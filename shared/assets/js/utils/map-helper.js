import * as d3 from 'd3';
import { countryRegionMapping } from './country-region-mapping.js';
import { colorScheme } from './color-scheme.js';
import { AppDefaults } from '../config/defaults.js';

/**
 * MapHelper - 地図関連のユーティリティクラス（統合版）
 *
 * 統合内容:
 * - MapProjectionHelper（プロジェクション・座標変換）
 * - MapStylingHelper（地図スタイリング）
 *
 * 責務:
 * - 地図のプロジェクション管理と座標変換
 * - 地図要素（国、都市、ラベル）のスタイリング
 * - スタイルのSVG要素への適用
 */

export class MapHelper {

    // ================================================
    // セクション 1: プロジェクション管理
    // ================================================

    /**
     * 標準的な地図プロジェクションを作成
     * @param {Object} config - プロジェクション設定
     * @returns {Function} D3プロジェクション関数
     */
    static createProjection(config = {}) {
        const {
            type = 'naturalEarth1',
            scale = 150,
            center = [0, 0],
            width = 800,
            height = 600
        } = config;

        let projection;

        switch (type) {
            case 'naturalEarth1':
                projection = d3.geoNaturalEarth1();
                break;
            case 'mercator':
                projection = d3.geoMercator();
                break;
            case 'orthographic':
                projection = d3.geoOrthographic();
                break;
            default:
                projection = d3.geoNaturalEarth1();
        }

        return projection
            .scale(scale)
            .center(center)
            .translate([width / 2, height / 2]);
    }

    /**
     * プロジェクションを指定した設定にアニメーション
     * @param {Function} projection - 現在のプロジェクション
     * @param {Object} targetConfig - ターゲット設定
     * @param {d3.Selection} svg - SVG要素
     * @param {Function} pathGenerator - パスジェネレーター
     * @param {Object} options - アニメーションオプション
     * @returns {Promise} アニメーション完了のPromise
     */
    static animateProjectionTo(projection, targetConfig, svg, pathGenerator, options = {}) {
        const {
            duration = AppDefaults?.animation?.chartTransitionDuration || 1000,
            ease = d3.easeCubicInOut,
            onUpdate = null,
            onComplete = null
        } = options;

        return new Promise((resolve) => {
            const currentCenter = projection.center();
            const currentScale = projection.scale();
            const targetCenter = targetConfig.center || currentCenter;
            const targetScale = targetConfig.scale || currentScale;

            svg.transition()
                .duration(duration)
                .ease(ease)
                .tween('projection', () => {
                    const interpolateCenter = d3.interpolate(currentCenter, targetCenter);
                    const interpolateScale = d3.interpolate(currentScale, targetScale);

                    return (t) => {
                        projection
                            .center(interpolateCenter(t))
                            .scale(interpolateScale(t));

                        // パスを再描画
                        svg.selectAll('.map-country')
                            .attr('d', pathGenerator);

                        // 都市マーカーや他の要素も更新
                        MapHelper.updateProjectedElements(svg, projection);

                        if (onUpdate) {
                            onUpdate(t, projection);
                        }
                    };
                })
                .on('end', () => {
                    if (onComplete) onComplete();
                    resolve();
                });
        });
    }

    /**
     * プロジェクションに依存する要素を更新
     * @param {d3.Selection} svg - SVG要素
     * @param {Function} projection - プロジェクション関数
     */
    static updateProjectedElements(svg, projection) {
        // 都市マーカーを更新
        svg.selectAll('.map-city, .timeline-city, .single-city-marker')
            .attr('cx', d => {
                const coords = MapHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[0];
            })
            .attr('cy', d => {
                const coords = MapHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[1];
            });

        // 都市ラベルを更新
        svg.selectAll('.city-label, .timeline-label, .single-city-label')
            .attr('x', d => {
                const coords = MapHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[0];
            })
            .attr('y', d => {
                const coords = MapHelper.safeProjection(projection, [d.longitude, d.latitude]);
                const offset = d.style?.size ? d.style.size + 5 : 15;
                return coords[1] - offset;
            });
    }

