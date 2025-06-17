/**
 * BaseManager - すべてのManagerクラスの基底クラス
 * 共通の初期化処理、イベント処理、状態管理を提供
 */
class BaseManager {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.currentState = null;
        this.config = null;
        this.isVisible = false;
        
        this.init();
    }

    /**
     * 初期化処理
     * 子クラスでオーバーライド可能
     */
    init() {
        this.setupEventListeners();
    }

    /**
     * 共通イベントリスナーの設定
     * 子クラスでオーバーライドして追加イベントを設定可能
     */
    setupEventListeners() {
        pubsub.subscribe(EVENTS.RESIZE, () => {
            this.resize();
        });
    }

    /**
     * 要素を表示
     * @param {Object} options - 表示オプション
     */
    show(options = {}) {
        const { 
            transitionDuration = window.AppDefaults?.animation?.defaultDuration || 300,
            ease = d3.easeQuadInOut,
            delay = 0
        } = options;

        this.isVisible = true;
        this.container.classed('visible', true);
        
        // フェードイン効果
        this.container
            .style('opacity', 0)
            .transition()
            .duration(transitionDuration)
            .ease(ease)
            .delay(delay)
            .style('opacity', 1);
    }

    /**
     * 要素を非表示
     * @param {Object} options - 非表示オプション
     */
    hide(options = {}) {
        const { 
            transitionDuration = window.AppDefaults?.animation?.defaultDuration || 300,
            ease = d3.easeQuadInOut,
            delay = 0
        } = options;

        this.isVisible = false;
        
        // フェードアウト効果
        this.container
            .transition()
            .duration(transitionDuration)
            .ease(ease)
            .delay(delay)
            .style('opacity', 0)
            .on('end', () => {
                this.container.classed('visible', false);
            });
    }

    /**
     * リサイズ処理
     * 子クラスでオーバーライドして具体的なリサイズ処理を実装
     */
    resize() {
        // 子クラスでオーバーライド
        console.log(`${this.constructor.name}: resize() called`);
    }

    /**
     * 設定値のデフォルト処理
     * @param {Object} defaultConfig - デフォルト設定
     * @param {Object} userConfig - ユーザー設定
     * @returns {Object} マージされた設定
     */
    static mergeConfig(defaultConfig, userConfig) {
        if (!userConfig) return defaultConfig;
        
        const merged = { ...defaultConfig };
        
        Object.keys(userConfig).forEach(key => {
            if (typeof userConfig[key] === 'object' && 
                !Array.isArray(userConfig[key]) && 
                userConfig[key] !== null) {
                // オブジェクトの場合は再帰的にマージ
                merged[key] = this.mergeConfig(defaultConfig[key] || {}, userConfig[key]);
            } else {
                merged[key] = userConfig[key];
            }
        });
        
        return merged;
    }

    /**
     * エラーハンドリング付きの状態更新
     * @param {*} newState - 新しい状態
     * @param {Function} callback - 更新後のコールバック関数
     * @param {Object} errorContext - エラー発生時のコンテキスト情報
     */
    updateState(newState, callback, errorContext = {}) {
        try {
            const previousState = this.currentState;
            this.currentState = newState;
            
            if (callback) {
                callback(newState, previousState);
            }
            
            // 状態更新イベントを発行
            pubsub.publish(`${this.constructor.name.toUpperCase()}_STATE_UPDATED`, {
                newState,
                previousState,
                manager: this
            });
            
        } catch (error) {
            console.error(`${this.constructor.name}: State update failed:`, error);
            
            // ErrorHandlerが利用可能な場合は使用
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, `${this.constructor.name}.updateState`, {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.MEDIUM,
                    context: {
                        ...errorContext,
                        newState,
                        previousState: this.currentState
                    }
                });
            }
            
            // 状態を元に戻す
            this.currentState = this.currentState; // previousStateを保持
        }
    }

    /**
     * 安全な非同期処理実行
     * @param {Function} asyncFunction - 非同期関数
     * @param {string} operationName - 操作名（エラーログ用）
     * @param {Object} errorContext - エラーコンテキスト
     * @returns {Promise} 実行結果
     */
    async safeAsyncOperation(asyncFunction, operationName, errorContext = {}) {
        try {
            return await asyncFunction();
        } catch (error) {
            console.error(`${this.constructor.name}: ${operationName} failed:`, error);
            
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, `${this.constructor.name}.${operationName}`, {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.MEDIUM,
                    context: errorContext
                });
            }
            
            throw error; // 呼び出し元で処理できるよう再スロー
        }
    }

    /**
     * 共通のコンテナクリア処理
     * @param {d3.Selection} container - クリアするコンテナ（省略時はthis.container）
     */
    clearContainer(container = null) {
        const targetContainer = container || this.container;
        targetContainer.selectAll('*').remove();
    }

    /**
     * 共通のアニメーション停止処理
     */
    stopAnimations() {
        this.container.selectAll('*').interrupt();
    }

    /**
     * 現在の状態を取得
     * @returns {*} 現在の状態
     */
    getCurrentState() {
        return this.currentState;
    }

    /**
     * 可視状態を取得
     * @returns {boolean} 可視状態
     */
    getVisibility() {
        return this.isVisible;
    }

    /**
     * コンテナの境界矩形を取得
     * @returns {DOMRect} 境界矩形
     */
    getContainerBounds() {
        const node = this.container.node();
        return node ? node.getBoundingClientRect() : null;
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            className: this.constructor.name,
            isVisible: this.isVisible,
            currentState: this.currentState,
            config: this.config,
            containerBounds: this.getContainerBounds()
        };
    }

    /**
     * 設定を検証する
     * @param {Object} config - 検証する設定
     * @param {Array} requiredFields - 必須フィールドのリスト
     * @returns {Object} 検証結果 {valid: boolean, errors: Array}
     */
    validateConfig(config, requiredFields = []) {
        const errors = [];
        
        if (!config) {
            errors.push('Config is null or undefined');
            return { valid: false, errors };
        }
        
        // 必須フィールドの検証
        requiredFields.forEach(field => {
            if (!(field in config)) {
                errors.push(`Missing required field: ${field}`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 破棄処理
     * 子クラスでオーバーライドしてリソースのクリーンアップを実装
     */
    destroy() {
        this.stopAnimations();
        this.clearContainer();
        
        // イベントリスナーの削除（pubsubでは自動的に処理される）
        console.log(`${this.constructor.name} destroyed`);
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.BaseManager = BaseManager;