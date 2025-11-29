import * as d3 from 'd3';
import { AppConstants } from '../utils/app-constants.js';
import { AppDefaults } from '../config/defaults.js';
import { colorScheme } from '../utils/color-scheme.js';

/**
 * LineChartUtilities - 折れ線グラフの汎用ユーティリティ関数
 * データ変換、色スケール、アノテーション処理などを提供
 */
export class LineChartUtilities {
    /**
     * データを系列形式に変換
     * @param {Array} data - 元データ
     * @param {Object} config - 設定
     * @returns {Array} 系列形式のデータ
     */
    static transformToSeries(data, config) {
        const { xField = 'year', yField = 'value', seriesField = 'series' } = config;

        // フィルタが設定されている場合は適用
        let filteredData = data;
        if (config.filter) {
            filteredData = LineChartUtilities.applyFilter(data, config.filter);
        }

        if (config.multiSeries === false) {
            // 単一系列として強制的に扱う
            const result = [{
                name: config.seriesName || 'Data',
                values: filteredData.map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
            }];
            return result;
        }

        // 複数系列の場合
        const seriesNames = [...new Set(filteredData.map(d => d[seriesField]))];

        if (seriesNames.length === 1 && seriesNames[0] === undefined) {
            // seriesFieldが存在しない場合は単一系列として扱う
            const result = [{
                name: config.title || 'Data',
                values: filteredData.map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
            }];
            return result;
        }

        const result = seriesNames.map(name => ({
            name,
            values: filteredData
                .filter(d => d[seriesField] === name)
                .map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
        }));
        return result;
    }

