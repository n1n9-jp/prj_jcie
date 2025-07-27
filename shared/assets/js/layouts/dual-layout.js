/**
 * DualLayout - 2つのチャートを横並びで表示するレイアウトクラス
 * BaseLayoutを継承し、統一されたレイアウト処理を提供
 */
class DualLayout extends BaseLayout {
    constructor(containerId) {
        super(containerId, 'dual');
        this.charts = [];
        this.renderers = new Map();
    }
    

    /**
     * デュアルレイアウトの描画
     * @param {Object} config - レイアウト設定（データ込み）
     */
    async render(config) {
        try {
            // レイアウト設定の取得
            const layoutConfig = this.getLayoutConfig(config);
            
            // データの準備（main.jsから渡されたデータを使用）
            const chartsData = this.prepareChartsData(config.charts);
            
            // コンテナの準備
            this.prepareContainer(layoutConfig);
            
            // 各チャートの描画
            this.renderCharts(chartsData, layoutConfig);
            
            return true;
        } catch (error) {
            ErrorHandler.handle(error, {
                context: 'DualLayout.render',
                config
            });
            return false;
        }
    }

    /**
     * レイアウト設定の取得
     * @private
     */
    getLayoutConfig(config) {
        // LayoutConfigが利用可能かチェック
        if (!window.LayoutConfig) {
            console.warn('LayoutConfig not available, using basic config');
            return config;
        }
        
        // プリセットの適用
        const preset = config.preset || 'DUAL_HORIZONTAL';
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
     * チャートデータの準備（main.jsから渡されたデータを使用）
     * @private
     */
    prepareChartsData(charts) {
        if (!charts || charts.length !== 2) {
            throw new Error('Dual layout requires exactly 2 charts configuration');
        }

        return charts.map((chartConfig) => {
            // main.jsで既に読み込まれたデータが添付されているはず
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
     * レンダラーのクリーンアップ
     * @private
     */
    cleanupRenderers() {
        this.renderers.clear();
        this.charts = [];
    }

    /**
     * コンテナの準備
     * @private
     */
    prepareContainer(layoutConfig) {
        try {
            
            // レンダラーをクリーンアップ
            this.cleanupRenderers();
            
            // メインコンテナの設定（原子操作で競合回避）
            const container = d3.select('#chart-container');
            
            // 既存のコンテンツを一度にクリア
            container.selectAll('*').remove();
            
            // コンテナスタイルを一度に設定
            container
                .classed('dual-layout-container', true)
                .style('display', 'flex')
                .style('flex-direction', layoutConfig.arrangement === 'vertical' ? 'column' : 'row')
                .style('gap', `${layoutConfig.spacing || 40}px`)
                .style('width', '100%')
                .style('height', '100%')
                .style('visibility', 'visible')
                .style('opacity', '1');
            
            // 各チャート用のコンテナを作成
            this.chartContainers = [];
            for (let i = 0; i < 2; i++) {
                const chartContainer = container.append('div')
                    .attr('class', `dual-chart-container chart-${i}`)
                    .style('flex', '1')
                    .style('min-width', '0')
                    .style('position', 'relative')
                    .style('display', 'block');
                
                this.chartContainers.push(chartContainer);
            }
        } catch (error) {
            console.error('Error preparing container:', error);
            throw error;
        }
    }

    /**
     * 各チャートの描画（同期処理で競合回避）
     * @private
     */
    renderCharts(chartsData, layoutConfig) {
        
        for (let i = 0; i < chartsData.length; i++) {
            const chartData = chartsData[i];
            if (chartData.error || !chartData.data) {
                console.warn(`DualLayout: Chart ${i} has error or no data:`, chartData.error);
                this.renderErrorState(i, chartData.error);
                continue;
            }

            const container = this.chartContainers[i];
            const chartConfig = chartData.config;
            
            // チャートサイズの計算
            const size = this.calculateChartSize(container.node(), chartConfig, layoutConfig);
            
            // チャートタイプに応じたレンダラーの取得または作成
            const renderer = this.getOrCreateRenderer(chartConfig.type, i, container.node());
            
            try {
                // チャートの描画（同期処理）
                renderer.renderChart(chartConfig.type, chartData.data, {
                    ...chartConfig.config,  // config内の設定を展開
                    ...chartConfig,         // その他の設定
                    width: size.width,
                    height: size.height
                });
                
                this.charts[i] = {
                    renderer,
                    config: chartConfig,
                    data: chartData.data
                };
                
            } catch (error) {
                console.error(`DualLayout: Error rendering chart ${i}:`, error);
                this.renderErrorState(i, error);
            }
        }
    }

    /**
     * チャートサイズの計算
     * @private
     */
    calculateChartSize(containerNode, chartConfig, layoutConfig) {
        const containerRect = containerNode.getBoundingClientRect();
        
        // コンテナサイズの取得
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
     * レンダラーの取得または作成（汚染回避のため毎回新規作成）
     * @private
     */
    getOrCreateRenderer(chartType, index, containerNode) {
        // レンダラーキャッシュを無効化：汚染を回避するため毎回新規作成
        
        // コンテナにIDを設定
        const containerId = `dual-chart-${index}`;
        containerNode.id = containerId;
        
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
        
        // レンダラーキャッシュは無効化：汚染を回避するため保存しない
        return renderer;
    }

    /**
     * エラー状態の表示
     * @private
     */
    renderErrorState(index, error) {
        const container = this.chartContainers[index];
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
     * レイアウトの更新
     */
    update(config) {
        // 既存のチャートをフェードアウト
        this.fadeOut(300).then(() => {
            // 新しい設定で再描画
            this.render(config).then(() => {
                // フェードイン
                this.fadeIn(300);
            });
        });
    }

    /**
     * レイアウトのクリーンアップ
     */
    destroy() {
        // レンダラーのクリーンアップ
        this.renderers.forEach(renderer => {
            if (renderer && typeof renderer.destroy === 'function') {
                renderer.destroy();
            }
        });
        this.renderers.clear();
        
        // チャート情報のクリア
        this.charts = [];
        
        // 親クラスのdestroy呼び出し
        super.destroy();
    }
}

// グローバルスコープに登録
window.DualLayout = DualLayout;