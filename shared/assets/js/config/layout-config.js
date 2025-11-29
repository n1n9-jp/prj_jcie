/**
 * LayoutConfig - 統一レイアウト設定
 *
 * 全てのチャートレイアウトタイプの標準設定を提供
 * レイアウトの一貫性と保守性を確保
 */
export class LayoutConfig {
    /**
     * レイアウトタイプ定数
     */
    static LAYOUT_TYPES = {
        SINGLE: 'single',
        DUAL: 'dual',
        TRIPLE: 'triple',
        GRID: 'grid'
    };

    /**
     * レスポンシブブレークポイント設定
     */
    static BREAKPOINTS = {
        mobile: 768,
        tablet: 1024,
        desktop: 1440
    };

    /**
     * レイアウトプリセット
     */
    static PRESETS = {
        // Single Layout Presets
        SINGLE_FULL: {
            type: 'single',
            position: {
                width: '100%',
                height: '80%',
                horizontal: 'center',
                vertical: 'center'
            }
        },
        SINGLE_COMPACT: {
            type: 'single',
            position: {
                width: '80%',
                height: '60%',
                horizontal: 'center',
                vertical: 'center'
            }
        },

        // Dual Layout Presets
        DUAL_HORIZONTAL: {
            type: 'dual',
            position: {
                width: '90%',
                height: '70%',
                horizontal: 'center',
                vertical: 'center'
            },
            arrangement: 'horizontal',
            spacing: 40,
            aspectRatio: [1, 1] // 各チャートの比率
        },
        DUAL_VERTICAL: {
            type: 'dual',
            position: {
                width: '80%',
                height: '90%',
                horizontal: 'center',
                vertical: 'center'
            },
            arrangement: 'vertical',
            spacing: 30,
            aspectRatio: [1, 1]
        },
        DUAL_ASYMMETRIC: {
            type: 'dual',
            position: {
                width: '95%',
                height: '70%',
                horizontal: 'center',
                vertical: 'center'
            },
            arrangement: 'horizontal',
            spacing: 40,
            aspectRatio: [3, 2] // 左が大きい
        },

        // Triple Layout Presets
        TRIPLE_HORIZONTAL: {
            type: 'triple',
            position: {
                width: '95%',
                height: '60%',
                horizontal: 'center',
                vertical: 'center'
            },
            arrangement: 'horizontal',
            spacing: 30,
            aspectRatio: [1, 1, 1]
        },
        TRIPLE_PYRAMID: {
            type: 'triple',
            position: {
                width: '90%',
                height: '80%',
                horizontal: 'center',
                vertical: 'center'
            },
            arrangement: 'pyramid', // 2上1下
            spacing: 30,
            aspectRatio: [1, 1, 2]
        },

        // Grid Layout Presets
        GRID_AUTO: {
            type: 'grid',
            gridMode: 'auto', // データから自動計算
            position: {
                width: '95%',
                height: '85%',
                horizontal: 'center',
                vertical: 'center'
            },
            chartSize: {
                width: 120,
                height: 120
            },
            spacing: {
                column: 20,
                row: 40
            }
        },
        GRID_FIXED_7x2: {
            type: 'grid',
            gridMode: 'fixed',
            columns: 7,
            rows: 2,
            position: {
                width: '100%',
                height: '70%',
                horizontal: 'center',
                vertical: 'center'
            },
            chartSize: {
                width: 120,
                height: 120
            },
            spacing: {
                column: 20,
                row: 50
            }
        },
        GRID_COMPACT: {
            type: 'grid',
            gridMode: 'auto',
            position: {
                width: '90%',
                height: '70%',
                horizontal: 'center',
                vertical: 'center'
            },
            chartSize: {
                width: 100,
                height: 100
            },
            spacing: {
                column: 15,
                row: 30
            }
        }
    };

    /**
     * デフォルト設定
     */
    static DEFAULTS = {
        // Single Layout
        single: {
            margin: { top: 40, right: 60, bottom: 40, left: 60 },
            minWidth: 400,
            maxWidth: 1200,
            minHeight: 300,
            maxHeight: 800,
            aspectRatio: 16 / 9
        },

        // Dual Layout
        dual: {
            spacing: 40,
            arrangement: 'horizontal',
            minTotalWidth: 800,
            maxTotalWidth: 1400,
            minTotalHeight: 400,
            maxTotalHeight: 800,
            chartMargin: { top: 30, right: 30, bottom: 30, left: 50 }
        },

        // Triple Layout
        triple: {
            spacing: 30,
            arrangement: 'horizontal',
            minTotalWidth: 900,
            maxTotalWidth: 1600,
            minTotalHeight: 300,
            maxTotalHeight: 700,
            chartMargin: { top: 25, right: 25, bottom: 25, left: 45 }
        },

        // Grid Layout
        grid: {
            chartSize: { width: 120, height: 120 },
            spacing: { column: 20, row: 40 },
            maxColumns: 10,
            maxRows: 5,
            labelConfig: {
                showLabels: true,
                showPercentages: true,
                fontSize: 12
            }
        }
    };

