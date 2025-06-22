/**
 * ConfigHelper - 設定管理のユーティリティクラス
 * デフォルト設定、設定マージ、設定検証などの共通処理を提供
 */
class ConfigHelper {
    /**
     * デフォルトチャート設定を取得
     * @returns {Object} デフォルトチャート設定
     */
    static getDefaultChartConfig() {
        return {
            width: 800,
            height: 600,
            margin: { top: 40, right: 20, bottom: 40, left: 50 },
            colors: d3.schemeCategory10,
            transitionDuration: window.AppDefaults?.animation?.chartTransitionDuration || 1000,
            xField: 'year',
            yField: 'value',
            seriesField: 'series',
            multiSeries: true,
            showGrid: true,
            showLegend: true,
            responsive: true,
            // レスポンシブ設定
            minWidth: 300,
            maxWidth: 1200,
            minHeight: 200,
            maxHeight: 800,
            aspectRatio: null,
            widthPercent: null,
            heightPercent: null
        };
    }

    /**
     * デフォルト地図設定を取得
     * @returns {Object} デフォルト地図設定
     */
    static getDefaultMapConfig() {
        return {
            width: 800,
            height: 600,
            center: [0, 0],
            zoom: 1,
            highlightCountries: [],
            cities: [],
            transitionDuration: window.AppDefaults?.animation?.chartTransitionDuration || 1000,
            // プロジェクション設定
            projection: 'geoNaturalEarth1',
            // スタイル設定
            countryStroke: '#666',
            countryFill: '#ccc',
            highlightStroke: '#333',
            highlightFill: '#f0f0f0',
            // インタラクション設定
            enableZoom: true,
            enablePan: true,
            enableTooltip: true
        };
    }

    /**
     * デフォルト画像設定を取得
     * @returns {Object} デフォルト画像設定
     */
    static getDefaultImageConfig() {
        return {
            width: 'auto',
            height: 'auto',
            position: 'center',
            opacity: 1,
            objectFit: 'contain',
            transitionDuration: window.AppDefaults?.animation?.shortDuration || 500,
            // レスポンシブ設定
            maxWidth: '100%',
            maxHeight: '100vh',
            // エフェクト設定
            filter: null,
            transform: null
        };
    }

    /**
     * デフォルトアニメーション設定を取得
     * @returns {Object} デフォルトアニメーション設定
     */
    static getDefaultAnimationConfig() {
        return {
            duration: window.AppDefaults?.animation?.chartTransitionDuration || 1000,
            ease: d3.easeQuadInOut,
            delay: 0,
            staggerDelay: 100,
            // アクセシビリティ設定
            respectReducedMotion: true,
            reducedMotionDuration: 100
        };
    }

    /**
     * デフォルトレイアウト設定を取得
     * @returns {Object} デフォルトレイアウト設定
     */
    static getDefaultLayoutConfig() {
        return {
            textPosition: 'overlay',
            chartPosition: 'background',
            containerPadding: 20,
            // レスポンシブブレークポイント
            breakpoints: {
                mobile: 768,
                tablet: 1024,
                desktop: 1200
            }
        };
    }

    /**
     * 設定のディープマージ
     * @param {Object} defaultConfig - デフォルト設定
     * @param {Object} userConfig - ユーザー設定
     * @param {Object} options - マージオプション
     * @returns {Object} マージされた設定
     */
    static mergeConfig(defaultConfig, userConfig, options = {}) {
        const {
            arrayMergeStrategy = 'replace', // 'replace', 'concat', 'merge'
            deepMerge = true,
            validateTypes = false
        } = options;

        if (!userConfig) return defaultConfig;
        if (!defaultConfig) return userConfig;

        const merged = deepMerge ? this.deepClone(defaultConfig) : { ...defaultConfig };

        Object.keys(userConfig).forEach(key => {
            const userValue = userConfig[key];
            const defaultValue = defaultConfig[key];

            // 型検証
            if (validateTypes && defaultValue !== undefined) {
                const defaultType = Array.isArray(defaultValue) ? 'array' : typeof defaultValue;
                const userType = Array.isArray(userValue) ? 'array' : typeof userValue;
                
                if (defaultType !== userType) {
                    console.warn(`Type mismatch for config key "${key}": expected ${defaultType}, got ${userType}`);
                    return; // スキップ
                }
            }

            if (Array.isArray(userValue) && Array.isArray(defaultValue)) {
                // 配列の処理
                switch (arrayMergeStrategy) {
                    case 'concat':
                        merged[key] = [...defaultValue, ...userValue];
                        break;
                    case 'merge':
                        merged[key] = this.mergeArrays(defaultValue, userValue);
                        break;
                    case 'replace':
                    default:
                        merged[key] = [...userValue];
                        break;
                }
            } else if (this.isPlainObject(userValue) && this.isPlainObject(defaultValue)) {
                // オブジェクトの再帰的マージ
                merged[key] = this.mergeConfig(defaultValue, userValue, options);
            } else {
                // プリミティブ値の置換
                merged[key] = userValue;
            }
        });

        return merged;
    }

