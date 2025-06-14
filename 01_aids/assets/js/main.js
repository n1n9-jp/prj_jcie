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
            
            // スクロールを初期化
            this.initScroller();
            
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
                map: mapData
            };

            pubsub.publish(EVENTS.DATA_LOADED, this.data);
            
        } catch (error) {
            console.error('Data loading failed:', error);
            pubsub.publish(EVENTS.DATA_ERROR, error);
            throw error;
        }
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

        console.log(`Entering step ${index}`, stepConfig);

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
            } else {
                // 従来の単一チャート
                const chartData = {
                    ...stepConfig.chart,
                    data: this.getChartData(stepConfig.chart.type, stepConfig.chart.dataFile)
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