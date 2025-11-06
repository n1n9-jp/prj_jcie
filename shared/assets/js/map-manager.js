/**
 * MapManager - 地図管理クラス
 * D3.jsを使用した世界地図の描画・更新を管理
 * BaseManagerを継承し、共通機能を活用
 */
class MapManager extends BaseManager {
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
        this.controller = new window.MapController(this);

        // MapCityManager を初期化
        this.cityManager = new window.MapCityManager(this);

        // イベントリスナーを設定
        pubsub.subscribe(EVENTS.MAP_UPDATE, (data) => {
            this.controller.updateMap(data);
        });

        pubsub.subscribe(EVENTS.MAP_PROGRESS, (data) => {
            this.controller.handleMapProgress(data);
        });
        
        // 都市タイムライン用の状態
        this.citiesTimelineData = null;
        this.timelineMode = false;
        this.visibleCities = [];
        
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
        return window.AppConstants?.getCountryNameJapanese(countryEn) || countryEn;
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
        this.clearSpreadingArrows();
        
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
            this.renderer = new window.MapRenderer(this.container, this);
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
            this.renderer = new window.MapRenderer(this.container, this);
        }

        // MapRenderer の renderMap を使用
        this.renderer.renderMap(geoData, config);

        // MapManager のプロパティを同期
        this.svg = this.renderer.getSVG();
        this.projection = this.renderer.getProjection();
        this.path = this.renderer.getPath();
    }

    /**
     * 【非推奨】従来の renderMap 実装（削除予定）
     * 互換性保持のため残存
     */
    _renderMapLegacy(geoData, config = {}) {
        // 再描画時は既存の拡散矢印を即座にクリア
        this.clearSpreadingArrows();

        const {
            center = [0, 0],
            zoom = 1,
            highlightCountries = [],
            cities = [],
            useRegionColors = false,
            lightenNonVisited = false,
            lightenAllCountries = false,
            targetRegions = [],
            showSpreadingArrows = false,
            mode = null
        } = config;
        
        
        const svg = this.initSVG(config);
        
        // 現在のSVGサイズを取得
        const actualSize = SVGHelper.getActualSize(svg);
        const svgWidth = actualSize.width || config.width || 800;
        const svgHeight = actualSize.height || config.height || 600;
        
        // 投影法を設定（モード別スケール調整）
        const scaleMultiplier = (mode === 'single-city') ? 1.0 : 1.5; // 都市モードでは拡大なし
        
        // 座標の安全性をチェック（NaN防止）
        const safeCenter = [
            (center && typeof center[0] === 'number' && !isNaN(center[0])) ? center[0] : 0,
            (center && typeof center[1] === 'number' && !isNaN(center[1])) ? center[1] : 0
        ];
        const safeZoom = (typeof zoom === 'number' && !isNaN(zoom) && zoom > 0) ? zoom : 1;
        
        this.projection = d3.geoNaturalEarth1()
            .scale(safeZoom * 150 * scaleMultiplier)
            .center(safeCenter)
            .translate([svgWidth / 2, svgHeight / 2]);
            
        this.path = d3.geoPath().projection(this.projection);

        // 地図グループを作成
        const mapGroup = svg.append('g').attr('class', 'map-group');

        // 国境を描画
        if (geoData && geoData.features) {
            
            const paths = mapGroup.selectAll('.map-country')
                .data(geoData.features)
                .enter()
                .append('path')
                .attr('class', 'map-country')
                .attr('d', this.path)
                .style('fill', d => {
                    // 地図データの実際の構造に合わせて国名を取得（空文字列の場合はデフォルト値を使用）
                    const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';
                    
                    // 地域色を適用
                    if (config.useRegionColors && window.CountryRegionMapping && window.ColorScheme) {
                        const region = window.CountryRegionMapping.getRegionForCountry(countryName);
                        
                        // デバッグ：地域マッピングに失敗した国をログ出力
                        if (!region) {
                            console.warn('MapManager: No region mapping found for country:', countryName);
                        }
                        
                        // highlightCountriesが指定されている場合、ハイライト国のみ地域色、他は薄いグレー
                        if (highlightCountries && highlightCountries.length > 0) {
                            // より厳密な国名マッチング
                            const isHighlighted = highlightCountries.some(hc => {
                                // 完全一致
                                if (countryName === hc) return true;
                                
                                // 双方向部分一致（正当な名前の変形に対応）
                                if (countryName.includes(hc) || hc.includes(countryName)) return true;
                                
                                return false;
                            });
                            
                            if (isHighlighted) {
                                if (region) {
                                    return window.ColorScheme.getRegionColor(region); // ハイライト国は地域色
                                } else {
                                    return window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6'; // 地域不明のハイライト国は情報色
                                }
                            } else {
                                return window.AppConstants?.APP_COLORS?.BACKGROUND?.GRAY || '#f3f4f6'; // ハイライト国以外は薄いグレー
                            }
                        }
                        
                        if (region) {
                            // targetRegionsが指定されている場合、対象地域のみ色を付ける
                            if (config.targetRegions && config.targetRegions.length > 0) {
                                if (!config.targetRegions.includes(region)) {
                                    return window.AppConstants?.APP_COLORS?.BACKGROUND?.GRAY || '#f3f4f6'; // 対象外の地域は薄いグレー
                                }
                            }
                            
                            let color = window.ColorScheme.getRegionColor(region);
                            
                            // lightenNonVisitedが有効な場合、訪問国以外を明るくする
                            if (config.lightenNonVisited) {
                                // より確実に訪問国を取得
                                let visitedCountry = this.getCurrentVisitedCountry();
                                // getCurrentVisitedCountryが失敗した場合の代替手段
                                if (!visitedCountry && this.currentCity) {
                                    visitedCountry = this.currentCity.country;
                                }
                                if (visitedCountry && countryName !== visitedCountry) {
                                    color = window.ColorScheme.getLighterColor(color, 0.5);
                                }
                            }
                            
                            // lightenAllCountriesが有効な場合：すべての国を50%明るくする
                            if (lightenAllCountries) {
                                color = window.ColorScheme.getLighterColor(color, 0.5);
                            }
                            
                            return color;
                        }
                    }
                    
                    // 地域色が設定されていない場合のみハイライト色を適用
                    if (highlightCountries.includes(countryName)) {
                        return window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6';
                    }
                    
                    // デフォルト色（未分類）
                    return window.AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db';
                })
                .style('stroke', d => {
                    // 地図データの実際の構造に合わせて国名を取得（空文字列の場合はデフォルト値を使用）
                    const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';
                    
                    // 地域色適用時は境界を強調（ハイライト国も含む）
                    if (config.useRegionColors) {
                        return window.AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc';
                    }
                    
                    // 地域色が無効な場合のみハイライト色を適用
                    if (highlightCountries.includes(countryName)) {
                        return window.AppConstants?.APP_COLORS?.ACCENT?.INFO || '#1d4ed8';
                    }
                    
                    return window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff';
                })
                .style('stroke-width', d => {
                    // 地図データの実際の構造に合わせて国名を取得（空文字列の場合はデフォルト値を使用）
                    const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';
                    
                    // 地域色適用時は境界線を少し太く（ハイライト国も含む）
                    if (config.useRegionColors) {
                        return '0.75';
                    }
                    
                    // 地域色が無効な場合のみハイライト幅を適用
                    if (highlightCountries.includes(countryName)) {
                        return '1.5';
                    }
                    
                    return '0.5';
                })
                .style('opacity', 0);
                
            
            paths.transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .delay((d, i) => i * 10)
                .style('opacity', 1);
                
        } else {
            console.error('No geoData or geoData.features available for drawing');
            console.error('geoData:', geoData);
        }

        // 都市マーカーを描画
        if (cities && cities.length > 0) {
            mapGroup.selectAll('.map-city')
                .data(cities)
                .enter()
                .append('circle')
                .attr('class', 'map-city')
                .attr('cx', d => this.projection(this.getCityCoordinates(d))[0])
                .attr('cy', d => this.projection(this.getCityCoordinates(d))[1])
                .attr('r', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .delay(1000)
                .attr('r', 6);

            // 都市ラベルを追加
            mapGroup.selectAll('.city-label')
                .data(cities)
                .enter()
                .append('text')
                .attr('class', 'city-label')
                .attr('x', d => this.projection(this.getCityCoordinates(d))[0])
                .attr('y', d => this.projection(this.getCityCoordinates(d))[1] - 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '16px')
                .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
                .attr('font-weight', 'bold')
                .attr('font-family', window.AppConstants?.FONT_CONFIG?.FAMILIES?.SERIF || '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
                .text(d => this.getCountryNameJapanese(d.country))
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .delay(1200)
                .style('opacity', 1);
        }

        // エイズ拡散矢印を描画（step3用）
        if (showSpreadingArrows) {
            this.drawSpreadingArrows(mapGroup);
        } else {
            // showSpreadingArrowsがfalseの場合は拡散矢印を即座に削除
            this.clearSpreadingArrows();
        }

        // 滑らかなトランジション
        this.animateToView(center, zoom, mode);
    }

    /**
     * 指定した座標とズームレベルにアニメーション
     * @param {Array} center - 中心座標 [経度, 緯度]
     * @param {number} zoom - ズームレベル
     * @param {string} mode - 地図モード
     */
    animateToView(center, zoom, mode = null) {
        if (this.controller) {
            this.controller.animateToView(center, zoom, mode);
        }
    }

    /**
     * 特定の国をハイライト
     * @param {Array} countryNames - ハイライトする国名の配列
     */
    highlightCountries(countryNames) {
        if (this.controller) {
            this.controller.highlightCountries(countryNames);
        }
    }

    /**
     * 都市マーカーを追加/更新
     * @param {Array} cities - 都市データの配列
     */
    updateCities(cities) {
        if (this.controller) {
            this.controller.updateCities(cities);
        }
    }

    /**
     * 既存の地図を更新（MapController へ委譲）
     * @param {Object} config - 設定オプション
     */
    updateExistingMap(config = {}) {
        if (this.controller) {
            this.controller.updateExistingMap(config);
        }
    }

    /**
     * 国のハイライトを更新（MapController へ委譲）
     * @param {Array} highlightCountries - ハイライトする国名の配列
     * @param {boolean} useRegionColors - 地域色を使用するかどうか
     * @param {boolean} lightenNonVisited - 訪問国以外を明るくするかどうか
     */
    updateCountryHighlights(highlightCountries, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = []) {
        if (this.controller) {
            this.controller.updateCountryHighlights(highlightCountries, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions);
            return;
        }
        if (!this.svg) return;

        this.svg.selectAll('.map-country')
            .transition()
            .duration(window.AppDefaults?.animation?.shortDuration || 500)
            .style('fill', d => {
                const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                
                // 地域色を適用
                if (useRegionColors && window.CountryRegionMapping && window.ColorScheme) {
                    const region = window.CountryRegionMapping.getRegionForCountry(countryName);
                    
                    // デバッグ：地域マッピングに失敗した国をログ出力
                    if (!region) {
                        console.warn('MapManager: No region mapping found for country (updateCountryHighlights):', countryName);
                    }
                    
                    // highlightCountriesが指定されている場合、ハイライト国のみ地域色、他は薄いグレー
                    if (highlightCountries && highlightCountries.length > 0) {
                        // より厳密な国名マッチング
                        const isHighlighted = highlightCountries.some(hc => {
                            // 完全一致
                            if (countryName === hc) return true;
                            
                            // 双方向部分一致（正当な名前の変形に対応）
                            if (countryName.includes(hc) || hc.includes(countryName)) return true;
                            
                            return false;
                        });
                        
                        if (isHighlighted) {
                            if (region) {
                                return window.ColorScheme.getRegionColor(region); // ハイライト国は地域色
                            } else {
                                return '#3b82f6'; // 地域不明のハイライト国はデフォルトのハイライト色
                            }
                        } else {
                            return '#f3f4f6'; // ハイライト国以外は薄いグレー
                        }
                    }
                    
                    if (region) {
                        // targetRegionsが指定されている場合、対象地域のみ色を付ける
                        if (targetRegions && targetRegions.length > 0) {
                            if (!targetRegions.includes(region)) {
                                return '#f3f4f6'; // 対象外の地域は薄いグレー
                            }
                        }
                        
                        let color = window.ColorScheme.getRegionColor(region);
                        
                        // lightenNonVisitedが有効な場合、訪問国以外を明るくする
                        if (lightenNonVisited) {
                            // より確実に訪問国を取得
                            let visitedCountry = this.getCurrentVisitedCountry();
                            // getCurrentVisitedCountryが失敗した場合の代替手段
                            if (!visitedCountry && this.currentCity) {
                                visitedCountry = this.currentCity.country;
                            }
                            if (visitedCountry && countryName !== visitedCountry) {
                                color = window.ColorScheme.getLighterColor(color, 0.5);
                            }
                        }
                        
                        // lightenAllCountriesが有効な場合：すべての国を50%明るくする
                        if (lightenAllCountries) {
                            color = window.ColorScheme.getLighterColor(color, 0.5);
                        }
                        
                        return color;
                    }
                }
                
                // 地域色が設定されていない場合のみハイライト色を適用
                if (highlightCountries.includes(countryName)) {
                    return '#3b82f6';
                }
                
                // デフォルト色（未分類）
                return '#d1d5db';
            })
            .style('stroke', d => {
                const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                
                // 地域色適用時は境界を強調（ハイライト国も含む）
                if (useRegionColors) {
                    return '#ccc';
                }
                
                // 地域色が無効な場合のみハイライト色を適用
                if (highlightCountries.includes(countryName)) {
                    return '#1d4ed8';
                }
                
                return '#fff';
            })
            .style('stroke-width', d => {
                const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                
                // 地域色適用時は境界線を少し太く（ハイライト国も含む）
                if (useRegionColors) {
                    return '0.75';
                }
                
                // 地域色が無効な場合のみハイライト幅を適用
                if (highlightCountries.includes(countryName)) {
                    return '1.5';
                }
                
                return '0.5';
            });

    }

    /**
     * 現在訪問中の国名を取得（single-cityモード用）
     * @returns {string|null} 訪問国名、見つからない場合はnull
     */
    getCurrentVisitedCountry() {
        if (this.controller) {
            return this.controller.getCurrentVisitedCountry();
        }
        if (!this.currentView || !this.currentView.cityId || !this.citiesTimelineData) {
            return null;
        }

        const city = this.citiesTimelineData.cities.find(c => c.id === this.currentView.cityId);
        return city ? city.country : null;
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
     * スクロール進行度に応じた都市表示処理
     * @param {Object} progressData - 進行度データ
     */
    handleMapProgress(progressData) {
        if (this.controller) {
            this.controller.handleMapProgress(progressData);
            return;
        }
        if (!this.timelineMode || !this.citiesTimelineData) {
            return;
        }
        
        const { progress, direction, config } = progressData;
        
        // より緩やかな都市表示のために進行度を調整
        // 進行度を二乗してゆっくりスタート、速く終了のカーブにする
        const adjustedProgress = Math.pow(progress, 0.7); // 0.7乗でゆっくりスタート
        
        // 進行度から表示する都市数を計算（0-100% -> 0-10都市）
        const totalCities = this.citiesTimelineData.cities.length;
        let targetCityCount = Math.floor(adjustedProgress * totalCities);
        
        // 進行度が0.1以下の場合は都市を表示しない（遅延スタート）
        if (progress < 0.1) {
            targetCityCount = 0;
        }
        
        // 最低0都市、最大全都市
        targetCityCount = Math.max(0, Math.min(targetCityCount, totalCities));
        
        // 都市を順序通りに並べ替え
        const sortedCities = [...this.citiesTimelineData.cities]
            .sort((a, b) => a.order - b.order);
        
        // 順スクロールと逆スクロールで順序を変える
        const orderedCities = direction === 'up' 
            ? [...sortedCities].reverse()
            : sortedCities;
            
        const targetCities = orderedCities.slice(0, targetCityCount);
        
        
        this.updateTimelineCities(targetCities);
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
        try {
            
            // 都市データを読み込み
            if (!this.citiesTimelineData) {
                this.citiesTimelineData = await d3.json(citiesFile);
            }
            
            // 指定された都市を検索
            const targetCity = this.citiesTimelineData.cities.find(city => city.id === cityId);
            
            if (!targetCity) {
                console.error('MapManager: City not found:', cityId);
                return;
            }
            
            
            // タイムラインモードをリセット
            this.timelineMode = false;
            this.visibleCities = [];
            this.singleCityMode = true;
            
            // 統一システム: 常にrenderMapを使用（設定駆動）
            if (this.svg && this.projection && this.geoData) {
                // 既存の地図を使ってスムーズにトランジション
                this.animateToCity(targetCity);
                this.mapInitialized = true;
            } else {
                // 初回の場合も統一されたrenderMapを使用
                const cityCoords = this.getCityCoordinates(targetCity);
                this.renderMap(this.geoData, {
                    center: cityCoords,
                    zoom: 6, // 統一されたズーム値
                    mode: 'single-city',
                    widthPercent: 100,
                    heightPercent: 100,
                    useRegionColors: true,
                    lightenNonVisited: true
                });
                this.mapInitialized = true;
            }
            
            this.currentCity = targetCity;
            
        } catch (error) {
            console.error('MapManager: Failed to load single city data:', error);
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
     * 拡散矢印を即座にクリア
     */
    clearSpreadingArrows() {
        if (this.svg) {
            // 進行中のアニメーションも含めて即座に削除
            this.svg.selectAll('.spreading-arrows').interrupt().remove();
            
            // より強力なクリーンアップ：個別要素も削除
            this.svg.selectAll('.spreading-flow').interrupt().remove();
            this.svg.selectAll('#spreading-arrow').remove();
            
        }
    }

    /**
     * エイズ拡散矢印を描画（step3用）
     * @param {d3.Selection} mapGroup - 地図グループ要素
     */
    drawSpreadingArrows(mapGroup) {
        
        // アメリカから各地域への拡散データ（概念的座標）
        const spreadingFlows = [
            {
                id: 'usa-europe',
                from: { name: 'アメリカ', coords: [-95, 40] },
                to: { name: 'ヨーロッパ', coords: [10, 50] },
                delay: 0
            },
            {
                id: 'usa-asia',
                from: { name: 'アメリカ', coords: [-95, 40] },
                to: { name: 'アジア・太平洋', coords: [104, 35] },
                delay: 150
            },
            {
                id: 'usa-east-africa',
                from: { name: 'アメリカ', coords: [-95, 40] },
                to: { name: '東部・南部アフリカ', coords: [35, -10] },
                delay: 300
            },
            {
                id: 'usa-west-africa',
                from: { name: 'アメリカ', coords: [-95, 40] },
                to: { name: '西部・中部アフリカ', coords: [0, 10] },
                delay: 450
            }
        ];

        // SVGマーカー（矢印）を定義
        const defs = mapGroup.select('defs').empty() ? 
            mapGroup.append('defs') : mapGroup.select('defs');

        // 既存のマーカーがない場合のみ作成
        if (defs.select('#spreading-arrow').empty()) {
            defs.append('marker')
                .attr('id', 'spreading-arrow')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 8)
                .attr('refY', 0)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', window.AppConstants?.APP_COLORS?.ANNOTATIONS?.LINE || '#999999')
                .attr('stroke', 'none');
        }

        // 拡散矢印グループを作成
        const arrowGroup = mapGroup.append('g')
            .attr('class', 'spreading-arrows');

        // 各フローラインを描画
        spreadingFlows.forEach(flow => {
            // 投影座標を計算
            const fromCoords = this.projection(flow.from.coords);
            const toCoords = this.projection(flow.to.coords);
            
            if (!fromCoords || !toCoords) {
                console.warn('Invalid coordinates for flow:', flow.id);
                return;
            }

            // 曲線パスを生成（制御点を使用）
            const midX = (fromCoords[0] + toCoords[0]) / 2;
            const midY = (fromCoords[1] + toCoords[1]) / 2 - 100; // 上に湾曲
            
            const pathData = `M ${fromCoords[0]},${fromCoords[1]} Q ${midX},${midY} ${toCoords[0]},${toCoords[1]}`;

            // パスを描画（最初はマーカーなし）
            const path = arrowGroup.append('path')
                .attr('class', `spreading-flow ${flow.id}`)
                .attr('d', pathData)
                .attr('fill', 'none')
                .attr('stroke', window.AppConstants?.APP_COLORS?.ANNOTATIONS?.LINE || '#999999')
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', '5,5')
                .style('opacity', 0);

            // パスの長さを取得してアニメーション
            const totalLength = path.node().getTotalLength();
            
            path.attr('stroke-dasharray', totalLength + ' ' + totalLength)
                .attr('stroke-dashoffset', totalLength)
                .transition()
                .duration(window.AppConstants?.ANIMATION_CONFIG?.DURATION?.SLOW || 1200)
                .delay(flow.delay + 100) // さらに早いタイミングで表示
                .ease(d3.easeQuadOut)
                .attr('stroke-dashoffset', 0)
                .style('opacity', 1)
                .on('end', () => {
                    // 線の描画完了後に矢印マーカーを追加
                    path.attr('marker-end', 'url(#spreading-arrow)');
                });


        });

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

        // 都市フォーカス管理をリセット
        if (this.cityFocusManager) {
            this.cityFocusManager.reset();
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

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.MapManager = MapManager;