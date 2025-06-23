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
        
        // Initialize after properties are set
        this.init();
    }

    /**
     * 初期化処理（BaseManagerを拡張）
     */
    init() {
        super.init();
        
        // イベントリスナーを設定
        pubsub.subscribe(EVENTS.MAP_UPDATE, (data) => {
            this.updateMap(data);
        });

        pubsub.subscribe(EVENTS.MAP_PROGRESS, (data) => {
            this.handleMapProgress(data);
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
     * 地図を更新する
     * @param {Object} mapData - 地図データとオプション
     */
    updateMap(mapData) {
        
        const { center, zoom, visible, data, highlightCountries = [], cities = [], mode, citiesFile, cityId, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = [], width = 800, height = 600, widthPercent, heightPercent, aspectRatio, showSpreadingArrows = false } = mapData;
        
        // 地図更新の最初に拡散矢印の状態をチェック
        if (!showSpreadingArrows) {
            this.clearSpreadingArrows();
        }
        
        this.currentView = { center, zoom, highlightCountries, cities, mode, citiesFile, cityId, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions };

        if (visible) {
            this.show();
            
            // 都市タイムラインモードの場合
            if (mode === 'cities-timeline' && citiesFile) {
                this.initCitiesTimeline(citiesFile);
                return;
            }
            
            // 単一都市表示モードの場合
            if (mode === 'single-city' && cityId && citiesFile) {
                this.handleSingleCityMode(citiesFile, cityId);
                return;
            }
            
            
            if (this.geoData) {
                // 地図が既に描画されているかチェック
                if (!this.svg || this.svg.selectAll('.map-country').empty()) {
                    this.renderMap(this.geoData, { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode });
                } else {
                    this.updateExistingMap({ center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions, width, height, widthPercent, heightPercent, aspectRatio, showSpreadingArrows, mode });
                }
            } else {
                console.error('MapManager: No geo data available for rendering');
            }
        } else {
            this.hide();
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
    setGeoData(topoData) {
        
        // TopoJSONをGeoJSONに変換
        if (topoData && topoData.objects && topoData.objects.countries) {
            this.geoData = topojson.feature(topoData, topoData.objects.countries);
        } else {
            console.error('Invalid TopoJSON data structure');
            console.error('Expected: topoData.objects.countries');
            console.error('Actual objects keys:', topoData?.objects ? Object.keys(topoData.objects) : 'No objects');
            this.geoData = null;
        }
    }

    /**
     * SVG要素を初期化（レスポンシブ対応）
     */
    initSVG(config = {}) {
        
        // 地図専用のレスポンシブサイズ計算
        let responsiveSize;
        if (config.widthPercent || config.heightPercent) {
            // パーセント指定の場合は、コンテナサイズに基づいて計算
            const containerElement = this.container.node();
            const containerRect = containerElement.getBoundingClientRect();
            const containerWidth = containerRect.width || window.innerWidth;
            const containerHeight = containerRect.height || window.innerHeight;
            
            let width = config.width || 800;
            let height = config.height || 600;
            
            if (config.widthPercent) {
                width = containerWidth * (config.widthPercent / 100);
            }
            if (config.heightPercent) {
                height = containerHeight * (config.heightPercent / 100);
            }
            
            responsiveSize = { width, height };
        } else if (window.SVGHelper) {
            responsiveSize = SVGHelper.getResponsiveSize(this.container, {
                defaultWidth: config.width || 800,
                defaultHeight: config.height || 600,
                aspectRatio: config.aspectRatio
            });
        } else {
            // フォールバック：固定サイズ
            responsiveSize = {
                width: config.width || 800,
                height: config.height || 600
            };
        }
        
        const { width, height } = responsiveSize;
        
        this.container.selectAll('*').remove();
        
        // パーセント指定の場合は独自にSVGを作成
        if (config.widthPercent || config.heightPercent) {
            this.svg = this.container
                .append('svg')
                .attr('viewBox', `0 0 ${width} ${height}`)
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .style('width', '100%')
                .style('height', 'auto')
                .style('max-width', '100%')
                .style('display', 'block');
        } else if (window.SVGHelper) {
            // 固定サイズの場合はSVGHelperを使用
            this.svg = SVGHelper.initSVG(this.container, width, height, {
                responsive: true,
                preserveAspectRatio: 'xMidYMid meet'
            });
        } else {
            // フォールバック：従来の方法
            this.svg = this.container
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('viewBox', `0 0 ${width} ${height}`)
                .style('width', '100%')
                .style('height', '100%');
        }
            

        // ズーム機能を追加
        const zoom = d3.zoom()
            .scaleExtent([0.5, 8])
            .on('zoom', (event) => {
                this.svg.select('.map-group')
                    .attr('transform', event.transform);
            });

        this.svg.call(zoom);
            
        return this.svg;
    }

    /**
     * 地図を描画
     * @param {Object} geoData - GeoJSONデータ
     * @param {Object} config - 設定オプション
     */
    renderMap(geoData, config = {}) {
        
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
        this.projection = d3.geoNaturalEarth1()
            .scale(zoom * 150 * scaleMultiplier)
            .center(center)
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
                    const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                    
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
                            const isHighlighted = highlightCountries.some(hc => 
                                countryName === hc || 
                                countryName.includes('United States') || 
                                countryName === 'USA' ||
                                hc.includes(countryName)
                            );
                            
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
                    const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                    
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
                    const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                    
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
                .attr('cx', d => this.projection([d.longitude, d.latitude])[0])
                .attr('cy', d => this.projection([d.longitude, d.latitude])[1])
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
                .attr('x', d => this.projection([d.longitude, d.latitude])[0])
                .attr('y', d => this.projection([d.longitude, d.latitude])[1] - 10)
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
        if (!this.projection || !this.svg) return;

        const duration = window.AppDefaults?.animation?.chartTransitionDuration || 1000;
        const currentCenter = this.projection.center();
        const currentScale = this.projection.scale();
        const scaleMultiplier = (mode === 'single-city') ? 1.0 : 1.5; // 都市モードでは拡大なし
        const targetScale = zoom * 150 * scaleMultiplier;
        
        // SVGに対してtransitionを適用（projectionではなく）
        this.svg
            .transition()
            .duration(duration)
            .tween('projection', () => {
                const interpolateCenter = d3.interpolate(currentCenter, center);
                const interpolateScale = d3.interpolate(currentScale, targetScale);
                
                return (t) => {
                    this.projection
                        .center(interpolateCenter(t))
                        .scale(interpolateScale(t));
                    
                    // パスを再描画
                    this.svg.selectAll('.map-country')
                        .attr('d', this.path);
                    
                    // 都市マーカーを更新
                    this.svg.selectAll('.map-city')
                        .attr('cx', d => {
                            const coords = this.projection([d.longitude, d.latitude]);
                            return coords ? coords[0] : 0;
                        })
                        .attr('cy', d => {
                            const coords = this.projection([d.longitude, d.latitude]);
                            return coords ? coords[1] : 0;
                        });
                    
                    // 都市ラベルを更新
                    this.svg.selectAll('.city-label')
                        .attr('x', d => {
                            const coords = this.projection([d.longitude, d.latitude]);
                            return coords ? coords[0] : 0;
                        })
                        .attr('y', d => {
                            const coords = this.projection([d.longitude, d.latitude]);
                            return coords ? coords[1] - 10 : 0;
                        });
                };
            });
    }

    /**
     * 特定の国をハイライト
     * @param {Array} countryNames - ハイライトする国名の配列
     */
    highlightCountries(countryNames) {
        this.svg.selectAll('.map-country')
            .classed('highlighted', d => {
                const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                return countryNames.includes(countryName);
            });
    }

    /**
     * 都市マーカーを追加/更新
     * @param {Array} cities - 都市データの配列
     */
    updateCities(cities) {
        if (!this.projection) return;

        const mapGroup = this.svg.select('.map-group');
        
        // 既存の都市マーカーを削除
        mapGroup.selectAll('.map-city, .city-label').remove();

        // 新しい都市マーカーを追加
        if (cities && cities.length > 0) {
            mapGroup.selectAll('.map-city')
                .data(cities)
                .enter()
                .append('circle')
                .attr('class', 'map-city')
                .attr('cx', d => this.projection([d.longitude, d.latitude])[0])
                .attr('cy', d => this.projection([d.longitude, d.latitude])[1])
                .attr('r', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.defaultDuration || 300)
                .attr('r', 6);

            mapGroup.selectAll('.city-label')
                .data(cities)
                .enter()
                .append('text')
                .attr('class', 'city-label')
                .attr('x', d => this.projection([d.longitude, d.latitude])[0])
                .attr('y', d => this.projection([d.longitude, d.latitude])[1] - 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '16px')
                .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
                .attr('font-weight', 'bold')
                .attr('font-family', window.AppConstants?.FONT_CONFIG?.FAMILIES?.SERIF || '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
                .text(d => this.getCountryNameJapanese(d.country))
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.defaultDuration || 300)
                .delay(200)
                .style('opacity', 1);
        }
    }

    /**
     * 既存の地図を更新（再描画せずにアニメーション）
     * @param {Object} config - 設定オプション
     */
    updateExistingMap(config = {}) {
        const { 
            center = [0, 0], 
            zoom = 1, 
            highlightCountries = [], 
            cities = [],
            useRegionColors = false,
            lightenNonVisited = false,
            lightenAllCountries = false,
            targetRegions = [],
            width = 800,
            height = 600,
            widthPercent,
            heightPercent,
            aspectRatio,
            showSpreadingArrows = false,
            mode = null
        } = config;


        // 最優先で拡散矢印の状態を処理（アニメーション前に実行）
        if (!showSpreadingArrows) {
            this.clearSpreadingArrows();
        }

        if (!this.svg || !this.projection) {
            console.error('MapManager: No SVG or projection available for update');
            return;
        }

        // プロジェクションの現在の設定を取得
        const currentCenter = this.projection.center();
        const currentScale = this.projection.scale();
        const scaleMultiplier = (mode === 'single-city') ? 1.0 : 1.5; // 都市モードでは拡大なし
        const targetScale = zoom * 150 * scaleMultiplier;


        // アニメーション開始前に既存の都市マーカー・ラベルを削除
        const mapGroup = this.svg.select('.map-group');
        mapGroup.selectAll('.map-city, .city-label, .single-city-marker, .single-city-label, .single-city-info')
            .transition()
            .duration(window.AppDefaults?.animation?.defaultDuration || 200)
            .style('opacity', 0)
            .remove();

        // スムーズなトランジション
        this.svg
            .transition()
            .delay(200) // 既存要素の削除を待つ
            .duration((window.AppDefaults?.animation?.chartTransitionDuration || 1000) * 1.5)
            .ease(d3.easeCubicInOut)
            .tween('projection', () => {
                const interpolateCenter = d3.interpolate(currentCenter, center);
                const interpolateScale = d3.interpolate(currentScale, targetScale);
                
                return (t) => {
                    // プロジェクションを更新
                    this.projection
                        .center(interpolateCenter(t))
                        .scale(interpolateScale(t));
                    
                    // 国境パスを再描画
                    this.svg.selectAll('.map-country')
                        .attr('d', this.path);
                };
            })
            .on('end', () => {
                // アニメーション完了後に国のハイライトと都市マーカーを更新
                this.updateCountryHighlights(highlightCountries, useRegionColors, lightenNonVisited, lightenAllCountries, targetRegions);
                this.updateCityMarkers(cities);
                
                // エイズ拡散矢印を処理（step3用）
                if (showSpreadingArrows) {
                    // 新たに拡散矢印を描画
                    const mapGroup = this.svg.select('.map-group');
                    if (!mapGroup.empty()) {
                        this.drawSpreadingArrows(mapGroup);
                    }
                }
                // 注意：showSpreadingArrowsがfalseの場合のクリアは既にupdateExistingMapの開始時に実行済み
            });
    }

    /**
     * 国のハイライトを更新
     * @param {Array} highlightCountries - ハイライトする国名の配列
     * @param {boolean} useRegionColors - 地域色を使用するかどうか
     * @param {boolean} lightenNonVisited - 訪問国以外を明るくするかどうか
     */
    updateCountryHighlights(highlightCountries, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = []) {
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
                        const isHighlighted = highlightCountries.some(hc => 
                            countryName === hc || 
                            countryName.includes('United States') || 
                            countryName === 'USA' ||
                            hc.includes(countryName)
                        );
                        
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
        if (!this.currentView || !this.currentView.cityId || !this.citiesTimelineData) {
            return null;
        }
        
        const city = this.citiesTimelineData.cities.find(c => c.id === this.currentView.cityId);
        return city ? city.country : null;
    }

    /**
     * 都市マーカーを更新
     * @param {Array} cities - 都市データの配列
     */
    updateCityMarkers(cities) {
        if (!this.projection || !this.svg) return;

        const mapGroup = this.svg.select('.map-group');
        
        // 新しい都市マーカーを追加（既存要素は既に削除済み）
        if (cities && cities.length > 0) {
            // 都市マーカーを追加
            mapGroup.selectAll('.new-city')
                .data(cities)
                .enter()
                .append('circle')
                .attr('class', 'map-city')
                .attr('cx', d => {
                    const coords = this.projection([d.longitude, d.latitude]);
                    return coords ? coords[0] : 0;
                })
                .attr('cy', d => {
                    const coords = this.projection([d.longitude, d.latitude]);
                    return coords ? coords[1] : 0;
                })
                .attr('r', 0)
                .style('fill', window.AppConstants?.APP_COLORS?.ACCENT?.ERROR || '#ef4444')
                .style('stroke', window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
                .style('stroke-width', 2)
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .delay(300)
                .attr('r', 6);

            // 都市ラベルを追加
            mapGroup.selectAll('.new-label')
                .data(cities)
                .enter()
                .append('text')
                .attr('class', 'city-label')
                .attr('x', d => {
                    const coords = this.projection([d.longitude, d.latitude]);
                    return coords ? coords[0] : 0;
                })
                .attr('y', d => {
                    const coords = this.projection([d.longitude, d.latitude]);
                    return coords ? coords[1] - 10 : 0;
                })
                .attr('text-anchor', 'middle')
                .attr('font-size', '16px')
                .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
                .attr('font-weight', 'bold')
                .attr('font-family', window.AppConstants?.FONT_CONFIG?.FAMILIES?.SERIF || '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
                .text(d => this.getCountryNameJapanese(d.country))
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .delay(500)
                .style('opacity', 1);
        }
    }

    /**
     * 都市タイムラインを初期化
     * @param {string} citiesFile - 都市データファイルのパス
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
            if (this.geoData) {
                this.renderTimelineMap();
            } else {
                console.error('MapManager: Cannot render timeline map - no geo data');
            }
            
        } catch (error) {
            console.error('MapManager: Failed to load cities timeline data:', error);
            console.error('MapManager: Error details:', error.message);
        }
    }

    /**
     * タイムライン用の地図を描画
     */
    renderTimelineMap() {
        const config = { width: 800, height: 600 };
        
        const svg = this.initSVG(config);
        
        // 現在のSVGサイズを取得
        const actualSize = SVGHelper.getActualSize(svg);
        const svgWidth = actualSize.width || config.width || 800;
        const svgHeight = actualSize.height || config.height || 600;
        
        // 投影法を設定（世界全体を表示、タイムラインモードでは元スケール）
        this.projection = d3.geoNaturalEarth1()
            .scale(150)
            .center([0, 0])
            .translate([svgWidth / 2, svgHeight / 2]);
            
        this.path = d3.geoPath().projection(this.projection);

        // 地図グループを作成
        const mapGroup = svg.append('g').attr('class', 'map-group');

        // 国境を描画
        if (this.geoData && this.geoData.features) {
            mapGroup.selectAll('.map-country')
                .data(this.geoData.features)
                .enter()
                .append('path')
                .attr('class', 'map-country')
                .attr('d', this.path)
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .style('opacity', 1);
        }
        
    }

    /**
     * スクロール進行度に応じた都市表示処理
     * @param {Object} progressData - 進行度データ
     */
    handleMapProgress(progressData) {
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
     * タイムライン都市を更新
     * @param {Array} targetCities - 表示する都市の配列
     */
    updateTimelineCities(targetCities) {
        if (!this.svg || !this.projection) return;
        
        const mapGroup = this.svg.select('.map-group');
        
        // データバインディング
        const cityMarkers = mapGroup.selectAll('.timeline-city')
            .data(targetCities, d => d.id);
        
        // 新しい都市を追加
        const enteringCities = cityMarkers.enter()
            .append('circle')
            .attr('class', 'timeline-city')
            .attr('cx', d => {
                const coords = this.projection([d.longitude, d.latitude]);
                return coords ? coords[0] : 0;
            })
            .attr('cy', d => {
                const coords = this.projection([d.longitude, d.latitude]);
                return coords ? coords[1] : 0;
            })
            .attr('r', 0)
            .style('fill', d => this.getCityColor(d))
            .style('stroke', window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
            .style('stroke-width', 2)
            .style('opacity', 0);
        
        // 都市の表示アニメーション（ゆっくり）
        enteringCities
            .transition()
            .duration((window.AppDefaults?.animation?.shortDuration || 500) * 1.6)
            .ease(d3.easeBackOut.overshoot(1.7))
            .attr('r', d => d.style.size)
            .style('opacity', 1);
        
        // 都市ラベルを追加
        const cityLabels = mapGroup.selectAll('.timeline-label')
            .data(targetCities, d => d.id);
        
        const enteringLabels = cityLabels.enter()
            .append('text')
            .attr('class', 'timeline-label')
            .attr('x', d => {
                const coords = this.projection([d.longitude, d.latitude]);
                return coords ? coords[0] : 0;
            })
            .attr('y', d => {
                const coords = this.projection([d.longitude, d.latitude]);
                return coords ? coords[1] - (d.style.size + 5) : 0;
            })
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('fill', '#1f2937')
            .attr('font-weight', 'bold')
            .attr('font-family', '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
            .style('opacity', 0)
            .text(d => this.getCountryNameJapanese(d.country));
        
        enteringLabels
            .transition()
            .duration((window.AppDefaults?.animation?.shortDuration || 500) * 1.2)
            .delay(400)
            .style('opacity', 1);
        
        // 都市の削除アニメーション
        cityMarkers.exit()
            .transition()
            .duration((window.AppDefaults?.animation?.shortDuration || 500) * 1.2)
            .ease(d3.easeBackIn)
            .attr('r', 0)
            .style('opacity', 0)
            .remove();
        
        cityLabels.exit()
            .transition()
            .duration((window.AppDefaults?.animation?.defaultDuration || 300) * 1.33)
            .style('opacity', 0)
            .remove();
        
        this.visibleCities = targetCities;
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
            
            // 既存の地図がある場合（world-overviewなどから遷移）は、スムーズにアニメーション
            if (this.svg && this.projection && this.geoData) {
                // 既存の地図を使ってスムーズにトランジション
                this.animateToCity(targetCity);
                this.mapInitialized = true;
            } else {
                // 初回の場合のみ地図を初期化
                this.initializeSingleCityMap(targetCity);
                this.mapInitialized = true;
            }
            
            this.currentCity = targetCity;
            
        } catch (error) {
            console.error('MapManager: Failed to load single city data:', error);
        }
    }

    /**
     * 単一都市地図を初期化（初回のみ）
     * @param {Object} targetCity - 表示する都市データ
     */
    initializeSingleCityMap(targetCity) {
        const config = { width: 800, height: 600 };
        
        const svg = this.initSVG(config);
        
        // SVGのviewBoxサイズを取得（パーセンテージ表示対応）
        const viewBox = svg.attr('viewBox').split(' ');
        const viewBoxWidth = parseFloat(viewBox[2]);
        const viewBoxHeight = parseFloat(viewBox[3]);
        
        
        // 投影法を設定（都市モードでは元スケール、viewBoxサイズを使用）
        this.projection = d3.geoNaturalEarth1()
            .scale(400)
            .center([targetCity.longitude, targetCity.latitude])
            .translate([viewBoxWidth / 2, viewBoxHeight / 2]);
            
        this.path = d3.geoPath().projection(this.projection);

        // 地図グループを作成
        const mapGroup = svg.append('g').attr('class', 'map-group');

        // 国境を描画
        if (this.geoData && this.geoData.features) {
            mapGroup.selectAll('.map-country')
                .data(this.geoData.features)
                .enter()
                .append('path')
                .attr('class', 'map-country')
                .attr('d', this.path)
                .style('fill', d => {
                    const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                    
                    // 地域色を適用（地域色が有効な場合は常に優先）
                    if (this.currentView && this.currentView.useRegionColors && window.CountryRegionMapping && window.ColorScheme) {
                        const region = window.CountryRegionMapping.getRegionForCountry(countryName);
                        if (region) {
                            let color = window.ColorScheme.getRegionColor(region);
                            
                            // lightenNonVisitedが有効な場合、訪問国以外を明るくする
                            if (this.currentView.lightenNonVisited) {
                                // より確実に訪問国を取得
                                let visitedCountry = this.getCurrentVisitedCountry();
                                // getCurrentVisitedCountryが失敗した場合の代替手段
                                if (!visitedCountry && this.currentCity) {
                                    visitedCountry = this.currentCity.country;
                                }
                                // targetCityからも取得を試みる
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
                .style('stroke', this.currentView && this.currentView.useRegionColors ? window.AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc' : window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
                .style('stroke-width', this.currentView && this.currentView.useRegionColors ? 0.75 : 0.5)
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .style('opacity', 1);
        }
        
        // 初回都市マーカーを表示
        this.showCityMarker(targetCity);
        
    }

    /**
     * 都市への平行移動アニメーション
     * @param {Object} targetCity - 移動先の都市データ
     */
    animateToCity(targetCity) {
        if (!this.projection || !this.svg) return;
        
        // currentCityがない場合（world-overviewからの遷移）でも動作するように
        const fromName = this.currentCity ? this.currentCity.name : 'world view';
        
        // 現在の投影設定を取得
        const currentCenter = this.projection.center();
        const currentScale = this.projection.scale();
        const targetCenter = [targetCity.longitude, targetCity.latitude];
        const targetScale = 400; // 固定ズームレベル
        
        // 既存の都市マーカーをフェードアウト
        this.svg.selectAll('.single-city-marker, .single-city-label, .single-city-info')
            .transition()
            .duration((window.AppDefaults?.animation?.shortDuration || 500) * 1.2)
            .style('opacity', 0)
            .remove();
        
        // アニメーション完了後に色を適用するため、ここでは削除
        
        // world-overviewからの遷移の場合は長めのトランジション時間を設定
        const isFromWorldView = !this.currentCity;
        const transitionDuration = isFromWorldView 
            ? (window.AppDefaults?.animation?.chartTransitionDuration || 1000) * 2.5
            : (window.AppDefaults?.animation?.chartTransitionDuration || 1000) * 1.5;
        
        // 地図のアニメーション
        this.svg
            .transition()
            .duration(transitionDuration)
            .ease(d3.easeCubicInOut)
            .tween('projection', () => {
                const interpolateCenter = d3.interpolate(currentCenter, targetCenter);
                const interpolateScale = d3.interpolate(currentScale, targetScale);
                
                return (t) => {
                    // プロジェクションを更新
                    this.projection
                        .center(interpolateCenter(t))
                        .scale(interpolateScale(t));
                    
                    // 国境パスを再描画
                    this.svg.selectAll('.map-country')
                        .attr('d', this.path)
                        .style('fill', d => {
                            const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                            
                            // 地域色を適用
                            if (this.currentView && this.currentView.useRegionColors && window.CountryRegionMapping && window.ColorScheme) {
                                const region = window.CountryRegionMapping.getRegionForCountry(countryName);
                                if (region) {
                                    let color = window.ColorScheme.getRegionColor(region);
                                    
                                    // lightenNonVisitedが有効な場合、訪問国以外を明るくする
                                    if (this.currentView.lightenNonVisited) {
                                        const visitedCountry = targetCity.country;
                                        if (visitedCountry && countryName !== visitedCountry) {
                                            color = window.ColorScheme.getLighterColor(color, 0.3);
                                        }
                                    }
                                    
                                    return color;
                                }
                            }
                            
                            return '#d1d5db';
                        })
                        .style('stroke', this.currentView && this.currentView.useRegionColors ? window.AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc' : window.AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff')
                        .style('stroke-width', this.currentView && this.currentView.useRegionColors ? '0.75' : '0.5');
                };
            })
            .on('end', () => {
                // アニメーション完了後に新しい都市マーカーを表示
                this.showCityMarker(targetCity);
            });
    }

    /**
     * 都市マーカーを表示
     * @param {Object} city - 都市データ
     */
    showCityMarker(city) {
        
        // SVGのviewBoxサイズを取得
        const viewBox = this.svg.attr('viewBox').split(' ');
        const viewBoxWidth = parseFloat(viewBox[2]);
        const viewBoxHeight = parseFloat(viewBox[3]);
        
        // プロジェクションの中心が都市座標と一致している場合、画面中央に配置
        const projectionCenter = this.projection.center();
        const isCityCenter = Math.abs(projectionCenter[0] - city.longitude) < 0.001 && 
                            Math.abs(projectionCenter[1] - city.latitude) < 0.001;
        
        let coords;
        if (isCityCenter) {
            // 都市が中心の場合は、強制的に画面中央に配置
            coords = [viewBoxWidth / 2, viewBoxHeight / 2];
        } else {
            // 通常の投影計算
            coords = this.projection([city.longitude, city.latitude]);
        }
        
        if (!coords) {
            console.error('Failed to project city coordinates:', city);
            return;
        }
        
        const mapGroup = this.svg.select('.map-group');
        
        // 都市マーカーを追加
        const markerColor = this.getCityColor(city);
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
            .attr('r', city.style.size * 1.5)  // 少し大きめに表示
            .style('opacity', 1);
        
        // 都市ラベルを追加
        mapGroup.append('text')
            .attr('class', 'single-city-label')
            .attr('x', coords[0])
            .attr('y', coords[1] - (city.style.size * 1.5 + 8))
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .attr('font-family', '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
            .attr('fill', '#1f2937')
            .style('opacity', 0)
            .text(this.getCountryNameJapanese(city.country))
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
     * 都市の地域に基づく色を取得
     * @param {Object} city - 都市データ
     * @returns {string} 色コード
     */
    getCityColor(city) {
        if (!city || !city.country) {
            return window.AppConstants?.APP_COLORS?.ANNOTATIONS?.LINE || '#808080'; // フォールバック色
        }
        
        // 地域色機能が利用可能かチェック
        if (window.CountryRegionMapping && window.ColorScheme) {
            const region = window.CountryRegionMapping.getRegionForCountry(city.country);
            if (region) {
                return window.ColorScheme.getRegionColor(region);
            }
        }
        
        // フォールバック：元のstyle.colorまたはデフォルト色
        return city.style?.color || window.AppConstants?.APP_COLORS?.ANNOTATIONS?.LINE || '#808080';
    }

    /**
     * リサイズ処理（最適化版）
     */
    resize() {
        try {
            const cityState = this.cityFocusManager.getCurrentState();
            
            if (cityState.timelineMode) {
                this.renderTimelineMap();
                // 現在表示中の都市を再描画
                if (cityState.visibleCities.length > 0 && this.svg && this.projection) {
                    const mapGroup = this.svg.select('.map-group');
                    this.cityFocusManager.updateTimelineCities(mapGroup, cityState.visibleCities, this.projection);
                }
            } else if (this.currentView && this.geoData) {
                this.renderMap(this.geoData, this.currentView);
            }
        } catch (error) {
            ErrorHandler.handle(error, 'MapManager.resize', {
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.LOW
            });
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