/**
 * MapManager - 地図管理クラス
 * D3.jsを使用した世界地図の描画・更新を管理
 */
class MapManager {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.svg = null;
        this.projection = null;
        this.path = null;
        this.geoData = null;
        this.currentView = null;
        
        this.init();
    }

    init() {
        // イベントリスナーを設定
        pubsub.subscribe(EVENTS.MAP_UPDATE, (data) => {
            this.updateMap(data);
        });

        pubsub.subscribe(EVENTS.MAP_PROGRESS, (data) => {
            this.handleMapProgress(data);
        });

        pubsub.subscribe(EVENTS.RESIZE, () => {
            this.resize();
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
     * 地図を更新する
     * @param {Object} mapData - 地図データとオプション
     */
    updateMap(mapData) {
        console.log('MapManager: updateMap called with:', mapData);
        
        const { center, zoom, visible, data, highlightCountries = [], cities = [], mode, citiesFile, cityId, useRegionColors = false, lightenNonVisited = false } = mapData;
        
        this.currentView = { center, zoom, highlightCountries, cities, mode, citiesFile, cityId, useRegionColors, lightenNonVisited };
        console.log('MapManager: Current view set to:', this.currentView);
        console.log('MapManager: Map visible:', visible);
        console.log('MapManager: GeoData available:', !!this.geoData);

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
                    console.log('MapManager: Initial map rendering...');
                    this.renderMap(this.geoData, { center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited });
                } else {
                    console.log('MapManager: Updating existing map...');
                    this.updateExistingMap({ center, zoom, highlightCountries, cities, useRegionColors, lightenNonVisited });
                }
            } else {
                console.error('MapManager: No geo data available for rendering');
            }
        } else {
            console.log('MapManager: Hiding map');
            this.hide();
        }
    }

    /**
     * 地図コンテナを表示
     */
    show() {
        console.log('MapManager: Showing map container');
        this.container.classed('visible', true);
        console.log('MapManager: Container classes after show:', this.container.attr('class'));
    }

    /**
     * 地図コンテナを非表示
     */
    hide() {
        console.log('MapManager: Hiding map container');
        this.container.classed('visible', false);
        console.log('MapManager: Container classes after hide:', this.container.attr('class'));
    }

    /**
     * 地図データを設定
     * @param {Object} topoData - TopoJSONデータ
     */
    setGeoData(topoData) {
        console.log('MapManager: Setting geo data...');
        console.log('TopoJSON input:', topoData);
        console.log('TopoJSON type:', topoData?.type);
        console.log('TopoJSON objects:', topoData?.objects);
        
        // TopoJSONをGeoJSONに変換
        if (topoData && topoData.objects && topoData.objects.countries) {
            console.log('Converting TopoJSON to GeoJSON...');
            this.geoData = topojson.feature(topoData, topoData.objects.countries);
            console.log('GeoJSON result:', this.geoData);
            console.log('GeoJSON features count:', this.geoData?.features?.length);
        } else {
            console.error('Invalid TopoJSON data structure');
            console.error('Expected: topoData.objects.countries');
            console.error('Actual objects keys:', topoData?.objects ? Object.keys(topoData.objects) : 'No objects');
            this.geoData = null;
        }
    }

    /**
     * SVG要素を初期化
     */
    initSVG(width, height) {
        console.log('MapManager: initSVG called with', width, height);
        console.log('MapManager: Container:', this.container);
        console.log('MapManager: Container node:', this.container.node());
        
        this.container.selectAll('*').remove();
        
        this.svg = this.container
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('width', '100%')
            .style('height', '100%');
            
        console.log('MapManager: SVG created:', this.svg);
        console.log('MapManager: SVG node:', this.svg.node());

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
        console.log('MapManager: renderMap called');
        console.log('renderMap geoData:', geoData);
        console.log('renderMap config:', config);
        
        const { 
            center = [0, 0], 
            zoom = 1, 
            highlightCountries = [], 
            cities = [],
            width = 800,
            height = 600 
        } = config;
        
        console.log('renderMap parameters:', { center, zoom, width, height });
        
        const svg = this.initSVG(width, height);
        console.log('SVG initialized:', svg);
        
        // 投影法を設定
        this.projection = d3.geoNaturalEarth1()
            .scale(zoom * 150)
            .center(center)
            .translate([width / 2, height / 2]);
            
        this.path = d3.geoPath().projection(this.projection);
        console.log('Projection and path initialized');

        // 地図グループを作成
        const mapGroup = svg.append('g').attr('class', 'map-group');
        console.log('Map group created');

        // 国境を描画
        if (geoData && geoData.features) {
            console.log('Drawing countries, features count:', geoData.features.length);
            console.log('First feature sample:', geoData.features[0]);
            
            const paths = mapGroup.selectAll('.map-country')
                .data(geoData.features)
                .enter()
                .append('path')
                .attr('class', 'map-country')
                .attr('d', this.path)
                .style('fill', d => {
                    const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                    
                    // 地域色を適用（地域色が有効な場合はハイライトより優先）
                    if (config.useRegionColors && window.CountryRegionMapping && window.ColorScheme) {
                        const region = window.CountryRegionMapping.getRegionForCountry(countryName);
                        if (region) {
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
                            
                            // step8の場合：すべての国を50%明るくする
                            if (highlightCountries && highlightCountries.length > 0) {
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
                    if (config.useRegionColors) {
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
                
            console.log('Country paths created:', paths.size());
            
            paths.transition()
                .duration(500)
                .delay((d, i) => i * 10)
                .style('opacity', 1);
                
            console.log('Country paths transition started');
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
                .duration(500)
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
                .attr('font-size', '12px')
                .attr('fill', '#1f2937')
                .attr('font-weight', 'bold')
                .text(d => d.name)
                .style('opacity', 0)
                .transition()
                .duration(500)
                .delay(1200)
                .style('opacity', 1);
        }

        // 滑らかなトランジション
        this.animateToView(center, zoom);
    }

    /**
     * 指定した座標とズームレベルにアニメーション
     * @param {Array} center - 中心座標 [経度, 緯度]
     * @param {number} zoom - ズームレベル
     */
    animateToView(center, zoom) {
        if (!this.projection || !this.svg) return;

        const duration = 1000;
        const currentCenter = this.projection.center();
        const currentScale = this.projection.scale();
        const targetScale = zoom * 150;
        
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
                .duration(300)
                .attr('r', 6);

            mapGroup.selectAll('.city-label')
                .data(cities)
                .enter()
                .append('text')
                .attr('class', 'city-label')
                .attr('x', d => this.projection([d.longitude, d.latitude])[0])
                .attr('y', d => this.projection([d.longitude, d.latitude])[1] - 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('fill', '#1f2937')
                .attr('font-weight', 'bold')
                .text(d => d.name)
                .style('opacity', 0)
                .transition()
                .duration(300)
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
            lightenNonVisited = false
        } = config;

        console.log('MapManager: updateExistingMap called with:', config);

        if (!this.svg || !this.projection) {
            console.error('MapManager: No SVG or projection available for update');
            return;
        }

        // プロジェクションの現在の設定を取得
        const currentCenter = this.projection.center();
        const currentScale = this.projection.scale();
        const targetScale = zoom * 150;

        console.log('Transition from:', { center: currentCenter, scale: currentScale });
        console.log('Transition to:', { center, scale: targetScale });

        // アニメーション開始前に既存の都市マーカー・ラベルを削除
        const mapGroup = this.svg.select('.map-group');
        mapGroup.selectAll('.map-city, .city-label, .single-city-marker, .single-city-label, .single-city-info')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .remove();

        // スムーズなトランジション
        this.svg
            .transition()
            .delay(200) // 既存要素の削除を待つ
            .duration(1500)
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
                this.updateCountryHighlights(highlightCountries, useRegionColors, lightenNonVisited);
                this.updateCityMarkers(cities);
            });
    }

    /**
     * 国のハイライトを更新
     * @param {Array} highlightCountries - ハイライトする国名の配列
     * @param {boolean} useRegionColors - 地域色を使用するかどうか
     * @param {boolean} lightenNonVisited - 訪問国以外を明るくするかどうか
     */
    updateCountryHighlights(highlightCountries, useRegionColors = false, lightenNonVisited = false) {
        if (!this.svg) return;

        this.svg.selectAll('.map-country')
            .transition()
            .duration(500)
            .style('fill', d => {
                const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                
                // 地域色を適用（地域色が有効な場合はハイライトより優先）
                if (useRegionColors && window.CountryRegionMapping && window.ColorScheme) {
                    const region = window.CountryRegionMapping.getRegionForCountry(countryName);
                    if (region) {
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
                        
                        // step8の場合：すべての国を50%明るくする
                        if (highlightCountries && highlightCountries.length > 0) {
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
                .style('fill', '#ef4444')
                .style('stroke', '#fff')
                .style('stroke-width', 2)
                .transition()
                .duration(500)
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
                .attr('font-size', '12px')
                .attr('fill', '#1f2937')
                .attr('font-weight', 'bold')
                .text(d => d.name)
                .style('opacity', 0)
                .transition()
                .duration(500)
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
            console.log('MapManager: Initializing cities timeline with:', citiesFile);
            
            // 都市データを読み込み
            if (!this.citiesTimelineData) {
                console.log('MapManager: Loading cities data from:', citiesFile);
                this.citiesTimelineData = await d3.json(citiesFile);
                console.log('MapManager: Cities timeline data loaded:', this.citiesTimelineData);
                console.log('MapManager: Cities count:', this.citiesTimelineData?.cities?.length);
            }
            
            this.timelineMode = true;
            this.visibleCities = [];
            
            console.log('MapManager: Timeline mode activated. GeoData available:', !!this.geoData);
            
            // 基本地図を描画
            if (this.geoData) {
                console.log('MapManager: Rendering timeline map...');
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
        const width = 800;
        const height = 600;
        
        const svg = this.initSVG(width, height);
        
        // 投影法を設定（世界全体を表示）
        this.projection = d3.geoNaturalEarth1()
            .scale(150)
            .center([0, 0])
            .translate([width / 2, height / 2]);
            
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
                .duration(500)
                .style('opacity', 1);
        }
        
        console.log('Timeline map rendered, ready for city progression');
    }

    /**
     * スクロール進行度に応じた都市表示処理
     * @param {Object} progressData - 進行度データ
     */
    handleMapProgress(progressData) {
        if (!this.timelineMode || !this.citiesTimelineData) {
            console.log('MapManager: Progress ignored - timeline mode:', this.timelineMode, 'data:', !!this.citiesTimelineData);
            return;
        }
        
        const { progress, direction, config } = progressData;
        console.log('MapManager: Handling progress:', progress * 100 + '%', 'direction:', direction);
        
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
        
        console.log(`MapManager: Showing ${targetCities.length} of ${totalCities} cities`);
        console.log('MapManager: Target cities:', targetCities.map(c => c.name));
        
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
            .style('stroke', '#fff')
            .style('stroke-width', 2)
            .style('opacity', 0);
        
        // 都市の表示アニメーション（ゆっくり）
        enteringCities
            .transition()
            .duration(800)
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
            .attr('font-size', '11px')
            .attr('fill', '#1f2937')
            .attr('font-weight', 'bold')
            .style('opacity', 0)
            .text(d => d.name);
        
        enteringLabels
            .transition()
            .duration(600)
            .delay(400)
            .style('opacity', 1);
        
        // 都市の削除アニメーション
        cityMarkers.exit()
            .transition()
            .duration(600)
            .ease(d3.easeBackIn)
            .attr('r', 0)
            .style('opacity', 0)
            .remove();
        
        cityLabels.exit()
            .transition()
            .duration(400)
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
            console.log('MapManager: Handling single city mode:', cityId);
            
            // 都市データを読み込み
            if (!this.citiesTimelineData) {
                console.log('MapManager: Loading cities data from:', citiesFile);
                this.citiesTimelineData = await d3.json(citiesFile);
                console.log('MapManager: Cities data loaded for single city mode');
            }
            
            // 指定された都市を検索
            const targetCity = this.citiesTimelineData.cities.find(city => city.id === cityId);
            
            if (!targetCity) {
                console.error('MapManager: City not found:', cityId);
                return;
            }
            
            console.log('MapManager: Found target city:', targetCity);
            
            // タイムラインモードをリセット
            this.timelineMode = false;
            this.visibleCities = [];
            this.singleCityMode = true;
            
            // 初回の場合は地図を初期化、2回目以降は平行移動
            if (!this.mapInitialized || !this.svg) {
                console.log('MapManager: Initializing single city map...');
                this.initializeSingleCityMap(targetCity);
                this.mapInitialized = true;
            } else {
                console.log('MapManager: Animating to new city:', targetCity.name);
                this.animateToCity(targetCity);
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
        const width = 800;
        const height = 600;
        
        const svg = this.initSVG(width, height);
        
        // 投影法を設定
        this.projection = d3.geoNaturalEarth1()
            .scale(400)
            .center([targetCity.longitude, targetCity.latitude])
            .translate([width / 2, height / 2]);
            
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
                    
                    return '#d1d5db';
                })
                .style('stroke', this.currentView && this.currentView.useRegionColors ? '#ccc' : '#fff')
                .style('stroke-width', this.currentView && this.currentView.useRegionColors ? 0.75 : 0.5)
                .style('opacity', 0)
                .transition()
                .duration(500)
                .style('opacity', 1);
        }
        
        // 初回都市マーカーを表示
        this.showCityMarker(targetCity);
        
        console.log('Single city map initialized for:', targetCity.name);
    }

    /**
     * 都市への平行移動アニメーション
     * @param {Object} targetCity - 移動先の都市データ
     */
    animateToCity(targetCity) {
        if (!this.projection || !this.svg || !this.currentCity) return;
        
        console.log(`Animating from ${this.currentCity.name} to ${targetCity.name}`);
        
        // 現在の投影設定を取得
        const currentCenter = this.projection.center();
        const currentScale = this.projection.scale();
        const targetCenter = [targetCity.longitude, targetCity.latitude];
        const targetScale = 400; // 固定ズームレベル
        
        // 既存の都市マーカーをフェードアウト
        this.svg.selectAll('.single-city-marker, .single-city-label, .single-city-info')
            .transition()
            .duration(600)
            .style('opacity', 0)
            .remove();
        
        // アニメーション完了後に色を適用するため、ここでは削除
        
        // 地図のアニメーション
        this.svg
            .transition()
            .duration(1500)
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
                        .style('stroke', this.currentView && this.currentView.useRegionColors ? '#ccc' : '#fff')
                        .style('stroke-width', this.currentView && this.currentView.useRegionColors ? '0.75' : '0.5');
                };
            })
            .on('end', () => {
                // アニメーション完了後に新しい都市マーカーを表示
                console.log('Map animation completed, showing new city marker');
                this.showCityMarker(targetCity);
            });
    }

    /**
     * 都市マーカーを表示
     * @param {Object} city - 都市データ
     */
    showCityMarker(city) {
        const coords = this.projection([city.longitude, city.latitude]);
        
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
            .style('stroke', '#fff')
            .style('stroke-width', 3)
            .style('opacity', 0)
            .transition()
            .duration(800)
            .ease(d3.easeBackOut.overshoot(1.7))
            .attr('r', city.style.size * 1.5)  // 少し大きめに表示
            .style('opacity', 1);
        
        // 都市ラベルを追加
        mapGroup.append('text')
            .attr('class', 'single-city-label')
            .attr('x', coords[0])
            .attr('y', coords[1] - (city.style.size * 1.5 + 8))
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('fill', '#1f2937')
            .style('opacity', 0)
            .text(city.name)
            .transition()
            .duration(600)
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
            console.log('Geographic info container not found for step:', stepId);
            return;
        }
        
        // 距離・移動情報がある場合のみ表示
        if (city.transitions && city.transitions.distanceFromPrevious > 0) {
            const {
                distanceFromPrevious,
                routeType,
                crossedFeatures = []
            } = city.transitions;
            
            // 飛行時間を概算（時速900kmで計算）
            const flightHours = Math.round(distanceFromPrevious / 900 * 10) / 10;
            
            // 地理的情報のHTML
            let infoHTML = `
                <strong>前都市からの距離:</strong> ${distanceFromPrevious.toLocaleString()}km<br>
                <strong>移動方法:</strong> ${routeType === 'flight' ? '航空機' : '陸路'}
            `;
            
            if (routeType === 'flight' && flightHours > 0) {
                infoHTML += `<br><strong>飛行時間:</strong> 約${flightHours}時間`;
            }
            
            if (crossedFeatures.length > 0) {
                infoHTML += `<br><strong>経由地域:</strong> ${crossedFeatures.join('、')}`;
            }
            
            geoInfoContainer.innerHTML = infoHTML;
            geoInfoContainer.style.display = 'block';
        } else {
            // 最初の都市など距離情報がない場合は非表示
            geoInfoContainer.style.display = 'none';
        }
    }

    /**
     * 都市の地域に基づく色を取得
     * @param {Object} city - 都市データ
     * @returns {string} 色コード
     */
    getCityColor(city) {
        if (!city || !city.country) {
            return '#808080'; // フォールバック色
        }
        
        // 地域色機能が利用可能かチェック
        if (window.CountryRegionMapping && window.ColorScheme) {
            const region = window.CountryRegionMapping.getRegionForCountry(city.country);
            if (region) {
                return window.ColorScheme.getRegionColor(region);
            }
        }
        
        // フォールバック：元のstyle.colorまたはデフォルト色
        return city.style?.color || '#808080';
    }

    /**
     * リサイズ処理
     */
    resize() {
        if (this.timelineMode && this.citiesTimelineData) {
            this.renderTimelineMap();
            // 現在表示中の都市を再描画
            if (this.visibleCities.length > 0) {
                this.updateTimelineCities(this.visibleCities);
            }
        } else if (this.currentView && this.geoData) {
            this.renderMap(this.geoData, this.currentView);
        }
    }
}