    /**
     * チャートサイズ設定（レスポンシブ）
     */
    static CHART_SIZES = {
        default: {
            width: 800,
            height: 600
        },
        small: {
            width: 600,
            height: 400
        }
    };

    /**
     * チャートマージン設定（レスポンシブ）
     */
    static CHART_MARGINS = {
        default: {
            top: 40,
            right: 20,
            bottom: 40,
            left: 50
        },
        compact: {
            top: 20,
            right: 20,
            bottom: 40,
            left: 40
        },
        minimal: {
            top: 20,
            right: 20,
            bottom: 40,
            left: 50
        },
        none: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    };

    /**
     * レイアウト設定を取得
     * @param {string} layoutType - レイアウトタイプ
     * @param {Object} customConfig - カスタム設定
     * @returns {Object} マージされた設定
     */
    static getLayoutConfig(layoutType, customConfig = {}) {
        const defaults = this.DEFAULTS[layoutType] || this.DEFAULTS.single;
        return this.deepMerge(defaults, customConfig);
    }

    /**
     * プリセットを取得
     * @param {string} presetName - プリセット名
     * @param {Object} overrides - 上書き設定
     * @returns {Object} プリセット設定
     */
    static getPreset(presetName, overrides = {}) {
        const preset = this.PRESETS[presetName];
        if (!preset) {
            console.warn(`LayoutConfig: Unknown preset '${presetName}'`);
            return null;
        }
        return this.deepMerge(preset, overrides);
    }

    // ============================================
    // LayoutHelper メソッド（統合）
    // ============================================

    /**
     * グリッドレイアウトの自動計算
     * @param {number} itemCount - アイテム数
     * @param {Object} constraints - 制約条件
     * @returns {Object} 計算されたグリッド設定
     */
    static calculateOptimalGrid(itemCount, constraints = {}) {
        const {
            maxColumns = this.DEFAULTS.grid.maxColumns,
            maxRows = this.DEFAULTS.grid.maxRows,
            aspectRatio = 1,
            containerAspectRatio = 16 / 9
        } = constraints;

        let optimalColumns = Math.ceil(Math.sqrt(itemCount * containerAspectRatio / aspectRatio));
        optimalColumns = Math.min(optimalColumns, maxColumns);
        optimalColumns = Math.max(optimalColumns, 1);

        let optimalRows = Math.ceil(itemCount / optimalColumns);
        optimalRows = Math.min(optimalRows, maxRows);

        if (optimalColumns * optimalRows < itemCount) {
            optimalColumns = Math.ceil(itemCount / optimalRows);
        }

        return {
            columns: optimalColumns,
            rows: optimalRows,
            totalItems: itemCount,
            actualItems: optimalColumns * optimalRows
        };
    }

    /**
     * レイアウト位置を計算
     * @param {Object} position - position設定
     * @param {Object} containerSize - コンテナサイズ
     * @returns {Object} 計算された位置とサイズ
     */
    static calculateLayoutPosition(position, containerSize) {
        const {
            width = '100%',
            height = '100%',
            horizontal = 'center',
            vertical = 'center'
        } = position;

        const { containerWidth, containerHeight } = containerSize;

        const layoutWidth = this.parseDimension(width, containerWidth);
        const layoutHeight = this.parseDimension(height, containerHeight);

        let x = 0, y = 0;

        switch (horizontal) {
            case 'left':
                x = 0;
                break;
            case 'right':
                x = containerWidth - layoutWidth;
                break;
            case 'center':
            default:
                x = (containerWidth - layoutWidth) / 2;
                break;
        }

        switch (vertical) {
            case 'top':
                y = 0;
                break;
            case 'bottom':
                y = containerHeight - layoutHeight;
                break;
            case 'center':
            default:
                y = (containerHeight - layoutHeight) / 2;
                break;
        }

        return {
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: layoutWidth,
            height: layoutHeight
        };
    }

