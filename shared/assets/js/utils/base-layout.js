/**
 * BaseLayout - 全レイアウトタイプの統合基底クラス
 *
 * Dual/Triple/Single レイアウトの共通処理を提供
 * 以前の DualLayout/TripleLayout は本クラスに統合
 */
class BaseLayout {
    /**
     * コンストラクタ
     * @param {string} containerId - コンテナID
     * @param {string} layoutType - レイアウトタイプ ('dual', 'triple', 'single', 'grid')
     */
    constructor(containerId, layoutType = 'single') {
        this.containerId = containerId;
        this.layoutType = layoutType;
        this.container = null;
        this.svg = null;
        this.config = null;
        this.isInitialized = false;

        // レイアウト設定を取得
        const resolvedType = layoutType || 'single';
        this.layoutDefaults = LayoutConfig.getLayoutConfig(resolvedType);

        // チャート管理
        this.charts = [];
        this.chartContainers = [];
        this.chartCount = this.getChartCountForType(layoutType);
    }

    /**
     * レイアウトタイプに応じた期待チャート数を取得
     * @param {string} layoutType - レイアウトタイプ
     * @returns {number} 期待されるチャート数
     */
    getChartCountForType(layoutType) {
        switch(layoutType) {
            case 'dual':
                return 2;
            case 'triple':
                return 3;
            case 'grid':
                return -1; // 可変
            default:
                return 1;
        }
    }

    /**
     * 初期化
     */
    init() {
        try {
            // コンテナを取得または作成
            this.container = d3.select(this.containerId);
            if (this.container.empty()) {
                console.error(`BaseLayout: Container '${this.containerId}' not found`);
                return false;
            }

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('BaseLayout: Initialization error:', error);
            return false;
        }
    }

    /**
     * SVGを作成または更新
     * @param {Object} dimensions - 寸法設定
     * @returns {Object} D3 SVG selection
     */
    createOrUpdateSVG(dimensions) {
        const { width, height } = dimensions;

        // 既存のSVGをチェック
        let svg = this.container.select('svg');
        
        if (svg.empty()) {
            // 新規作成
            svg = this.container.append('svg');
        }

        // SVGHelperを使用して初期化
        if (window.SVGHelper) {
            return SVGHelper.initSVG(this.container, width, height, {
                className: `${this.layoutType}-layout-svg`,
                responsive: true,
                preserveAspectRatio: 'xMidYMid meet'
            });
        } else {
            // フォールバック
            svg.attr('width', width)
               .attr('height', height)
               .attr('viewBox', `0 0 ${width} ${height}`)
               .attr('preserveAspectRatio', 'xMidYMid meet')
               .classed(`${this.layoutType}-layout-svg`, true);
            
            return svg;
        }
    }

    /**
     * レイアウトサイズを計算
     * @param {Object} config - 設定
     * @returns {Object} 計算されたサイズ
     */
    calculateLayoutSize(config = {}) {
        const containerNode = this.container.node();
        const containerWidth = containerNode.offsetWidth || 800;
        const containerHeight = containerNode.offsetHeight || 600;

        // position設定から計算
        if (config.position) {
            return LayoutConfig.calculateLayoutPosition(config.position, {
                containerWidth,
                containerHeight
            });
        }

        // デフォルト計算
        const defaults = this.layoutDefaults;
        let width = containerWidth;
        let height = containerHeight;

        // 最小・最大制約を適用
        if (defaults.minWidth) {
            width = Math.max(width, defaults.minWidth);
        }
        if (defaults.maxWidth) {
            width = Math.min(width, defaults.maxWidth);
        }
        if (defaults.minHeight) {
            height = Math.max(height, defaults.minHeight);
        }
        if (defaults.maxHeight) {
            height = Math.min(height, defaults.maxHeight);
        }

        // アスペクト比を考慮
        if (config.aspectRatio || defaults.aspectRatio) {
            const aspectRatio = config.aspectRatio || defaults.aspectRatio;
            const calculatedHeight = width / aspectRatio;
            
            if (calculatedHeight <= height) {
                height = calculatedHeight;
            } else {
                width = height * aspectRatio;
            }
        }

        return {
            x: 0,
            y: 0,
            width: Math.floor(width),
            height: Math.floor(height)
        };
    }

