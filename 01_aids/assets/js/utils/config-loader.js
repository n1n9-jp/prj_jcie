/**
 * ConfigLoader - 外部設定ファイルの読み込みと管理
 * JSON設定ファイルを読み込み、フォールバック値を提供
 */
class ConfigLoader {
    constructor() {
        this.configs = {
            app: null,
            theme: null,
            animation: null
        };
        this.loaded = false;
        this.loadPromise = null;
    }

    /**
     * 全ての設定ファイルを読み込む
     * @returns {Promise<Object>} 読み込まれた設定
     */
    async loadAll() {
        if (this.loaded) {
            return this.configs;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = this._loadConfigs();
        return this.loadPromise;
    }

    /**
     * 設定ファイルを実際に読み込む
     * @private
     */
    async _loadConfigs() {
        try {
            const [appConfig, themeConfig, animationConfig] = await Promise.all([
                this._loadConfig('config/app.config.json'),
                this._loadConfig('config/theme.config.json'),
                this._loadConfig('config/animation.config.json')
            ]);

            this.configs = {
                app: appConfig || this._getDefaultAppConfig(),
                theme: themeConfig || this._getDefaultThemeConfig(),
                animation: animationConfig || this._getDefaultAnimationConfig()
            };

            // CSS変数を設定
            this._applyCSSVariables();

            this.loaded = true;
            console.log('All configurations loaded successfully', this.configs);
            return this.configs;

        } catch (error) {
            console.error('Failed to load configurations, using defaults', error);
            this.configs = {
                app: this._getDefaultAppConfig(),
                theme: this._getDefaultThemeConfig(),
                animation: this._getDefaultAnimationConfig()
            };
            this._applyCSSVariables();
            this.loaded = true;
            return this.configs;
        }
    }

    /**
     * 単一の設定ファイルを読み込む
     * @private
     */
    async _loadConfig(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`Failed to load ${path}:`, error);
            return null;
        }
    }

    /**
     * CSS変数を設定
     * @private
     */
    _applyCSSVariables() {
        const root = document.documentElement;

        // アニメーション時間
        if (this.configs.animation?.durations) {
            Object.entries(this.configs.animation.durations).forEach(([key, value]) => {
                root.style.setProperty(`--animation-${this._kebabCase(key)}`, `${value}ms`);
            });
        }

        // イージング関数
        if (this.configs.animation?.easings) {
            Object.entries(this.configs.animation.easings).forEach(([key, value]) => {
                root.style.setProperty(`--easing-${this._kebabCase(key)}`, value);
            });
        }

        // 色設定
        if (this.configs.theme?.colors) {
            this._flattenObject(this.configs.theme.colors, 'color').forEach(({ key, value }) => {
                root.style.setProperty(`--${key}`, value);
            });
        }

        // 影
        if (this.configs.theme?.shadows) {
            Object.entries(this.configs.theme.shadows).forEach(([key, value]) => {
                root.style.setProperty(`--shadow-${this._kebabCase(key)}`, value);
            });
        }

        // スペーシング
        if (this.configs.app?.spacing) {
            Object.entries(this.configs.app.spacing).forEach(([key, value]) => {
                root.style.setProperty(`--spacing-${key}`, `${value}px`);
            });
        }

        // フォントサイズ
        if (this.configs.app?.typography?.fontSizes) {
            Object.entries(this.configs.app.typography.fontSizes).forEach(([key, value]) => {
                root.style.setProperty(`--font-size-${key}`, `${value}px`);
            });
        }

        // レイアウト
        if (this.configs.app?.layout) {
            root.style.setProperty(`--header-height`, `${this.configs.app.layout.header.height}px`);
            root.style.setProperty(`--content-max-width`, `${this.configs.app.layout.content.maxWidth}px`);
        }

        // z-index
        if (this.configs.app?.zIndex) {
            Object.entries(this.configs.app.zIndex).forEach(([key, value]) => {
                root.style.setProperty(`--z-${this._kebabCase(key)}`, value);
            });
        }
    }

    /**
     * オブジェクトをフラット化
     * @private
     */
    _flattenObject(obj, prefix = '') {
        const result = [];
        
        const flatten = (current, path = []) => {
            Object.entries(current).forEach(([key, value]) => {
                const newPath = [...path, this._kebabCase(key)];
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flatten(value, newPath);
                } else {
                    result.push({
                        key: [prefix, ...newPath].filter(Boolean).join('-'),
                        value: value
                    });
                }
            });
        };
        
        flatten(obj);
        return result;
    }

    /**
     * camelCaseをkebab-caseに変換
     * @private
     */
    _kebabCase(str) {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    }

    /**
     * デフォルトのアプリケーション設定
     * @private
     */
    _getDefaultAppConfig() {
        return {
            layout: {
                header: { height: 60, zIndex: 1000 },
                content: { maxWidth: 1200, padding: { desktop: 32, tablet: 24, mobile: 16 } },
                sticky: { offset: 60, zIndex: 100 }
            },
            breakpoints: { mobile: 480, tablet: 768, desktop: 1024, wide: 1200 },
            spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
            charts: {
                margins: { top: 20, right: 20, bottom: 40, left: 60 },
                minSizes: { width: 300, height: 200 }
            },
            zIndex: {
                background: -1, default: 1, sticky: 10,
                dropdown: 100, modal: 1000, tooltip: 1050
            }
        };
    }

    /**
     * デフォルトのテーマ設定
     * @private
     */
    _getDefaultThemeConfig() {
        return {
            colors: {
                primary: { blue: '#2563eb' },
                text: { primary: '#1f2937', secondary: '#374151', body: '#4b5563' },
                background: { white: '#ffffff', light: '#f9fafb', gray: '#f3f4f6' },
                border: { light: '#e5e7eb', default: '#d1d5db' }
            },
            shadows: {
                sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
            }
        };
    }

    /**
     * デフォルトのアニメーション設定
     * @private
     */
    _getDefaultAnimationConfig() {
        return {
            durations: {
                instant: 0, fast: 150, short: 300,
                default: 500, long: 800, slow: 1200
            },
            easings: {
                linear: 'linear', ease: 'ease',
                easeIn: 'ease-in', easeOut: 'ease-out',
                easeInOut: 'ease-in-out'
            }
        };
    }

    /**
     * 設定値を取得（ドット記法対応）
     * @param {string} path - 設定パス (例: 'app.layout.header.height')
     * @param {*} defaultValue - デフォルト値
     * @returns {*} 設定値
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.configs;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * アニメーション時間を取得
     * @param {string} name - 時間名
     * @returns {number} ミリ秒
     */
    getAnimationDuration(name) {
        return this.get(`animation.durations.${name}`, 500);
    }

    /**
     * 色を取得
     * @param {string} path - 色のパス
     * @returns {string} 色コード
     */
    getColor(path) {
        return this.get(`theme.colors.${path}`, '#000000');
    }

    /**
     * ブレークポイントを取得
     * @param {string} name - ブレークポイント名
     * @returns {number} ピクセル値
     */
    getBreakpoint(name) {
        return this.get(`app.breakpoints.${name}`, 768);
    }
}

// グローバルインスタンスを作成
window.ConfigLoader = new ConfigLoader();

// 既存のコードとの互換性のため、設定を即座に読み込む
(async () => {
    await window.ConfigLoader.loadAll();
})();