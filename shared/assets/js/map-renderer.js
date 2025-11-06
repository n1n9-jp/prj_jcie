/**
 * MapRenderer - 地図描画専門クラス
 *
 * 責務: SVG初期化、地図描画、UI更新
 * MapManagerから描画関連メソッドを分離
 */

class MapRenderer {
    constructor(container, mapManager) {
        this.container = container;
        this.mapManager = mapManager;  // 参照用（getCityCoordinates等で使用）
        this.svg = null;
        this.projection = null;
        this.path = null;
    }

    /**
     * SVG要素を初期化（レスポンシブ対応）
     * @param {Object} config - SVG設定オプション
     * @returns {Object} D3 SVG selection
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
        if (this.mapManager) {
            this.mapManager.clearSpreadingArrows();
        }

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
                            if (window.Logger) {
                                window.Logger.warn('MapRenderer: No region mapping found for country:', countryName);
                            } else {
                                console.warn('MapRenderer: No region mapping found for country:', countryName);
                            }
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
                            if (config.lightenNonVisited && this.mapManager) {
                                // より確実に訪問国を取得
                                let visitedCountry = this.mapManager.getCurrentVisitedCountry();
                                // getCurrentVisitedCountryが失敗した場合の代替手段
                                if (!visitedCountry && this.mapManager.currentCity) {
                                    visitedCountry = this.mapManager.currentCity.country;
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
            const logger = window.Logger || console;
            logger.error('MapRenderer: No geoData or geoData.features available for drawing');
            logger.error('geoData:', geoData);
        }

        // 都市マーカーを描画
        if (cities && cities.length > 0 && this.mapManager) {
            mapGroup.selectAll('.map-city')
                .data(cities)
                .enter()
                .append('circle')
                .attr('class', 'map-city')
                .attr('cx', d => this.projection(this.mapManager.getCityCoordinates(d))[0])
                .attr('cy', d => this.projection(this.mapManager.getCityCoordinates(d))[1])
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
                .attr('x', d => this.projection(this.mapManager.getCityCoordinates(d))[0])
                .attr('y', d => this.projection(this.mapManager.getCityCoordinates(d))[1] - 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '16px')
                .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
                .attr('font-weight', 'bold')
                .attr('font-family', window.AppConstants?.FONT_CONFIG?.FAMILIES?.SERIF || '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
                .text(d => this.mapManager.getCountryNameJapanese(d.country))
                .style('opacity', 0)
                .transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .delay(1200)
                .style('opacity', 1);
        }

        // エイズ拡散矢印を描画（step3用）
        if (showSpreadingArrows && this.mapManager) {
            this.mapManager.drawSpreadingArrows(mapGroup);
        } else if (this.mapManager) {
            // showSpreadingArrowsがfalseの場合は拡散矢印を即座に削除
            this.mapManager.clearSpreadingArrows();
        }

        // 滑らかなトランジション
        if (this.mapManager) {
            this.mapManager.animateToView(center, zoom, mode);
        }
    }

    /**
     * SVGへの参照を取得
     */
    getSVG() {
        return this.svg;
    }

    /**
     * projectionへの参照を取得
     */
    getProjection() {
        return this.projection;
    }

    /**
     * pathへの参照を取得
     */
    getPath() {
        return this.path;
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
if (typeof window !== 'undefined') {
    window.MapRenderer = MapRenderer;
}
