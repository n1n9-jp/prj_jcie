/**
 * MapController - 地図制御クラス
 *
 * 責務: 地図の更新制御、イベントハンドリング、状態管理
 * MapManagerから制御ロジックを分離
 */

class MapController {
    constructor(mapManager) {
        this.mapManager = mapManager;  // MapManagerへの参照（状態・データアクセス用）
        this.renderer = null;           // MapRenderer への参照（遅延初期化）
    }

    /**
     * 地図を更新する
     * @param {Object} mapData - 地図データとオプション
     */
    updateMap(mapData) {
        const { center, zoom, visible, data, highlightCountries = [], cities = [], mode, citiesFile, cityId, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = [], width = 800, height = 600, widthPercent, heightPercent, aspectRatio, showSpreadingArrows = false, position } = mapData;

        // BaseManagerの統一position処理を適用
        if (position && this.mapManager.applyPositionSettings) {
            this.mapManager.applyPositionSettings(position);
        }

        // 地図更新の最初に拡散矢印の状態をチェック
        if (!showSpreadingArrows && this.mapManager.clearSpreadingArrows) {
            this.mapManager.clearSpreadingArrows();
        }

        this.mapManager.currentView = { center, zoom, highlightCountries, cities, mode, citiesFile, cityId, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions };

        if (visible) {
            this.mapManager.show();

            // 都市タイムラインモードの場合
            if (mode === 'cities-timeline' && citiesFile) {
                if (this.mapManager.initCitiesTimeline) {
                    this.mapManager.initCitiesTimeline(citiesFile);
                }
                return;
            }

            // 単一都市表示モードの場合
            if (mode === 'single-city' && cityId && citiesFile) {
                if (this.mapManager.handleSingleCityMode) {
                    this.mapManager.handleSingleCityMode(citiesFile, cityId);
                }
                return;
            }


            if (this.mapManager.geoData) {
                // 地図が既に描画されているかチェック
                if (!this.mapManager.svg || this.mapManager.svg.selectAll('.map-country').empty()) {
                    this.mapManager.renderMap(this.mapManager.geoData, { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode });
                } else {
                    this.updateExistingMap({ center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode });
                }
            } else {
                if (window.Logger) {
                    window.Logger.error('MapController: No geo data available for rendering');
                } else {
                    console.error('MapController: No geo data available for rendering');
                }
            }
        } else {
            this.mapManager.hide();
        }
    }

    /**
     * ジオデータを設定する
     * @param {Object} topoData - TopoJSON形式のジオデータ
     */
    setGeoData(topoData) {
        if (!topoData || !topoData.objects) {
            if (window.Logger) {
                window.Logger.error('MapController: Invalid topoData structure');
            } else {
                console.error('MapController: Invalid topoData structure');
            }
            return;
        }

        // TopoJSON → GeoJSON 変換
        const countries = topoData.objects.countries;
        const geoData = topojson.feature(topoData, countries);

        this.mapManager.geoData = geoData;

        // 地図が初期化されていなければ初期化
        if (!this.mapManager.mapInitialized) {
            this.mapManager.mapInitialized = true;
            // 初期地図描画
            if (this.mapManager.currentView) {
                const { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode } = this.mapManager.currentView;
                this.mapManager.renderMap(geoData, { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode });
            }
        }
    }