    /**
     * レスポンシブサイズを取得
     * @param {Object} config - 設定
     * @returns {Object} レスポンシブサイズ
     */
    getResponsiveSize(config = {}) {
        if (window.SVGHelper) {
            return SVGHelper.getResponsiveSize(this.container, {
                defaultWidth: this.layoutDefaults.minWidth || 800,
                defaultHeight: this.layoutDefaults.minHeight || 600,
                widthPercent: config.widthPercent,
                heightPercent: config.heightPercent,
                aspectRatio: config.aspectRatio || this.layoutDefaults.aspectRatio
            });
        }

        // フォールバック
        return this.calculateLayoutSize(config);
    }

    /**
     * マージン付きの内部サイズを計算
     * @param {Object} totalSize - 全体サイズ
     * @param {Object} margin - マージン設定
     * @returns {Object} 内部サイズ
     */
    getInnerSize(totalSize, margin) {
        const defaultMargin = this.layoutDefaults.margin || 
                            { top: 20, right: 20, bottom: 20, left: 20 };
        
        const finalMargin = { ...defaultMargin, ...margin };

        return {
            width: totalSize.width - finalMargin.left - finalMargin.right,
            height: totalSize.height - finalMargin.top - finalMargin.bottom,
            margin: finalMargin
        };
    }

    /**
     * レイアウトを更新
     * @param {Object} config - 設定
     */
    async update(config) {
        this.config = this.mergeConfig(config);
        return await this.render(config);
    }

    /**
     * レイアウトを描画（統合実装）
     * @param {Object} config - レイアウト設定
     */
    async render(config) {
        try {
            // レイアウト設定の取得
            const layoutConfig = this.getLayoutConfig(config);

            // データの準備
            const chartsData = this.prepareChartsData(config.charts, this.chartCount);

            // コンテナの準備
            this.prepareContainer(layoutConfig);

            // 各チャートの描画
            await this.renderCharts(chartsData, layoutConfig);

            return true;
        } catch (error) {
            ErrorHandler.handle(error, {
                context: `BaseLayout.render (${this.layoutType})`,
                config
            });
            return false;
        }
    }

    /**
     * 設定をマージ
     * @param {Object} config - カスタム設定
     * @returns {Object} マージされた設定
     */
    mergeConfig(config) {
        return LayoutConfig.deepMerge(this.layoutDefaults, config);
    }

    /**
     * コンテナを準備（DualLayout/TripleLayout 統合）
     * @protected
     */
    prepareContainer(layoutConfig) {
        try {
            const container = d3.select(`#${this.containerId}`) || this.container;

            // 既存のコンテンツを一度にクリア
            container.selectAll('*').remove();

            // コンテナスタイルを設定
            const flexDirection = layoutConfig.arrangement === 'vertical' ? 'column' : 'row';
            container
                .classed(`${this.layoutType}-layout-container`, true)
                .style('display', 'flex')
                .style('flex-direction', flexDirection)
                .style('gap', `${layoutConfig.spacing || (this.layoutType === 'dual' ? 40 : 30)}px`)
                .style('width', '100%')
                .style('height', '100%');

            // 特定レイアウトのスタイル
            if (this.layoutType === 'single') {
                container.style('visibility', 'visible')
                    .style('opacity', '1');
            }

            // 各チャート用のコンテナを作成
            this.chartContainers = [];
            for (let i = 0; i < this.chartCount; i++) {
                const chartContainer = container.append('div')
                    .attr('class', `${this.layoutType}-chart-container chart-${i}`)
                    .style('flex', '1')
                    .style('min-width', '0')
                    .style('position', 'relative')
                    .style('display', 'block');

                this.chartContainers.push(chartContainer);
            }
        } catch (error) {
            console.error(`BaseLayout.prepareContainer (${this.layoutType}):`, error);
            throw error;
        }
    }

