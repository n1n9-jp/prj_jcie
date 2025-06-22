/**
 * MapProjectionHelper - 地図プロジェクションと座標変換のユーティリティクラス
 * D3.jsの地理的プロジェクションに関する共通処理を提供
 * CoordinateHelperの機能を統合（2024年6月）
 */
class MapProjectionHelper {
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
            duration = window.AppDefaults?.animation?.chartTransitionDuration || 1000,
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
                        MapProjectionHelper.updateProjectedElements(svg, projection);
                        
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
                const coords = CoordinateHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[0];
            })
            .attr('cy', d => {
                const coords = CoordinateHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[1];
            });
        
        // 都市ラベルを更新
        svg.selectAll('.city-label, .timeline-label, .single-city-label')
            .attr('x', d => {
                const coords = CoordinateHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[0];
            })
            .attr('y', d => {
                const coords = CoordinateHelper.safeProjection(projection, [d.longitude, d.latitude]);
                const offset = d.style?.size ? d.style.size + 5 : 15;
                return coords[1] - offset;
            });
    }

    /**
     * 地理的座標から画面座標への安全な変換
     * @param {Function} projection - プロジェクション関数
     * @param {number} longitude - 経度
     * @param {number} latitude - 緯度
     * @param {Array} fallback - 変換失敗時のフォールバック座標
     * @returns {Array} 画面座標 [x, y]
     */
    static projectCoordinate(projection, longitude, latitude, fallback = [0, 0]) {
        return CoordinateHelper.safeProjection(projection, [longitude, latitude], fallback);
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
     * 安全な座標プロジェクション変換（CoordinateHelperより統合）
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
     * 座標配列の境界矩形計算（CoordinateHelperより統合）
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
     * 中心点計算（CoordinateHelperより統合）
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
}

// グローバルスコープで利用可能にする
window.MapProjectionHelper = MapProjectionHelper;