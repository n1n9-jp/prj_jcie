/**
 * MapStylingHelper - 地図スタイリングの共通ユーティリティクラス
 * 国境、都市マーカー、その他の地図要素のスタイリング処理を提供
 */
class MapStylingHelper {
    /**
     * 国のスタイルを計算する
     * @param {Object} countryFeature - 国の地理データ
     * @param {Object} styleConfig - スタイル設定
     * @returns {Object} スタイル情報（fill, stroke, strokeWidth）
     */
    static getCountryStyle(countryFeature, styleConfig = {}) {
        const {
            highlightCountries = [],
            useRegionColors = false,
            lightenNonVisited = false,
            visitedCountry = null,
            lightenAllCountries = false,
            targetRegions = []
        } = styleConfig;

        const countryName = this.getCountryName(countryFeature);
        let style = {
            fill: window.AppDefaults?.colors?.border?.light || '#d1d5db',
            stroke: '#fff',
            strokeWidth: '0.5'
        };

        // 地域色を適用（優先）
        if (useRegionColors && this.isRegionColoringAvailable()) {
            const regionStyle = this.getRegionStyle(countryName, {
                lightenNonVisited,
                visitedCountry,
                lightenAllCountries,
                targetRegions
            });
            
            if (regionStyle) {
                style = {
                    ...style,
                    ...regionStyle,
                    stroke: '#ccc',
                    strokeWidth: '0.75'
                };
            }
        }
        // 地域色が無効な場合のみハイライト色を適用
        else if (highlightCountries.includes(countryName)) {
            style = {
                fill: window.AppDefaults?.colors?.accent?.info || '#3b82f6',
                stroke: '#1d4ed8',
                strokeWidth: '1.5'
            };
        }

        return style;
    }

    /**
     * 地域スタイルを取得
     * @param {string} countryName - 国名
     * @param {Object} options - スタイルオプション
     * @returns {Object|null} 地域スタイル
     */
    static getRegionStyle(countryName, options = {}) {
        const {
            lightenNonVisited = false,
            visitedCountry = null,
            lightenAllCountries = false,
            targetRegions = []
        } = options;

        if (!this.isRegionColoringAvailable()) return null;

        const region = window.CountryRegionMapping.getRegionForCountry(countryName);
        if (!region) return null;

        // targetRegionsが指定されている場合、対象地域のみ色を付ける
        if (targetRegions && targetRegions.length > 0) {
            if (!targetRegions.includes(region)) {
                return { fill: '#f3f4f6' }; // 対象外の地域は薄いグレー
            }
        }

        let color = window.ColorScheme.getRegionColor(region);

        // lightenNonVisitedが有効な場合、訪問国以外を明るくする
        if (lightenNonVisited && visitedCountry && countryName !== visitedCountry) {
            color = window.ColorScheme.getLighterColor(color, 0.5);
        }
        
        // すべての国を50%明るくする（step8の場合など）
        if (lightenAllCountries) {
            color = window.ColorScheme.getLighterColor(color, 0.5);
        }

        return { fill: color };
    }

    /**
     * 国名を取得（複数のプロパティから）
     * @param {Object} countryFeature - 国の地理データ
     * @returns {string} 国名
     */
    static getCountryName(countryFeature) {
        if (!countryFeature || !countryFeature.properties) return '';
        
        const props = countryFeature.properties;
        return props.NAME || props.name || props.NAME_EN || '';
    }

    /**
     * 地域色機能が利用可能かチェック
     * @returns {boolean} 利用可能性
     */
    static isRegionColoringAvailable() {
        return !!(window.CountryRegionMapping && window.ColorScheme);
    }

    /**
     * 都市マーカーのスタイルを取得
     * @param {Object} city - 都市データ
     * @param {Object} options - スタイルオプション
     * @returns {Object} スタイル情報
     */
    static getCityMarkerStyle(city, options = {}) {
        const {
            markerType = 'default',
            useRegionColor = true,
            size = null
        } = options;

        const baseStyle = {
            fill: this.getCityColor(city, useRegionColor),
            stroke: '#fff',
            strokeWidth: 2,
            radius: size || city.style?.size || 6
        };

        switch (markerType) {
            case 'timeline':
                return {
                    ...baseStyle,
                    strokeWidth: 2,
                    radius: city.style?.size || 6
                };
            case 'single':
                return {
                    ...baseStyle,
                    strokeWidth: 3,
                    radius: (city.style?.size || 6) * 1.5
                };
            default:
                return baseStyle;
        }
    }

    /**
     * 都市の色を取得
     * @param {Object} city - 都市データ
     * @param {boolean} useRegionColor - 地域色を使用するかどうか
     * @returns {string} 色コード
     */
    static getCityColor(city, useRegionColor = true) {
        if (!city || !city.country) {
            return window.AppDefaults?.colors?.border?.medium || '#808080';
        }
        
        // 地域色機能が利用可能かチェック
        if (useRegionColor && this.isRegionColoringAvailable()) {
            const region = window.CountryRegionMapping.getRegionForCountry(city.country);
            if (region) {
                return window.ColorScheme.getRegionColor(region);
            }
        }
        
        // フォールバック：元のstyle.colorまたはデフォルト色
        return city.style?.color || window.AppDefaults?.colors?.border?.medium || '#808080';
    }

