/**
 * CityManager - 都市管理クラス
 *
 * 責務: 都市タイムラインデータ管理、都市表示ロジック
 * MapManagerから都市関連の責務を分離
 */

class MapCityManager {
    constructor(mapManager) {
        this.mapManager = mapManager;  // MapManager への参照

        // 都市タイムライン用の状態
        this.citiesTimelineData = null;
        this.timelineMode = false;
        this.visibleCities = [];
    }

    /**
     * 都市タイムラインデータを初期化
     * @param {string} citiesFile - 都市データファイルパス
     */
    async initCitiesTimeline(citiesFile) {
        try {
            // 都市データを読み込み
            if (!this.citiesTimelineData) {
                this.citiesTimelineData = await d3.json(citiesFile);
            }

            this.timelineMode = true;
            this.visibleCities = [];

            // 基本地図を描画
            if (this.mapManager.geoData) {
                this.renderTimelineMap();
            } else {
                if (window.Logger) {
                    window.Logger.error('MapCityManager: Cannot render timeline map - no geo data');
                } else {
                    console.error('MapCityManager: Cannot render timeline map - no geo data');
                }
            }

        } catch (error) {
            if (window.Logger) {
                window.Logger.error('MapCityManager: Failed to load cities timeline data:', error);
            } else {
                console.error('MapCityManager: Failed to load cities timeline data:', error);
            }
        }
    }

    /**
     * タイムライン用の地図を描画
     */
    renderTimelineMap() {
        const config = { width: 800, height: 600 };

        const svg = this.mapManager.initSVG(config);

        // 現在のSVGサイズを取得
        const actualSize = SVGHelper.getActualSize(svg);
        const svgWidth = actualSize.width || config.width || 800;
        const svgHeight = actualSize.height || config.height || 600;

        // 投影法を設定（世界全体を表示、タイムラインモードでは元スケール）
        this.mapManager.projection = d3.geoNaturalEarth1()
            .scale(150)
            .center([0, 0])
            .translate([svgWidth / 2, svgHeight / 2]);

        this.mapManager.path = d3.geoPath().projection(this.mapManager.projection);

        // 地図グループを作成
        const mapGroup = svg.append('g').attr('class', 'map-group');

        // 国境を描画
        if (this.mapManager.geoData && this.mapManager.geoData.features) {
            mapGroup.selectAll('.map-country')
                .data(this.mapManager.geoData.features)
                .enter()
                .append('path')
                .attr('class', 'map-country')
                .attr('d', this.mapManager.path)
                .style('fill', window.AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db')
                .style('stroke', window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
                .style('stroke-width', 0.5)
                .style('opacity', 0);

            mapGroup.selectAll('.map-country')
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .style('opacity', 1);
        }
    }

    /**
     * タイムライン用都市を更新
     * @param {Array} targetCities - 表示する都市の配列
     */
    updateTimelineCities(targetCities) {
        if (!this.mapManager.svg || !Array.isArray(targetCities)) {
            return;
        }

        const mapGroup = this.mapManager.svg.select('.map-group');

        // 既存の都市マーカーを削除
        mapGroup.selectAll('.timeline-city, .timeline-city-label').remove();

        // 新しい都市マーカーを追加
        if (targetCities.length > 0) {
            mapGroup.selectAll('.timeline-city')
                .data(targetCities)
                .enter()
                .append('circle')
                .attr('class', 'timeline-city')
                .attr('cx', d => {
                    const coords = this.mapManager.projection(this.getCityCoordinates(d));
                    return coords ? coords[0] : 0;
                })
                .attr('cy', d => {
                    const coords = this.mapManager.projection(this.getCityCoordinates(d));
                    return coords ? coords[1] : 0;
                })
                .attr('r', d => {
                    const style = this.getCityStyle(d);
                    return style.size || 8;
                })
                .style('fill', d => this.getCityColor(d))
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.defaultDuration || 300)
                .style('opacity', 0.8);

            // 都市ラベルを追加
            mapGroup.selectAll('.timeline-city-label')
                .data(targetCities)
                .enter()
                .append('text')
                .attr('class', 'timeline-city-label')
                .attr('x', d => {
                    const coords = this.mapManager.projection(this.getCityCoordinates(d));
                    return coords ? coords[0] : 0;
                })
                .attr('y', d => {
                    const coords = this.mapManager.projection(this.getCityCoordinates(d));
                    return coords ? coords[1] - 12 : 0;
                })
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
                .text(d => d.name || d.id)
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.defaultDuration || 300)
                .delay(100)
                .style('opacity', 1);

            // 状態を保存
            this.visibleCities = targetCities;
        }
    }

