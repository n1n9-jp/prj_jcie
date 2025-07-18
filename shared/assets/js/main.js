/**
 * Main Application - Scrollytelling メインアプリケーション
 * scrollama.jsとPubSubを使用してスクロールイベントを管理
 */
class ScrollytellingApp {
    constructor() {
        this.scroller = null;
        this.chartManager = null;
        this.mapManager = null;
        this.config = null;
        this.data = {};
        
        this.init();
    }

    async init() {
        try {
            // データを読み込み
            await this.loadData();
            
            // マネージャーを初期化
            this.initManagers();
            
            // テキストポジションを事前適用（ちらつき防止）
            this.preApplyTextPositions();
            
            // スクロールを初期化（都市ステップ生成後）
            // DOM更新を待つため、次のティックで初期化
            setTimeout(() => {
                this.initScroller();
            }, 0);
            
            // リサイズイベントを設定
            this.initResizeHandler();
            
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('アプリケーションの初期化に失敗しました。');
        }
    }

    /**
     * データを読み込み
     */
    async loadData() {
        try {
            
            // 新しい設定システムを使用して設定を読み込む
            await window.ConfigLoader.loadAll();
            const config = window.ConfigLoader.getLegacyCompatibleConfig();
            
            // デバッグ情報を出力
            const env = window.ConfigLoader.getEnvironment();
            
            // cities-timeline.jsonを読み込む（感染症対応パス）
            const citiesDataPath = window.ConfigLoader.resolveDataPath('cities-timeline.json');
            const citiesData = await d3.json(citiesDataPath);
            
            // 設定から必要なデータファイルを抽出
            const dataFiles = new Set();
            config.steps.forEach(step => {
                if (step.chart?.dataFile) {
                    dataFiles.add(step.chart.dataFile);
                }
                // Dual chart の場合
                if (step.chart?.charts) {
                    step.chart.charts.forEach(chartConfig => {
                        if (chartConfig.dataFile) {
                            dataFiles.add(chartConfig.dataFile);
                        }
                    });
                }
                // Grid chart の場合
                if (step.chart?.config?.dataFile) {
                    dataFiles.add(step.chart.config.dataFile);
                }
            });
            
            
            // 動的にデータファイルを読み込む（感染症対応パス）
            const dataPromises = [
                ...Array.from(dataFiles).map(file => d3.csv(window.ConfigLoader.resolveDataPath(file))),
                d3.json(window.ConfigLoader.resolveDataPath('countries-110m.json'))
            ];
            
            const dataResults = await Promise.all(dataPromises);
            const mapData = dataResults.pop(); // 最後は地図データ
            
            // ファイル名でデータをマッピング（元のファイル名をキーとして使用）
            const csvData = {};
            Array.from(dataFiles).forEach((file, index) => {
                csvData[file] = dataResults[index];
            });
            
            this.config = config;
            this.data = {
                csv: csvData,
                map: mapData,
                cities: citiesData
            };
            
            // 都市ステップを動的に生成
            this.generateCitySteps(citiesData);

            pubsub.publish(EVENTS.DATA_LOADED, this.data);
            
        } catch (error) {
            console.error('Data loading failed:', error);
            pubsub.publish(EVENTS.DATA_ERROR, error);
            throw error;
        }
    }

