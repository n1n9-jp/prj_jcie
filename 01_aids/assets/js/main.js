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
            
            // スクロールを初期化（都市ステップ生成後）
            // DOM更新を待つため、次のティックで初期化
            setTimeout(() => {
                this.initScroller();
            }, 0);
            
            // リサイズイベントを設定
            this.initResizeHandler();
            
            console.log('Scrollytelling app initialized successfully');
            
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
            console.log('Starting data loading...');
            
            // 設定ファイルを最初に読み込む
            const config = await d3.json('config.json');
            console.log('Config loaded:', config);
            
            // cities-timeline.jsonを読み込む
            const citiesData = await d3.json('data/cities-timeline.json');
            console.log('Cities timeline data loaded:', citiesData);
            
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
            });
            
            console.log('Data files to load:', Array.from(dataFiles));
            
            // 動的にデータファイルを読み込む
            const dataPromises = [
                ...Array.from(dataFiles).map(file => d3.csv(file)),
                d3.json('data/countries-110m.json')
            ];
            
            const dataResults = await Promise.all(dataPromises);
            const mapData = dataResults.pop(); // 最後は地図データ
            
            // ファイル名でデータをマッピング
            const csvData = {};
            Array.from(dataFiles).forEach((file, index) => {
                csvData[file] = dataResults[index];
                console.log(`Loaded ${file}:`, dataResults[index].slice(0, 2));
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
        
        // 都市データから動的にHTMLを生成
        citiesData.cities.forEach((city, index) => {
            const stepIndex = 9 + index; // step9から開始
            const stepDiv = document.createElement('div');
            stepDiv.className = 'step';
            stepDiv.setAttribute('data-step', stepIndex.toString());
            
            stepDiv.innerHTML = `
                <div class="w-full min-h-screen flex items-center">
                    <div class="max-w-lg mx-auto p-8 bg-white bg-opacity-90 rounded-lg shadow-lg">
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
                                <span class="font-semibold">${city.name}</span> 
                                (${city.nameEn}), ${city.country}
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
                        <div id="geographic-info-${stepIndex}" class="text-sm text-gray-500 border-t pt-3 mt-4" style="display: none;"></div>
                    </div>
                </div>
            `;
            
            container.appendChild(stepDiv);
        });
        
        console.log(`Generated ${citiesData.cities.length} city steps`);
    }

    /**
     * マネージャーを初期化
     */
    initManagers() {
        console.log('Initializing managers...');
        this.chartManager = new ChartManager('#chart-container');
        this.mapManager = new MapManager('#map-container');
        this.imageManager = new ImageManager('#image-container');
        
        // 地図データを設定
        console.log('Setting geo data...');
        console.log('Map data available:', !!this.data.map);
        if (this.data.map) {
            console.log('Calling mapManager.setGeoData()');
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
        
        if (!stepConfig) {
            console.warn(`No config found for step ${index}`);
            return;
        }

        console.log(`Entering step ${index} (direction: ${direction})`, stepConfig);

        // チャート更新
        if (stepConfig.chart) {
            if (stepConfig.chart.layout === 'dual' && stepConfig.chart.charts) {
                // Dual chart の場合
                const dualChartData = {
                    ...stepConfig.chart,
                    charts: stepConfig.chart.charts.map(chartConfig => ({
                        ...chartConfig,
                        data: this.getChartData('line', chartConfig.dataFile)
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
                        console.log(`Using transition mode for reverse scroll from step ${index + 1} to ${index}`);
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

        // 地図更新
        if (stepConfig.map) {
            console.log('Step has map config:', stepConfig.map);
            const mapData = {
                ...stepConfig.map,
                data: this.data.map
            };
            console.log('Publishing MAP_UPDATE event with data:', mapData);
            console.log('Map data available:', !!this.data.map);
            console.log('Map data type:', this.data.map?.type);
            pubsub.publish(EVENTS.MAP_UPDATE, mapData);
        } else {
            console.log('Step has no map config');
        }

        // 画像更新
        if (stepConfig.image) {
            pubsub.publish(EVENTS.IMAGE_UPDATE, stepConfig.image);
        }

        // コンテンツポジション設定を適用
        this.applyStepPositioning(stepConfig, index);

        // ステップ進入イベントを発行
        pubsub.publish(EVENTS.STEP_ENTER, { index, direction, config: stepConfig });
    }

    /**
     * ステップ退出時の処理
     * @param {Object} response - scrollamaのレスポンス
     */
    handleStepExit(response) {
        const { index, direction } = response;
        
        console.log(`Exiting step ${index}`);
        
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
            console.log('Main: No step config for index', index);
            return;
        }

        console.log(`Main: Step ${index} progress: ${(progress * 100).toFixed(1)}%, direction: ${direction}`);

        // 都市タイムラインモードの場合のみ進行度イベントを発行
        if (stepConfig.map?.mode === "cities-timeline") {
            console.log(`Main: Publishing MAP_PROGRESS for cities timeline`);
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
            console.log(`Returning data for ${dataFile}:`, this.data.csv[dataFile].slice(0, 2));
            return this.data.csv[dataFile];
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
        console.log('Window resized');
        
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
     * ステップのコンテンツポジション設定を適用
     * @param {Object} stepConfig - ステップ設定
     * @param {number} stepIndex - ステップインデックス
     */
    applyStepPositioning(stepConfig, stepIndex) {
        if (!window.PositionManager) {
            console.warn('PositionManager not available, skipping positioning');
            return;
        }

        console.log(`Applying positioning for step ${stepIndex}:`, stepConfig);

        // チャートポジション設定
        if (stepConfig.chart && stepConfig.chart.visible !== false) {
            this.applyChartPositioning(stepConfig.chart, stepIndex);
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

        console.log(`Applied chart positioning for step ${stepIndex}:`, positionConfig);
        
        // デバッグ用：実際のコンテナクラスとスタイルを確認
        console.log(`Chart container classes:`, Array.from(container.classList));
        console.log(`Chart container styles:`, {
            position: container.style.position,
            justifyContent: window.getComputedStyle(container).justifyContent,
            alignItems: window.getComputedStyle(container).alignItems,
            width: container.style.width,
            height: container.style.height
        });
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

        console.log(`Applied map positioning for step ${stepIndex}:`, positionConfig);
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

        console.log(`Applied image positioning for step ${stepIndex}:`, positionConfig);
        
        // デバッグ用：実際の要素スタイルを確認
        const imgElement = container.querySelector('#image');
        if (imgElement) {
            console.log(`Image element styles:`, {
                containerWidth: container.style.width,
                containerHeight: container.style.height,
                imgWidth: imgElement.style.width,
                imgHeight: imgElement.style.height,
                objectFit: imgElement.style.objectFit
            });
        }
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
            console.log(`Adjusting multi-content layout for step ${stepIndex}:`, visibleContents.map(c => c.type));

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
     * 全コンテンツのポジションをリセット
     */
    resetAllPositions() {
        if (!window.PositionManager) return;

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

        console.log('All content positions reset to default');
    }
}

// DOMContentLoaded後にアプリケーションを開始
document.addEventListener('DOMContentLoaded', () => {
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
        console.log(`Debug: Triggering step ${index}`);
        const stepConfig = window.app?.config?.steps?.[index];
        if (stepConfig) {
            console.log(`Debug: Step config found:`, stepConfig);
            window.app.handleStepEnter({ index, direction: 'down' });
        } else {
            console.error(`Debug: No step config found for index ${index}`);
        }
    },
    
    // 地図を表示するステップ（step2）をトリガー
    showMap: () => {
        console.log('Debug: Showing map (triggering step 2)');
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
        console.log('Debug: Manual map update:', { center, zoom, visible });
        const mapData = {
            center,
            zoom,
            visible,
            data: window.app?.data?.map
        };
        console.log('Debug: Map data being sent:', mapData);
        pubsub.publish(EVENTS.MAP_UPDATE, mapData);
    },
    
    // 地図マネージャーの状態を確認
    checkMapManager: () => {
        const mapManager = window.app?.mapManager;
        console.log('Debug: Map manager:', mapManager);
        console.log('Debug: Geo data:', mapManager?.geoData);
        console.log('Debug: Current view:', mapManager?.currentView);
        return mapManager;
    },
    
    // データ読み込み状況を確認
    checkDataLoading: () => {
        console.log('Debug: App data:', window.app?.data);
        console.log('Debug: Map data type:', window.app?.data?.map?.type);
        console.log('Debug: Map objects:', window.app?.data?.map?.objects);
        return window.app?.data;
    }
};