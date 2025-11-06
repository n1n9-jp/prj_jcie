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