    /**
     * 都市ステップを動的に生成
     * @param {Object} citiesData - cities-timeline.jsonのデータ
     */
    generateCitySteps(citiesData) {
        const container = document.getElementById('city-steps-container');
        if (!container) {
            console.error('City steps container not found');
            return;
        }
        
        // 感染症タイプを確認して都市ステップの開始番号を決定
        const diseaseType = window.DISEASE_TYPE || this.detectDiseaseFromURL();
        
        // 感染症別の都市ステップ開始番号
        const cityStepStart = {
            'aids': 11,        // AIDS: step11から開始
            'tuberculosis': 11, // 結核: step11から開始
            'malariae': 23     // マラリア: step23から開始
        };
        
        const startStep = cityStepStart[diseaseType] || 11;
        
        // 都市データから動的にHTMLを生成（全感染症対応）
        citiesData.cities.forEach((city, index) => {
            const stepIndex = startStep + index;
            const stepDiv = document.createElement('div');
            if (!stepDiv) {
                console.error('Failed to create step element');
                return;
            }
            stepDiv.className = 'step';
            stepDiv.setAttribute('data-step', stepIndex.toString());
            
            // 都市ステップの設定をconfigに追加
            const cityStepConfig = {
                id: `step${stepIndex}`,
                text: {
                    content: city.data.title,
                    visible: true,
                    position: {
                        width: "30%",
                        horizontal: "center",
                        vertical: "center"
                    }
                },
                chart: {
                    visible: false
                },
                map: {
                    visible: true,
                    mode: "single-city",
                    cityId: city.id,
                    center: [city.longitude, city.latitude],
                    zoom: 6,
                    citiesFile: "data/cities-timeline.json",
                    useRegionColors: true,
                    lightenNonVisited: true,
                    widthPercent: 100,
                    heightPercent: 100
                },
                image: {
                    visible: false
                }
            };
            
            // configに都市ステップを追加
            if (this.config && this.config.steps) {
                console.log(`🔧 Adding dynamic city step ${stepIndex} for ${city.id}:`, cityStepConfig);
                
                // 既存の同じstepがあるかチェック
                const existingStepIndex = this.config.steps.findIndex(step => step.id === `step${stepIndex}`);
                if (existingStepIndex !== -1) {
                    console.log(`⚠️ Replacing existing step${stepIndex} with dynamic config`);
                    this.config.steps[existingStepIndex] = cityStepConfig;
                } else {
                    this.config.steps.push(cityStepConfig);
                }
                
                console.log(`📋 Total steps after adding: ${this.config.steps.length}`);
            }
            
            try {
                stepDiv.innerHTML = `
                <div class="w-full min-h-screen flex items-center">
                    <div class="max-w-lg p-8 bg-white bg-opacity-90 rounded-lg shadow-lg">
                        ${city.data.thumbnail ? `
                        <div class="mb-6">
                            <img src="data/thumb/${city.data.thumbnail}" 
                                 alt="${city.data.title}" 
                                 class="w-full h-48 object-cover rounded-lg shadow-md">
                        </div>
                        ` : ''}
                        <h2 class="text-2xl font-bold mb-4">${city.data.title}</h2>
                        <p class="text-gray-700 leading-relaxed">
                            ${city.data.description}
                        </p>
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <p class="text-sm text-gray-600">
                                <span class="font-semibold">${this.getCountryNameJapanese(city.country)}</span> 
                                (${city.country})
                            </p>
                        </div>
                        ${city.data.url ? `
                        <div class="mt-4">
                            <a href="${city.data.url}" target="_blank" rel="noopener noreferrer" 
                               class="text-blue-600 hover:text-blue-800 text-sm underline">
                                詳しい記事を読む →
                            </a>
                        </div>
                        ` : ''}
                    </div>
                </div>
                `;
                
                container.appendChild(stepDiv);
            } catch (error) {
                console.error('Failed to set innerHTML for city step:', error);
                console.error('City data:', city);
            }
        });
        
    }

    /**
     * 国名を日本語に変換
     * @param {string} countryEn - 英語の国名
     * @returns {string} 日本語の国名
     */
    getCountryNameJapanese(countryEn) {
        return window.AppConstants?.getCountryNameJapanese(countryEn) || countryEn;
    }

    /**
     * マネージャーを初期化
     */
    initManagers() {
        
        // ColorSchemeを初期化
        if (!window.colorScheme && window.ColorScheme) {
            window.colorScheme = new ColorScheme();
        }
        
        this.chartManager = new ChartManager('#chart');
        this.mapManager = new MapManager('#map-container');
        this.imageManager = new ImageManager('#image-container');
        
        // 地図データを設定
        if (this.data.map) {
            this.mapManager.setGeoData(this.data.map);
        } else {
            console.error('No map data available for setting geo data');
        }
    }

    /**
     * スクローラーを初期化
     */
    initScroller() {
        this.scroller = scrollama();

        this.scroller
            .setup({
                step: '.step',
                offset: 0.5,
                progress: true,
                debug: false
            })
            .onStepEnter((response) => {
                this.handleStepEnter(response);
            })
            .onStepExit((response) => {
                this.handleStepExit(response);
            })
            .onStepProgress((response) => {
                this.handleStepProgress(response);
            });
    }