    /**
     * ビューをアニメーションさせて移動
     * @param {Array} center - 中心座標 [longitude, latitude]
     * @param {number} zoom - ズームレベル
     * @param {string} mode - 表示モード
     */
    animateToView(center, zoom, mode = null) {
        if (!this.mapManager.projection || !this.mapManager.svg) {
            if (window.Logger) {
                window.Logger.warn('MapController: Projection or SVG not initialized yet');
            }
            return;
        }

        const duration = window.AppDefaults?.animation?.chartTransitionDuration || 1000;
        const currentCenter = this.mapManager.projection.center();
        const currentScale = this.mapManager.projection.scale();
        const scaleMultiplier = (mode === 'single-city') ? 1.0 : 1.5; // 都市モードでは拡大なし
        const targetScale = zoom * 150 * scaleMultiplier;

        // 中心座標の安全性チェック
        const safeCenter = [
            (center && typeof center[0] === 'number' && !isNaN(center[0])) ? center[0] : 0,
            (center && typeof center[1] === 'number' && !isNaN(center[1])) ? center[1] : 0
        ];

        // SVGに対してtransitionを適用（projectionではなく）
        this.mapManager.svg
            .transition()
            .duration(duration)
            .tween('projection', () => {
                const interpolateCenter = d3.interpolate(currentCenter, safeCenter);
                const interpolateScale = d3.interpolate(currentScale, targetScale);

                return (t) => {
                    this.mapManager.projection
                        .center(interpolateCenter(t))
                        .scale(interpolateScale(t));

                    // パスを再描画
                    this.mapManager.svg.selectAll('.map-country')
                        .attr('d', this.mapManager.path);

                    // 都市マーカーを更新
                    this.mapManager.svg.selectAll('.map-city')
                        .attr('cx', d => {
                            const coords = this.mapManager.projection(this.mapManager.getCityCoordinates(d));
                            return coords ? coords[0] : 0;
                        })
                        .attr('cy', d => {
                            const coords = this.mapManager.projection(this.mapManager.getCityCoordinates(d));
                            return coords ? coords[1] : 0;
                        });

                    // 都市ラベルを更新
                    this.mapManager.svg.selectAll('.city-label')
                        .attr('x', d => {
                            const coords = this.mapManager.projection(this.mapManager.getCityCoordinates(d));
                            return coords ? coords[0] : 0;
                        })
                        .attr('y', d => {
                            const coords = this.mapManager.projection(this.mapManager.getCityCoordinates(d));
                            return coords ? coords[1] - 10 : 0;
                        });
                };
            });
    }

    /**
     * 国をハイライトする
     * @param {Array} countryNames - ハイライトする国名の配列
     */
    highlightCountries(countryNames) {
        if (!this.mapManager.svg || !Array.isArray(countryNames)) {
            return;
        }

        this.mapManager.svg.selectAll('.map-country')
            .style('opacity', d => {
                const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';
                return countryNames.includes(countryName) ? 1 : 0.3;
            });
    }

