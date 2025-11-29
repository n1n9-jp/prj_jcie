/**
 * Logger - アプリケーション統一ログ管理ユーティリティ
 * 環境設定に基づいてログレベルを制御
 */

export class Logger {
    constructor() {
        this.LOG_LEVELS = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            SILENT: 4
        };

        this.LOG_LEVEL_NAMES = {
            0: 'DEBUG',
            1: 'INFO',
            2: 'WARN',
            3: 'ERROR',
            4: 'SILENT'
        };

        // デフォルトはDEBUGレベル（ローカル環境を想定）
        this.currentLevel = this.LOG_LEVELS.DEBUG;
        this.enabled = true;
        this.initialized = false;
    }

    /**
     * ロガーを初期化（設定ファイルから環境レベルを読み込み）
     * @param {Object} configLoader - ConfigLoaderインスタンス（オプション）
     */
    init(configLoader = null) {
        if (this.initialized) return;

        try {
            // ConfigLoaderから設定を取得
            // 依存性の注入、またはグローバルフォールバック
            const loader = configLoader || (typeof window !== 'undefined' ? window.ConfigLoader : null);

            if (loader && loader.loaded) {
                const loggingConfig = loader.get('logging');

                if (loggingConfig) {
                    this.setLevel(loggingConfig.level || 'debug');
                    this.enabled = loggingConfig.console !== false;
                    this.initialized = true;
                    return;
                }
            }

            // デフォルト設定（ローカル環境）
            const isDevelopment = typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1');
            const defaultLevel = isDevelopment ? 'debug' : 'error';
            this.setLevel(defaultLevel);
            this.initialized = true;
        } catch (error) {
            console.error('Logger initialization error:', error);
        }
    }

    /**
     * ログレベルを設定
     * @param {string|number} level - ログレベル（'debug', 'info', 'warn', 'error', 'silent' or 0-4）
     */
    setLevel(level) {
        if (typeof level === 'string') {
            const levelName = level.toUpperCase();
            this.currentLevel = this.LOG_LEVELS[levelName] ?? this.LOG_LEVELS.DEBUG;
        } else if (typeof level === 'number') {
            this.currentLevel = Math.max(0, Math.min(4, level));
        }
    }

    /**
     * 現在のログレベルを取得
     * @returns {number} ログレベル
     */
    getLevel() {
        return this.currentLevel;
    }

    /**
     * ログレベルの名前を取得
     * @returns {string} ログレベル名
     */
    getLevelName() {
        return this.LOG_LEVEL_NAMES[this.currentLevel] || 'UNKNOWN';
    }

    /**
     * DEBUGレベルのログを出力
     * @param {string} message - メッセージ
     * @param {*} data - オプションデータ
     */
    debug(message, data) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.DEBUG) return;
        this._log('debug', message, data);
    }

    /**
     * INFOレベルのログを出力
     * @param {string} message - メッセージ
     * @param {*} data - オプションデータ
     */
    info(message, data) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.INFO) return;
        this._log('info', message, data);
    }

    /**
     * WARNレベルのログを出力
     * @param {string} message - メッセージ
     * @param {*} data - オプションデータ
     */
    warn(message, data) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.WARN) return;
        this._log('warn', message, data);
    }

    /**
     * ERRORレベルのログを出力
     * @param {string} message - メッセージ
     * @param {*} data - オプションデータ
     */
    error(message, data) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.ERROR) return;
        this._log('error', message, data);
    }

    /**
     * タイムスタンプ付きのログを出力
     * @param {string} label - ラベル
     */
    time(label) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.DEBUG) return;
        console.time(label);
    }

    /**
     * タイムスタンプを終了
     * @param {string} label - ラベル
     */
    timeEnd(label) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.DEBUG) return;
        console.timeEnd(label);
    }

    /**
     * グループを開始
     * @param {string} label - ラベル
     */
    group(label) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.DEBUG) return;
        console.group(label);
    }

    /**
     * グループを終了
     */
    groupEnd() {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.DEBUG) return;
        console.groupEnd();
    }

    /**
     * テーブル形式で出力
     * @param {Array|Object} data - データ
     */
    table(data) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.DEBUG) return;
        console.table(data);
    }

    /**
     * アサーション（条件が偽の場合のみ出力）
     * @param {boolean} condition - 条件
     * @param {string} message - メッセージ
     */
    assert(condition, message) {
        if (!this.enabled || this.currentLevel > this.LOG_LEVELS.WARN) return;
        console.assert(condition, message);
    }

    /**
     * 内部ログ出力メソッド
     * @private
     */
    _log(level, message, data) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        if (data !== undefined) {
            console[level](`${prefix} ${message}`, data);
        } else {
            console[level](`${prefix} ${message}`);
        }
    }

    /**
     * 設定からログレベルを更新
     * @param {Object} configLoader - ConfigLoaderインスタンス
     */
    updateFromConfig(configLoader) {
        const loader = configLoader || (typeof window !== 'undefined' ? window.ConfigLoader : null);
        if (loader && loader.loaded) {
            const loggingConfig = loader.get('logging');
            if (loggingConfig) {
                this.setLevel(loggingConfig.level || 'debug');
                this.enabled = loggingConfig.console !== false;
            }
        }
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            enabled: this.enabled,
            currentLevel: this.currentLevel,
            levelName: this.getLevelName(),
            initialized: this.initialized
        };
    }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();

