import * as d3 from 'd3';
import { SVGHelper } from '../utils/svg-helper.js';
import { MapHelper } from '../utils/map-helper.js';
import { logger as Logger } from '../utils/logger.js';
import { AppConstants } from '../utils/app-constants.js';
import { AppDefaults } from '../config/defaults.js';
import { countryRegionMapping } from '../utils/country-region-mapping.js';
import { colorScheme } from '../utils/color-scheme.js';

/**
 * CityManager - 都市管理クラス
 *
 * 責務: 都市タイムラインデータ管理、都市表示ロジック
 * MapManagerから都市関連の責務を分離
 */

export class MapCityManager {
    constructor(mapManager) {
        this.mapManager = mapManager;  // MapManager への参照

        // 都市タイムライン用の状態
        this.citiesTimelineData = null;
        this.timelineMode = false;
        this.visibleCities = [];
        this.singleCityMode = false;
        this.currentCity = null;
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
            this.singleCityMode = false;

            // 基本地図を描画
            if (this.mapManager.geoData) {
                this.renderTimelineMap();
            } else {
                if (Logger) {
                    Logger.error('MapCityManager: Cannot render timeline map - no geo data');
                } else {
                    console.error('MapCityManager: Cannot render timeline map - no geo data');
                }
            }

        } catch (error) {
            if (Logger) {
                Logger.error('MapCityManager: Failed to load cities timeline data:', error);
            } else {
                console.error('MapCityManager: Failed to load cities timeline data:', error);
            }
        }
    }

    /**
     * タイムライン進行度に応じた都市表示を更新
     * @param {Object} progressData - 進行度データ
     */
    handleTimelineProgress(progressData = {}) {
        if (!this.timelineMode || !this.citiesTimelineData) {
            return;
        }

        const { progress = 0, direction = 'down' } = progressData;
        const adjustedProgress = Math.pow(progress, 0.7);
        const totalCities = this.citiesTimelineData.cities.length;

        let targetCityCount = Math.floor(adjustedProgress * totalCities);
        if (progress < 0.1) {
            targetCityCount = 0;
        }
        targetCityCount = Math.max(0, Math.min(targetCityCount, totalCities));

        const sortedCities = [...this.citiesTimelineData.cities].sort((a, b) => a.order - b.order);
        const orderedCities = direction === 'up' ? [...sortedCities].reverse() : sortedCities;
        const targetCities = orderedCities.slice(0, targetCityCount);

        this.updateTimelineCities(targetCities);
    }

    /**
     * 単一都市モードを処理
     * @param {string} citiesFile
     * @param {string} cityId
     */
    async handleSingleCityMode(citiesFile, cityId) {
        try {
            if (!cityId) return;

            if (!this.citiesTimelineData) {
                this.citiesTimelineData = await d3.json(citiesFile);
            }

            const targetCity = this.citiesTimelineData.cities.find(city => city.id === cityId);
            if (!targetCity) {
                const logger = Logger || console;
                logger.error('MapCityManager: City not found:', cityId);
                return;
            }

            this.timelineMode = false;
            this.visibleCities = [];
            this.singleCityMode = true;
            this.currentCity = targetCity;
            this.mapManager.singleCityMode = true;
            this.mapManager.currentCity = targetCity;

            if (this.mapManager.svg && this.mapManager.projection && this.mapManager.geoData) {
                this.animateToCity(targetCity);
                this.mapManager.mapInitialized = true;
            } else if (this.mapManager.geoData) {
                const cityCoords = this.getCityCoordinates(targetCity);
                this.mapManager.renderMap(this.mapManager.geoData, {
                    center: cityCoords,
                    zoom: 6,
                    mode: 'single-city',
                    widthPercent: 100,
                    heightPercent: 100,
                    useRegionColors: true,
                    lightenNonVisited: true
                });
                this.mapManager.mapInitialized = true;
            } else {
                const logger = Logger || console;
                logger.error('MapCityManager: Cannot render single city map - no geo data');
            }
        } catch (error) {
            const logger = Logger || console;
            logger.error('MapCityManager: Failed to load single city data:', error);
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

        // 投影法を設定（世界全体を表示）
        if (MapHelper) {
            this.mapManager.projection = MapHelper.createProjection({
                type: 'naturalEarth1',
                scale: 150,
                center: [0, 0],
                width: svgWidth,
                height: svgHeight
            });
        } else {
            this.mapManager.projection = d3.geoNaturalEarth1()
                .scale(150)
                .center([0, 0])
                .translate([svgWidth / 2, svgHeight / 2]);
        }

        this.mapManager.path = d3.geoPath().projection(this.mapManager.projection);

        // 地図グループを作成
        const mapGroup = svg.append('g').attr('class', 'map-group');

        // 国境を描画
        if (this.mapManager.geoData && this.mapManager.geoData.features) {
            const countries = mapGroup.selectAll('.map-country')
                .data(this.mapManager.geoData.features)
                .enter()
                .append('path')
                .attr('class', 'map-country')
                .attr('d', this.mapManager.path)
                .style('opacity', 0);

            if (MapHelper) {
                MapHelper.applyCountryStyles(countries, {
                    fill: AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db',
                    stroke: AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff',
                    strokeWidth: 0.5
                });
            } else {
                countries
                    .style('fill', AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db')
                    .style('stroke', AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
                    .style('stroke-width', 0.5);
            }

            countries
                .transition()
                .duration(AppDefaults?.animation?.shortDuration || 500)
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
            // 座標投影計算を最適化（キャッシング）
            const projectedData = targetCities.map(d => ({
                ...d,
                coords: this.getProjectedCoordinates(d)
            }));

            const citySelection = mapGroup.selectAll('.timeline-city')
                .data(projectedData)
                .enter()
                .append('circle')
                .attr('class', 'timeline-city')
                .attr('cx', d => d.coords ? d.coords[0] : 0)
                .attr('cy', d => d.coords ? d.coords[1] : 0);

            if (MapHelper) {
                MapHelper.applyCityMarkerStyles(citySelection, { markerType: 'timeline' });
            } else {
                citySelection
                    .attr('r', 6)
                    .style('fill', AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6')
                    .style('stroke', '#fff')
                    .style('stroke-width', 2);
            }

            citySelection
                .style('opacity', 0)
                .transition()
                .duration(AppDefaults?.animation?.defaultDuration || 300)
                .style('opacity', 0.8);

            // 都市ラベルを追加
            const labelSelection = mapGroup.selectAll('.timeline-city-label')
                .data(projectedData)
                .enter()
                .append('text')
                .attr('class', 'timeline-city-label')
                .attr('x', d => d.coords ? d.coords[0] : 0)
                .attr('y', d => d.coords ? d.coords[1] - 12 : 0)
                .text(d => d.name || d.id);

            if (MapHelper) {
                MapHelper.applyCityLabelStyles(labelSelection, { labelType: 'timeline' });
            } else {
                labelSelection
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '12px')
                    .attr('fill', AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937');
            }

            labelSelection
                .style('opacity', 0)
                .transition()
                .duration(AppDefaults?.animation?.defaultDuration || 300)
                .delay(100)
                .style('opacity', 1);

            // 状態を保存
            this.visibleCities = targetCities;
        }
    }

    /**
     * 現在訪問中の国名を取得
     */
    getCurrentVisitedCountry() {
        if (this.mapManager.currentCity?.country) {
            return this.mapManager.currentCity.country;
        }

        const currentView = this.mapManager.currentView;
        if (!currentView || !currentView.cityId || !this.citiesTimelineData) {
            return null;
        }

        const city = this.citiesTimelineData.cities.find(c => c.id === currentView.cityId);
        return city ? city.country : null;
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
            const projectedData = cities.map(d => ({
                ...d,
                coords: this.getProjectedCoordinates(d)
            }));

            const citySelection = mapGroup.selectAll('.map-city')
                .data(projectedData)
                .enter()
                .append('circle')
                .attr('class', 'map-city')
                .attr('cx', d => d.coords ? d.coords[0] : 0)
                .attr('cy', d => d.coords ? d.coords[1] : 0);

            if (MapHelper) {
                MapHelper.applyCityMarkerStyles(citySelection, { markerType: 'default' });
            } else {
                citySelection
                    .attr('r', 6)
                    .style('fill', AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6');
            }

            citySelection
                .style('opacity', 0)
                .transition()
                .duration(AppDefaults?.animation?.defaultDuration || 300)
                .style('opacity', 1);

            const labelSelection = mapGroup.selectAll('.city-label')
                .data(projectedData)
                .enter()
                .append('text')
                .attr('class', 'city-label')
                .attr('x', d => d.coords ? d.coords[0] : 0)
                .attr('y', d => d.coords ? d.coords[1] - 10 : 0)
                .text(d => this.mapManager.getCountryNameJapanese(d.country));

            if (MapHelper) {
                MapHelper.applyCityLabelStyles(labelSelection, { labelType: 'default' });
            } else {
                labelSelection
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '16px')
                    .attr('fill', AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
                    .attr('font-weight', 'bold');
            }

            labelSelection
                .style('opacity', 0)
                .transition()
                .duration(AppDefaults?.animation?.defaultDuration || 300)
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

        const targetConfig = {
            center: this.getCityCoordinates(targetCity),
            scale: 300
        };

        if (MapHelper) {
            MapHelper.animateProjectionTo(
                this.mapManager.projection,
                targetConfig,
                this.mapManager.svg,
                this.mapManager.path,
                {}
            ).then(() => {
                if (this.mapManager.renderer) {
                    this.mapManager.renderer.updateCountryHighlights(
                        [targetCity.country],
                        true,
                        true,
                        false,
                        []
                    );
                }
            });
        } else {
            this.mapManager.svg
                .transition()
                .duration(AppDefaults?.animation?.chartTransitionDuration || 1000)
                .tween('projection', () => {
                    const currentCenter = this.mapManager.projection.center();
                    const currentScale = this.mapManager.projection.scale();
                    const interpolateCenter = d3.interpolate(currentCenter, targetConfig.center);
                    const interpolateScale = d3.interpolate(currentScale, targetConfig.scale);

                    return (t) => {
                        this.mapManager.projection
                            .center(interpolateCenter(t))
                            .scale(interpolateScale(t));

                        this.mapManager.svg.selectAll('.map-country')
                            .attr('d', this.mapManager.path);
                    };
                });
        }
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
     * 投影済み座標を取得
     * @param {Object} city - 都市データ
     * @returns {Array} [x, y]
     */
    getProjectedCoordinates(city) {
        const coords = this.getCityCoordinates(city);
        if (MapHelper && this.mapManager.projection) {
            return MapHelper.safeProjection(this.mapManager.projection, coords);
        }
        if (this.mapManager.projection) {
            return this.mapManager.projection(coords);
        }
        return coords;
    }

    /**
     * 都市タイムラインの状態をリセット
     */
    resetTimeline() {
        this.timelineMode = false;
        this.visibleCities = [];
        this.citiesTimelineData = null;
        this.singleCityMode = false;
        this.currentCity = null;
        if (this.mapManager) {
            this.mapManager.singleCityMode = false;
            this.mapManager.currentCity = null;
        }
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
        if (MapHelper) {
            this.mapManager.projection = MapHelper.createProjection({
                type: 'naturalEarth1',
                scale: 400,
                center: this.getCityCoordinates(targetCity),
                width: viewBoxWidth,
                height: viewBoxHeight
            });
        } else {
            this.mapManager.projection = d3.geoNaturalEarth1()
                .scale(400)
                .center(this.getCityCoordinates(targetCity))
                .translate([viewBoxWidth / 2, viewBoxHeight / 2]);
        }

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

                    if (this.mapManager.currentView && this.mapManager.currentView.useRegionColors && countryRegionMapping && colorScheme) {
                        const region = countryRegionMapping.getRegionForCountry(countryName);
                        if (region) {
                            let color = colorScheme.getRegionColor(region);

                            if (this.mapManager.currentView.lightenNonVisited) {
                                let visitedCountry = this.mapManager.getCurrentVisitedCountry();
                                if (!visitedCountry && this.mapManager.currentCity) {
                                    visitedCountry = this.mapManager.currentCity.country;
                                }
                                if (!visitedCountry && targetCity) {
                                    visitedCountry = targetCity.country;
                                }
                                if (visitedCountry && countryName !== visitedCountry) {
                                    color = colorScheme.getLighterColor(color, 0.5);
                                }
                            }

                            return color;
                        }
                    }

                    return AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db';
                })
                .style('stroke', this.mapManager.currentView && this.mapManager.currentView.useRegionColors ? AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc' : AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
                .style('stroke-width', this.mapManager.currentView && this.mapManager.currentView.useRegionColors ? 0.75 : 0.5)
                .style('opacity', 0)
                .transition()
                .duration(AppDefaults?.animation?.shortDuration || 500)
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
        const marker = mapGroup.append('circle')
            .attr('class', 'single-city-marker')
            .attr('cx', coords[0])
            .attr('cy', coords[1])
            .attr('r', 0);

        if (MapHelper) {
            MapHelper.applyCityMarkerStyles(marker, { markerType: 'single' });
        } else {
            marker
                .attr('r', (city.style?.size || 8) * 1.5)
                .style('fill', AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6')
                .style('stroke', AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
                .style('stroke-width', 3);
        }

        marker
            .style('opacity', 0)
            .transition()
            .duration((AppDefaults?.animation?.shortDuration || 500) * 1.6)
            .ease(d3.easeBackOut.overshoot(1.7))
            .style('opacity', 1);

        // 都市ラベルを追加
        const label = mapGroup.append('text')
            .attr('class', 'single-city-label')
            .attr('x', coords[0])
            .attr('y', coords[1] - ((city.style?.size || 8) * 1.5 + 8))
            .text(this.mapManager.getCountryNameJapanese(city.country));

        if (MapHelper) {
            MapHelper.applyCityLabelStyles(label, { labelType: 'single' });
        } else {
            label
                .attr('text-anchor', 'middle')
                .attr('font-size', '18px')
                .attr('font-weight', 'bold')
                .attr('font-family', '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
                .attr('fill', '#1f2937');
        }

        label
            .style('opacity', 0)
            .transition()
            .duration((AppDefaults?.animation?.shortDuration || 500) * 1.2)
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
