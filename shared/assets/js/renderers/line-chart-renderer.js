import * as d3 from 'd3';
import { ChartRendererBase } from '../utils/chart-renderer-base.js';
import { LineChartUtilities } from './line-chart-utilities.js';
import { LineChartAnimations } from './line-chart-animations.js';
import { ChartLayoutManager } from '../utils/chart-layout-manager.js';
import { ChartLayoutHelper } from '../utils/chart-layout-helper.js';
import { ChartTransitions } from '../utils/chart-transitions.js';
import { ChartFormatterHelper } from '../utils/chart-formatter-helper.js';
import { LineChartLabelManager } from '../utils/line-chart-label-manager.js';
import { LineChartLegendManager } from '../utils/line-chart-legend-manager.js';
import { LineChartAnimationManager } from '../utils/line-chart-animation-manager.js';
import { AppDefaults } from '../config/defaults.js';
import { SVGHelper } from '../utils/svg-helper.js';
import { AppConstants } from '../utils/app-constants.js';

/**
 * LineChartRenderer - 折れ線グラフの描画と更新を専門的に扱うクラス
 * ChartRendererBaseを継承し、線グラフ特有の機能を提供
 */
export class LineChartRenderer extends ChartRendererBase {
    constructor(containerId) {
        super(containerId);
        this.type = 'line';  // チャート種別を設定
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;

        // ラベル・凡例・アニメーション管理用マネージャーをインスタンス化
        this.labelManager = new LineChartLabelManager();
        this.legendManager = new LineChartLegendManager();
        this.animationManager = new LineChartAnimationManager();

        // Initialize after properties are set
        this.init();
    }

