// import * as topojson from 'topojson-client'; // Using global topojson from CDN
import { logger as Logger } from '../utils/logger.js';

/**
 * MapController - 地図制御クラス
 *
 * 責務: 地図の更新制御、イベントハンドリング、状態管理
 * MapManagerから制御ロジックを分離
 */

export class MapController {
    constructor(mapManager) {
        this.mapManager = mapManager;  // MapManagerへの参照（状態・データアクセス用）
        this.renderer = null;           // MapRenderer への参照（遅延初期化）
    }

    /**
     * 地図を更新する
     * @param {Object} mapData - 地図データとオプション
     */
    updateMap(mapData) {
        const { center, zoom, visible, data, highlightCountries = [], cities = [], mode, citiesFile, cityId, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = [], width = 800, height = 600, widthPercent, heightPercent, aspectRatio, showSpreadingArrows = false, position, projectionType: requestedProjection } = mapData;

        const projectionType = requestedProjection || this.mapManager?.config?.defaultProjection || 'mercator';
        if (typeof console !== 'undefined' && console.info) {
            console.info('[MapController] projectionType resolved to:', projectionType);
        }

        // BaseManagerの統一position処理を適用
        if (position && this.mapManager.applyPositionSettings) {
            this.mapManager.applyPositionSettings(position);
        }

        const renderer = this.mapManager.renderer;

        // 地図更新の最初に拡散矢印の状態をチェック
        if (!showSpreadingArrows && renderer?.clearSpreadingArrows) {
            renderer.clearSpreadingArrows();
        }

        const previousProjectionType = this.mapManager.currentView?.projectionType;
        this.mapManager.currentView = { center, zoom, highlightCountries, cities, mode, citiesFile, cityId, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, projectionType };

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
                const renderConfig = { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode, projectionType };
                const needsRerender = previousProjectionType && previousProjectionType !== projectionType;

                if (!this.mapManager.svg || this.mapManager.svg.selectAll('.map-country').empty() || needsRerender) {
                    this.mapManager.renderMap(this.mapManager.geoData, renderConfig);
                } else {
                    this.updateExistingMap(renderConfig);
                }
            } else {
                if (Logger) {
                    Logger.error('MapController: No geo data available for rendering');
                } else {
                    ErrorHandler.handle(
                        new Error('No geo data available for rendering'),
                        'MapController.renderMap',
                        { type: ErrorHandler.ERROR_TYPES.MAP, severity: ErrorHandler.SEVERITY.MEDIUM }
                    );
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
            if (Logger) {
                Logger.error('MapController: Invalid topoData structure');
            } else {
                ErrorHandler.handle(
                    new Error('Invalid topoData structure'),
                    'MapController.renderMap',
                    { type: ErrorHandler.ERROR_TYPES.MAP, severity: ErrorHandler.SEVERITY.HIGH }
                );
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
                const { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode, projectionType } = this.mapManager.currentView;
                this.mapManager.renderMap(geoData, { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode, projectionType });
            }
        }
    }


    /**
     * 既存の地図を更新する
     * @param {Object} config - 更新設定
     */
    updateExistingMap(config = {}) {
        const { center, zoom, highlightCountries, cities, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = [], showSpreadingArrows = false, mode, projectionType } = config;

        if (!this.mapManager.svg || !this.mapManager.geoData) {
            return;
        }

        // MapRenderer インスタンスを取得
        const renderer = this.mapManager.renderer || this.renderer;
        if (!renderer) {
            ErrorHandler.handle(
                new Error('MapRenderer not available'),
                'MapController.renderMap',
                { type: ErrorHandler.ERROR_TYPES.MAP, severity: ErrorHandler.SEVERITY.HIGH }
            );
            return;
        }

        // 国の色と境界線を更新（MapRenderer に委譲）
        renderer.updateCountryHighlights(highlightCountries, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions);

        // 都市マーカーを更新（MapRenderer に委譲）
        if (Array.isArray(cities) && cities.length > 0) {
            renderer.updateCities(cities);
        } else {
            this.mapManager.svg.selectAll('.map-city').remove();
            this.mapManager.svg.selectAll('.city-label').remove();
        }

        // 拡散矢印の表示制御
        if (showSpreadingArrows && renderer?.drawSpreadingArrows) {
            const mapGroup = this.mapManager.svg.select('.map-group');
            renderer.drawSpreadingArrows(mapGroup);
        } else if (renderer?.clearSpreadingArrows) {
            renderer.clearSpreadingArrows();
        }

        // ビューを更新（MapRenderer に委譲）
        renderer.animateToView(center, zoom, mode);
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

        if (Logger) {
            Logger.debug('MapController: Map progress event', { progress, step });
        }

        if (this.mapManager?.cityManager?.handleTimelineProgress) {
            this.mapManager.cityManager.handleTimelineProgress(progressData);
        }
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
        const renderer = this.mapManager?.renderer;
        renderer?.clearSpreadingArrows?.();

        // 参照を削除
        this.mapManager = null;
        this.renderer = null;
    }
}
