import * as d3 from 'd3';
import { BaseManager } from './base-manager.js';
import { SVGHelper } from './svg-helper.js';
import { colorScheme } from './color-scheme.js';
import { AppDefaults } from '../config/defaults.js';
import { AppConstants } from './app-constants.js';
import { LineChartLabelManager } from './line-chart-label-manager.js';

/**
 * ChartSVGRenderer - SVG直接描画を専門的に扱うクラス
 * ChartSVGDrawer を吸収した統合版
 * ChartManagerから抽出されたSVG描画ロジックを集約
 * レンダラーを使わない直接描画処理を担当
 */
export class ChartSVGRenderer extends BaseManager {
    /**
     * コンストラクタ
     * @param {string} containerId - コンテナの ID
     */
    constructor(containerId) {
        super(containerId);
        this.svg = null;
        this.currentLayout = null;
        this.init();
    }

    /**
     * デュアルレイアウトを直接SVG描画
     * @param {Object} chartData - チャートデータ
     */
    renderDualLayoutDirect(chartData) {
        const { charts, position } = chartData;

        if (!charts || !Array.isArray(charts) || charts.length !== 2) {
            ErrorHandler.handle(
                new Error('Invalid charts array for dual layout. Expected exactly 2 charts.'),
                'ChartSVGRenderer.createDualLayoutSVG',
                {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    additionalInfo: { charts }
                }
            );
            return;
        }

        console.log('ChartSVGRenderer: Starting direct dual layout rendering (no renderer contamination)');

        // 統一コンテナ管理：完全にクリア
        this.clearContainer();

        // ★重要: コンテナ内のすべての子要素を削除（他のレンダラーが残した要素を削除）
        this.container.selectAll('*').remove();

        // 横並びレイアウト用のSVGを作成
        const svg = this.createDualLayoutSVG(chartData);

        if (!svg) {
            ErrorHandler.handle(
                new Error('Failed to create SVG for direct dual layout'),
                'ChartSVGRenderer.createDualLayoutSVG',
                { type: ErrorHandler.ERROR_TYPES.RENDER, severity: ErrorHandler.SEVERITY.HIGH }
            );
            return;
        }

        this.svg = svg;

        // レイアウト計算
        const layout = this.calculateDualLayoutDimensions(position);
        this.currentLayout = layout;

        // 2つのチャートエリアを作成（独立したSVGとして）
        const leftChartSVG = svg.append('g')
            .attr('class', 'dual-chart-left')
            .attr('transform', `translate(${layout.marginLeft}, ${layout.marginTop})`);

        const rightChartSVG = svg.append('g')
            .attr('class', 'dual-chart-right')
            .attr('transform', `translate(${layout.marginLeft + layout.chartWidth + layout.spacing}, ${layout.marginTop})`);

        // 各チャートを独立して描画（既存レンダラーを使わない）
        this.drawSingleChartInSVG(leftChartSVG, charts[0], layout, 'left');
        this.drawSingleChartInSVG(rightChartSVG, charts[1], layout, 'right');

        console.log('ChartSVGRenderer: Direct dual layout rendering completed');
    }

