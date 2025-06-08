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

        pubsub.subscribe(EVENTS.RESIZE, () => {
            this.resize();
        });
    }

    /**
     * 地図を更新する
     * @param {Object} mapData - 地図データとオプション
     */
    updateMap(mapData) {
        console.log('MapManager: updateMap called with:', mapData);
        
        const { center, zoom, visible, data, highlightCountries = [], cities = [] } = mapData;
        
        this.currentView = { center, zoom, highlightCountries, cities };
        console.log('MapManager: Current view set to:', this.currentView);
        console.log('MapManager: Map visible:', visible);
        console.log('MapManager: GeoData available:', !!this.geoData);

        if (visible) {
            this.show();
            if (this.geoData) {
                // 地図が既に描画されているかチェック
                if (!this.svg || this.svg.selectAll('.map-country').empty()) {
                    console.log('MapManager: Initial map rendering...');
                    this.renderMap(this.geoData, { center, zoom, highlightCountries, cities });
                } else {
                    console.log('MapManager: Updating existing map...');
                    this.updateExistingMap({ center, zoom, highlightCountries, cities });
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
                .classed('highlighted', d => {
                    const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                    return highlightCountries.includes(countryName);
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
            cities = []
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
        mapGroup.selectAll('.map-city, .city-label')
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
                this.updateCountryHighlights(highlightCountries);
                this.updateCityMarkers(cities);
            });
    }

    /**
     * 国のハイライトを更新
     * @param {Array} highlightCountries - ハイライトする国名の配列
     */
    updateCountryHighlights(highlightCountries) {
        if (!this.svg) return;

        this.svg.selectAll('.map-country')
            .transition()
            .duration(500)
            .style('fill', d => {
                const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                return highlightCountries.includes(countryName) ? '#3b82f6' : '#e5e7eb';
            })
            .style('stroke', d => {
                const countryName = d.properties.NAME || d.properties.name || d.properties.NAME_EN;
                return highlightCountries.includes(countryName) ? '#1d4ed8' : '#fff';
            });
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
     * リサイズ処理
     */
    resize() {
        if (this.currentView && this.geoData) {
            this.renderMap(this.geoData, this.currentView);
        }
    }
}