    /**
     * ステップ進入時の処理
     * @param {Object} response - scrollamaのレスポンス
     */
    handleStepEnter(response) {
        const { index, direction } = response;
        const stepConfig = this.config?.steps?.[index];
        
        console.log(`[SCROLLAMA DEBUG] Step detected: index=${index}, stepId=${stepConfig?.id || 'undefined'}, direction=${direction}`);
        
        if (!stepConfig) {
            console.warn(`No config found for step ${index}`);
            return;
        }


        // step18の詳細デバッグ（stepConfig.idで判定）
        if (stepConfig.id === 'step18') {
            // Debug information for step18 (removed for performance)
        }

        // チャート更新
        if (stepConfig.chart) {
            if (stepConfig.chart.layout === 'dual' && stepConfig.chart.charts) {
                // Dual chart の場合
                const dualChartData = {
                    ...stepConfig.chart,
                    charts: stepConfig.chart.charts.map(chartConfig => ({
                        ...chartConfig,
                        data: this.getChartData(chartConfig.type || 'line', chartConfig.dataFile)
                    }))
                };
                pubsub.publish(EVENTS.CHART_UPDATE, dualChartData);
            } else if (stepConfig.chart.layout === 'triple' && stepConfig.chart.charts) {
                // Triple chart の場合
                const tripleChartData = {
                    ...stepConfig.chart,
                    charts: stepConfig.chart.charts.map(chartConfig => ({
                        ...chartConfig,
                        data: this.getChartData('pie', chartConfig.dataFile)
                    }))
                };
                pubsub.publish(EVENTS.CHART_UPDATE, tripleChartData);
            } else if (stepConfig.chart.layout === 'grid' && stepConfig.chart.config) {
                // Grid chart の場合
                const gridChartData = {
                    ...stepConfig.chart,
                    data: this.getChartData('pie', stepConfig.chart.config.dataFile)
                };
                pubsub.publish(EVENTS.CHART_UPDATE, gridChartData);
            } else {
                // visible: false の場合は最小限の情報で非表示指示
                if (stepConfig.chart.visible === false) {
                    pubsub.publish(EVENTS.CHART_UPDATE, { visible: false });
                } else {
                    // 従来の単一チャート
                    let updateMode = stepConfig.chart.updateMode || 'replace';
                    
                    // 逆方向スクロールでトランジション対応を判定
                    if (direction === 'up') {
                        // 現在のstepから、次のstep（より大きいindex）を探す
                        const nextStepConfig = this.config?.steps?.[index + 1];
                        // 次のstepと同じデータファイル、かつ次のstepがtransitionモードの場合
                        if (nextStepConfig?.chart?.dataFile === stepConfig.chart.dataFile &&
                            nextStepConfig?.chart?.updateMode === 'transition') {
                            updateMode = 'transition';
                        }
                    }
                    
                    const chartData = {
                        ...stepConfig.chart,
                        data: this.getChartData(stepConfig.chart.type, stepConfig.chart.dataFile),
                        updateMode: updateMode,
                        direction: direction // スクロール方向を追加
                    };
                    pubsub.publish(EVENTS.CHART_UPDATE, chartData);
                }
            }
        } else {
            // チャート設定がない場合は明示的に非表示にする
            pubsub.publish(EVENTS.CHART_UPDATE, { visible: false });
        }

        // 地図更新
        if (stepConfig.map) {
            const mapData = {
                ...stepConfig.map,
                data: this.data.map
            };
            
            pubsub.publish(EVENTS.MAP_UPDATE, mapData);
        } else {
            // 地図設定がない場合は明示的に非表示にする
            pubsub.publish(EVENTS.MAP_UPDATE, { visible: false });
        }

        // 画像更新
        if (stepConfig.image) {
            pubsub.publish(EVENTS.IMAGE_UPDATE, stepConfig.image);
        } else {
            // 画像設定がない場合は明示的に非表示にする
            pubsub.publish(EVENTS.IMAGE_UPDATE, { visible: false });
        }

        // フッター更新
        if (stepConfig.footer) {
            this.renderFooter(stepConfig.footer);
        }

        // コンテンツポジション設定を適用
        this.applyStepPositioning(stepConfig, index);
        
        // テキストポジション設定を適用
        this.applyTextPositioning(stepConfig, index);

        // ステップ進入イベントを発行
        pubsub.publish(EVENTS.STEP_ENTER, { index, direction, config: stepConfig });
    }

    /**
     * ステップ退出時の処理
     * @param {Object} response - scrollamaのレスポンス
     */
    handleStepExit(response) {
        const { index, direction } = response;
        
        
        // ステップ退出イベントを発行
        pubsub.publish(EVENTS.STEP_EXIT, { index, direction });
    }