    /**
     * チャートを更新する
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        const { type, data, config, visible, updateMode, direction } = chartData;

        // ★重要: Dual/Triple layout の場合はスキップ（ChartSVGDrawer が処理）
        if (this.shouldSkipDualLayout(chartData)) {
            return;
        }

        // updateModeが'transition'で既存チャートと同じタイプ、同じデータファイルの場合
        if (updateMode === 'transition' &&
            this.currentChart === type &&
            this.data &&
            this.svg &&
            config.dataFile === this.config?.dataFile) {

            // LineChartAnimationsに委譲
            LineChartAnimations.updateChartWithTransition(this, data, config, direction);
            return;
        }

        // 通常の更新（再描画）
        this.data = data;
        this.config = config;
        this.currentChart = type;

        if (visible) {
            this.show();
            this.renderChart(type, data, config);
        } else {
            this.hide();
        }
    }

    /**
     * チャートを描画する
     * @param {string} type - チャートタイプ
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderChart(type, data, config) {
        if (type !== 'line') {
            console.warn(`LineChartRenderer: Unsupported chart type: ${type}`);
            return;
        }

        // レイアウト内かどうかを判定して適切なサイズ計算を選択
        let width, height;
        if (config.width && config.height) {
            // Layout内: ChartManagerが計算したサイズを使用
            width = config.width;
            height = config.height;
        } else {
            // Single: 従来通りgetResponsiveSize使用
            const responsiveSize = this.getResponsiveSize(config);
            width = responsiveSize.width;
            height = responsiveSize.height;
        }

        // マージンを計算（ChartRendererBase のヘルパーメソッドを使用）
        const margin = this.getChartMargin(data, config, {
            chartType: type,
            hasLegend: config.showLegend !== false && config.multiSeries
        });

        // インラインラベル使用時は右マージンを拡大
        if (config.legendType === 'inline' && config.multiSeries) {
            margin.right = Math.max(margin.right, 240); // ラベル用の余白をさらに拡大
        }

        // コンテナクリア
        this.container.selectAll('*').remove();

        // SVGHelperを使用してレスポンシブSVGを作成
        if (SVGHelper) {
            // パーセンテージ指定の場合は実際のピクセルサイズを計算
            let actualWidth = null;
            let actualHeight = null;

            if (config.widthPercent) {
                actualWidth = window.innerWidth * (config.widthPercent / 100);
            }
            if (config.heightPercent) {
                actualHeight = window.innerHeight * (config.heightPercent / 100);
            }

            this.svg = SVGHelper.initSVG(this.container, width, height, {
                preserveAspectRatio: config.preserveAspectRatio || 'xMidYMid meet',
                responsive: true,
                actualWidth: actualWidth,
                actualHeight: actualHeight
            });
        } else {
            // フォールバック：従来のSVG作成
            this.svg = this.container.append('svg')
                .attr('width', width)
                .attr('height', height);
        }

        this.renderLineChart(data, { width, height, margin, ...config });
    }


    /**
     * 折れ線グラフを描画する
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderLineChart(data, config) {
        const {
            width, height, margin,
            xField = 'year', yField = 'value',
            colors = d3.schemeCategory10,
            multiSeries = true,
            title = '',
            dataSource = ''
        } = config;

        const svg = this.svg;
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // タイトルを追加
        if (title) {
            g.append('text')
                .attr('class', 'chart-title')
                .attr('x', 0)
                .attr('y', -10)
                .attr('text-anchor', 'start')
                .attr('fill', AppDefaults?.colors?.text?.primary || '#333')
                .style('font-family', 'var(--font-family-serif)')
                .style('font-size', 'var(--font-size-base)')
                .style('font-weight', 'var(--font-weight-bold)')
                .text(title);
        }

        // データを系列別に変換
        const series = LineChartUtilities.transformToSeries(data, config);

        // 全データからドメインを計算
        const allValues = series.flatMap(s => s.values);

        // スケール設定 - 年データの場合は線形スケールを使用
        const isYearData = allValues.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);

        // X軸のドメインを決定（設定で年度範囲が指定されていればそれを使用、なければデータ範囲）
        let xDomain;
        if (config.yearRange && config.yearRange.length === 2) {
            // 設定ファイルで年度範囲が指定されている場合
            xDomain = config.yearRange;
        } else if (isYearData) {
            // 年データの場合はデータの範囲を使用
            xDomain = d3.extent(allValues, d => +d[xField]);
        } else {
            // 時間データの場合
            xDomain = d3.extent(allValues, d => new Date(d[xField]));
        }

        const xScale = isYearData
            ? d3.scaleLinear()
                .domain(xDomain)
                .range([0, innerWidth])
            : d3.scaleTime()
                .domain(xDomain)
                .range([0, innerWidth]);

        // Y軸のドメインを決定（設定でY軸範囲が指定されていればそれを使用、なければデータ範囲）
        let yDomain;
        if (config.yRange && config.yRange.length === 2) {
            // 設定ファイルでY軸範囲が指定されている場合
            yDomain = config.yRange;
        } else {
            // データの範囲を使用
            yDomain = d3.extent(allValues, d => +d[yField]);
        }

        let yScale;
        if (config.yAxis && config.yAxis.type === 'log') {
            const yMin = yDomain[0] > 0 ? yDomain[0] : 1;
            yScale = d3.scaleLog()
                .domain([yMin, yDomain[1]])
                .range([innerHeight, 0]);
        } else {
            yScale = d3.scaleLinear()
                .domain(yDomain)
                .range([innerHeight, 0]);
        }

        // yRangeが明示的に設定されていない場合のみnice()を適用
        if (!(config.yRange && config.yRange.length === 2)) {
            yScale.nice();
        }

        // D3標準のカラースケール：地域名から直接色を取得
        const colorScale = LineChartUtilities.createColorScale(series, config);

        // 単位情報を分析
        let unitInfo = { xAxis: {}, yAxis: {} };
        if (ChartLayoutManager) {
            unitInfo = ChartLayoutManager.analyzeUnits(data, config);
        }

        // 軸を描画（カスタムフォーマット優先、ChartLayoutManager、D3デフォルトの順）
        let xAxis, yAxis;

        // Y軸フォーマッターを決定（優先順位：カスタム > ChartLayoutManager > D3デフォルト）
        let yFormatter;
        if (config.yAxisFormat) {
            // カスタムフォーマットが指定されている場合
            yFormatter = (value) => ChartFormatterHelper.formatYAxisValue(value, config.yAxisFormat);
        } else if (ChartLayoutManager) {
            // ChartLayoutManagerが利用可能な場合
            yFormatter = (value) => ChartLayoutManager.formatAxisWithUnits(value, unitInfo.yAxis);
        } else {
            // デフォルト（D3の標準フォーマット）
            yFormatter = null; // D3のデフォルトを使用
        }

        xAxis = isYearData
            ? d3.axisBottom(xScale).tickFormat(d3.format("d"))  // 年データは整数表示
            : d3.axisBottom(xScale);
        yAxis = yFormatter
            ? d3.axisLeft(yScale).tickFormat(yFormatter)
            : d3.axisLeft(yScale);

        // yAxisのtickValues設定がある場合は適用
        if (config.yAxis && config.yAxis.type === 'log') {
            const tickValues = yScale.ticks().filter(d => Number.isInteger(Math.log10(d)) || d === 1);
            yAxis.tickValues(tickValues);
        } else if (config.yAxis && config.yAxis.tickValues) {
            yAxis.tickValues(config.yAxis.tickValues);
        } else if (config.yAxis && config.yAxis.ticks) {
            yAxis.ticks(config.yAxis.ticks);
        }

        // X軸フォーマッター（将来の拡張用）
        if (ChartLayoutManager && !config.xAxisFormat) {
            const xFormatter = (value) => ChartLayoutManager.formatAxisWithUnits(value, unitInfo.xAxis);
            if (xAxis && !isYearData) {
                xAxis.tickFormat(xFormatter);
            }
        }

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

        // 軸ラベルを統一的に追加（カスタム優先、デフォルト単位フォールバック）
        if (ChartLayoutManager) {
            ChartLayoutManager.addAxisLabels(g, data, config, innerWidth, innerHeight);
        }

        // ライン生成器
        const line = d3.line()
            .x(d => isYearData ? xScale(+d[xField]) : xScale(new Date(d[xField])))
            .y(d => yScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        // 系列ごとにラインを描画
        const seriesGroups = g.selectAll('.series-group')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'series-group');

        // プログレッシブアニメーションかどうかをチェック
        const hasProgressiveAnimation = config.animation && config.animation.mode === 'progressive';

        let lineElements;
        if (!hasProgressiveAnimation) {
            // 通常のライン描画
            lineElements = seriesGroups.append('path')
                .attr('class', 'chart-line')
                .datum(d => d) // 系列データを設定
                .attr('stroke', d => colorScale(d.name))
                .attr('stroke-width', AppDefaults?.strokeWidth?.thick || 2)
                .attr('fill', 'none');

            // ChartTransitionsを使用してライン描画
            ChartTransitions.animateLine(lineElements, line, {
                chartType: 'line',
                phase: 'enter',
                animateEntry: true,
                duration: 600
            });
        }

        // ChartTransitionsを使用してポイント描画（progressiveモード以外）
        if (!config.animation || config.animation.mode !== 'progressive') {
            seriesGroups.each(function (seriesData) {
                const group = d3.select(this);

                // 一意キーでデータポイントを追跡
                const dataWithKeys = ChartTransitions.addObjectKeys(seriesData.values, xField, seriesData.name);

                const scales = { x: xScale, y: yScale };
                const pointConfig = {
                    chartType: 'line',
                    phase: 'enter',
                    xField: xField,
                    yField: yField,
                    radius: 3,
                    isYearData: isYearData,
                    duration: 600
                };

                // ポイントのエンターアニメーション
                ChartTransitions.createStaggered(
                    group.selectAll('.chart-circle')
                        .data(dataWithKeys, d => d._uniqueKey)
                        .enter()
                        .append('circle')
                        .attr('class', 'chart-circle')
                        .attr('fill', d => colorScale(seriesData.name)),
                    { delay: 15, duration: 600 }
                ).call(function (selection) {
                    ChartTransitions.animatePoints(selection, scales, pointConfig);
                });
            });
        }

        // プログレッシブアニメーションが設定されている場合の処理
        if (hasProgressiveAnimation) {
            this.animationManager.renderProgressiveAnimation(seriesGroups, series, line, xScale, yScale, xField, yField, colorScale, config, this);
        }

        // プログレッシブアニメーション完了後にインラインラベルを追加
        if (hasProgressiveAnimation && config.legendType === 'inline' && series.length > 1) {
            const animationDuration = config.animation?.duration || 3000;
            setTimeout(() => {
                const context = {
                    xScale,
                    yScale,
                    width: innerWidth,
                    height: innerHeight,
                    isYearData,
                    xField,
                    yField,
                    isDualLayout: false // 通常の折れ線グラフは常にfalse
                };
                this.labelManager.addInlineLabelsWithAnimation(g, series, colorScale, context);
            }, animationDuration + 500); // アニメーション完了後500ms待機
        }

        // レジェンドを追加（複数系列の場合のみ）
        if (series.length > 1) {
            const legendType = config.legendType || 'traditional';
            if (legendType === 'inline' && !hasProgressiveAnimation) {
                // プログレッシブアニメーションがない場合はすぐに表示
                const context = {
                    xScale,
                    yScale,
                    width: innerWidth,
                    height: innerHeight,
                    isYearData,
                    xField,
                    yField,
                    isDualLayout: false // 通常の折れ線グラフは常にfalse
                };
                this.labelManager.addInlineLabels(g, series, colorScale, context);
            } else if (legendType === 'traditional') {
                this.legendManager.addLegend(svg, series, colorScale, width, height);
            }
        }

        // 注釈（アノテーション）を描画
        if (config.annotations) {
            this.renderAnnotations(g, config.annotations, { xScale, yScale, width: innerWidth, height: innerHeight, isYearData, xField, yField });
        }

        // データソースを表示
        if (dataSource) {
            this.addDataSource(svg, dataSource, width, height);
        }
    }

    /**
     * 指定されたグループ内で折れ線グラフを描画
     */
    renderLineChartInGroup(g, data, config) {
        const { width, height, xField = 'year', yField = 'value', colors = d3.schemeCategory10, multiSeries = true, dataSource = '' } = config;

        // データを系列別に変換
        const series = LineChartUtilities.transformToSeries(data, config);

        // 全データからドメインを計算
        const allValues = series.flatMap(s => s.values);

        // スケール設定
        const isYearData = allValues.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);