    /**
     * ディメンション値をパース
     * @param {string|number} value - 値
     * @param {number} referenceSize - 参照サイズ
     * @returns {number} 計算された値
     */
    static parseDimension(value, referenceSize) {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string' && value.endsWith('%')) {
            const percentage = parseFloat(value) / 100;
            return referenceSize * percentage;
        }
        if (typeof value === 'string' && value.endsWith('px')) {
            return parseFloat(value);
        }
        return parseFloat(value) || referenceSize;
    }

    /**
     * レイアウト設定を検証
     * @param {Object} config - 設定オブジェクト
     * @param {string} layoutType - レイアウトタイプ
     * @returns {Object} 検証結果
     */
    static validateLayoutConfig(config, layoutType) {
        const errors = [];
        const warnings = [];

        if (!config || typeof config !== 'object') {
            errors.push('Config must be an object');
            return { valid: false, errors, warnings };
        }

        switch (layoutType) {
            case 'dual':
                if (config.charts && !Array.isArray(config.charts)) {
                    errors.push('Dual layout requires charts array');
                }
                if (config.charts && config.charts.length !== 2) {
                    warnings.push('Dual layout expects exactly 2 charts');
                }
                break;

            case 'triple':
                if (config.charts && !Array.isArray(config.charts)) {
                    errors.push('Triple layout requires charts array');
                }
                if (config.charts && config.charts.length !== 3) {
                    warnings.push('Triple layout expects exactly 3 charts');
                }
                break;

            case 'grid':
                if (config.gridMode === 'fixed' && (!config.columns || !config.rows)) {
                    errors.push('Fixed grid mode requires columns and rows');
                }
                if (config.columns > this.DEFAULTS.grid.maxColumns) {
                    warnings.push(`Column count ${config.columns} exceeds recommended maximum ${this.DEFAULTS.grid.maxColumns}`);
                }
                break;
        }

        if (config.position) {
            const validHorizontal = ['left', 'center', 'right'];
            const validVertical = ['top', 'center', 'bottom'];

            if (config.position.horizontal && !validHorizontal.includes(config.position.horizontal)) {
                errors.push(`Invalid horizontal position: ${config.position.horizontal}`);
            }
            if (config.position.vertical && !validVertical.includes(config.position.vertical)) {
                errors.push(`Invalid vertical position: ${config.position.vertical}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * ディープマージユーティリティ
     * @param {Object} target - ターゲットオブジェクト
     * @param {Object} source - ソースオブジェクト
     * @returns {Object} マージされたオブジェクト
     */
    static deepMerge(target, source) {
        const output = { ...target };

        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }

        return output;
    }

    /**
     * オブジェクト判定
     * @param {*} item - 判定対象
     * @returns {boolean} オブジェクトかどうか
     */
    static isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    // ============================================
    // ResponsiveHelper メソッド（統合）
    // ============================================

    /**
     * レスポンシブブレークポイントをチェック
     * @param {string} breakpoint - 'mobile', 'tablet', 'desktop'
     * @returns {boolean}
     */
    static isBreakpoint(breakpoint) {
        const width = window.innerWidth;
        switch (breakpoint) {
            case 'mobile':
                return width < this.BREAKPOINTS.mobile;
            case 'tablet':
                return width >= this.BREAKPOINTS.mobile && width < this.BREAKPOINTS.tablet;
            case 'desktop':
                return width >= this.BREAKPOINTS.tablet;
            default:
                return false;
        }
    }

    /**
     * レスポンシブサイズを取得
     * @returns {Object} {width, height}
     */
    static getResponsiveSize() {
        if (this.isBreakpoint('mobile')) {
            return this.CHART_SIZES.small;
        }
        return this.CHART_SIZES.default;
    }

    /**
     * レスポンシブマージンを取得
     * @param {string} type - 'default', 'compact', 'minimal', 'none'
     * @returns {Object} {top, right, bottom, left}
     */
    static getResponsiveMargin(type = 'default') {
        const marginType = this.isBreakpoint('mobile') ? 'compact' : type;
        return this.CHART_MARGINS[marginType] || this.CHART_MARGINS.default;
    }

    /**
     * 現在のデバイスタイプを取得
     * @returns {string} 'mobile', 'tablet', 'desktop'
     */
    static getCurrentDeviceType() {
        if (this.isBreakpoint('mobile')) {
            return 'mobile';
        } else if (this.isBreakpoint('tablet')) {
            return 'tablet';
        }
        return 'desktop';
    }

    /**
     * ウィンドウサイズを取得
     * @returns {Object} {width, height}
     */
    static getWindowSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }
}