    /**
     * ステップ進行度変化時の処理
     * @param {Object} response - scrollamaのレスポンス
     */
    handleStepProgress(response) {
        const { index, progress, direction } = response;
        const stepConfig = this.config?.steps?.[index];
        
        if (!stepConfig) {
            return;
        }


        // 都市タイムラインモードの場合のみ進行度イベントを発行
        if (stepConfig.map?.mode === "cities-timeline") {
            pubsub.publish(EVENTS.MAP_PROGRESS, {
                progress: progress,
                direction: direction,
                config: stepConfig.map
            });
        }

        // ステップ進行度イベントを発行
        pubsub.publish(EVENTS.STEP_PROGRESS, { index, progress, direction, config: stepConfig });
    }

    /**
     * チャートデータを取得
     * @param {string} type - チャートタイプ
     * @param {string} dataFile - データファイル名
     * @returns {Array} チャートデータ
     */
    getChartData(type, dataFile) {
        // 新しいデータ構造から指定されたファイルのデータを取得
        if (dataFile && this.data.csv && this.data.csv[dataFile]) {
            const data = this.data.csv[dataFile];
            // Special handling for africa_young data files (debug info removed)
            return data;
        }
        
        console.warn(`Data file not found: ${dataFile}`);
        return [];
    }

    /**
     * リサイズハンドラーを初期化
     */
    initResizeHandler() {
        let resizeTimeout;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
    }

    /**
     * リサイズ処理
     */
    handleResize() {
        // Handle window resize events
        
        // スクローラーをリサイズ
        if (this.scroller) {
            this.scroller.resize();
        }
        
        // リサイズイベントを発行
        pubsub.publish(EVENTS.RESIZE);
    }

    /**
     * エラー表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    /**
     * フッター表示stepを動的に決定
     * @returns {string} フッター表示step番号
     */
    determineFooterStep() {
        // 1. 設定ファイルからフッターstepを探す（最優先）
        if (this.config && this.config.steps) {
            for (let i = 0; i < this.config.steps.length; i++) {
                const step = this.config.steps[i];
                if (step.footer && step.footer.visible) {
                    // step{番号}からdata-step用の番号を抽出
                    const stepNumber = step.id.replace('step', '');
                    console.log(`Footer step found in config: ${stepNumber}`);
                    return stepNumber;
                }
            }
        }
        
        // 2. HTMLから最後のstepを探す
        const allSteps = document.querySelectorAll('.step[data-step]');
        if (allSteps.length > 0) {
            const lastStep = allSteps[allSteps.length - 1];
            const lastStepNumber = lastStep.getAttribute('data-step');
            console.log(`Footer step detected from HTML: ${lastStepNumber}`);
            return lastStepNumber;
        }
        
        // 3. 感染症別フォールバック値
        const diseaseType = window.DISEASE_TYPE || this.detectDiseaseFromURL();
        const diseaseFooterSteps = {
            'aids': '25',           // 01_aids: step11-17(7都市) + step25(フッター)
            'malariae': '32',       // 03_malariae: step22-26(5都市) + step32(フッター)
            'tuberculosis': '30'    // 02_tuberculosis（仮値、将来調整予定）
        };
        
        if (diseaseFooterSteps[diseaseType]) {
            console.log(`Footer step fallback for ${diseaseType}: ${diseaseFooterSteps[diseaseType]}`);
            return diseaseFooterSteps[diseaseType];
        }
        
        // 4. 最終フォールバック
        console.log('Footer step using final fallback: 25');
        return '25';
    }

    /**
     * URLから感染症タイプを検出（フォールバック用）
     * @returns {string} 感染症タイプ
     */
    detectDiseaseFromURL() {
        const pathname = window.location.pathname;
        if (pathname.includes('01_aids')) return 'aids';
        if (pathname.includes('02_tuberculosis')) return 'tuberculosis';
        if (pathname.includes('03_malariae')) return 'malariae';
        return 'aids'; // デフォルト
    }

