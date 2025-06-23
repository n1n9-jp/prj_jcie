/**
 * PubSub - シンプルなパブリッシュ・サブスクライブパターンの実装
 * イベント管理用ライブラリ
 */
class PubSub {
    constructor() {
        this.events = {};
    }

    /**
     * イベントを購読する
     * @param {string} event - イベント名
     * @param {function} callback - コールバック関数
     * @returns {function} - 購読解除用の関数
     */
    subscribe(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        
        this.events[event].push(callback);
        
        // 購読解除用の関数を返す
        return () => {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        };
    }

    /**
     * イベントを発行する
     * @param {string} event - イベント名
     * @param {*} data - 送信するデータ
     */
    publish(event, data) {
        if (!this.events[event]) {
            return;
        }
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for "${event}":`, error);
            }
        });
    }

    /**
     * 指定したイベントの全ての購読を解除する
     * @param {string} event - イベント名
     */
    unsubscribeAll(event) {
        if (this.events[event]) {
            delete this.events[event];
        }
    }

    /**
     * 全てのイベントの購読を解除する
     */
    clear() {
        this.events = {};
    }

    /**
     * 購読中のイベント一覧を取得する
     * @returns {Array} - イベント名の配列
     */
    getEvents() {
        return Object.keys(this.events);
    }

    /**
     * 指定したイベントの購読者数を取得する
     * @param {string} event - イベント名
     * @returns {number} - 購読者数
     */
    getSubscriberCount(event) {
        return this.events[event] ? this.events[event].length : 0;
    }
}

// グローバルインスタンス
window.pubsub = new PubSub();

// イベント名の定数定義
window.EVENTS = {
    STEP_ENTER: 'step-enter',
    STEP_EXIT: 'step-exit',
    STEP_PROGRESS: 'step-progress',
    CHART_UPDATE: 'chart-update',
    MAP_UPDATE: 'map-update',
    MAP_PROGRESS: 'map-progress',
    IMAGE_UPDATE: 'image-update',
    DATA_LOADED: 'data-loaded',
    DATA_ERROR: 'data-error',
    RESIZE: 'window-resize'
};