        // X軸のドメインを決定（設定で年度範囲が指定されていればそれを使用、なければデータ範囲）
        let xDomain;
        if (config.yearRange && config.yearRange.length === 2) {
            // 設定ファイルで年度範囲が指定されている場合
            xDomain = config.yearRange;
        } else if (isYearData) {
            // 年データの場合はデータの範囲を使用
            xDomain = d3.extent(allValues, d => +d[xField]);
        } else {
            // 時間データの場合
            xDomain = d3.extent(allValues, d => new Date(d[xField]));
        }

        const xScale = isYearData
            ? d3.scaleLinear()
                .domain(xDomain)
                .range([0, width])
            : d3.scaleTime()
                .domain(xDomain)
                .range([0, width]);

        // Y軸のドメインを決定（設定でY軸範囲が指定されていればそれを使用、なければデータ範囲）
        let yDomain;
        if (config.yRange && config.yRange.length === 2) {
            // 設定ファイルでY軸範囲が指定されている場合
            yDomain = config.yRange;
        } else {
            // データの範囲を使用
            yDomain = d3.extent(allValues, d => +d[yField]);
        }

        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([height, 0]);

        // yRangeが明示的に設定されていない場合のみnice()を適用
        if (!(config.yRange && config.yRange.length === 2)) {
            yScale.nice();
        }