    /**
     * フッターを描画
     * @param {Object} footerConfig - フッター設定
     */
    renderFooter(footerConfig) {
        if (!footerConfig.visible) {
            return;
        }

        // フッター表示stepを動的に決定
        const footerStepNumber = this.determineFooterStep();
        const stepElement = document.querySelector(`[data-step="${footerStepNumber}"]`);
        if (!stepElement) {
            console.warn('Footer step element not found');
            return;
        }

        // step25の子要素（コンテナdiv）を取得
        const containerDiv = stepElement.querySelector('div');
        if (!containerDiv) {
            console.warn('Footer container div not found');
            return;
        }

        // 既存のフッター要素を削除
        const existingFooter = containerDiv.querySelector('.site-footer');
        if (existingFooter) {
            existingFooter.remove();
        }

        // フッター要素を作成
        const footer = document.createElement('footer');
        if (!footer) {
            console.error('Failed to create footer element');
            return;
        }
        footer.className = 'site-footer';
        
        try {
            footer.innerHTML = `
            <div class="footer-container">
                <div class="footer-content">
                    <div class="footer-section">
                        <div class="footer-logo">
                            <img src="assets/images/fgfj-logo-horizontal-white.svg" alt="公益財団法人 日本国際交流センター">
                        </div>
                        <p class="footer-tagline">&nbsp;</p>
                    </div>

                    <div class="footer-section">
                        <div class="footer-address">
                            〒107-0052 東京都港区赤坂1-1-12 明産溜池ビル7F (公財)日本国際交流センター 内
                        </div>
                        <div class="footer-contact">
                            <div class="contact-item">
                                <span>Email</span>fgfj&lt;at&gt;jcie.or.jp (&lt;at&gt;を@に変更してお送りください)
                            </div>
                            <div class="contact-item">
                                <span>TEL</span>03-6277-7811 (代)
                            </div>
                            <div class="contact-item">
                                <span>FAX</span>03-6277-6712
                            </div>
                        </div>
                    </div>
                    
                </div>
                
                <div class="footer-copyright">
                    © Japan Center for International Exchange. All rights reserved.
                </div>
            </div>
            `;

            containerDiv.appendChild(footer);
        } catch (error) {
            console.error('Failed to set innerHTML for footer:', error);
        }
    }

    /**
     * ステップのコンテンツポジション設定を適用
     * @param {Object} stepConfig - ステップ設定
     * @param {number} stepIndex - ステップインデックス
     */
    applyStepPositioning(stepConfig, stepIndex) {
        if (!window.PositionManager) {
            console.warn('PositionManager not available, skipping positioning');
            return;
        }

        // チャートポジション設定
        if (stepConfig.chart && stepConfig.chart.visible !== false) {
            this.applyChartPositioning(stepConfig.chart, stepIndex);
        } else {
            // チャートが存在しないまたは非表示の場合、chart-containerと#chartを非表示にする
            const chartContainer = document.getElementById('chart-container');
            const chartElement = document.getElementById('chart');
            if (chartContainer) {
                chartContainer.classList.remove('visible');
            }
            if (chartElement) {
                chartElement.classList.remove('visible');
            }
        }

        // 地図ポジション設定
        if (stepConfig.map && stepConfig.map.visible !== false) {
            this.applyMapPositioning(stepConfig.map, stepIndex);
        }

        // 画像ポジション設定
        if (stepConfig.image && stepConfig.image.visible !== false) {
            this.applyImagePositioning(stepConfig.image, stepIndex);
        }

        // 複数コンテンツの場合の調整
        this.adjustMultiContentPositioning(stepConfig, stepIndex);
    }

    /**
     * チャートのポジション設定を適用
     * @param {Object} chartConfig - チャート設定
     * @param {number} stepIndex - ステップインデックス
     */
    applyChartPositioning(chartConfig, stepIndex) {
        const container = document.getElementById('chart-container');
        if (!container) {
            console.warn('Chart container not found');
            return;
        }

        // チャートが表示される場合、chart-containerにvisibleクラスを追加
        if (chartConfig.visible !== false) {
            container.classList.add('visible');
        } else {
            container.classList.remove('visible');
        }

        // ポジション設定を取得
        const positionConfig = PositionManager.mergePositionConfig(
            chartConfig.position || {},
            'chart'
        );

        // バリデーション
        const validation = PositionManager.validatePositionConfig(positionConfig);
        if (!validation.valid) {
            console.error('Invalid chart position config:', validation.errors);
            return;
        }

        if (validation.warnings.length > 0) {
            console.warn('Chart position warnings:', validation.warnings);
        }

        // ポジション適用
        PositionManager.applyPosition(container, positionConfig, {
            responsive: true,
            debugMode: true  // チャートのデバッグモードを有効化
        });

        
        // Debug information removed for performance
    }