    /**
     * SVG内で単一チャートを直接描画（レンダラー非使用）
     * ChartSVGDrawer のロジックを統合
     * @param {d3.Selection} svgGroup - SVGグループ
     * @param {Object} chartConfig - チャート設定
     * @param {Object} layout - レイアウト情報
     * @param {string} position - 位置 ('left' | 'right')
     */
    drawSingleChartInSVG(svgGroup, chartConfig, layout, position) {
        if (chartConfig.type !== 'line') {
            ErrorHandler.handle(
                new Error(`Direct rendering only supports line charts, got: ${chartConfig.type}`),
                'ChartSVGRenderer.renderDirectChart',
                { type: ErrorHandler.ERROR_TYPES.RENDER, severity: ErrorHandler.SEVERITY.MEDIUM }
            );
            return;
        }

        // データを取得
        const data = chartConfig.data;
        if (!data || data.length === 0) {
            ErrorHandler.handle(
                new Error(`No data available for ${position} chart`),
                'ChartSVGRenderer.renderDirectChart',
                { type: ErrorHandler.ERROR_TYPES.DATA, severity: ErrorHandler.SEVERITY.MEDIUM }
            );
            return;
        }

        // チャート描画エリアを準備
        let margin = chartConfig.config.margin || { top: 40, right: 30, bottom: 60, left: 80 };

        // 複数系列でインラインレジェンドの場合、右マージンを拡大
        if (chartConfig.config.multiSeries && chartConfig.config.legendType === 'inline') {
            const legendWidth = chartConfig.config.legendWidth || 240;
            margin = { ...margin, right: Math.max(margin.right, legendWidth) };
        }

        const width = layout.chartWidth - margin.left - margin.right;
        const height = layout.chartHeight - margin.top - margin.bottom;

        const chartGroup = svgGroup.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // タイトルを追加
        if (chartConfig.title) {
            svgGroup.append('text')
                .attr('class', 'chart-title')
                .attr('x', layout.chartWidth / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .text(chartConfig.title);
        }

        // フィールド設定
        const xField = chartConfig.config.xField || 'year';
        const yField = chartConfig.config.yField || 'value';
        const config = chartConfig.config;

        // ★重要: データを系列別に変換（複数系列対応）
        const series = ChartSVGRenderer.transformToSeries(data, chartConfig.config);

        // 全データからドメインを計算
        const allValues = series.flatMap(s => s.values);

        // X軸とY軸のドメインを計算
        const xDomain = d3.extent(allValues, d => +d[xField]);
        let yDomain;
        if (config.yRange && config.yRange.length === 2) {
            yDomain = config.yRange;
        } else {
            yDomain = d3.extent(allValues, d => +d[yField]);
        }

        const xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([height, 0]);

        // ★重要: 色スケールを作成（系列ごとの色設定）
        const colorScale = this.createColorScale(series, config);

        // 軸を描画
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        // 日本語フォーマットが設定されている場合
        if (config.yAxisFormat && config.yAxisFormat.type === 'japanese') {
            yAxis.tickFormat(d => {
                if (d >= 10000) {
                    return (d / 10000) + '万';
                }
                return d;
            });
        }

        chartGroup.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${height})`)
            .call(xAxis);

        chartGroup.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);

        // 軸ラベル
        if (config.yAxisLabel) {
            chartGroup.append('text')
                .attr('class', 'y-axis-label')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left)
                .attr('x', 0 - (height / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .style('font-size', '12px')
                .text(config.yAxisLabel);
        }

        // ライン生成器
        const line = d3.line()
            .x(d => xScale(+d[xField]))
            .y(d => yScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        // ★重要: 系列ごとにグループを作成し、ラインとドットを描画
        const seriesGroups = chartGroup.selectAll('.series-group')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'series-group');

        // 各系列にラインを追加
        seriesGroups.append('path')
            .attr('class', 'chart-line')
            .datum(d => d)
            .attr('stroke', d => colorScale(d.name))
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('d', d => line(d.values));

        // 各系列にドット（データポイント）を追加
        seriesGroups.each(function (seriesData) {
            const group = d3.select(this);

            group.selectAll('.chart-circle')
                .data(seriesData.values)
                .enter().append('circle')
                .attr('class', 'chart-circle')
                .attr('cx', d => xScale(+d[xField]))
                .attr('cy', d => yScale(+d[yField]))
                .attr('r', 3)
                .attr('fill', colorScale(seriesData.name));
        });

        // インラインラベルを追加（複数系列の場合）
        if (series.length > 1 && config.legendType === 'inline') {
            this.addInlineLabelsToGroup(chartGroup, series, colorScale, width, height, xField, yField);
        }

        // データソースを表示
        if (config.dataSource) {
            svgGroup.append('text')
                .attr('class', 'chart-data-source')
                .attr('x', 0)
                .attr('y', layout.chartHeight - 5)
                .attr('text-anchor', 'start')
                .style('font-size', '12px')
                .style('fill', '#888')
                .style('font-style', 'normal')
                .text(`出典: ${config.dataSource}`);
        }
    }

    /**
     * デュアルレイアウト用のSVGを作成
     * @param {Object} chartData - チャートデータ
     * @returns {d3.Selection} SVG要素
     */
    createDualLayoutSVG(chartData) {
        const containerNode = this.container.node();
        const containerRect = containerNode.getBoundingClientRect();

        // ビューポートサイズを基準としたサイズ計算
        const viewportWidth = window.innerWidth || 1200;
        const viewportHeight = window.innerHeight || 800;

        let totalWidth = Math.min(viewportWidth * 0.9, 1400);
        let totalHeight = Math.min(viewportHeight * 0.8, 700);

        // position設定がある場合はそれを優先
        if (chartData.position) {
            if (chartData.position.width) {
                totalWidth = this.calculateDimensionFromPosition(chartData.position.width, viewportWidth, 'width');
            }
            if (chartData.position.height) {
                totalHeight = this.calculateDimensionFromPosition(chartData.position.height, viewportHeight, 'height');
            }
        }

        // SVGHelperを使用してレスポンシブSVGを作成
        if (SVGHelper) {
            return SVGHelper.initSVG(this.container, totalWidth, totalHeight, {
                preserveAspectRatio: 'xMidYMid meet',
                responsive: true
            });
        } else {
            // フォールバック
            this.container.selectAll('*').remove();
            return this.container.append('svg')
                .attr('width', totalWidth)
                .attr('height', totalHeight);
        }
    }

    /**
     * デュアルレイアウトの寸法を計算（統一版）
     * @param {Object} position - position設定
     * @returns {Object} レイアウト情報
     */
    calculateDualLayoutDimensions(position = {}) {
        const viewportWidth = window.innerWidth || 1200;
        const viewportHeight = window.innerHeight || 800;

        // デフォルト値：他のチャートと同等のサイズ
        let totalWidth = Math.min(viewportWidth * 0.95, 1400);
        let totalHeight = Math.min(viewportHeight * 0.85, 850);

        // position設定での上書き（ただし最小値を保証）
        if (position.width) {
            const calculatedWidth = this.calculateDimensionFromPosition(position.width, viewportWidth, 'width');
            // position.width が明示的に指定されている場合は、それに基づくが、最小値1000は保証
            totalWidth = Math.max(calculatedWidth, 1000);
        }
        if (position.height) {
            const calculatedHeight = this.calculateDimensionFromPosition(position.height, viewportHeight, 'height');
            // position.height が明示的に指定されている場合は、それに基づくが、最小値600は保証
            totalHeight = Math.max(calculatedHeight, 600);
        }

        const spacing = 40;
        const marginTop = 40;
        const marginBottom = 40;
        const marginLeft = 20;
        const marginRight = 20;

        const availableWidth = totalWidth - marginLeft - marginRight;
        const availableHeight = totalHeight - marginTop - marginBottom;

        const chartWidth = Math.max((availableWidth - spacing) / 2, 400);
        const chartHeight = Math.max(availableHeight, 300);

        console.log(`DEBUG: calculateDualLayoutDimensions - totalWidth: ${totalWidth}, totalHeight: ${totalHeight}, chartWidth: ${chartWidth}, chartHeight: ${chartHeight}`);

        return {
            totalWidth,
            totalHeight,
            chartWidth,
            chartHeight,
            spacing,
            marginTop,
            marginBottom,
            marginLeft,
            marginRight
        };
    }

    /**
     * position値から実寸法を計算
     * @param {string|number} value - position値 (%, px, vw, vhなど)
     * @param {number} containerSize - コンテナサイズ
     * @param {string} type - サイズタイプ ('width', 'height')
     * @returns {number} 計算された寸法
     */
    calculateDimensionFromPosition(value, containerSize, type = 'width') {
        if (typeof value === 'number') {
            return value;
        }

        if (typeof value !== 'string') {
            return containerSize;
        }

        // パーセンテージ
        if (value.includes('%')) {
            const percent = parseFloat(value);
            return (containerSize * percent) / 100;
        }

        // ピクセル
        if (value.includes('px')) {
            return parseFloat(value);
        }

        // ビューポート幅
        if (value.includes('vw')) {
            const percent = parseFloat(value);
            return (window.innerWidth * percent) / 100;
        }

        // ビューポート高さ
        if (value.includes('vh')) {
            const percent = parseFloat(value);
            return (window.innerHeight * percent) / 100;
        }

        // デフォルト
        return containerSize;
    }

    /**
     * レイアウト用のSVGを作成（position設定対応版）
     * @param {string} layoutType - レイアウトタイプ ('dual', 'triple', etc)
     * @param {Object} chartData - チャートデータ
     * @returns {d3.Selection} SVG要素
     */
    createLayoutSVG(layoutType, chartData = {}) {
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth || 800;
        const containerHeight = containerNode.clientHeight || 600;

        let totalWidth, totalHeight;

        // position設定からサイズを計算
        const position = chartData.position || {};

        if (position.width && position.height) {
            // position設定で明示的にサイズが指定されている場合
            totalWidth = this.calculateDimensionFromPosition(position.width, containerWidth, 'width');
            totalHeight = this.calculateDimensionFromPosition(position.height, containerHeight, 'height');
        } else {
            // 従来のデフォルト計算 - より大きなサイズに調整
            switch (layoutType) {
                case 'dual':
                    totalWidth = Math.min(containerWidth * 0.95, 1400);
                    totalHeight = Math.max(Math.min(containerHeight * 0.85, 800), 500);
                    break;
                case 'triple':
                    totalWidth = Math.min(containerWidth * 0.95, 1200);
                    totalHeight = Math.max(Math.min(containerHeight * 0.8, 500), 400);
                    break;
                default:
                    totalWidth = 800;
                    totalHeight = 600;
            }
        }

        // SVGHelperを使用してSVGを作成
        if (SVGHelper) {
            return SVGHelper.initSVG(this.container, totalWidth, totalHeight, {
                className: 'chart-svg',
                responsive: true,
                preserveAspectRatio: 'xMidYMid meet',
                actualWidth: layoutType === 'dual' ? totalWidth : null,
                actualHeight: layoutType === 'dual' ? totalHeight : null
            });
        } else {
            // フォールバック
            const svg = this.container.append('svg')
                .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

            if (layoutType === 'dual') {
                svg.style('width', '100%')
                    .style('height', 'auto')
                    .style('max-width', '100%');
            } else {
                svg.style('width', '100%')
                    .style('height', 'auto');
            }

            return svg;
        }
    }

    /**
     * 仮想コンテナを作成（既存レンダラー用）
     * @param {d3.Selection} group - SVGグループ
     * @param {string} id - コンテナID
     * @returns {Object} 仮想コンテナオブジェクト
     */
    createVirtualContainer(group, id) {
        return {
            selection: group,
            id: id,
            node: () => group.node(),
            selectAll: (selector) => group.selectAll(selector),
            append: (element) => group.append(element),
            select: (selector) => group.select(selector),
            classed: (className, value) => group.classed(className, value),
            style: (property, value) => group.style(property, value),
            attr: (attribute, value) => group.attr(attribute, value)
        };
    }

    /**
     * コンテナをクリア
     */
    clearContainer() {
        if (this.container) {
            // #chart 要素の場合、その中身だけをクリア
            const containerId = this.container.node() ? this.container.node().id : null;
            if (containerId === 'chart') {
                // #chart内のSVGのみをクリア（#chart-containerは触らない）
                this.container.selectAll('svg').remove();
            } else {
                // その他のコンテナは全て削除
                this.container.selectAll('*').remove();
            }
        }
        this.svg = null;
        this.currentLayout = null;
    }

    /**
     * データを系列別に変換
     * @param {Array} data - 生データ
     * @param {Object} config - 設定
     * @returns {Array} 系列別データ
     */
    static transformToSeries(data, config) {
        const { xField = 'year', yField = 'value', seriesField = 'series' } = config;

        // multiSeriesがfalseの場合は単一系列として扱う
        if (config.multiSeries === false) {
            const result = [{
                name: config.seriesName || 'Data',
                values: data.map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
            }];
            return result;
        }

        // 複数系列の場合
        const seriesNames = [...new Set(data.map(d => d[seriesField]))];

        if (seriesNames.length === 1 && seriesNames[0] === undefined) {
            // seriesFieldが存在しない場合は単一系列として扱う
            const result = [{
                name: config.title || 'Data',
                values: data.map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
            }];
            return result;
        }

        const result = seriesNames.map(name => ({
            name,
            values: data
                .filter(d => d[seriesField] === name)
                .map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
        }));
        return result;
    }

    /**
     * インスタンスメソッド版（既存コード互換性）
     * @param {Array} data - 生データ
     * @param {Object} config - 設定
     * @returns {Array} 系列別データ
     */
    transformToSeriesInstance(data, config) {
        return ChartSVGRenderer.transformToSeries(data, config);
    }

    /**
     * 色スケールを作成
     * @param {Array} series - 系列データ
     * @param {Object} config - 設定
     * @returns {Function} 色スケール関数
     */
    createColorScale(series, config) {
        // 単一色設定が指定されている場合（dualレイアウト対応）
        if (config.color) {
            return () => config.color;
        } else if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            // 単一系列の明示色
            return d3.scaleOrdinal(config.colors).domain(series.map(d => d.name));
        } else if (colorScheme && config.useUnifiedColors !== false) {
            // 統一カラースキーム：地域名→色の直接マッピング
            // 統一カラースキーム：地域名→色の直接マッピング
            // let colorScheme = window.colorScheme; // Removed global usage

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
     * リソースを破棄
     */
    destroy() {
        this.clearContainer();
        super.destroy();
    }

    /**
     * 静的メソッド版：SVG内で単一チャートを直接描画（レンダラー非使用）
     * chart-manager.jsから呼び出し用
     * @param {d3.Selection} svgGroup - SVGグループ
     * @param {Object} chartConfig - チャート設定
     * @param {Object} layout - レイアウト情報
     * @param {string} position - 位置 ('left' | 'right')
     */
    static drawSingleChartInSVGStatic(svgGroup, chartConfig, layout, position) {
        if (chartConfig.type !== 'line') {
            ErrorHandler.handle(
                new Error(`Direct rendering only supports line charts, got: ${chartConfig.type}`),
                'ChartSVGRenderer.renderDirectChart',
                { type: ErrorHandler.ERROR_TYPES.RENDER, severity: ErrorHandler.SEVERITY.MEDIUM }
            );
            return;
        }

        // データを取得
        const data = chartConfig.data;
        if (!data || data.length === 0) {
            ErrorHandler.handle(
                new Error(`No data available for ${position} chart`),
                'ChartSVGRenderer.renderDirectChart',
                { type: ErrorHandler.ERROR_TYPES.DATA, severity: ErrorHandler.SEVERITY.MEDIUM }
            );
            return;
        }

        // チャート描画エリアを準備
        let margin = chartConfig.config.margin || { top: 40, right: 30, bottom: 60, left: 80 };

        // 複数系列でインラインレジェンドの場合、右マージンを拡大
        if (chartConfig.config.multiSeries && chartConfig.config.legendType === 'inline') {
            const legendWidth = chartConfig.config.legendWidth || 240;
            margin = { ...margin, right: Math.max(margin.right, legendWidth) };
        }

        const width = layout.chartWidth - margin.left - margin.right;
        const height = layout.chartHeight - margin.top - margin.bottom;

        const chartGroup = svgGroup.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // タイトルを追加
        if (chartConfig.title) {
            svgGroup.append('text')
                .attr('class', 'chart-title')
                .attr('x', layout.chartWidth / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .text(chartConfig.title);
        }

        // フィールド設定
        const xField = chartConfig.config.xField || 'year';
        const yField = chartConfig.config.yField || 'value';
        const config = chartConfig.config;

        // ★重要: データを系列別に変換（複数系列対応）
        const series = ChartSVGRenderer.transformToSeries(data, chartConfig.config);

        // 全データからドメインを計算
        const allValues = series.flatMap(s => s.values);

        // X軸とY軸のドメインを計算
        const xDomain = d3.extent(allValues, d => +d[xField]);
        let yDomain;
        if (config.yRange && config.yRange.length === 2) {
            yDomain = config.yRange;
        } else {
            yDomain = d3.extent(allValues, d => +d[yField]);
        }

        const xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([height, 0]);

        // ★重要: 色スケールを作成（系列ごとの色設定）
        const colorScale = ChartSVGRenderer.createColorScaleStatic(series, config);

        // 軸を描画
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        // 日本語フォーマットが設定されている場合
        if (config.yAxisFormat && config.yAxisFormat.type === 'japanese') {
            yAxis.tickFormat(d => {
                if (d >= 10000) {
                    return (d / 10000) + '万';
                }
                return d;
            });
        }

        chartGroup.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${height})`)
            .call(xAxis);