    /**
     * レイアウトをクリア
     */
    clear() {
        if (this.svg) {
            this.svg.selectAll('*').remove();
        }
    }

    /**
     * レイアウトを破棄
     */
    destroy() {
        this.clear();
        if (this.container) {
            this.container.selectAll('svg').remove();
        }
        this.isInitialized = false;
    }

    /**
     * トランジション設定を取得
     * @param {Object} customTransition - カスタムトランジション設定
     * @returns {Object} トランジション設定
     */
    getTransitionConfig(customTransition = {}) {
        // AppDefaults.animationから統一されたアニメーション設定を使用
        const defaults = {
            duration: window.AppDefaults?.animation?.chartTransitionDuration || 1000,
            easing: window.AppDefaults?.animation?.defaultEasing || 'easeInOut'
        };
        return { ...defaults, ...customTransition };
    }

    /**
     * エラーハンドリング
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - コンテキスト
     */
    handleError(error, context) {
        console.error(`BaseLayout.${context}:`, error);
        
        if (window.ErrorHandler) {
            ErrorHandler.handle(error, `BaseLayout.${context}`, {
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.MEDIUM,
                context: {
                    layoutType: this.layoutType,
                    containerId: this.containerId
                }
            });
        }
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            layoutType: this.layoutType,
            containerId: this.containerId,
            isInitialized: this.isInitialized,
            containerSize: this.container ? {
                width: this.container.node().offsetWidth,
                height: this.container.node().offsetHeight
            } : null,
            config: this.config
        };
    }

    /**
     * レイアウト設定の取得（DualLayout/TripleLayout で使用）
     * @protected
     * @param {Object} config - レイアウト設定
     * @returns {Object} マージされたレイアウト設定
     */
    getLayoutConfig(config) {
        if (!window.LayoutConfig) {
            console.warn('LayoutConfig not available, using basic config');
            return config;
        }

        // プリセットの適用
        const preset = config.preset || `${this.layoutType.toUpperCase()}_HORIZONTAL`;
        const presetConfig = LayoutConfig.PRESETS[preset] || {};

        // デフォルト設定との統合
        return window.ConfigHelper ?
            ConfigHelper.mergeConfig(
                LayoutConfig.DEFAULT_SETTINGS,
                presetConfig,
                config
            ) :
            { ...presetConfig, ...config };
    }

    /**
     * チャートデータの準備（DualLayout/TripleLayout で使用）
     * @protected
     * @param {Array} charts - チャート設定配列
     * @param {number} expectedCount - 期待されるチャート数
     * @returns {Array} チャートデータ配列
     */
    prepareChartsData(charts, expectedCount) {
        if (!charts || charts.length !== expectedCount) {
            throw new Error(`${this.layoutType} layout requires exactly ${expectedCount} charts configuration`);
        }

        return charts.map((chartConfig) => {
            if (chartConfig.data) {
                return {
                    config: chartConfig,
                    data: chartConfig.data,
                    error: null
                };
            } else {
                console.error(`No data provided for chart: ${chartConfig.dataFile || 'unknown'}`);
                return {
                    config: chartConfig,
                    data: null,
                    error: new Error(`No data provided for chart: ${chartConfig.dataFile || 'unknown'}`)
                };
            }
        });
    }

    /**
     * チャートサイズの計算（DualLayout/TripleLayout で使用）
     * @protected
     * @param {HTMLElement} containerNode - コンテナ要素
     * @param {Object} chartConfig - チャート設定
     * @param {Object} layoutConfig - レイアウト設定
     * @returns {Object} 計算されたサイズ
     */
    calculateChartSize(containerNode, chartConfig, layoutConfig) {
        const containerRect = containerNode.getBoundingClientRect();

        let width = containerRect.width;
        let height = containerRect.height;

        // 設定からのサイズ指定がある場合
        if (chartConfig.width) {
            width = typeof chartConfig.width === 'string' && chartConfig.width.includes('%')
                ? containerRect.width * (parseFloat(chartConfig.width) / 100)
                : chartConfig.width;
        }

        if (chartConfig.height) {
            height = typeof chartConfig.height === 'string' && chartConfig.height.includes('%')
                ? containerRect.height * (parseFloat(chartConfig.height) / 100)
                : chartConfig.height;
        }

        // 最小・最大サイズの制約を適用
        const constraints = layoutConfig.sizeConstraints || {};
        width = Math.max(constraints.minWidth || 400, Math.min(width, constraints.maxWidth || 1200));
        height = Math.max(constraints.minHeight || 300, Math.min(height, constraints.maxHeight || 800));

        return { width, height };
    }

    /**
     * レンダラーの取得または作成（DualLayout/TripleLayout で使用）
     * @protected
     * @param {string} chartType - チャートタイプ
     * @param {number} index - チャートインデックス
     * @param {string} containerId - コンテナID
     * @returns {Object} チャートレンダラーインスタンス
     */
    getOrCreateRenderer(chartType, index, containerId) {
        let renderer;
        switch (chartType) {
            case 'line':
                renderer = new LineChartRenderer(`#${containerId}`);
                break;
            case 'bar':
                renderer = new BarChartRenderer(`#${containerId}`);
                break;
            case 'pie':
                renderer = new PieChartRenderer(`#${containerId}`);
                break;
            default:
                throw new Error(`Unknown chart type: ${chartType}`);
        }
        return renderer;
    }

    /**
     * エラー状態の表示（DualLayout/TripleLayout で使用）
     * @protected
     * @param {Object} container - D3 コンテナセレクション
     * @param {Error} error - エラーオブジェクト
     */
    renderErrorState(container, error) {
        container
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('background-color', '#f8f8f8')
            .style('border', '2px dashed #ddd')
            .append('div')
            .style('text-align', 'center')
            .style('color', '#666')
            .html(`
                <p style="margin: 0 0 10px 0;">チャートデータの読み込みに失敗しました</p>
                <p style="margin: 0; font-size: 0.9em; color: #999;">${error?.message || 'Unknown error'}</p>
            `);
    }

    /**
     * 各チャートの描画（DualLayout/TripleLayout で共通使用）
     * @protected
     * @param {Array} chartsData - チャートデータ配列
     * @param {Object} layoutConfig - レイアウト設定
     */
    async renderCharts(chartsData, layoutConfig) {
        for (let i = 0; i < chartsData.length; i++) {
            const chartData = chartsData[i];
            if (chartData.error || !chartData.data) {
                console.warn(`${this.layoutType} Layout: Chart ${i} has error or no data:`, chartData.error);
                this.renderErrorState(this.chartContainers[i], chartData.error);
                continue;
            }

            const container = this.chartContainers[i];
            const chartConfig = chartData.config;

            // チャートサイズの計算
            const size = this.calculateChartSize(container.node(), chartConfig, layoutConfig);

            // チャートタイプに応じたレンダラーの取得または作成
            const containerId = `${this.layoutType}-chart-${i}`;
            container.node().id = containerId;
            const renderer = this.getOrCreateRenderer(chartConfig.type, i, containerId);

            try {
                // チャートの描画
                renderer.renderChart(chartConfig.type, chartData.data, {
                    ...chartConfig,
                    ...chartConfig.config,
                    width: size.width,
                    height: size.height
                });

                this.charts[i] = {
                    renderer,
                    config: chartConfig,
                    data: chartData.data
                };

            } catch (error) {
                console.error(`${this.layoutType} Layout: Error rendering chart ${i}:`, error);
                this.renderErrorState(container, error);
            }
        }
    }
}

// グローバルスコープで利用可能にする
window.BaseLayout = BaseLayout;