    /**
     * 地図のポジション設定を適用
     * @param {Object} mapConfig - 地図設定
     * @param {number} stepIndex - ステップインデックス
     */
    applyMapPositioning(mapConfig, stepIndex) {
        const container = document.getElementById('map-container');
        if (!container) {
            console.warn('Map container not found');
            return;
        }

        // ポジション設定を取得
        const positionConfig = PositionManager.mergePositionConfig(
            mapConfig.position || {},
            'map'
        );

        // バリデーション
        const validation = PositionManager.validatePositionConfig(positionConfig);
        if (!validation.valid) {
            console.error('Invalid map position config:', validation.errors);
            return;
        }

        // ポジション適用
        PositionManager.applyPosition(container, positionConfig, {
            responsive: true,
            debugMode: false
        });

    }

    /**
     * 画像のポジション設定を適用
     * @param {Object} imageConfig - 画像設定
     * @param {number} stepIndex - ステップインデックス
     */
    applyImagePositioning(imageConfig, stepIndex) {
        const container = document.getElementById('image-container');
        if (!container) {
            console.warn('Image container not found');
            return;
        }

        // ポジション設定を取得
        const positionConfig = PositionManager.mergePositionConfig(
            imageConfig.position || {},
            'image'
        );

        // バリデーション
        const validation = PositionManager.validatePositionConfig(positionConfig);
        if (!validation.valid) {
            console.error('Invalid image position config:', validation.errors);
            return;
        }

        // ポジション適用
        PositionManager.applyPosition(container, positionConfig, {
            responsive: true,
            debugMode: false
        });

        
        // Debug information for image element styles (removed for performance)
    }

    /**
     * 複数コンテンツの位置調整
     * @param {Object} stepConfig - ステップ設定
     * @param {number} stepIndex - ステップインデックス
     */
    adjustMultiContentPositioning(stepConfig, stepIndex) {
        const visibleContents = [];

        // 表示されているコンテンツを収集
        if (stepConfig.chart && stepConfig.chart.visible !== false) {
            visibleContents.push({
                type: 'chart',
                element: document.getElementById('chart-container'),
                config: stepConfig.chart.position || {}
            });
        }

        if (stepConfig.map && stepConfig.map.visible !== false) {
            visibleContents.push({
                type: 'map',
                element: document.getElementById('map-container'),
                config: stepConfig.map.position || {}
            });
        }

        if (stepConfig.image && stepConfig.image.visible !== false) {
            visibleContents.push({
                type: 'image',
                element: document.getElementById('image-container'),
                config: stepConfig.image.position || {}
            });
        }

        // 複数コンテンツが表示される場合の調整
        if (visibleContents.length > 1) {
            // Multiple content layout adjustment

            // z-indexの調整
            visibleContents.forEach((content, index) => {
                if (content.element) {
                    content.element.style.zIndex = 1 + index;
                }
            });

            // レイアウトの競合チェック
            this.checkLayoutConflicts(visibleContents, stepIndex);
        }
    }