        // D3標準のカラースケール：地域名から直接色を取得
        const colorScale = LineChartUtilities.createColorScale(series, config);

        // 単位情報を分析
        let unitInfo = { xAxis: {}, yAxis: {} };
        if (ChartLayoutManager) {
            unitInfo = ChartLayoutManager.analyzeUnits(data, config);
        }

        // 軸を描画（カスタムフォーマット優先、ChartLayoutManager、D3デフォルトの順）
        let xAxis, yAxis;

        // Y軸フォーマッターを決定（優先順位：カスタム > ChartLayoutManager > D3デフォルト）
        let yFormatter;
        if (config.yAxisFormat) {
            // カスタムフォーマットが指定されている場合
            yFormatter = (value) => ChartFormatterHelper.formatYAxisValue(value, config.yAxisFormat);
        } else if (ChartLayoutManager) {
            // ChartLayoutManagerが利用可能な場合
            yFormatter = (value) => ChartLayoutManager.formatAxisWithUnits(value, unitInfo.yAxis);
        } else {
            // デフォルト（D3の標準フォーマット）
            yFormatter = null; // D3のデフォルトを使用
        }

        xAxis = isYearData
            ? d3.axisBottom(xScale).tickFormat(d3.format("d"))  // 年データは整数表示
            : d3.axisBottom(xScale);
        yAxis = yFormatter
            ? d3.axisLeft(yScale).tickFormat(yFormatter)
            : d3.axisLeft(yScale);

        // yAxisのtickValues設定がある場合は適用
        if (config.yAxis && config.yAxis.type === 'log') {
            const tickValues = yScale.ticks().filter(d => Number.isInteger(Math.log10(d)) || d === 1);
            yAxis.tickValues(tickValues);
        } else if (config.yAxis && config.yAxis.tickValues) {
            yAxis.tickValues(config.yAxis.tickValues);
        } else if (config.yAxis && config.yAxis.ticks) {
            yAxis.ticks(config.yAxis.ticks);
        }