    /**
     * オブジェクトのディープクローン
     * @param {*} obj - クローンするオブジェクト
     * @returns {*} クローンされたオブジェクト
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }

        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = this.deepClone(obj[key]);
        });

        return cloned;
    }

    /**
     * プレーンオブジェクトかどうかの判定
     * @param {*} obj - 判定するオブジェクト
     * @returns {boolean} プレーンオブジェクトかどうか
     */
    static isPlainObject(obj) {
        return obj !== null && 
               typeof obj === 'object' && 
               !Array.isArray(obj) && 
               !(obj instanceof Date) &&
               !(obj instanceof RegExp) &&
               !(obj instanceof Function);
    }

    /**
     * 配列のマージ（重複排除）
     * @param {Array} arr1 - 配列1
     * @param {Array} arr2 - 配列2
     * @returns {Array} マージされた配列
     */
    static mergeArrays(arr1, arr2) {
        const merged = [...arr1];
        arr2.forEach(item => {
            if (!merged.includes(item)) {
                merged.push(item);
            }
        });
        return merged;
    }

    /**
     * 設定の検証
     * @param {Object} config - 検証する設定
     * @param {Object} schema - 検証スキーマ
     * @returns {Object} 検証結果 {valid: boolean, errors: Array, warnings: Array}
     */
    static validateConfig(config, schema) {
        const errors = [];
        const warnings = [];

        if (!config) {
            errors.push('Config is null or undefined');
            return { valid: false, errors, warnings };
        }

        if (!schema) {
            warnings.push('No validation schema provided');
            return { valid: true, errors, warnings };
        }

        this.validateObject(config, schema, '', errors, warnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }

    /**
     * オブジェクトの検証（再帰的）
     * @private
     */
    static validateObject(obj, schema, path, errors, warnings) {
        // 必須フィールドのチェック
        if (schema.required) {
            schema.required.forEach(field => {
                if (!(field in obj)) {
                    errors.push(`Missing required field: ${path}${field}`);
                }
            });
        }

        // フィールドの型チェック
        if (schema.properties) {
            Object.entries(schema.properties).forEach(([field, fieldSchema]) => {
                const fieldPath = path ? `${path}.${field}` : field;
                const value = obj[field];

                if (value !== undefined && value !== null) {
                    this.validateField(value, fieldSchema, fieldPath, errors, warnings);
                }
            });
        }

        // 追加フィールドのチェック
        if (schema.additionalProperties === false) {
            const allowedFields = new Set(Object.keys(schema.properties || {}));
            Object.keys(obj).forEach(field => {
                if (!allowedFields.has(field)) {
                    warnings.push(`Unexpected field: ${path}${field}`);
                }
            });
        }
    }

    /**
     * フィールドの検証
     * @private
     */
    static validateField(value, fieldSchema, path, errors, warnings) {
        // 型チェック
        if (fieldSchema.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== fieldSchema.type) {
                errors.push(`Type mismatch at ${path}: expected ${fieldSchema.type}, got ${actualType}`);
                return;
            }
        }

        // 範囲チェック（数値）
        if (typeof value === 'number') {
            if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
                errors.push(`Value at ${path} is below minimum: ${value} < ${fieldSchema.minimum}`);
            }
            if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
                errors.push(`Value at ${path} is above maximum: ${value} > ${fieldSchema.maximum}`);
            }
        }

        // 長さチェック（文字列・配列）
        if (typeof value === 'string' || Array.isArray(value)) {
            if (fieldSchema.minLength !== undefined && value.length < fieldSchema.minLength) {
                errors.push(`Length at ${path} is below minimum: ${value.length} < ${fieldSchema.minLength}`);
            }
            if (fieldSchema.maxLength !== undefined && value.length > fieldSchema.maxLength) {
                errors.push(`Length at ${path} is above maximum: ${value.length} > ${fieldSchema.maxLength}`);
            }
        }

        // 列挙値チェック
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
            errors.push(`Invalid value at ${path}: ${value} not in ${fieldSchema.enum.join(', ')}`);
        }

        // パターンチェック（文字列）
        if (typeof value === 'string' && fieldSchema.pattern) {
            const regex = new RegExp(fieldSchema.pattern);
            if (!regex.test(value)) {
                errors.push(`Pattern mismatch at ${path}: ${value} does not match ${fieldSchema.pattern}`);
            }
        }

        // ネストしたオブジェクトの検証
        if (fieldSchema.type === 'object' && fieldSchema.properties) {
            this.validateObject(value, fieldSchema, `${path}.`, errors, warnings);
        }

        // 配列要素の検証
        if (fieldSchema.type === 'array' && fieldSchema.items && Array.isArray(value)) {
            value.forEach((item, index) => {
                this.validateField(item, fieldSchema.items, `${path}[${index}]`, errors, warnings);
            });
        }
    }

    /**
     * チャート設定のスキーマを取得
     * @returns {Object} チャート設定スキーマ
     */
    static getChartConfigSchema() {
        return {
            type: 'object',
            required: ['width', 'height'],
            properties: {
                width: { type: 'number', minimum: 100, maximum: 2000 },
                height: { type: 'number', minimum: 100, maximum: 1500 },
                widthPercent: { type: 'number', minimum: 10, maximum: 100 },
                heightPercent: { type: 'number', minimum: 10, maximum: 100 },
                margin: {
                    type: 'object',
                    properties: {
                        top: { type: 'number', minimum: 0 },
                        right: { type: 'number', minimum: 0 },
                        bottom: { type: 'number', minimum: 0 },
                        left: { type: 'number', minimum: 0 }
                    }
                },
                colors: { type: 'array', minLength: 1 },
                transitionDuration: { type: 'number', minimum: 0, maximum: 5000 },
                xField: { type: 'string', minLength: 1 },
                yField: { type: 'string', minLength: 1 },
                multiSeries: { type: 'boolean' }
            }
        };
    }

    /**
     * 設定ファイルの最適化
     * @param {Object} config - 最適化する設定
     * @returns {Object} 最適化された設定
     */
    static optimizeConfig(config) {
        if (!config || !config.steps) {
            return config;
        }

        // 重複する設定を抽出
        const commonSettings = this.extractCommonSettings(config.steps);
        
        // 最適化された設定を作成
        const optimized = {
            ...config,
            commonSettings,
            steps: config.steps.map(step => this.optimizeStep(step, commonSettings))
        };

        return optimized;
    }

    /**
     * 共通設定を抽出
     * @private
     */
    static extractCommonSettings(steps) {
        const commonSettings = {};
        
        // チャート設定の共通部分を抽出
        const chartConfigs = steps
            .filter(step => step.chart && step.chart.config)
            .map(step => step.chart.config);

        if (chartConfigs.length > 1) {
            commonSettings.chart = this.findCommonProperties(chartConfigs);
        }

        // 地図設定の共通部分を抽出
        const mapConfigs = steps
            .filter(step => step.map)
            .map(step => step.map);

        if (mapConfigs.length > 1) {
            commonSettings.map = this.findCommonProperties(mapConfigs);
        }

        return commonSettings;
    }

    /**
     * 共通プロパティを見つける
     * @private
     */
    static findCommonProperties(configs) {
        if (!configs || configs.length === 0) return {};
        
        const firstConfig = configs[0];
        const common = {};

        Object.keys(firstConfig).forEach(key => {
            const values = configs.map(config => config[key]);
            const allSame = values.every(value => 
                JSON.stringify(value) === JSON.stringify(values[0])
            );

            if (allSame) {
                common[key] = values[0];
            }
        });

        return common;
    }

    /**
     * ステップ設定を最適化
     * @private
     */
    static optimizeStep(step, commonSettings) {
        const optimized = { ...step };

        // チャート設定から共通部分を除去
        if (optimized.chart && optimized.chart.config && commonSettings.chart) {
            optimized.chart.config = this.removeCommonProperties(
                optimized.chart.config,
                commonSettings.chart
            );
        }

        // 地図設定から共通部分を除去
        if (optimized.map && commonSettings.map) {
            optimized.map = this.removeCommonProperties(
                optimized.map,
                commonSettings.map
            );
        }

        return optimized;
    }

    /**
     * 共通プロパティを除去
     * @private
     */
    static removeCommonProperties(config, commonConfig) {
        const filtered = {};

        Object.keys(config).forEach(key => {
            if (!(key in commonConfig) || 
                JSON.stringify(config[key]) !== JSON.stringify(commonConfig[key])) {
                filtered[key] = config[key];
            }
        });

        return filtered;
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.ConfigHelper = ConfigHelper;