    /**
     * レイアウト競合をチェック
     * @param {Array} visibleContents - 表示コンテンツリスト
     * @param {number} stepIndex - ステップインデックス
     */
    checkLayoutConflicts(visibleContents, stepIndex) {
        const positions = visibleContents.map(content => ({
            type: content.type,
            horizontal: content.config.horizontal || 'center',
            vertical: content.config.vertical || 'center'
        }));

        // 同じ位置にあるコンテンツをチェック
        const conflicts = [];
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                if (positions[i].horizontal === positions[j].horizontal &&
                    positions[i].vertical === positions[j].vertical) {
                    conflicts.push({
                        content1: positions[i].type,
                        content2: positions[j].type,
                        position: `${positions[i].horizontal}-${positions[i].vertical}`
                    });
                }
            }
        }

        if (conflicts.length > 0) {
            console.warn(`Layout conflicts detected in step ${stepIndex}:`, conflicts);
            console.warn('Consider using different positions or adjusting z-index values');
        }
    }

    /**
     * テキストのポジション設定を適用
     * @param {Object} stepConfig - ステップ設定
     * @param {number} stepIndex - ステップインデックス
     */
    applyTextPositioning(stepConfig, stepIndex) {
        if (!window.PositionManager) {
            console.warn('PositionManager not available, skipping text positioning');
            return;
        }

        // step0（表紙）は特別な構造なのでテキストポジショニングを適用しない
        if (stepConfig.id === 'step0' || stepIndex === 0) {
            return;
        }

        // 現在のステップ要素を取得
        let stepElement = document.querySelector(`[data-step="${stepConfig.id}"]`) ||
                         document.querySelector(`[data-step="${stepConfig.id.replace(/^step/, '')}"]`) ||
                         document.querySelector(`[data-step="${stepIndex}"]`);
        
        if (!stepElement) {
            console.warn(`Step element not found for step ${stepConfig.id} (index ${stepIndex})`);
            return;
        }

        // テキストの表示/非表示をチェック
        if (stepConfig.text && stepConfig.text.visible === false) {
            this.hideTextBox(stepElement);
            return;
        }


        // テキストポジション設定があるかチェック
        if (stepConfig.text && stepConfig.text.position) {
            // Text position configuration found

            // ポジション設定を取得・マージ
            const positionConfig = PositionManager.mergePositionConfig(
                stepConfig.text.position,
                'text'
            );

            // バリデーション
            const validation = PositionManager.validatePositionConfig(positionConfig);
            if (!validation.valid) {
                console.error('Invalid text position config:', validation.errors);
                return;
            }

            if (validation.warnings.length > 0) {
                console.warn('Text position warnings:', validation.warnings);
            }

            // 他のコンテンツとの組み合わせクラスを追加
            this.addContentCombinationClasses(stepElement, stepConfig);

            // テキストポジション適用
            PositionManager.applyTextPosition(stepElement, positionConfig, {
                responsive: true,
                debugMode: true // デバッグモードを有効に
            });

        } else {
            // テキストポジション設定がない場合はデフォルト（中央）
            this.resetTextPosition(stepElement);
        }
    }

    /**
     * 他のコンテンツとの組み合わせに応じたクラスを追加
     * @param {HTMLElement} stepElement - ステップ要素
     * @param {Object} stepConfig - ステップ設定
     */
    addContentCombinationClasses(stepElement, stepConfig) {
        // 既存の組み合わせクラスをリセット
        const combinationClasses = [
            'has-chart-left', 'has-chart-right', 'has-chart-center',
            'has-map-left', 'has-map-right', 'has-map-center',
            'has-image-left', 'has-image-right', 'has-image-center'
        ];
        stepElement.classList.remove(...combinationClasses);

        // チャートがある場合
        if (stepConfig.chart && stepConfig.chart.visible !== false) {
            const chartPosition = stepConfig.chart.position?.horizontal || 'center';
            stepElement.classList.add(`has-chart-${chartPosition}`);
        }

        // 地図がある場合
        if (stepConfig.map && stepConfig.map.visible !== false) {
            const mapPosition = stepConfig.map.position?.horizontal || 'center';
            stepElement.classList.add(`has-map-${mapPosition}`);
        }

        // 画像がある場合
        if (stepConfig.image && stepConfig.image.visible !== false) {
            const imagePosition = stepConfig.image.position?.horizontal || 'center';
            stepElement.classList.add(`has-image-${imagePosition}`);
        }
    }

    /**
     * テキストポジションをリセット
     * @param {HTMLElement} stepElement - ステップ要素
     */
    resetTextPosition(stepElement) {
        if (!stepElement || !window.PositionManager) return;

        PositionManager.resetTextClasses(stepElement);
        
        // 組み合わせクラスもリセット
        const combinationClasses = [
            'has-chart-left', 'has-chart-right', 'has-chart-center',
            'has-map-left', 'has-map-right', 'has-map-center',
            'has-image-left', 'has-image-right', 'has-image-center'
        ];
        stepElement.classList.remove(...combinationClasses);
    }

    /**
     * 全コンテンツのポジションをリセット
     */
    resetAllPositions() {
        if (!window.PositionManager) return;

        // コンテンツコンテナのリセット
        const containers = [
            document.getElementById('chart-container'),
            document.getElementById('map-container'),
            document.getElementById('image-container')
        ];

        containers.forEach(container => {
            if (container) {
                PositionManager.resetContainerClasses(container);
                // デフォルトスタイルに戻す
                container.style.cssText = '';
                container.className = container.className.replace(/content-\w+/g, '');
            }
        });

        // テキストポジションのリセット
        const steps = document.querySelectorAll('.step');
        steps.forEach(step => {
            this.resetTextPosition(step);
        });

    }

    /**
     * テキストポジションを事前適用（ちらつき防止）
     */
    preApplyTextPositions() {
        if (!window.PositionManager || !this.config?.steps) {
            return;
        }

        // Pre-apply text positions to prevent flickering
        
        this.config.steps.forEach((stepConfig, stepIndex) => {
            if (stepConfig.text && stepConfig.text.visible === false) {
                // 非表示設定の場合
                let stepElement = document.querySelector(`[data-step="${stepConfig.id}"]`) ||
                               document.querySelector(`[data-step="${stepConfig.id.replace(/^step/, '')}"]`) ||
                               document.querySelector(`[data-step="${stepIndex}"]`);
                
                if (stepElement) {
                    this.hideTextBox(stepElement);
                }
            } else if (stepConfig.text && stepConfig.text.position) {
                // 通常のポジション適用
                let stepElement = document.querySelector(`[data-step="${stepConfig.id}"]`) ||
                               document.querySelector(`[data-step="${stepConfig.id.replace(/^step/, '')}"]`) ||
                               document.querySelector(`[data-step="${stepIndex}"]`);
                
                if (stepElement) {
                    // フルのテキストポジションを適用（白い矩形の位置制御も含む）
                    this.applyTextPositioning(stepConfig, stepIndex);
                }
            }
        });
    }


    /**
     * テキストボックス（白い矩形）を非表示にする
     * @param {HTMLElement} stepElement - ステップ要素
     */
    hideTextBox(stepElement) {
        if (!stepElement) return;
        
        // ステップ内の白い矩形（テキストコンテナ）を非表示にする
        const textContainers = stepElement.querySelectorAll('.max-w-lg, .text-container, [class*="bg-white"]');
        textContainers.forEach(container => {
            container.style.display = 'none';
        });
        
        // Add debug class for hidden text
        stepElement.classList.add('text-hidden');
        
    }

    /**
     * テキストボックスを再表示する
     * @param {HTMLElement} stepElement - ステップ要素
     */
    showTextBox(stepElement) {
        if (!stepElement) return;
        
        // ステップ内の白い矩形（テキストコンテナ）を再表示する
        const textContainers = stepElement.querySelectorAll('.max-w-lg, .text-container, [class*="bg-white"]');
        textContainers.forEach(container => {
            container.style.display = '';
        });
        
        // Remove debug class for visible text
        stepElement.classList.remove('text-hidden');
        
    }


}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.ScrollytellingApp = ScrollytellingApp;

