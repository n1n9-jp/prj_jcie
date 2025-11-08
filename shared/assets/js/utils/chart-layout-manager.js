/**
 * ChartLayoutManager - レイアウト処理の統合管理クラス
 * BaseLayout を継承し、Dual/Triple レイアウトの処理を集約
 *
 * 責務:
 * - 複数チャートのレイアウト管理（Dual, Triple）
 * - レイアウト寸法計算（position 設定対応）
 * - SVG 作成と チャート描画の統合
 * - 各レンダラーのインスタンス管理
 *
 * 使用例:
 * const layoutManager = new ChartLayoutManager('chart-container');
 * layoutManager.createDualLayout(chartData);
 */
class ChartLayoutManager extends BaseLayout {
    /**
     * コンストラクタ
     * @param {string} containerId - コンテナの ID
     */
    constructor(containerId) {
        super(containerId);
        this.layoutType = null; // 'dual', 'triple', 'single'
        this.layoutState = {};
        this.renderers = {}; // レンダラーキャッシュ
        this.chartsData = {}; // チャートデータキャッシュ
    }

    /**
     * レイアウトを初期化
     * @param {string} type - レイアウトタイプ
     * @param {Object} config - レイアウト設定
     */
    initializeLayout(type, config = {}) {
        this.layoutType = type;
        this.layoutState = {
            type,
            config,
            initialized: true,
            timestamp: Date.now()
        };
        console.log(`ChartLayoutManager: Initialized ${type} layout`);
    }

    /**
     * レイアウト状態を更新
     * @param {string} type - レイアウトタイプ
     * @param {Object} data - チャートデータ
     */
    updateLayoutState(type, data) {
        this.layoutType = type;
        this.layoutState = {
            type,
            data,
            timestamp: Date.now()
        };
    }

    /**
     * 現在のレイアウト状態を取得
     * @returns {Object} レイアウト状態
     */
    getCurrentLayoutState() {
        return { ...this.layoutState };
    }

    /**
     * デュアルレイアウトを作成
     * DualLayout クラスへ委譲（描画処理は DualLayout が担当）
     * @param {Object} chartData - チャートデータ
     */
    async createDualLayout(chartData) {
        try {
            this.initializeLayout('dual', chartData);

            // DualLayout クラスに委譲
            if (window.DualLayout) {
                const dualLayout = new window.DualLayout('chart-container');
                await dualLayout.render(chartData);
            } else {
                console.warn('ChartLayoutManager: DualLayout class not found');
                throw new Error('DualLayout class is required');
            }
        } catch (error) {
            console.error('ChartLayoutManager: Error creating dual layout:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'ChartLayoutManager.createDualLayout', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { chartData }
                });
            }
        }
    }

    /**
     * トリプルレイアウトを作成
     * TripleLayout クラスへ委譲（描画処理は TripleLayout が担当）
     * @param {Object} chartData - チャートデータ
     */
    async createTripleLayout(chartData) {
        try {
            this.initializeLayout('triple', chartData);

            // TripleLayout クラスに委譲
            if (window.TripleLayout) {
                const tripleLayout = new window.TripleLayout('chart-container');
                await tripleLayout.render(chartData);
            } else {
                console.warn('ChartLayoutManager: TripleLayout class not found');
                throw new Error('TripleLayout class is required');
            }
        } catch (error) {
            console.error('ChartLayoutManager: Error creating triple layout:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'ChartLayoutManager.createTripleLayout', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { chartData }
                });
            }
        }
    }


    /**
     * チャートレンダラーを取得または作成
     * @param {string} type - チャートタイプ
     * @returns {Object} レンダラーインスタンス
     */
    getOrCreateRenderer(type) {
        if (!this.renderers[type]) {
            // 新規コンテナを作成してレンダラーをインスタンス化
            const containerId = `chart-renderer-${type}-${Date.now()}`;
            const div = this.container.append('div')
                .attr('id', containerId)
                .style('display', 'none'); // 非表示

            try {
                const RendererClass = window[`${type.charAt(0).toUpperCase() + type.slice(1)}ChartRenderer`];
                if (RendererClass) {
                    this.renderers[type] = new RendererClass(containerId);
                } else {
                    console.warn(`ChartLayoutManager: Renderer not found for type: ${type}`);
                    return null;
                }
            } catch (error) {
                console.error(`ChartLayoutManager: Error creating renderer for type ${type}:`, error);
                return null;
            }
        }

        return this.renderers[type];
    }

    /**
     * チャートデータを検証
     * @param {Object} chartData - チャートデータ
     * @returns {Object} {valid: boolean, errors: string[]}
     */
    validateChartData(chartData) {
        const errors = [];

        if (!chartData || typeof chartData !== 'object') {
            errors.push('chartData must be an object');
            return { valid: false, errors };
        }

        if (!chartData.type) {
            errors.push('chartData.type is required');
        }

        if (!chartData.data || !Array.isArray(chartData.data)) {
            errors.push('chartData.data must be an array');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * コンテナをクリア
     */
    clearContainer() {
        if (this.container) {
            this.container.selectAll('*').remove();
        }
    }

    /**
     * リソースをクリーンアップ
     */
    cleanup() {
        this.clearContainer();

        // レンダラーをクリーンアップ
        Object.values(this.renderers).forEach(renderer => {
            if (renderer && typeof renderer.destroy === 'function') {
                renderer.destroy();
            }
        });

        this.renderers = {};
        this.chartsData = {};
        this.layoutState = {};
    }

    /**
     * リソースを破棄
     */
    destroy() {
        this.cleanup();
        super.destroy();
    }
}

// グローバルスコープで提供
window.ChartLayoutManager = ChartLayoutManager;
