/**
 * ErrorHandler - エラーハンドリングの共通管理クラス
 * アプリケーション全体のエラー処理を一元管理
 */
class ErrorHandler {
    // エラータイプの定数
    static ERROR_TYPES = {
        DATA_LOAD: 'data_load',
        RENDER: 'render',
        TRANSITION: 'transition',
        VALIDATION: 'validation',
        NETWORK: 'network',
        UNKNOWN: 'unknown'
    };

    // エラー重要度レベル
    static SEVERITY = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };

    // エラーログを保存する配列（デバッグ用）
    static errorLog = [];

    /**
     * エラーをハンドリングする
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - エラーが発生したコンテキスト
     * @param {Object} options - オプション設定
     */
    static handle(error, context, options = {}) {
        const {
            type = ErrorHandler.ERROR_TYPES.UNKNOWN,
            severity = ErrorHandler.SEVERITY.MEDIUM,
            showNotification = true,
            fallbackAction = null,
            additionalInfo = {}
        } = options;

        // エラー情報を構造化
        const errorInfo = {
            timestamp: new Date().toISOString(),
            context,
            type,
            severity,
            message: error.message || 'Unknown error',
            stack: error.stack,
            additionalInfo,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // エラーログに追加
        ErrorHandler.errorLog.push(errorInfo);

        // コンソールに出力
        ErrorHandler.logError(errorInfo);

        // PubSubでエラーイベントを発行
        if (window.pubsub) {
            window.pubsub.publish(window.EVENTS?.ERROR || 'error', errorInfo);
        }

        // ユーザーへの通知
        if (showNotification) {
            ErrorHandler.showErrorNotification(errorInfo);
        }

        // フォールバックアクションの実行
        if (fallbackAction && typeof fallbackAction === 'function') {
            try {
                fallbackAction(errorInfo);
            } catch (fallbackError) {
                console.error('Fallback action failed:', fallbackError);
            }
        }

        // 重大なエラーの場合は追加の処理
        if (severity === ErrorHandler.SEVERITY.CRITICAL) {
            ErrorHandler.handleCriticalError(errorInfo);
        }
    }

    /**
     * try-catchラッパー関数
     * @param {Function} fn - 実行する関数
     * @param {string} context - コンテキスト
     * @param {Object} options - エラーハンドリングオプション
     * @returns {*} 関数の実行結果
     */
    static wrap(fn, context, options = {}) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                ErrorHandler.handle(error, context, options);
                return options.defaultValue !== undefined ? options.defaultValue : null;
            }
        };
    }

    /**
     * 非同期関数用のtry-catchラッパー
     * @param {Function} asyncFn - 実行する非同期関数
     * @param {string} context - コンテキスト
     * @param {Object} options - エラーハンドリングオプション
     * @returns {Promise} Promise
     */
    static async wrapAsync(asyncFn, context, options = {}) {
        try {
            return await asyncFn();
        } catch (error) {
            ErrorHandler.handle(error, context, options);
            if (options.throwError) {
                throw error;
            }
            return options.defaultValue !== undefined ? options.defaultValue : null;
        }
    }

    /**
     * データ検証エラーをハンドリング
     * @param {string} dataType - データタイプ
     * @param {*} data - 検証対象のデータ
     * @param {string} context - コンテキスト
     */
    static handleDataValidationError(dataType, data, context) {
        const error = new Error(`Invalid ${dataType} data`);
        ErrorHandler.handle(error, context, {
            type: ErrorHandler.ERROR_TYPES.VALIDATION,
            severity: ErrorHandler.SEVERITY.MEDIUM,
            additionalInfo: {
                dataType,
                dataSnapshot: JSON.stringify(data).substring(0, 200)
            }
        });
    }

    /**
     * エラーをコンソールに出力
     * @param {Object} errorInfo - エラー情報
     */
    static logError(errorInfo) {
        const style = ErrorHandler.getConsoleStyle(errorInfo.severity);
        console.group(`%c[${errorInfo.severity.toUpperCase()}] ${errorInfo.context}`, style);
        console.error('Message:', errorInfo.message);
        console.error('Type:', errorInfo.type);
        console.error('Timestamp:', errorInfo.timestamp);
        
        if (Object.keys(errorInfo.additionalInfo).length > 0) {
            console.error('Additional Info:', errorInfo.additionalInfo);
        }
        
        if (errorInfo.stack) {
            console.error('Stack trace:', errorInfo.stack);
        }
        
        console.groupEnd();
    }

    /**
     * 重要度に応じたコンソールスタイルを取得
     * @param {string} severity - 重要度
     * @returns {string} CSSスタイル
     */
    static getConsoleStyle(severity) {
        const styles = {
            [ErrorHandler.SEVERITY.LOW]: 'color: #666; font-weight: normal;',
            [ErrorHandler.SEVERITY.MEDIUM]: 'color: #f39c12; font-weight: bold;',
            [ErrorHandler.SEVERITY.HIGH]: 'color: #e74c3c; font-weight: bold;',
            [ErrorHandler.SEVERITY.CRITICAL]: 'color: #fff; background: #e74c3c; padding: 2px 4px; font-weight: bold;'
        };
        return styles[severity] || styles[ErrorHandler.SEVERITY.MEDIUM];
    }

    /**
     * ユーザーへのエラー通知を表示
     * @param {Object} errorInfo - エラー情報
     */
    static showErrorNotification(errorInfo) {
        // 既存のエラー表示要素があれば削除
        const existingError = document.getElementById('error-notification');
        if (existingError) {
            existingError.remove();
        }

        // エラーメッセージを生成
        const userMessage = ErrorHandler.getUserFriendlyMessage(errorInfo);

        // エラー表示要素を作成
        const errorDiv = document.createElement('div');
        errorDiv.id = 'error-notification';
        errorDiv.className = `error-notification error-${errorInfo.severity}`;
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${userMessage}</span>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // スタイルを適用
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: ${window.AppDefaults?.errorModal?.imageMaxWidth || '400px'};
            padding: 16px;
            background: ${errorInfo.severity === ErrorHandler.SEVERITY.CRITICAL ? '#e74c3c' : '#f8f9fa'};
            color: ${errorInfo.severity === ErrorHandler.SEVERITY.CRITICAL ? '#fff' : '#333'};
            border-radius: 8px;
            box-shadow: 0 4px 6px ${window.AppDefaults?.colors?.background?.shadow || 'rgba(0, 0, 0, 0.1)'};
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        // ボディに追加
        document.body.appendChild(errorDiv);

        // 自動的に削除（重大でないエラーの場合）
        if (errorInfo.severity !== ErrorHandler.SEVERITY.CRITICAL) {
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => errorDiv.remove(), 300);
                }
            }, 5000);
        }
    }

    /**
     * ユーザーフレンドリーなエラーメッセージを生成
     * @param {Object} errorInfo - エラー情報
     * @returns {string} ユーザー向けメッセージ
     */
    static getUserFriendlyMessage(errorInfo) {
        const messages = {
            [ErrorHandler.ERROR_TYPES.DATA_LOAD]: 'データの読み込みに失敗しました。ページを再読み込みしてください。',
            [ErrorHandler.ERROR_TYPES.RENDER]: '表示の更新に失敗しました。',
            [ErrorHandler.ERROR_TYPES.TRANSITION]: 'アニメーションの実行に失敗しました。',
            [ErrorHandler.ERROR_TYPES.VALIDATION]: 'データの形式が正しくありません。',
            [ErrorHandler.ERROR_TYPES.NETWORK]: 'ネットワークエラーが発生しました。接続を確認してください。',
            [ErrorHandler.ERROR_TYPES.UNKNOWN]: '予期しないエラーが発生しました。'
        };

        return messages[errorInfo.type] || messages[ErrorHandler.ERROR_TYPES.UNKNOWN];
    }

    /**
     * 重大なエラーの処理
     * @param {Object} errorInfo - エラー情報
     */
    static handleCriticalError(errorInfo) {
        // エラー情報をローカルストレージに保存
        try {
            const errors = JSON.parse(localStorage.getItem('criticalErrors') || '[]');
            errors.push(errorInfo);
            // 最新の10件のみ保持
            if (errors.length > 10) {
                errors.shift();
            }
            localStorage.setItem('criticalErrors', JSON.stringify(errors));
        } catch (e) {
            console.error('Failed to save critical error to localStorage:', e);
        }

        // 開発環境では詳細情報を表示
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            ErrorHandler.showDebugPanel(errorInfo);
        }
    }

    /**
     * デバッグパネルを表示
     * @param {Object} errorInfo - エラー情報
     */
    static showDebugPanel(errorInfo) {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'error-debug-panel';
        debugPanel.innerHTML = `
            <div style="position: fixed; bottom: 20px; left: 20px; max-width: ${window.AppDefaults?.errorModal?.maxWidth || '600px'}; 
                        background: #2c3e50; color: #ecf0f1; padding: 20px; 
                        border-radius: 8px; font-family: monospace; font-size: 12px;
                        max-height: ${window.AppDefaults?.errorModal?.imageMaxHeight || '400px'}; overflow-y: auto; z-index: 10001;">
                <h3 style="margin-top: 0;">Debug Information</h3>
                <pre>${JSON.stringify(errorInfo, null, 2)}</pre>
                <button onclick="this.parentElement.remove()" 
                        style="margin-top: 10px; padding: 5px 10px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        document.body.appendChild(debugPanel);
    }

    /**
     * エラーログを取得
     * @param {number} limit - 取得する件数
     * @returns {Array} エラーログ
     */
    static getErrorLog(limit = 50) {
        return ErrorHandler.errorLog.slice(-limit);
    }

    /**
     * エラーログをクリア
     */
    static clearErrorLog() {
        ErrorHandler.errorLog = [];
    }

    /**
     * エラーログをエクスポート
     * @returns {string} JSON形式のエラーログ
     */
    static exportErrorLog() {
        return JSON.stringify(ErrorHandler.errorLog, null, 2);
    }
}

// アニメーション用のCSS（スタイルシートがない場合のフォールバック）
if (!document.getElementById('error-handler-styles')) {
    const style = document.createElement('style');
    style.id = 'error-handler-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .error-notification .error-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .error-notification .error-close {
            margin-left: auto;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        .error-notification .error-close:hover {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.ErrorHandler = ErrorHandler;