// DOMContentLoaded後にアプリケーションを開始
document.addEventListener('DOMContentLoaded', () => {
    // 診断モードでは自動初期化をスキップ
    if (window.DIAGNOSIS_MODE) {
        console.log('📋 Diagnosis Mode: ScrollytellingApp auto-initialization skipped');
        return;
    }
    
    window.app = new ScrollytellingApp();
});

// デバッグ用のグローバル関数
window.debugScrollytelling = {
    getApp: () => window.app,
    getConfig: () => window.app?.config,
    getData: () => window.app?.data,
    getScroller: () => window.app?.scroller,
    triggerResize: () => window.app?.handleResize(),
    
    // ステップを手動でトリガー
    triggerStep: (index) => {
        const stepConfig = window.app?.config?.steps?.[index];
        if (stepConfig) {
            window.app.handleStepEnter({ index, direction: 'down' });
        } else {
            console.error(`Debug: No step config found for index ${index}`);
        }
    },
    
    // 地図を表示するステップ（step2）をトリガー
    showMap: () => {
        window.debugScrollytelling.triggerStep(2);
    },
    
    // チャートを手動で更新
    updateChart: (type, visible = true) => {
        const chartData = {
            type,
            visible,
            data: window.app?.getChartData(type),
            config: { width: 600, height: 400 }
        };
        pubsub.publish(EVENTS.CHART_UPDATE, chartData);
    },
    
    // 地図を手動で更新
    updateMap: (center = [0, 0], zoom = 1, visible = true) => {
        const mapData = {
            center,
            zoom,
            visible,
            data: window.app?.data?.map
        };
        pubsub.publish(EVENTS.MAP_UPDATE, mapData);
    },
    
    // 地図マネージャーの状態を確認
    checkMapManager: () => {
        const mapManager = window.app?.mapManager;
        return mapManager;
    },
    
    // データ読み込み状況を確認
    checkDataLoading: () => {
        return window.app?.data;
    }
};