    /**
     * 都市マーカーを更新
     * @param {Array} cities - 都市データの配列
     */
    updateCityMarkers(cities) {
        if (!this.mapManager.projection || !this.mapManager.svg) {
            return;
        }

        const mapGroup = this.mapManager.svg.select('.map-group');

        // 既存の都市マーカーを削除
        mapGroup.selectAll('.map-city, .city-label').remove();

        // 新しい都市マーカーを追加
        if (cities && cities.length > 0) {
            mapGroup.selectAll('.map-city')
                .data(cities)
                .enter()
                .append('circle')
                .attr('class', 'map-city')
                .attr('cx', d => this.mapManager.projection(this.getCityCoordinates(d))[0])
                .attr('cy', d => this.mapManager.projection(this.getCityCoordinates(d))[1])
                .attr('r', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.defaultDuration || 300)
                .attr('r', 6);

            mapGroup.selectAll('.city-label')
                .data(cities)
                .enter()
                .append('text')
                .attr('class', 'city-label')
                .attr('x', d => this.mapManager.projection(this.getCityCoordinates(d))[0])
                .attr('y', d => this.mapManager.projection(this.getCityCoordinates(d))[1] - 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '16px')
                .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
                .attr('font-weight', 'bold')
                .attr('font-family', window.AppConstants?.FONT_CONFIG?.FAMILIES?.SERIF || '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
                .text(d => this.mapManager.getCountryNameJapanese(d.country))
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.defaultDuration || 300)
                .delay(200)
                .style('opacity', 1);
        }
    }

    /**
     * 都市へのアニメーション
     * @param {Object} targetCity - 対象都市データ
     */
    animateToCity(targetCity) {
        if (!this.mapManager.svg || !this.mapManager.projection || !targetCity) {
            return;
        }

        const coords = this.getCityCoordinates(targetCity);
        const duration = window.AppDefaults?.animation?.chartTransitionDuration || 1000;
        const currentCenter = this.mapManager.projection.center();
        const currentScale = this.mapManager.projection.scale();
        const targetScale = 300; // 都市フォーカス時のズーム

        // 都市へのスムーズなズーム
        this.mapManager.svg
            .transition()
            .duration(duration)
            .tween('projection', () => {
                const interpolateCenter = d3.interpolate(currentCenter, coords);
                const interpolateScale = d3.interpolate(currentScale, targetScale);

                return (t) => {
                    this.mapManager.projection
                        .center(interpolateCenter(t))
                        .scale(interpolateScale(t));

                    // 地図を再描画
                    this.mapManager.svg.selectAll('.map-country')
                        .attr('d', this.mapManager.path);
                };
            })
            .on('end', () => {
                // アニメーション完了後に訪問国色を適用（lightenNonVisited演出）
                // MapControllerのupdateCountryHighlights()を使用
                if (this.mapManager.controller) {
                    // 訪問国をハイライト、他の国を明るくする
                    this.mapManager.controller.updateCountryHighlights(
                        [targetCity.country], // ハイライト国
                        true,                  // useRegionColors
                        true,                  // lightenNonVisited
                        false,                 // lightenAllCountries
                        []                     // targetRegions
                    );
                }
            });
    }

    /**
     * 都市座標を取得
     * @param {Object} city - 都市データ
     * @returns {Array} [longitude, latitude]
     */
    getCityCoordinates(city) {
        if (!city) {
            throw new Error('City data is required');
        }

        // 新形式: coordinates配列
        if (city.coordinates && Array.isArray(city.coordinates) && city.coordinates.length === 2) {
            return city.coordinates;
        }

        // 旧形式: latitude/longitude プロパティ
        if (city.latitude !== undefined && city.longitude !== undefined) {
            return [city.longitude, city.latitude];
        }

        throw new Error(`Invalid city coordinate format for city: ${city.id || 'unknown'}`);
    }

    /**
     * 都市のスタイル情報を統一形式で取得
     * @param {Object} city - 都市データ
     * @returns {Object} スタイル情報 { size, color }
     */
    getCityStyle(city) {
        if (!city) {
            return { size: 8, color: null };
        }

        const defaultSize = 8;
        const size = city.size || defaultSize;
        const color = city.color || null;

        return { size, color };
    }

    /**
     * 都市の色を取得
     * @param {Object} city - 都市データ
     * @returns {string} 16進数カラーコード
     */
    getCityColor(city) {
        if (!city) {
            return window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6';
        }

        // city.colorが指定されていればそれを使用
        if (city.color) {
            return city.color;
        }

        // デフォルト色
        return window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6';
    }

    /**
     * 都市タイムラインの状態をリセット
     */
    resetTimeline() {
        this.timelineMode = false;
        this.visibleCities = [];
        this.citiesTimelineData = null;
    }

