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
            
            const promises = [
                d3.json('config.json'),
                d3.csv('data/sample-line-data.csv'),
                d3.csv('data/sample-bar-data.csv'),
                d3.csv('data/sample-pie-data.csv'),
                d3.json('data/countries-110m.json')
            ];

            const [config, lineData, barData, pieData, mapData] = await Promise.all(promises);
            
            console.log('Data loaded successfully:');
            console.log('- Config:', config);
            console.log('- Line data:', lineData);
            console.log('- Bar data:', barData);
            console.log('- Pie data:', pieData);
            console.log('- Map data (TopoJSON):', mapData);
            console.log('- Map data type:', mapData?.type);
            console.log('- Map objects:', mapData?.objects);
            
            this.config = config;
            this.data = {
                line: lineData,
                bar: barData,
                pie: pieData,
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
                debug: false
            })
            .onStepEnter((response) => {
                this.handleStepEnter(response);
            })
            .onStepExit((response) => {
                this.handleStepExit(response);
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
            const chartData = {
                ...stepConfig.chart,
                data: this.getChartData(stepConfig.chart.type, stepConfig.chart.dataFile)
            };
            pubsub.publish(EVENTS.CHART_UPDATE, chartData);
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
     * チャートデータを取得
     * @param {string} type - チャートタイプ
     * @param {string} dataFile - データファイル名
     * @returns {Array} チャートデータ
     */
    getChartData(type, dataFile) {
        // データファイル名からデータタイプを判定
        if (dataFile && dataFile.includes('line')) {
            return this.data.line;
        } else if (dataFile && dataFile.includes('bar')) {
            return this.data.bar;
        } else if (dataFile && dataFile.includes('pie')) {
            return this.data.pie;
        }
        
        // タイプベースのフォールバック
        switch (type) {
            case 'line':
                return this.data.line;
            case 'bar':
                return this.data.bar;
            case 'pie':
                return this.data.pie;
            default:
                return this.data.line || [];
        }
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