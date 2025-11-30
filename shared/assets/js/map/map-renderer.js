import * as d3 from 'd3';
import { SVGHelper } from '../utils/svg-helper.js';
import { countryRegionMapping } from '../utils/country-region-mapping.js';
import { colorScheme } from '../utils/color-scheme.js';
import { logger as Logger } from '../utils/logger.js';
import { AppConstants } from '../utils/app-constants.js';
import { AppDefaults } from '../config/defaults.js';

/**
 * MapRenderer - 地図描画専門クラス
 *
 * 責務: SVG初期化、地図描画、UI更新
 * MapManagerから描画関連メソッドを分離
 */

export class MapRenderer {
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
        } else if (SVGHelper) {
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
        } else if (SVGHelper) {
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


        // ズーム機能を追加（設定で無効化可能）
        if (!config.disableZoom) {
            const zoom = d3.zoom()
                .scaleExtent([0.5, 8])
                .on('zoom', (event) => {
                    this.svg.select('.map-group')
                        .attr('transform', event.transform);
                });

            this.svg.call(zoom);
        }

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

        // 座標の安全性をチェック（NaN防止）
        const safeCenter = [
            (center && typeof center[0] === 'number' && !isNaN(center[0])) ? center[0] : 0,
            (center && typeof center[1] === 'number' && !isNaN(center[1])) ? center[1] : 0
        ];
        const safeZoom = (typeof zoom === 'number' && !isNaN(zoom) && zoom > 0) ? zoom : 1;

        const offsetY = config.offsetY || 0;
        const baseScale = config.projectionType === 'orthographic' ? 250 : 150;
        const customScaleMultiplier = config.scaleMultiplier || 1.0;

        if (config.projectionType === 'orthographic') {
            this.projection = d3.geoOrthographic()
                .scale(safeZoom * baseScale * scaleMultiplier * customScaleMultiplier)
                .center(safeCenter)
                .rotate([-safeCenter[0], -safeCenter[1]])
                .translate([svgWidth / 2, (svgHeight / 2) + offsetY]);
        } else {
            this.projection = d3.geoNaturalEarth1()
                .scale(safeZoom * baseScale * scaleMultiplier * customScaleMultiplier)
                .center(safeCenter)
                .translate([svgWidth / 2, (svgHeight / 2) + offsetY]);
        }

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
                    if (config.useRegionColors && countryRegionMapping && colorScheme) {
                        const region = countryRegionMapping.getRegionForCountry(countryName);

                        // デバッグ：地域マッピングに失敗した国をログ出力
                        if (!region) {
                            if (Logger) {
                                Logger.warn('MapRenderer: No region mapping found for country:', countryName);
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

                                // 逆方向の部分一致も確認
                                if (hc.includes(countryName)) return true;

                                return false;
                            });

                            if (isHighlighted) {
                                if (region) {
                                    return colorScheme.getRegionColor(region); // ハイライト国は地域色
                                } else {
                                    return AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6'; // 地域不明のハイライト国は情報色
                                }
                            } else {
                                return AppConstants?.APP_COLORS?.BACKGROUND?.GRAY || '#f3f4f6'; // ハイライト国以外は薄いグレー
                            }
                        }

                        if (region) {
                            // targetRegionsが指定されている場合、対象地域のみ色を付ける
                            if (config.targetRegions && config.targetRegions.length > 0) {
                                if (!config.targetRegions.includes(region)) {
                                    return AppConstants?.APP_COLORS?.BACKGROUND?.GRAY || '#f3f4f6'; // 対象外の地域は薄いグレー
                                }
                            }

                            let color = colorScheme.getRegionColor(region);

                            // lightenNonVisitedが有効な場合、訪問国以外を明るくする
                            if (config.lightenNonVisited && this.mapManager) {
                                // より確実に訪問国を取得
                                let visitedCountry = this.mapManager.getCurrentVisitedCountry();
                                // getCurrentVisitedCountryが失敗した場合の代替手段
                                if (!visitedCountry && this.mapManager.currentCity) {
                                    visitedCountry = this.mapManager.currentCity.country;
                                }
                                if (visitedCountry && countryName !== visitedCountry) {
                                    color = colorScheme.getLighterColor(color, 0.5);
                                }
                            }

                            // lightenAllCountriesが有効な場合：すべての国を50%明るくする
                            if (lightenAllCountries) {
                                color = colorScheme.getLighterColor(color, 0.5);
                            }

                            return color;
                        }
                    }

                    // 地域色が設定されていない場合のみハイライト色を適用
                    if (highlightCountries.includes(countryName)) {
                        return AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6';
                    }

                    // デフォルト色（未分類）
                    return AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db';
                })
                .style('stroke', d => {
                    // 地図データの実際の構造に合わせて国名を取得（空文字列の場合はデフォルト値を使用）
                    const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';

                    // 地域色適用時は境界を強調（ハイライト国も含む）
                    if (config.useRegionColors) {
                        return AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc';
                    }

                    // 地域色が無効な場合のみハイライト色を適用


                    return AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff';
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
                .duration(AppDefaults?.animation?.shortDuration || 500)
                .delay((d, i) => i * 10)
                .style('opacity', 1);

        } else {
            const logger = Logger || console;
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
                .duration(AppDefaults?.animation?.shortDuration || 500)
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
                .attr('fill', AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
                .attr('font-weight', 'bold')
                .attr('font-family', AppConstants?.FONT_CONFIG?.FAMILIES?.SERIF || '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif')
                .text(d => this.mapManager.getCountryNameJapanese(d.country))
                .style('opacity', 0)
                .transition()
                .duration(AppDefaults?.animation?.shortDuration || 500)
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

        // 滑らかなトランジション（MapRenderer の animateToView を呼び出し）
        this.animateToView(center, zoom, mode);
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

    /**
     * 国のハイライトと色を更新する
     * @param {Array} highlightCountries - ハイライトする国名
     * @param {boolean} useRegionColors - 地域別色を使用するか
     * @param {boolean} lightenNonVisited - 未訪問国を明るくするか
     * @param {boolean} lightenAllCountries - すべての国を明るくするか
     * @param {Array} targetRegions - 対象地域
     * @param {string} highlightColor - ハイライト色（オプション）
     */
    updateCountryHighlights(highlightCountries, useRegionColors = false, lightenNonVisited = false, lightenAllCountries = false, targetRegions = [], highlightColor = null) {
        if (!this.svg) {
            return;
        }

        this.svg.selectAll('.map-country')
            .style('fill', d => {
                const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';

                if (useRegionColors && countryRegionMapping && colorScheme) {
                    const region = countryRegionMapping.getRegionForCountry(countryName);

                    if (highlightCountries && highlightCountries.length > 0) {
                        const isHighlighted = highlightCountries.some(hc => {
                            if (countryName === hc) return true;
                            if (countryName.includes(hc) || hc.includes(countryName)) return true;
                            return false;
                        });

                        if (isHighlighted) {
                            if (region) {
                                return colorScheme.getRegionColor(region);
                            } else {
                                return AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6';
                            }
                        } else {
                            return AppConstants?.APP_COLORS?.BACKGROUND?.GRAY || '#f3f4f6';
                        }
                    }

                    if (region) {
                        if (targetRegions && targetRegions.length > 0) {
                            if (!targetRegions.includes(region)) {
                                return AppConstants?.APP_COLORS?.BACKGROUND?.GRAY || '#f3f4f6';
                            }
                        }

                        let color = colorScheme.getRegionColor(region);

                        if (lightenNonVisited && this.mapManager && this.mapManager.getCurrentVisitedCountry) {
                            let visitedCountry = this.mapManager.getCurrentVisitedCountry();
                            if (!visitedCountry && this.mapManager.currentCity) {
                                visitedCountry = this.mapManager.currentCity.country;
                            }
                            if (visitedCountry && countryName !== visitedCountry) {
                                color = colorScheme.getLighterColor(color, 0.5);
                            }
                        }

                        if (lightenAllCountries) {
                            color = colorScheme.getLighterColor(color, 0.5);
                        }

                        return color;
                    }
                }

                if (highlightCountries.includes(countryName)) {
                    return highlightColor || AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6';
                }

                return AppConstants?.APP_COLORS?.BACKGROUND?.LIGHT || '#d1d5db';
            })
            .style('stroke', d => {
                const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';

                if (useRegionColors) {
                    return AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc';
                }



                return AppConstants?.APP_COLORS?.TEXT?.WHITE || '#fff';
            })
            .style('stroke-width', d => {
                const countryName = d.properties.name || d.properties.NAME || d.properties.NAME_EN || 'Unknown';

                if (useRegionColors) {
                    return '0.75';
                }

                if (highlightCountries.includes(countryName)) {
                    return '1.5';
                }

                return '0.5';
            });
    }

    /**
     * 都市マーカーを更新する
     * @param {Array} cities - 都市オブジェクトの配列
     */
    updateCities(cities) {
        if (!this.svg || !Array.isArray(cities)) {
            return;
        }

        // 既存の都市マーカーを削除
        this.svg.selectAll('.map-city').remove();
        this.svg.selectAll('.city-label').remove();

        // 新しい都市マーカーを追加
        const mapGroup = this.svg.select('.map-group');
        if (mapGroup.empty()) return;

        mapGroup.selectAll('.map-city')
            .data(cities)
            .enter()
            .append('circle')
            .attr('class', 'map-city')
            .attr('cx', d => this.mapManager && this.mapManager.projection ? this.mapManager.projection(this.mapManager.getCityCoordinates(d))[0] : 0)
            .attr('cy', d => this.mapManager && this.mapManager.projection ? this.mapManager.projection(this.mapManager.getCityCoordinates(d))[1] : 0)
            .attr('r', 6)
            .style('fill', AppConstants?.APP_COLORS?.ACCENT?.INFO || '#3b82f6')
            .style('opacity', 0.8);

        // 都市ラベルを追加
        mapGroup.selectAll('.city-label')
            .data(cities)
            .enter()
            .append('text')
            .attr('class', 'city-label')
            .attr('x', d => this.mapManager && this.mapManager.projection ? this.mapManager.projection(this.mapManager.getCityCoordinates(d))[0] : 0)
            .attr('y', d => this.mapManager && this.mapManager.projection ? this.mapManager.projection(this.mapManager.getCityCoordinates(d))[1] - 10 : 0)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('fill', AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#1f2937')
            .text(d => this.mapManager && this.mapManager.getCountryNameJapanese ? this.mapManager.getCountryNameJapanese(d.country) : d.country);
    }

    /**
     * 拡散矢印を即座にクリア
     */
    clearSpreadingArrows() {
        if (!this.svg) {
            return;
        }

        this.svg.selectAll('.spreading-arrows').interrupt().remove();
        this.svg.selectAll('.spreading-flow').interrupt().remove();
        this.svg.selectAll('#spreading-arrow').remove();
    }

    /**
     * 拡散矢印を描画（概念的な拡散表現）
     * @param {d3.Selection} mapGroup
     */
    drawSpreadingArrows(mapGroup) {
        if (!mapGroup || !this.projection) {
            return;
        }

        const spreadingFlows = [
            { id: 'usa-europe', from: { name: 'アメリカ', coords: [-95, 40] }, to: { name: 'ヨーロッパ', coords: [10, 50] }, delay: 0 },
            { id: 'usa-asia', from: { name: 'アメリカ', coords: [-95, 40] }, to: { name: 'アジア・太平洋', coords: [104, 35] }, delay: 150 },
            { id: 'usa-east-africa', from: { name: 'アメリカ', coords: [-95, 40] }, to: { name: '東部・南部アフリカ', coords: [35, -10] }, delay: 300 },
            { id: 'usa-west-africa', from: { name: 'アメリカ', coords: [-95, 40] }, to: { name: '西部・中部アフリカ', coords: [0, 10] }, delay: 450 }
        ];

        const defs = mapGroup.select('defs').empty()
            ? mapGroup.append('defs')
            : mapGroup.select('defs');

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
                .attr('fill', AppConstants?.APP_COLORS?.ANNOTATIONS?.LINE || '#999999')
                .attr('stroke', 'none');
        }

        const arrowGroup = mapGroup.append('g')
            .attr('class', 'spreading-arrows');

        spreadingFlows.forEach(flow => {
            const fromCoords = this.projection(flow.from.coords);
            const toCoords = this.projection(flow.to.coords);

            if (!fromCoords || !toCoords) {
                const logger = Logger || console;
                logger.warn('MapRenderer: Invalid coordinates for flow:', flow.id);
                return;
            }

            const midX = (fromCoords[0] + toCoords[0]) / 2;
            const midY = (fromCoords[1] + toCoords[1]) / 2 - 100;
            const pathData = `M ${fromCoords[0]},${fromCoords[1]} Q ${midX},${midY} ${toCoords[0]},${toCoords[1]}`;

            const path = arrowGroup.append('path')
                .attr('class', `spreading-flow ${flow.id}`)
                .attr('d', pathData)
                .attr('fill', 'none')
                .attr('stroke', AppConstants?.APP_COLORS?.ANNOTATIONS?.LINE || '#999999')
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', '5,5')
                .style('opacity', 0);

            const totalLength = path.node().getTotalLength();

            path.attr('stroke-dasharray', `${totalLength} ${totalLength}`)
                .attr('stroke-dashoffset', totalLength)
                .transition()
                .duration(AppConstants?.ANIMATION_CONFIG?.DURATION?.SLOW || 1200)
                .delay(flow.delay + 100)
                .ease(d3.easeQuadOut)
                .attr('stroke-dashoffset', 0)
                .style('opacity', 1)
                .on('end', () => {
                    path.attr('marker-end', 'url(#spreading-arrow)');
                });
        });
    }

    /**
     * ビューをアニメーションさせて移動
     * @param {Array} center - 中心座標 [longitude, latitude]
     * @param {number} zoom - ズームレベル
     * @param {string} mode - 表示モード
     */
    animateToView(center, zoom, mode = null) {
        if (!this.projection || !this.svg) {
            if (Logger) {
                Logger.warn('MapRenderer.animateToView: Projection or SVG not initialized yet');
            }
            return;
        }

        const duration = AppDefaults?.animation?.chartTransitionDuration || 1000;
        const currentCenter = this.projection.center();
        const currentScale = this.projection.scale();
        const scaleMultiplier = (mode === 'single-city') ? 1.0 : 1.5;
        const targetScale = zoom * 150 * scaleMultiplier;

        // 中心座標の安全性チェック
        const safeCenter = [
            (center && typeof center[0] === 'number' && !isNaN(center[0])) ? center[0] : 0,
            (center && typeof center[1] === 'number' && !isNaN(center[1])) ? center[1] : 0
        ];

        // SVGに対してtransitionを適用
        this.svg
            .transition()
            .duration(duration)
            .tween('projection', () => {
                const interpolateCenter = d3.interpolate(currentCenter, safeCenter);
                const interpolateScale = d3.interpolate(currentScale, targetScale);

                // For Orthographic, we interpolate rotation instead of center
                const isOrthographic = this.projection.clipAngle; // Simple check for Orthographic
                let interpolateRotate;
                if (isOrthographic) {
                    const currentRotate = this.projection.rotate();
                    const targetRotate = [-safeCenter[0], -safeCenter[1]];
                    interpolateRotate = d3.interpolate(currentRotate, targetRotate);
                }

                return (t) => {
                    if (isOrthographic) {
                        this.projection
                            .rotate(interpolateRotate(t))
                            .scale(interpolateScale(t));
                    } else {
                        this.projection
                            .center(interpolateCenter(t))
                            .scale(interpolateScale(t));
                    }

                    // パスを再描画
                    this.svg.selectAll('.map-country')
                        .attr('d', this.path);

                    // 都市マーカーを更新
                    this.svg.selectAll('.map-city')
                        .attr('cx', d => {
                            const coords = this.mapManager && this.mapManager.projection ? this.mapManager.projection(this.mapManager.getCityCoordinates(d)) : null;
                            return coords ? coords[0] : 0;
                        })
                        .attr('cy', d => {
                            const coords = this.mapManager && this.mapManager.projection ? this.mapManager.projection(this.mapManager.getCityCoordinates(d)) : null;
                            return coords ? coords[1] : 0;
                        });

                    // 都市ラベルを更新
                    this.svg.selectAll('.city-label')
                        .attr('x', d => {
                            const coords = this.mapManager && this.mapManager.projection ? this.mapManager.projection(this.mapManager.getCityCoordinates(d)) : null;
                            return coords ? coords[0] : 0;
                        })
                        .attr('y', d => {
                            const coords = this.mapManager && this.mapManager.projection ? this.mapManager.projection(this.mapManager.getCityCoordinates(d)) : null;
                            return coords ? coords[1] - 10 : 0;
                        });
                };
            });
    }
}