    /**
     * プロジェクション設定の妥当性を検証
     * @param {Object} config - プロジェクション設定
     * @returns {Object} 検証結果
     */
    static validateProjectionConfig(config) {
        const errors = [];

        if (!config) {
            errors.push('Projection config is required');
            return { valid: false, errors };
        }

        const { center, scale, width, height } = config;

        if (center && (!Array.isArray(center) || center.length < 2)) {
            errors.push('Center must be an array with longitude and latitude');
        }

        if (scale && (typeof scale !== 'number' || scale <= 0)) {
            errors.push('Scale must be a positive number');
        }

        if (width && (typeof width !== 'number' || width <= 0)) {
            errors.push('Width must be a positive number');
        }

        if (height && (typeof height !== 'number' || height <= 0)) {
            errors.push('Height must be a positive number');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // ================================================
    // セクション 2: 座標変換・計算
    // ================================================

    /**
     * 地理的座標から画面座標への安全な変換
     * @param {Function} projection - D3のプロジェクション関数
     * @param {Array} coordinates - [経度, 緯度]の配列
     * @param {Array} fallback - 変換失敗時のフォールバック座標
     * @returns {Array} 変換された座標 [x, y]
     */
    static safeProjection(projection, coordinates, fallback = [0, 0]) {
        try {
            if (!projection || !coordinates || coordinates.length < 2) {
                return fallback;
            }

            const [longitude, latitude] = coordinates;

            // 有効な座標値の範囲チェック
            if (isNaN(longitude) || isNaN(latitude) ||
                longitude < -180 || longitude > 180 ||
                latitude < -90 || latitude > 90) {
                console.warn('Invalid coordinates:', coordinates);
                return fallback;
            }

            const result = projection(coordinates);
            return result || fallback;

        } catch (error) {
            console.warn('Projection failed:', error);
            return fallback;
        }
    }

    /**
     * 地理的座標から画面座標への変換
     * @param {Function} projection - プロジェクション関数
     * @param {number} longitude - 経度
     * @param {number} latitude - 緯度
     * @param {Array} fallback - 変換失敗時のフォールバック座標
     * @returns {Array} 画面座標 [x, y]
     */
    static projectCoordinate(projection, longitude, latitude, fallback = [0, 0]) {
        return MapHelper.safeProjection(projection, [longitude, latitude], fallback);
    }

    /**
     * 都市データの座標を一括変換
     * @param {Function} projection - プロジェクション関数
     * @param {Array} cities - 都市データ配列
     * @returns {Array} 変換された都市データ（画面座標付き）
     */
    static projectCities(projection, cities) {
        if (!Array.isArray(cities)) return [];

        return cities.map(city => {
            const coords = this.projectCoordinate(projection, city.longitude, city.latitude);
            return {
                ...city,
                screenX: coords[0],
                screenY: coords[1]
            };
        });
    }

    /**
     * 地図の表示領域を都市に合わせて計算
     * @param {Array} cities - 都市データ配列
     * @param {Object} options - 計算オプション
     * @returns {Object} 中心座標とズームレベル
     */
    static calculateOptimalView(cities, options = {}) {
        const {
            padding = 0.1,        // 余白（0-1の比率）
            minZoom = 1,
            maxZoom = 10,
            defaultZoom = 1
        } = options;

        if (!Array.isArray(cities) || cities.length === 0) {
            return {
                center: [0, 0],
                zoom: defaultZoom
            };
        }

        // 都市の座標から境界を計算
        const longitudes = cities.map(city => city.longitude).filter(lon => !isNaN(lon));
        const latitudes = cities.map(city => city.latitude).filter(lat => !isNaN(lat));

        if (longitudes.length === 0 || latitudes.length === 0) {
            return {
                center: [0, 0],
                zoom: defaultZoom
            };
        }

        const minLon = Math.min(...longitudes);
        const maxLon = Math.max(...longitudes);
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);

        // 中心座標を計算
        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;

        // ズームレベルを計算（簡易版）
        const lonSpan = maxLon - minLon;
        const latSpan = maxLat - minLat;
        const maxSpan = Math.max(lonSpan, latSpan);

        let zoom = defaultZoom;
        if (maxSpan > 0) {
            // スパンに基づいてズームを計算（パディングを考慮）
            zoom = Math.max(minZoom, Math.min(maxZoom, 360 / (maxSpan * (1 + padding))));
        }

        return {
            center: [centerLon, centerLat],
            zoom: zoom
        };
    }

    /**
     * 地図の境界矩形を取得
     * @param {Function} projection - プロジェクション関数
     * @param {Object} geoData - GeoJSONデータ
     * @returns {Object} 境界矩形
     */
    static getMapBounds(projection, geoData) {
        if (!geoData || !geoData.features) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }

        const coordinates = [];

        geoData.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                // 簡易的に座標を取得（ポリゴンの場合）
                const coords = feature.geometry.coordinates;
                if (coords && coords[0] && Array.isArray(coords[0])) {
                    coords[0].forEach(coord => {
                        if (Array.isArray(coord) && coord.length >= 2) {
                            const projected = this.safeProjection(projection, coord);
                            coordinates.push(projected);
                        }
                    });
                }
            }
        });

        return this.calculateBounds(coordinates);
    }

    /**
     * 座標配列の境界矩形計算
     * @param {Array} coordinates - 座標配列
     * @returns {Object} 境界矩形 {minX, maxX, minY, maxY}
     */
    static calculateBounds(coordinates) {
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        coordinates.forEach(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
                const [x, y] = coord;
                if (!isNaN(x) && !isNaN(y)) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        });

        // 有効な座標が見つからない場合のフォールバック
        if (minX === Infinity) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * 中心点計算
     * @param {Array} coordinates - 座標配列
     * @returns {Array} 中心座標 [x, y]
     */
    static calculateCentroid(coordinates) {
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            return [0, 0];
        }

        let totalX = 0, totalY = 0, validCount = 0;

        coordinates.forEach(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
                const [x, y] = coord;
                if (!isNaN(x) && !isNaN(y)) {
                    totalX += x;
                    totalY += y;
                    validCount++;
                }
            }
        });

        if (validCount === 0) {
            return [0, 0];
        }

        return [totalX / validCount, totalY / validCount];
    }

    // ================================================
    // セクション 3: スタイル取得
    // ================================================

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
            fill: AppDefaults?.colors?.border?.light || '#d1d5db',
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
                fill: AppDefaults?.colors?.accent?.info || '#3b82f6',
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

        const region = countryRegionMapping.getRegionForCountry(countryName);
        if (!region) return null;

        // targetRegionsが指定されている場合、対象地域のみ色を付ける
        if (targetRegions && targetRegions.length > 0) {
            if (!targetRegions.includes(region)) {
                return { fill: '#f3f4f6' }; // 対象外の地域は薄いグレー
            }
        }

        let color = colorScheme.getRegionColor(region);

        // lightenNonVisitedが有効な場合、訪問国以外を明るくする
        if (lightenNonVisited && visitedCountry && countryName !== visitedCountry) {
            color = colorScheme.getLighterColor(color, 0.5);
        }

        // すべての国を50%明るくする（step8の場合など）
        if (lightenAllCountries) {
            color = colorScheme.getLighterColor(color, 0.5);
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
        return !!(countryRegionMapping && colorScheme);
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
            return AppDefaults?.colors?.border?.medium || '#808080';
        }

        // 地域色機能が利用可能かチェック
        if (useRegionColor && this.isRegionColoringAvailable()) {
            const region = countryRegionMapping.getRegionForCountry(city.country);
            if (region) {
                return colorScheme.getRegionColor(region);
            }
        }

        // フォールバック：元のstyle.colorまたはデフォルト色
        return city.style?.color || AppDefaults?.colors?.border?.medium || '#808080';
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
            fill = AppDefaults?.colors?.text?.primary || '#1f2937',
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
     * デフォルトスタイル設定を取得
     * @param {string} elementType - 要素タイプ（country, city, label）
     * @returns {Object} デフォルトスタイル
     */
    static getDefaultStyle(elementType) {
        const defaults = AppDefaults;

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

    // ================================================
    // セクション 4: スタイル適用
    // ================================================

    /**
     * スタイルをSVG要素に適用
     * @param {d3.Selection} selection - D3選択要素
     * @param {Object} style - スタイル情報
     * @param {Object} options - 適用オプション
     */
    static applyStyle(selection, style, options = {}) {
        const {
            transition = null,
            duration = AppDefaults?.animation?.shortDuration || 500
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
            duration = AppDefaults?.animation?.shortDuration || 500
        } = options;

        countrySelection.each(function (d) {
            const style = MapHelper.getCountryStyle(d, styleConfig);
            MapHelper.applyStyle(d3.select(this), style, { transition, duration });
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
            duration = AppDefaults?.animation?.shortDuration || 500
        } = options;

        citySelection.each(function (d) {
            const style = MapHelper.getCityMarkerStyle(d, styleOptions);
            MapHelper.applyStyle(d3.select(this), style, { transition, duration });
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
            duration = AppDefaults?.animation?.shortDuration || 500
        } = options;

        labelSelection.each(function (d) {
            const style = MapHelper.getCityLabelStyle(d, styleOptions);
            MapHelper.applyStyle(d3.select(this), style, { transition, duration });
        });
    }
}