    /**
     * カラースケールを作成
     * @param {Array} series - 系列データ
     * @param {Object} config - 設定
     * @returns {Function} D3 scaleOrdinal
     */
    static createColorScale(series, config) {
        // 単一色設定が指定されている場合（dualレイアウト対応）
        if (config.color) {
            return () => config.color;
        } else if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            // 単一系列の明示色
            return d3.scaleOrdinal(config.colors).domain(series.map(d => d.name));
        } else if (colorScheme && config.useUnifiedColors !== false) {
            // 統一カラースキーム：地域名→色の直接マッピング
            const regionColors = series.map(s => {
                const color = colorScheme.getRegionColor(s.name);
                return color;
            });
            return d3.scaleOrdinal()
                .domain(series.map(s => s.name))
                .range(regionColors);
        } else {
            // フォールバック
            const colors = config.colors || AppConstants?.APP_COLORS?.PRIMARY_PALETTE || d3.schemeCategory10;
            return d3.scaleOrdinal(colors).domain(series.map(d => d.name));
        }
    }

    /**
     * アノテーションを描画
     * @param {d3.Selection} g - SVGグループ
     * @param {Array} annotations - アノテーション設定
     * @param {Object} context - コンテキスト（スケール、サイズ情報）
     */
    static renderAnnotations(g, annotations, context) {
        if (!annotations || annotations.length === 0) return;

        const { xScale, yScale, width, height, isYearData, xField, yField } = context;

        // スケールが存在しない場合は処理をスキップ
        if (!xScale || !yScale) {
            console.warn('LineChartUtilities: xScale or yScale is undefined, skipping annotations');
            return;
        }

        const annotationGroup = g.append('g')
            .attr('class', 'chart-annotations');

        annotations.forEach((annotation, index) => {
            let { type, x, y, text, style = {} } = annotation;

            // 古い形式のアノテーションをサポート
            if (annotation.year !== undefined) {
                x = annotation.year;
                y = annotation.y || yScale.domain()[1]; // デフォルトで上端
                text = annotation.label || text;

                // verticalLine を line に変換
                if (type === 'verticalLine') {
                    type = 'line';
                }
            }

            // horizontalLine の場合
            if (type === 'horizontalLine' && annotation.value !== undefined) {
                y = annotation.value;
                x = x || xScale.domain()[0]; // デフォルトで左端
                text = annotation.label || text;
                type = 'horizontalLine';
            }

            // X座標の変換
            let xPos;
            try {
                if (isYearData) {
                    xPos = xScale(+x);
                } else {
                    xPos = xScale(new Date(x));
                }
            } catch (error) {
                console.warn(`LineChartUtilities: Failed to convert x coordinate for annotation ${index}:`, x, error);
                xPos = 0;
            }

            // Y座標の変換
            let yPos;
            try {
                yPos = yScale(+y);
            } catch (error) {
                console.warn(`LineChartUtilities: Failed to convert y coordinate for annotation ${index}:`, y, error);
                yPos = 0;
            }

            // 座標が有効かチェック
            if (isNaN(xPos) || isNaN(yPos)) {
                console.warn(`LineChartUtilities: Invalid coordinates for annotation ${index}: x=${xPos}, y=${yPos}`);
                return;
            }

            // 注釈要素を作成
            const annotationElement = annotationGroup.append('g')
                .attr('class', `annotation annotation-${index}`)
                .attr('transform', `translate(${xPos}, ${yPos})`);

            switch (type) {
                case 'point':
                    // ポイント注釈
                    annotationElement.append('circle')
                        .attr('r', style.radius || 5)
                        .attr('fill', style.color || AppConstants?.APP_COLORS?.ANNOTATIONS?.POINT || '#ff6b6b')
                        .attr('stroke', style.strokeColor || AppConstants?.APP_COLORS?.ANNOTATIONS?.STROKE || '#fff')
                        .attr('stroke-width', style.strokeWidth || 2);
                    break;

                case 'line':
                    // 線注釈（垂直線）
                    annotationElement.append('line')
                        .attr('x1', 0)
                        .attr('y1', -yPos) // チャート上端まで
                        .attr('x2', 0)
                        .attr('y2', height - yPos) // チャート下端まで
                        .attr('stroke', style.color || AppDefaults?.colors?.text?.secondary || '#999')
                        .attr('stroke-width', style.strokeWidth || AppDefaults?.strokeWidth?.normal || 1)
                        .attr('stroke-dasharray', style.dashArray || '3,3');

                    // ラベルテキストを追加
                    if (text) {
                        const position = annotation.position || 'top-left';
                        let textX = 5; // デフォルトは右側
                        let textY = -yPos + 15; // デフォルトは上側
                        let textAnchor = 'start'; // デフォルトは左寄せ

                        if (position.includes('right')) {
                            textX = 5; // 線の右側に配置
                            textAnchor = 'start'; // テキストを左寄せ
                        } else if (position.includes('left')) {
                            textX = -5; // 線の左側に配置
                            textAnchor = 'end'; // テキストを右寄せ
                        }

                        if (position.includes('bottom')) {
                            textY = height - yPos - 5;
                        }

                        annotationElement.append('text')
                            .attr('x', textX)
                            .attr('y', textY)
                            .attr('text-anchor', textAnchor)
                            .attr('font-size', style.fontSize || '12px')
                            .attr('fill', style.textColor || AppDefaults?.colors?.text?.primary || '#333')
                            .text(text);
                    }
                    break;

                case 'horizontalLine':
                    // 水平線注釈
                    annotationElement.append('line')
                        .attr('x1', -xPos) // チャート左端まで
                        .attr('y1', 0)
                        .attr('x2', width - xPos) // チャート右端まで
                        .attr('y2', 0)
                        .attr('stroke', style.color || AppDefaults?.colors?.text?.secondary || '#999')
                        .attr('stroke-width', style.strokeWidth || AppDefaults?.strokeWidth?.normal || 1)
                        .attr('stroke-dasharray', style.dashArray || '3,3');

                    // ラベルテキストを追加
                    if (text) {
                        const position = annotation.position || 'right';
                        let textX = width - xPos - 5; // デフォルトは右端
                        let textY = -5; // 線の上側
                        let textAnchor = 'end'; // デフォルトは右寄せ

                        if (position.includes('left')) {
                            textX = -xPos + 5; // 左端に配置
                            textAnchor = 'start'; // テキストを左寄せ
                        } else if (position.includes('center')) {
                            textX = (width - xPos) / 2; // 中央に配置
                            textAnchor = 'middle'; // テキストを中央寄せ
                        }

                        if (position.includes('below')) {
                            textY = 15; // 線の下側
                        }

                        annotationElement.append('text')
                            .attr('x', textX)
                            .attr('y', textY)
                            .attr('text-anchor', textAnchor)
                            .attr('font-size', style.fontSize || '12px')
                            .attr('fill', style.textColor || AppDefaults?.colors?.text?.primary || '#333')
                            .text(text);
                    }
                    break;

                case 'text':
                default:
                    // テキスト注釈
                    const textElement = annotationElement.append('text')
                        .attr('dx', style.dx || 5)
                        .attr('dy', style.dy || -5)
                        .attr('font-size', style.fontSize || '12px')
                        .attr('fill', style.color || '#333')
                        .attr('text-anchor', style.textAnchor || 'start')
                        .text(text);

                    // 背景を追加（可読性向上）
                    if (style.background !== false) {
                        const bbox = textElement.node().getBBox();
                        annotationElement.insert('rect', 'text')
                            .attr('x', bbox.x - 2)
                            .attr('y', bbox.y - 2)
                            .attr('width', bbox.width + 4)
                            .attr('height', bbox.height + 4)
                            .attr('fill', style.backgroundColor || 'rgba(255, 255, 255, 0.8)')
                            .attr('stroke', style.borderColor || AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc')
                            .attr('stroke-width', 0.5)
                            .attr('rx', 2);
                    }
                    break;
            }
        });
    }

    /**
     * フィルタを適用（ユーティリティメソッド）
     * @param {Array} data - データ
     * @param {Object} filter - フィルタ設定
     * @returns {Array} フィルタされたデータ
     */
    static applyFilter(data, filter) {
        if (!filter) return data;

        if (filter.type === 'range' && filter.field) {
            const [min, max] = filter.range || [filter.min, filter.max];
            return data.filter(d => {
                const value = d[filter.field];
                return value >= min && value <= max;
            });
        }

        if (filter.type === 'values' && filter.field && filter.values) {
            return data.filter(d => filter.values.includes(d[filter.field]));
        }

        return data;
    }
}