    /**
     * 単一都市地図を初期化（初回のみ）
     * @param {Object} targetCity - 表示する都市データ
     */
    initializeSingleCityMap(targetCity) {
        const config = { width: 800, height: 600 };

        const svg = this.mapManager.initSVG(config);

        // SVGのviewBoxサイズを取得（パーセンテージ表示対応）
        const viewBox = svg.attr('viewBox').split(' ');
        const viewBoxWidth = parseFloat(viewBox[2]);
        const viewBoxHeight = parseFloat(viewBox[3]);

        // 投影法を設定（都市モードでは元スケール、viewBoxサイズを使用）
        this.mapManager.projection = d3.geoNaturalEarth1()
            .scale(400)
            .center(this.getCityCoordinates(targetCity))
            .translate([viewBoxWidth / 2, viewBoxHeight / 2]);

        this.mapManager.path = d3.geoPath().projection(this.mapManager.projection);

        // 地図グループを作成
        const mapGroup = svg.append('g').attr('class', 'map-group');

        // 国境を描画
        if (this.mapManager.geoData && this.mapManager.geoData.features) {
            mapGroup.selectAll('.map-country')
                .data(this.mapManager.geoData.features)
                .enter()
                .append('path')
                .attr('class', 'map-country')
                .attr('d', this.mapManager.path)
                .style('fill', d => {
                    const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';

                    if (this.mapManager.currentView && this.mapManager.currentView.useRegionColors && window.CountryRegionMapping && window.ColorScheme) {
                        const region = window.CountryRegionMapping.getRegionForCountry(countryName);
                        if (region) {
                            let color = window.ColorScheme.getRegionColor(region);

                            if (this.mapManager.currentView.lightenNonVisited) {
                                let visitedCountry = this.mapManager.getCurrentVisitedCountry();
                                if (!visitedCountry && this.mapManager.currentCity) {
                                    visitedCountry = this.mapManager.currentCity.country;
                                }
                                if (!visitedCountry && targetCity) {
                                    visitedCountry = targetCity.country;
                                }
                                if (visitedCountry && countryName !== visitedCountry) {
                                    color = window.ColorScheme.getLighterColor(color, 0.5);
                                }
                            }

                            return color;
                        }
                    }

                    return window.AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db';
                })
                .style('stroke', this.mapManager.currentView && this.mapManager.currentView.useRegionColors ? window.AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc' : window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
                .style('stroke-width', this.mapManager.currentView && this.mapManager.currentView.useRegionColors ? 0.75 : 0.5)
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .style('opacity', 1);
        }

        // 初回都市マーカーを表示
        this.showCityMarker(targetCity);
    }

    /**
     * 都市マーカーを表示
     * @param {Object} city - 都市データ
     */
    showCityMarker(city) {
        // SVGのviewBoxサイズを取得
        const viewBox = this.mapManager.svg.attr('viewBox').split(' ');
        const viewBoxWidth = parseFloat(viewBox[2]);
        const viewBoxHeight = parseFloat(viewBox[3]);

        // プロジェクションの中心が都市座標と一致している場合、画面中央に配置
        const projectionCenter = this.mapManager.projection.center();
        const cityCoords = this.getCityCoordinates(city);
        const isCityCenter = Math.abs(projectionCenter[0] - cityCoords[0]) < 0.001 &&
                            Math.abs(projectionCenter[1] - cityCoords[1]) < 0.001;

        let coords;
        if (isCityCenter) {
            // 都市が中心の場合は、強制的に画面中央に配置
            coords = [viewBoxWidth / 2, viewBoxHeight / 2];
        } else {
            // 通常の投影計算
            coords = this.mapManager.projection(cityCoords);
        }

        if (!coords) {
            console.error('MapCityManager: Failed to project city coordinates:', city);
            return;
        }

        const mapGroup = this.mapManager.svg.select('.map-group');

        // 都市マーカーを追加
        const markerColor = this.getCityColor(city);
        const cityStyle = this.getCityStyle(city);

        mapGroup.append('circle')
            .attr('class', 'single-city-marker')
            .attr('cx', coords[0])
            .attr('cy', coords[1])
            .attr('r', 0)
            .style('fill', markerColor)
            .style('stroke', window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
            .style('stroke-width', 3)
            .style('opacity', 0)
            .transition()
            .duration((window.AppDefaults?.animation?.shortDuration || 500) * 1.6)
            .ease(d3.easeBackOut.overshoot(1.7))
            .attr('r', cityStyle.size * 1.5)
            .style('opacity', 1);

        // 都市ラベルを追加
        mapGroup.append('text')
            .attr('class', 'single-city-label')
            .attr('x', coords[0])
            .attr('y', coords[1] - (cityStyle.size * 1.5 + 8))
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .attr('font-family', '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
            .attr('fill', '#1f2937')
            .style('opacity', 0)
            .text(this.mapManager.getCountryNameJapanese(city.country))
            .transition()
            .duration((window.AppDefaults?.animation?.shortDuration || 500) * 1.2)
            .delay(400)
            .style('opacity', 1);

        // 地理的情報をHTMLコンテナに動的表示
        this.updateGeographicInfo(city);
    }

    /**
     * 地理的情報をHTMLに動的表示（地図専用機能）
     * @param {Object} city - 都市データ
     */
    updateGeographicInfo(city) {
        // ステップIDから対応するHTMLコンテナを特定
        const stepId = city.order + 2; // step3から開始（order 1 = step3）
        const geoInfoContainer = document.getElementById(`geographic-info-${stepId}`);

        if (!geoInfoContainer) {
            return;
        }

        // 地理的情報を非表示にする
        geoInfoContainer.style.display = 'none';
    }

    /**
     * クリーンアップ処理
     */
    destroy() {
        this.resetTimeline();
        this.mapManager = null;
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
if (typeof window !== 'undefined') {
    window.MapCityManager = MapCityManager;
}
