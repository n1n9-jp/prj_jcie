import { BaseManager } from '../utils/base-manager.js';
import { MapController } from '../map/map-controller.js';
import { MapCityManager } from './map-city-manager.js';
import { MapRenderer } from '../map/map-renderer.js';
import { pubsub, EVENTS } from '../core/pubsub.js';
import { AppConstants } from '../utils/app-constants.js';

/**
 * MapManager - 地図管理クラス
 * D3.jsを使用した世界地図の描画・更新を管理
 * BaseManagerを継承し、共通機能を活用
 */
export class MapManager extends BaseManager {
    constructor(containerId) {
        super(containerId);
        this.svg = null;
        this.projection = null;
        this.path = null;
        this.geoData = null;
        this.currentView = null;

        // MapRenderer のインスタンス化
        this.renderer = null;

        // MapController のインスタンス化
        this.controller = null;

        // MapCityManager のインスタンス化
        this.cityManager = null;

        // Initialize after properties are set
        this.init();
    }

    /**
     * 初期化処理（BaseManagerを拡張）
     */
    init() {
        super.init();

        // MapController を初期化
        this.controller = new MapController(this);

        // MapCityManager を初期化
        this.cityManager = new MapCityManager(this);

        // イベントリスナーを設定
        pubsub.subscribe(EVENTS.MAP_UPDATE, (data) => {
            this.controller.updateMap(data);
        });

        pubsub.subscribe(EVENTS.MAP_PROGRESS, (data) => {
            this.controller.handleMapProgress(data);
        });

        // 単一都市モード用の状態
        this.singleCityMode = false;
        this.currentCity = null;
        this.mapInitialized = false;
    }

    /**
     * 国名を日本語に変換
     * @param {string} countryEn - 英語の国名
     * @returns {string} 日本語の国名
     */
    getCountryNameJapanese(countryEn) {
        return AppConstants?.getCountryNameJapanese(countryEn) || countryEn;
    }

    /**
     * 地図を更新する（MapController へ委譲）
     * @param {Object} mapData - 地図データとオプション
     */
    updateMap(mapData) {
        if (this.controller) {
            this.controller.updateMap(mapData);
        }
    }

    /**
     * 地図コンテナを表示
     */
    show() {
        this.container.classed('visible', true);
    }

    /**
     * 地図コンテナを非表示
     */
    hide() {
        this.container.classed('visible', false);

        // 地図非表示時は拡散矢印も即座にクリア
        if (this.renderer && this.renderer.clearSpreadingArrows) {
            this.renderer.clearSpreadingArrows();
        }

    }

    /**
     * 地図データを設定
     * @param {Object} topoData - TopoJSONデータ
     */
    /**
     * ジオデータを設定する（MapController へ委譲）
     * @param {Object} topoData - TopoJSON形式のジオデータ
     */
    setGeoData(topoData) {
        if (this.controller) {
            this.controller.setGeoData(topoData);
        }
    }

    /**
     * SVG要素を初期化（レスポンシブ対応）
     * MapRenderer へ委譲
     */
    initSVG(config = {}) {
        // MapRenderer のインスタンスを作成（初回のみ）
        if (!this.renderer) {
            this.renderer = new MapRenderer(this.container, this);
        }

        // MapRenderer の initSVG を使用
        const svg = this.renderer.initSVG(config);

        // MapManager のプロパティを同期
        this.svg = this.renderer.getSVG();
        this.projection = this.renderer.getProjection();
        this.path = this.renderer.getPath();

        return svg;
    }

    /**
     * 地図を描画
     * @param {Object} geoData - GeoJSONデータ
     * @param {Object} config - 設定オプション
     * MapRenderer へ委譲
     */
    renderMap(geoData, config = {}) {
        // MapRenderer のインスタンスを作成（初回のみ）
        if (!this.renderer) {
            this.renderer = new MapRenderer(this.container, this);
        }

        // MapRenderer の renderMap を使用
        this.renderer.renderMap(geoData, config);

        // MapManager のプロパティを同期
        this.svg = this.renderer.getSVG();
        this.projection = this.renderer.getProjection();
        this.path = this.renderer.getPath();
    }







    /**
     * 現在訪問中の国名を取得（single-cityモード用）
     * @returns {string|null} 訪問国名、見つからない場合はnull
     */
    getCurrentVisitedCountry() {
        if (this.cityManager && this.cityManager.getCurrentVisitedCountry) {
            return this.cityManager.getCurrentVisitedCountry();
        }
        if (this.currentCity && this.currentCity.country) {
            return this.currentCity.country;
        }
        return null;
    }