        // X軸フォーマッター（将来の拡張用）
        if (ChartLayoutManager && !config.xAxisFormat) {
            const xFormatter = (value) => ChartLayoutManager.formatAxisWithUnits(value, unitInfo.xAxis);
            if (xAxis && !isYearData) {
                xAxis.tickFormat(xFormatter);
            }
        }

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

        // 軸ラベルを統一的に追加（カスタム優先、デフォルト単位フォールバック）
        if (ChartLayoutManager) {
            ChartLayoutManager.addAxisLabels(g, data, config, width, height);
        }

        // ライン生成器
        const line = d3.line()
            .x(d => isYearData ? xScale(+d[xField]) : xScale(new Date(d[xField])))
            .y(d => yScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        // 系列ごとにラインを描画
        const seriesGroups = g.selectAll('.series-group')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'series-group');

        // プログレッシブアニメーションの設定をチェック
        const hasProgressiveAnimation = config.animation && config.animation.mode === 'progressive';

        if (hasProgressiveAnimation) {
            // プログレッシブアニメーションが設定されている場合は、アニメーション関数で描画
            this.animationManager.renderProgressiveAnimation(seriesGroups, series, line, xScale, yScale, xField, yField, colorScale, config, this);
        } else {
            // 通常の描画
            // ラインを描画
            seriesGroups.append('path')
                .attr('class', 'chart-line')
                .datum(d => d) // 系列データを設定
                .attr('d', d => line(d.values))
                .attr('stroke', d => colorScale(d.name))
                .attr('stroke-width', AppDefaults?.strokeWidth?.thick || 2)
                .attr('fill', 'none');

            // ポイントを描画
            seriesGroups.each(function (seriesData) {
                const group = d3.select(this);

                const circles = group.selectAll('.chart-circle')
                    .data(seriesData.values)
                    .enter()
                    .append('circle')
                    .attr('class', 'chart-circle')
                    .attr('cx', d => isYearData ? xScale(+d[xField]) : xScale(new Date(d[xField])))
                    .attr('cy', d => yScale(+d[yField]))
                    .attr('r', 3)
                    .attr('fill', colorScale(seriesData.name));
            });
        }

        // コンパクトなレジェンドを追加（複数系列の場合のみ）
        if (series.length > 1) {
            const legendType = config.legendType || 'traditional';
            if (legendType === 'inline') {
                const context = {
                    xScale,
                    yScale,
                    width,
                    height,
                    isYearData,
                    xField,
                    yField,
                    isDualLayout: config.isDualLayout || false // デュアルレイアウトフラグを追加
                };
                this.labelManager.addInlineLabels(g, series, colorScale, context);
            } else {
                this.legendManager.addCompactLegend(g, series, colorScale, width, height);
            }
        }

        // データソースを表示
        if (dataSource) {
            g.append('text')
                .attr('class', 'chart-data-source')
                .attr('x', 0)
                .attr('y', height + 35) // X軸の下に配置
                .attr('text-anchor', 'start')
                .style('font-size', '12px')
                .style('fill', '#888')
                .style('font-style', 'normal')
                .text(`出典: ${dataSource}`);
        }
    }

    /**
     * 注釈（アノテーション）を描画
     */
    renderAnnotations(g, annotations, context) {
        if (!annotations || annotations.length === 0) return;

        const { xScale, yScale, width, height, isYearData, xField, yField } = context;

        // スケールが存在しない場合は処理をスキップ
        if (!xScale || !yScale) {
            console.warn('LineChartRenderer: xScale or yScale is undefined, skipping annotations');
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
                console.warn(`LineChartRenderer: Failed to convert x coordinate for annotation ${index}:`, x, error);
                xPos = 0;
            }

            // Y座標の変換
            let yPos;
            try {
                yPos = yScale(+y);
            } catch (error) {
                console.warn(`LineChartRenderer: Failed to convert y coordinate for annotation ${index}:`, y, error);
                yPos = 0;
            }

            // 座標が有効かチェック
            if (isNaN(xPos) || isNaN(yPos)) {
                console.warn(`LineChartRenderer: Invalid coordinates for annotation ${index}: x=${xPos}, y=${yPos}`);
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
}