    /**
     * 都市マーカーを更新する
     * @param {Array} cities - 都市オブジェクトの配列
     */
    updateCities(cities) {
        if (!this.mapManager.svg || !Array.isArray(cities)) {
            return;
        }

        // 既存の都市マーカーを削除
        this.mapManager.svg.selectAll('.map-city').remove();
        this.mapManager.svg.selectAll('.city-label').remove();

        // 新しい都市マーカーを追加
        const mapGroup = this.mapManager.svg.select('.map-group');
        if (mapGroup.empty()) return;

        mapGroup.selectAll('.map-city')
            .data(cities)
            .enter()
            .append('circle')
            .attr('class', 'map-city')
            .attr('cx', d => this.mapManager.projection(this.mapManager.getCityCoordinates(d))[0])
            .attr('cy', d => this.mapManager.projection(this.mapManager.getCityCoordinates(d))[1])
            .attr('r', 6)
            .style('fill', window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6')
            .style('opacity', 0.8);

        // 都市ラベルを追加
        mapGroup.selectAll('.city-label')
            .data(cities)
            .enter()
            .append('text')
            .attr('class', 'city-label')
            .attr('x', d => this.mapManager.projection(this.mapManager.getCityCoordinates(d))[0])
            .attr('y', d => this.mapManager.projection(this.mapManager.getCityCoordinates(d))[1] - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
            .text(d => this.mapManager.getCountryNameJapanese(d.country));
    }

    /**
     * 既存の地図を更新する
     * @param {Object} config - 更新設定
     */
    updateExistingMap(config = {}) {
        const { center, zoom, highlightCountries, cities, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = [], showSpreadingArrows = false, mode } = config;

        if (!this.mapManager.svg || !this.mapManager.geoData) {
            return;
        }

        // 国の色と境界線を更新
        this.updateCountryHighlights(highlightCountries, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions);

        // 都市マーカーを更新
        if (Array.isArray(cities) && cities.length > 0) {
            this.updateCities(cities);
        } else {
            this.mapManager.svg.selectAll('.map-city').remove();
            this.mapManager.svg.selectAll('.city-label').remove();
        }

        // 拡散矢印の表示制御
        if (showSpreadingArrows && this.mapManager.drawSpreadingArrows) {
            const mapGroup = this.mapManager.svg.select('.map-group');
            this.mapManager.drawSpreadingArrows(mapGroup);
        } else if (this.mapManager.clearSpreadingArrows) {
            this.mapManager.clearSpreadingArrows();
        }

        // ビューを更新
        this.animateToView(center, zoom, mode);
    }

    /**
     * 国のハイライトと色を更新する
     * @param {Array} highlightCountries - ハイライトする国名
     * @param {boolean} useRegionColors - 地域別色を使用するか
     * @param {boolean} lightenNonVisited - 未訪問国を明るくするか
     * @param {boolean} lightenAllCountries - すべての国を明るくするか
     * @param {Array} targetRegions - 対象地域
     */
    updateCountryHighlights(highlightCountries, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = []) {
        if (!this.mapManager.svg) {
            return;
        }

        this.mapManager.svg.selectAll('.map-country')
            .style('fill', d => {
                const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';

                if (useRegionColors && window.CountryRegionMapping && window.ColorScheme) {
                    const region = window.CountryRegionMapping.getRegionForCountry(countryName);

                    if (highlightCountries && highlightCountries.length > 0) {
                        const isHighlighted = highlightCountries.some(hc => {
                            if (countryName === hc) return true;
                            if (countryName.includes(hc) || hc.includes(countryName)) return true;
                            return false;
                        });

                        if (isHighlighted) {
                            if (region) {
                                return window.ColorScheme.getRegionColor(region);
                            } else {
                                return window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6';
                            }
                        } else {
                            return window.AppConstants?.APP_COLORS?.BACKGROUND?.GRAY || '#f3f4f6';
                        }
                    }

                    if (region) {
                        if (targetRegions && targetRegions.length > 0) {
                            if (!targetRegions.includes(region)) {
                                return window.AppConstants?.APP_COLORS?.BACKGROUND?.GRAY || '#f3f4f6';
                            }
                        }

                        let color = window.ColorScheme.getRegionColor(region);

                        if (lightenNonVisited && this.mapManager.getCurrentVisitedCountry) {
                            let visitedCountry = this.mapManager.getCurrentVisitedCountry();
                            if (!visitedCountry && this.mapManager.currentCity) {
                                visitedCountry = this.mapManager.currentCity.country;
                            }
                            if (visitedCountry && countryName !== visitedCountry) {
                                color = window.ColorScheme.getLighterColor(color, 0.5);
                            }
                        }

                        if (lightenAllCountries) {
                            color = window.ColorScheme.getLighterColor(color, 0.5);
                        }

                        return color;
                    }
                }

                if (highlightCountries.includes(countryName)) {
                    return window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6';
                }

                return window.AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db';
            })
            .style('stroke', d => {
                const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';

                if (useRegionColors) {
                    return window.AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc';
                }

                if (highlightCountries.includes(countryName)) {
                    return window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#1d4ed8';
                }

                return window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff';
            })
            .style('stroke-width', d => {
                const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';

                if (useRegionColors) {
                    return '0.75';
                }

                if (highlightCountries.includes(countryName)) {
                    return '1.5';
                }

                return '0.5';
            });
    }

    /**
     * 現在訪問している国を取得する
     * @returns {string} 国名
     */
    getCurrentVisitedCountry() {
        if (this.mapManager.currentCity && this.mapManager.currentCity.country) {
            return this.mapManager.currentCity.country;
        }
        return null;
    }

    /**
     * 地図の進捗イベントを処理する
     * @param {Object} progressData - 進捗データ
     */
    handleMapProgress(progressData) {
        const { progress, step } = progressData;

        if (window.Logger) {
            window.Logger.debug('MapController: Map progress event', { progress, step });
        }

        // 進捗に応じた地図更新処理
        // 例: 特定のステップで特定の表示変更
    }

    /**
     * ウィンドウリサイズに対応する
     */
    resize() {
        if (!this.mapManager.container || !this.mapManager.svg) {
            return;
        }

        // 新しいサイズを計算
        const containerRect = this.mapManager.container.node().getBoundingClientRect();
        const newWidth = containerRect.width || window.innerWidth;
        const newHeight = containerRect.height || window.innerHeight;

        // SVGのサイズを更新
        this.mapManager.svg
            .attr('viewBox', `0 0 ${newWidth} ${newHeight}`)
            .style('width', '100%')
            .style('height', 'auto');

        // 現在のビューを保持したまま再レンダリング
        if (this.mapManager.currentView) {
            const { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, showSpreadingArrows, mode } = this.mapManager.currentView;
            this.updateExistingMap({ center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, showSpreadingArrows, mode });
        }
    }

    /**
     * クリーンアップ処理
     */
    destroy() {
        // リソースの解放
        if (this.mapManager) {
            this.mapManager.clearSpreadingArrows?.();
        }

        // 参照を削除
        this.mapManager = null;
        this.renderer = null;
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
if (typeof window !== 'undefined') {
    window.MapController = MapController;
}
