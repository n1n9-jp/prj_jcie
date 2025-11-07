/**
 * DualLayout - 2つのチャートを横並びで表示するレイアウトクラス
 * BaseLayoutを継承し、統一されたレイアウト処理を提供
 */
class DualLayout extends BaseLayout {
    constructor(containerId) {
        super(containerId, 'dual');
        this.chartCount = 2;  // デュアルレイアウトは2つのチャート
        this.charts = [];
        this.chartContainers = [];
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
            const chartsData = this.prepareChartsData(config.charts, this.chartCount);

            // コンテナの準備
            this.prepareContainer(layoutConfig);

            // 各チャートの描画（BaseLayout の共通メソッド）
            await this.renderCharts(chartsData, layoutConfig);

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
     * コンテナの準備
     * @private
     */
    prepareContainer(layoutConfig) {
        try {
            // メインコンテナの設定
            const container = d3.select('#chart-container');

            // 既存のコンテンツを一度にクリア
            container.selectAll('*').remove();

            // コンテナスタイルを設定
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
            for (let i = 0; i < this.chartCount; i++) {
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
     * レイアウトの更新
     */
    update(config) {
        this.fadeOut(300).then(() => {
            this.render(config).then(() => {
                this.fadeIn(300);
            });
        });
    }

    /**
     * レイアウトのクリーンアップ
     */
    destroy() {
        this.charts = [];
        this.chartContainers = [];
        super.destroy();
    }
}

// グローバルスコープに登録
window.DualLayout = DualLayout;
