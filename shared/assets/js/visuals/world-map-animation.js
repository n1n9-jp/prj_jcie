import * as d3 from 'd3';
import { MapRenderer } from '../map/map-renderer.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { AppConstants } from '../utils/app-constants.js';

/**
 * WorldMapAnimation - トップページ用世界地図アニメーション
 * 
 * 責務:
 * - 世界地図の描画
 * - 指定した国々を順番に巡回するアニメーション
 * - 国名のオーバーレイ表示
 */
export class WorldMapAnimation {
    /**
     * @param {string} containerId - 地図を表示するコンテナのID
     * @param {string} overlayId - 国名を表示するオーバーレイ要素のID
     */
    constructor(containerId, overlayId) {
        this.container = d3.select(containerId);
        this.overlayText = d3.select(overlayId);
        this.configLoader = new ConfigLoader();

        // MapRenderer用の簡易マネージャー（依存解決用）
        const mockMapManager = {
            getCountryNameJapanese: (name) => AppConstants.getCountryNameJapanese(name),
            getCurrentVisitedCountry: () => null,
            currentCity: null
        };

        this.renderer = new MapRenderer(this.container, mockMapManager);
        this.isPlaying = false;
        this.currentIndex = 0;
        this.geoData = null;
        this.timer = null;

        // 巡回する国のリスト
        this.targetCountries = [
            'Vietnam',
            'El Salvador',
            'Nigeria',
            'Indonesia',
            'Niger',
            'Malawi',
            'Kenya',
            'Zimbabwe',
            'Cameroon',
            'India',
            'Belize',
            'South Africa',
            'Myanmar',
            'United States of America',
            'Philippines',
            'Pakistan',
            'Afghanistan'
        ];
    }

    /**
     * 初期化とアニメーション開始
     */
    async init() {
        try {
            // 設定から投影法を取得（フォールバックはorthographic）
            let projectionType = 'orthographic';
            try {
                if (this.configLoader?.setDiseaseType && window?.DISEASE_TYPE) {
                    this.configLoader.setDiseaseType(window.DISEASE_TYPE);
                }
                const configs = await this.configLoader.loadAll();
                const mapsConfig = configs?.app?.maps || {};
                projectionType = mapsConfig.heroProjection || mapsConfig.defaultProjection || projectionType;
            } catch (configError) {
                console.warn('WorldMapAnimation: Failed to load map projection config, using default', configError);
            }

            // 地図データの読み込み
            // 地図データの読み込み
            // 注意: topojsonはグローバルに読み込まれている前提
            const dataUrl = new URL('../../../data/countries-110m.json', import.meta.url).href;
            const response = await fetch(dataUrl);
            const topoData = await response.json();

            if (!window.topojson) {
                console.error('WorldMapAnimation: topojson library not found');
                return;
            }

            this.geoData = window.topojson.feature(topoData, topoData.objects.countries);

            // 初回描画（全体表示）
            this.renderer.renderMap(this.geoData, {
                widthPercent: 100,
                heightPercent: 100,
                center: [0, 20],
                zoom: 1,
                useRegionColors: false,
                lightenAllCountries: true, // 全体を薄くする
                disableZoom: true, // ズーム無効化
                projectionType, // 設定で指定された投影法を使用
                offsetY: -50, // 位置調整
                scaleMultiplier: 1.5 // 大きさを1.5倍
            });

            // アニメーション開始
            this.start();

        } catch (error) {
            console.error('WorldMapAnimation: Failed to initialize', error);
        }
    }

    /**
     * アニメーションループの開始
     */
    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this._animateLoop();
    }

    /**
     * アニメーションの停止
     */
    stop() {
        this.isPlaying = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * アニメーションの1ステップを実行
     * @private
     */
    _animateLoop() {
        if (!this.isPlaying) return;

        const countryName = this.targetCountries[this.currentIndex];
        this._highlightAndCenter(countryName);

        // 次のインデックスへ
        this.currentIndex = (this.currentIndex + 1) % this.targetCountries.length;

        // 次のステップをスケジュール（4秒間隔）
        this.timer = setTimeout(() => {
            this._animateLoop();
        }, 4000);
    }

    /**
     * 指定した国をハイライトし、中心に移動
     * @param {string} countryName 
     * @private
     */
    _highlightAndCenter(countryName) {
        if (!this.geoData) return;

        // 対象国のFeatureを探す
        // データによっては名前のプロパティが異なる場合があるため、いくつか試行
        const feature = this.geoData.features.find(f => {
            const props = f.properties;
            const name = props.name || props.NAME || props.NAME_EN;
            return name === countryName || name === this._getAlternativeName(countryName);
        });

        if (!feature) {
            console.warn(`WorldMapAnimation: Country not found "${countryName}"`);
            return;
        }

        // 重心を計算
        const centroid = d3.geoCentroid(feature);

        // ビューを移動（ズームレベル2）
        this.renderer.animateToView(centroid, 2, 'animation');

        // 国をハイライト（赤色）
        // MapRendererのupdateCountryHighlightsを使用
        // highlightCountriesに指定した国はデフォルトでINFO色(青)になるが、
        // MapRendererのロジックによっては調整が必要かもしれない。
        // ここではMapRendererの既存ロジックに頼る。
        // 赤にするにはMapRenderer側で色指定を制御する必要があるが、
        // 現状のMapRendererはハイライト色を定数から取っている。
        // 一旦デフォルトのハイライト色（青）で進めるか、MapRendererを拡張するか。
        // 要件は「赤くなり」なので、MapRendererのロジックを確認すると、
        this.renderer.updateCountryHighlights(
            [countryName],
            false, // useRegionColors
            false, // lightenNonVisited
            true,   // lightenAllCountries (他を薄く)
            [],     // targetRegions
            'rgb(118, 80, 127)' // highlightColor (Footer Purple)
        );

        // テキストオーバーレイの更新
        // 英語名を使用
        const displayName = countryName;

        this.overlayText
            .transition()
            .duration(500)
            .style('opacity', 0)
            .on('end', () => {
                this.overlayText.text(displayName);
                this.overlayText
                    .transition()
                    .duration(500)
                    .style('opacity', 1);
            });
    }

    /**
     * 国名の揺らぎ吸収用（簡易版）
     * @param {string} name 
     * @returns {string}
     */
    _getAlternativeName(name) {
        const map = {
            'United States of America': 'United States',
            'Russia': 'Russian Federation'
        };
        return map[name] || name;
    }
}