    /**
     * 都市ラベルのスタイルを取得
     * @param {Object} city - 都市データ
     * @param {Object} options - スタイルオプション
     * @returns {Object} スタイル情報
     */
    static getCityLabelStyle(city, options = {}) {
        const {
            fontSize = '12px',
            fontWeight = 'bold',
            fill = window.AppDefaults?.colors?.text?.primary || '#1f2937',
            textAnchor = 'middle',
            labelType = 'default'
        } = options;

        switch (labelType) {
            case 'timeline':
                return {
                    fontSize: '11px',
                    fontWeight,
                    fill,
                    textAnchor
                };
            case 'single':
                return {
                    fontSize: '16px',
                    fontWeight,
                    fill,
                    textAnchor
                };
            default:
                return {
                    fontSize,
                    fontWeight,
                    fill,
                    textAnchor
                };
        }
    }

    /**
     * スタイルをSVG要素に適用
     * @param {d3.Selection} selection - D3選択要素
     * @param {Object} style - スタイル情報
     * @param {Object} options - 適用オプション
     */
    static applyStyle(selection, style, options = {}) {
        const {
            transition = null,
            duration = window.AppDefaults?.animation?.shortDuration || 500
        } = options;

        const target = transition ? selection.transition(transition).duration(duration) : selection;

        Object.entries(style).forEach(([property, value]) => {
            switch (property) {
                case 'fill':
                case 'stroke':
                case 'opacity':
                    target.style(property, value);
                    break;
                case 'strokeWidth':
                    target.style('stroke-width', value);
                    break;
                case 'radius':
                    target.attr('r', value);
                    break;
                case 'fontSize':
                    target.style('font-size', value);
                    break;
                case 'fontWeight':
                    target.style('font-weight', value);
                    break;
                case 'textAnchor':
                    target.attr('text-anchor', value);
                    break;
                default:
                    // その他のプロパティは属性として設定
                    if (typeof value !== 'object') {
                        target.attr(property, value);
                    }
            }
        });
    }

    /**
     * 国境スタイルを一括適用
     * @param {d3.Selection} countrySelection - 国境要素の選択
     * @param {Object} styleConfig - スタイル設定
     * @param {Object} options - 適用オプション
     */
    static applyCountryStyles(countrySelection, styleConfig, options = {}) {
        const {
            transition = null,
            duration = window.AppDefaults?.animation?.shortDuration || 500
        } = options;

        countrySelection.each(function(d) {
            const style = MapStylingHelper.getCountryStyle(d, styleConfig);
            MapStylingHelper.applyStyle(d3.select(this), style, { transition, duration });
        });
    }

    /**
     * 都市マーカースタイルを一括適用
     * @param {d3.Selection} citySelection - 都市マーカー要素の選択
     * @param {Object} styleOptions - スタイルオプション
     * @param {Object} options - 適用オプション
     */
    static applyCityMarkerStyles(citySelection, styleOptions, options = {}) {
        const {
            transition = null,
            duration = window.AppDefaults?.animation?.shortDuration || 500
        } = options;

        citySelection.each(function(d) {
            const style = MapStylingHelper.getCityMarkerStyle(d, styleOptions);
            MapStylingHelper.applyStyle(d3.select(this), style, { transition, duration });
        });
    }

    /**
     * 都市ラベルスタイルを一括適用
     * @param {d3.Selection} labelSelection - 都市ラベル要素の選択
     * @param {Object} styleOptions - スタイルオプション
     * @param {Object} options - 適用オプション
     */
    static applyCityLabelStyles(labelSelection, styleOptions, options = {}) {
        const {
            transition = null,
            duration = window.AppDefaults?.animation?.shortDuration || 500
        } = options;

        labelSelection.each(function(d) {
            const style = MapStylingHelper.getCityLabelStyle(d, styleOptions);
            MapStylingHelper.applyStyle(d3.select(this), style, { transition, duration });
        });
    }

    /**
     * デフォルトスタイル設定を取得
     * @param {string} elementType - 要素タイプ（country, city, label）
     * @returns {Object} デフォルトスタイル
     */
    static getDefaultStyle(elementType) {
        const defaults = window.AppDefaults;
        
        switch (elementType) {
            case 'country':
                return {
                    fill: defaults?.colors?.border?.light || '#d1d5db',
                    stroke: '#fff',
                    strokeWidth: defaults?.strokeWidth?.thin || '0.5'
                };
            case 'city':
                return {
                    fill: defaults?.colors?.accent?.error || '#ef4444',
                    stroke: '#fff',
                    strokeWidth: defaults?.strokeWidth?.normal || 2,
                    radius: 6
                };
            case 'label':
                return {
                    fontSize: '12px',
                    fontWeight: 'bold',
                    fill: defaults?.colors?.text?.primary || '#1f2937',
                    textAnchor: 'middle'
                };
            default:
                return {};
        }
    }
}

// グローバルスコープで利用可能にする
window.MapStylingHelper = MapStylingHelper;