        chartGroup.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);

        // 軸ラベル
        if (config.yAxisLabel) {
            chartGroup.append('text')
                .attr('class', 'y-axis-label')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left)
                .attr('x', 0 - (height / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .style('font-size', '12px')
                .text(config.yAxisLabel);
        }

        // ライン生成器
        const line = d3.line()
            .x(d => xScale(+d[xField]))
            .y(d => yScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        // ★重要: 系列ごとにグループを作成し、ラインとドットを描画
        const seriesGroups = chartGroup.selectAll('.series-group')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'series-group');

        // 各系列にラインを追加
        seriesGroups.append('path')
            .attr('class', 'chart-line')
            .datum(d => d)
            .attr('stroke', d => colorScale(d.name))
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('d', d => line(d.values));

        // 各系列にドット（データポイント）を追加
        seriesGroups.each(function (seriesData) {
            const group = d3.select(this);

            group.selectAll('.chart-circle')
                .data(seriesData.values)
                .enter().append('circle')
                .attr('class', 'chart-circle')
                .attr('cx', d => xScale(+d[xField]))
                .attr('cy', d => yScale(+d[yField]))
                .attr('r', 3)
                .attr('fill', colorScale(seriesData.name));
        });

        // インラインラベルを追加（複数系列の場合）
        // LineChartLabelManagerを使用して一貫性のあるラベル表示を実現
        if (series.length > 1 && config.legendType === 'inline') {
            const context = {
                xScale,
                yScale,
                width,
                height,
                isYearData: true, // ここでは年データと仮定
                xField,
                yField,
                isDualLayout: true // デュアルレイアウトとして処理
            };

            // 静的メソッド内なのでインスタンスを作成して使用
            const labelManager = new LineChartLabelManager();
            labelManager.addInlineLabels(chartGroup, series, colorScale, context);
        }

        // データソースを表示
        if (config.dataSource) {
            svgGroup.append('text')
                .attr('class', 'data-source')
                .attr('x', layout.chartWidth - 10)
                .attr('y', layout.chartHeight - 10)
                .attr('text-anchor', 'end')
                .style('font-size', '10px')
                .style('fill', '#999')
                .text(`出典: ${config.dataSource}`);
        }
    }

    /**
     * 色スケール作成の静的メソッド版
     * @param {Array} series - 系列データ
     * @param {Object} config - 設定
     * @returns {Function} 色スケール関数
     */
    static createColorScaleStatic(series, config) {
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


}
