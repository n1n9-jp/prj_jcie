/**
 * ConfigLoader - 外部設定ファイルの読み込みと管理
 * JSON設定ファイルを読み込み、フォールバック値を提供
 */
class ConfigLoader {
    constructor() {
        this.configs = {
            app: null,
            theme: null,
            animation: null,
            content: null,
            settings: null,
            environment: null
        };
        this.mainConfig = null;
        this.mergedConfig = null;
        this.environment = this._detectEnvironment();
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
            // メイン設定ファイルを読み込み
            this.mainConfig = await this._loadConfig('config/main.config.json');
            if (!this.mainConfig) {
                console.warn('Main config not found, using legacy mode');
                return this._loadLegacyConfigs();
            }

            // 環境設定を読み込み
            const envConfig = await this._loadEnvironmentConfig();
            this.configs.environment = envConfig;
            
            // app-settings.jsonを読み込み（統合設定）
            if (this.mainConfig.configFiles.appSettings) {
                const appSettings = await this._loadConfig(this.mainConfig.configFiles.appSettings);
                if (appSettings) {
                    // 統合設定から個別の設定に分解
                    this.configs.app = appSettings.app || {};
                    this.configs.theme = appSettings.theme || {};
                    this.configs.animation = appSettings.animation || {};
                    this.configs.settings = {
                        transition: appSettings.transitions || {},
                        layout: appSettings.app?.layout || {},
                        responsive: { breakpoints: appSettings.breakpoints || {} }
                    };
                }
            }
            
            // content.jsonを読み込み
            if (this.mainConfig.configFiles.content) {
                this.configs.content = await this._loadConfig(this.mainConfig.configFiles.content) || {};
            }

            // 設定をマージ
            this.mergedConfig = this._mergeConfigs();

            // CSS変数を設定
            this._applyCSSVariables();

            this.loaded = true;
            
            if (this.configs.environment?.debug?.showConfigLoading) {
            }
            
            return this.mergedConfig;

        } catch (error) {
            console.error('Failed to load configurations, using defaults', error);
            return this._loadFallbackConfigs();
        }
    }

    /**
     * レガシー設定ファイル読み込み（main.config.jsonが無い場合）
     * @private
     */
    async _loadLegacyConfigs() {
        const [appConfig, themeConfig, animationConfig] = await Promise.all([
            this._loadConfig('config/app.config.json'),
            this._loadConfig('config/theme.config.json'),
            this._loadConfig('config/animation.config.json')
        ]);

        this.configs = {
            app: appConfig || this._getDefaultAppConfig(),
            theme: themeConfig || this._getDefaultThemeConfig(),
            animation: animationConfig || this._getDefaultAnimationConfig(),
            environment: this._getDefaultEnvironmentConfig()
        };

        this._applyCSSVariables();
        this.loaded = true;
        return this.configs;
    }

    /**
     * フォールバック設定読み込み
     * @private
     */
    async _loadFallbackConfigs() {
        this.configs = {
            app: this._getDefaultAppConfig(),
            theme: this._getDefaultThemeConfig(),
            animation: this._getDefaultAnimationConfig(),
            environment: this._getDefaultEnvironmentConfig(),
            settings: this._getDefaultSettingsConfig(),
            content: { steps: [] }
        };
        
        this.mergedConfig = this._mergeConfigs();
        this._applyCSSVariables();
        this.loaded = true;
        return this.mergedConfig;
    }

    /**
     * 環境設定を読み込み
     * @private
     */
    async _loadEnvironmentConfig() {
        if (!this.mainConfig?.environment) {
            return this._getDefaultEnvironmentConfig();
        }

        let envFile;
        if (this.mainConfig.environment.auto) {
            envFile = this.mainConfig.environment[this.environment];
        } else {
            envFile = this.mainConfig.environment.development; // デフォルトは開発環境
        }

        const envConfig = await this._loadConfig(envFile);
        return envConfig || this._getDefaultEnvironmentConfig();
    }

    /**
     * 設定をマージ
     * @private
     */
    _mergeConfigs() {
        const mergeStrategy = this.mainConfig?.mergeStrategy || {
            deep: true,
            arrayMerge: 'replace',
            overwriteOnConflict: true
        };

        let merged = {};

        // 環境設定をベースとして開始
        if (this.configs.environment) {
            merged = this._deepMerge(merged, this.configs.environment, mergeStrategy);
        }

        // 他の設定を順序に従ってマージ
        const loadOrder = this.mainConfig?.loadOrder || ['app', 'theme', 'animation', 'settings', 'content'];
        
        for (const configType of loadOrder) {
            if (configType !== 'environment' && this.configs[configType]) {
                merged = this._deepMerge(merged, this.configs[configType], mergeStrategy);
            }
        }

        return merged;
    }

    /**
     * 深いマージ処理
     * @private
     */
    _deepMerge(target, source, strategy) {
        if (!strategy.deep) {
            return { ...target, ...source };
        }

        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (Array.isArray(source[key])) {
                    // 配列の処理
                    if (strategy.arrayMerge === 'replace') {
                        result[key] = [...source[key]];
                    } else if (strategy.arrayMerge === 'concat') {
                        result[key] = (result[key] || []).concat(source[key]);
                    }
                } else if (typeof source[key] === 'object' && source[key] !== null) {
                    // オブジェクトの再帰マージ
                    result[key] = this._deepMerge(result[key] || {}, source[key], strategy);
                } else {
                    // プリミティブ値
                    if (strategy.overwriteOnConflict || !(key in result)) {
                        result[key] = source[key];
                    }
                }
            }
        }

        return result;
    }

    /**
     * 環境を検出
     * @private
     */
    _detectEnvironment() {
        // URLまたはホスト名から環境を判定
        const hostname = window.location.hostname;
        const isDev = hostname === 'localhost' || 
                     hostname === '127.0.0.1' || 
                     hostname.includes('local') ||
                     window.location.protocol === 'file:';
        
        return isDev ? 'development' : 'production';
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
     * デフォルト環境設定
     * @private
     */
    _getDefaultEnvironmentConfig() {
        return {
            debug: {
                enabled: false,
                verbose: false,
                showConfigLoading: false
            },
            performance: {
                enableCaching: true,
                preloadData: true,
                optimizeRenders: true
            },
            features: {
                hotReload: false,
                devTools: false
            },
            paths: {
                data: "data/",
                assets: "assets/",
                config: "config/"
            }
        };
    }

    /**
     * デフォルト設定取得
     * @private
     */
    _getDefaultSettingsConfig() {
        return {
            transition: {
                duration: 500,
                ease: "cubic-in-out"
            },
            layout: {
                textPosition: "overlay",
                chartPosition: "background"
            },
            responsive: {
                breakpoints: {
                    mobile: 768,
                    tablet: 1024,
                    desktop: 1200
                }
            }
        };
    }

    /**
     * 設定タイプに応じたデフォルト設定を取得
     * @private
     */
    _getDefaultConfig(configType) {
        switch (configType) {
            case 'app':
                return this._getDefaultAppConfig();
            case 'theme':
                return this._getDefaultThemeConfig();
            case 'animation':
                return this._getDefaultAnimationConfig();
            case 'environment':
                return this._getDefaultEnvironmentConfig();
            case 'settings':
                return this._getDefaultSettingsConfig();
            case 'content':
                return { steps: [] };
            default:
                return {};
        }
    }

    /**
     * 設定値を取得（ドット記法対応）
     * @param {string} path - 設定パス (例: 'app.layout.header.height')
     * @param {*} defaultValue - デフォルト値
     * @returns {*} 設定値
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.mergedConfig || this.configs;

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
     * マージ済み設定全体を取得
     * @returns {Object} マージ済み設定
     */
    getConfig() {
        return this.mergedConfig || this.configs;
    }

    /**
     * 特定の設定ファイルの内容を取得
     * @param {string} configType - 設定タイプ (content, settings, app, theme, animation, environment)
     * @returns {Object} 設定内容
     */
    getConfigByType(configType) {
        return this.configs[configType] || {};
    }

    /**
     * 環境設定を取得
     * @returns {Object} 環境設定
     */
    getEnvironment() {
        return {
            type: this.environment,
            config: this.configs.environment || {}
        };
    }

    /**
     * デバッグモードかどうかを判定
     * @returns {boolean} デバッグモード
     */
    isDebugMode() {
        return this.get('debug.enabled', false);
    }

    /**
     * 古いconfig.jsonと互換性のある統合設定を取得
     * @returns {Object} 統合設定（content + settings）
     */
    getLegacyCompatibleConfig() {
        const content = this.configs.content || {};
        const settings = this.configs.settings || {};
        
        return {
            steps: content.steps || [],
            settings: settings
        };
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