    /**
     * 都市マーカーを更新（MapCityManager へ委譲）
     * @param {Array} cities - 都市データの配列
     */
    updateCityMarkers(cities) {
        if (this.cityManager) {
            this.cityManager.updateCityMarkers(cities);
        }
    }

    /**
     * 都市タイムラインを初期化（MapCityManager へ委譲）
     * @param {string} citiesFile - 都市データファイルのパス
     */
    async initCitiesTimeline(citiesFile) {
        if (this.cityManager) {
            return await this.cityManager.initCitiesTimeline(citiesFile);
        }
    }

    /**
     * タイムライン用の地図を描画（MapCityManager へ委譲）
     */
    renderTimelineMap() {
        if (this.cityManager) {
            this.cityManager.renderTimelineMap();
        }
    }

    /**
     * タイムライン都市を更新（MapCityManager へ委譲）
     * @param {Array} targetCities - 表示する都市の配列
     */
    updateTimelineCities(targetCities) {
        if (this.cityManager) {
            this.cityManager.updateTimelineCities(targetCities);
        }
    }

    /**
     * 単一都市モードを処理（初回 or 都市切替）
     * @param {string} citiesFile - 都市データファイルのパス
     * @param {string} cityId - 表示する都市のID
     */
    async handleSingleCityMode(citiesFile, cityId) {
        if (this.cityManager?.handleSingleCityMode) {
            return await this.cityManager.handleSingleCityMode(citiesFile, cityId);
        }
    }

    /**
     * 単一都市地図を初期化（MapCityManager へ委譲）
     * @param {Object} targetCity - 表示する都市データ
     */
    initializeSingleCityMap(targetCity) {
        if (this.cityManager) {
            this.cityManager.initializeSingleCityMap(targetCity);
        }
    }

    /**
     * 都市への平行移動アニメーション（MapCityManager へ委譲）
     * @param {Object} targetCity - 移動先の都市データ
     */
    animateToCity(targetCity) {
        if (this.cityManager) {
            this.cityManager.animateToCity(targetCity);
        }
    }

    /**
     * 都市マーカーを表示（MapCityManager へ委譲）
     * @param {Object} city - 都市データ
     */
    showCityMarker(city) {
        if (this.cityManager) {
            this.cityManager.showCityMarker(city);
        }
    }

    /**
     * 地理的情報をHTMLに動的表示（MapCityManager へ委譲）
     * @param {Object} city - 都市データ
     */
    updateGeographicInfo(city) {
        if (this.cityManager) {
            this.cityManager.updateGeographicInfo(city);
        }
    }

    /**
     * 都市の座標を統一形式で取得（MapCityManager へ委譲）
     * @param {Object} city - 都市データ
     * @returns {Array} [longitude, latitude] 形式の座標配列
     */
    getCityCoordinates(city) {
        if (this.cityManager) {
            return this.cityManager.getCityCoordinates(city);
        }
    }

    /**
     * 都市のスタイル情報を統一形式で取得（MapCityManager へ委譲）
     * @param {Object} city - 都市データ
     * @returns {Object} スタイル情報 { size, color }
     */
    getCityStyle(city) {
        if (this.cityManager) {
            return this.cityManager.getCityStyle(city);
        }
    }

    /**
     * 都市の地域に基づく色を取得（MapCityManager へ委譲）
     * @param {Object} city - 都市データ
     * @returns {string} 色コード
     */
    getCityColor(city) {
        if (this.cityManager) {
            return this.cityManager.getCityColor(city);
        }
    }

    /**
     * リサイズ処理（最適化版）
     */
    resize() {
        if (this.controller) {
            this.controller.resize();
        }
    }


    /**
     * 破棄処理（BaseManagerをオーバーライド）
     */
    destroy() {
        // MapController をクリア
        if (this.controller) {
            this.controller.destroy();
            this.controller = null;
        }

        // MapRenderer をクリア
        if (this.renderer) {
            this.renderer = null;
        }

        if (this.cityManager) {
            this.cityManager.destroy?.();
            this.cityManager = null;
        }

        // プロジェクション関連をクリア
        this.projection = null;
        this.path = null;
        this.geoData = null;
        this.currentView = null;
        this.mapInitialized = false;

        // BaseManagerの破棄処理を呼び出し
        super.destroy();
    }
}
