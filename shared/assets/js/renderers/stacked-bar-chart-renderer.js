/**
 * StackedBarChartRenderer - 時系列積み重ね棒グラフの描画と更新を専門的に扱うクラス
 * ChartRendererBaseを継承し、積み重ね棒グラフ特有の機能を提供
 */
class StackedBarChartRenderer extends ChartRendererBase {
    constructor(containerId) {
        super(containerId);
        this.type = 'stacked-bar';  // チャート種別を設定
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;
        this.init();
    }

    /**
     * チャートを更新する
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        const { type, data, config, visible } = chartData;

        // Dual/Triple layout では個別レンダラーは動作しない
        if (this.shouldSkipDualLayout(chartData)) {
            return;
        }

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
        if (type !== 'stacked-bar') {
            console.warn(`StackedBarChartRenderer: Unsupported chart type: ${type}`);
            return;
        }

        const validation = this.validateChartData(data, config);
        if (!validation.valid) {
            console.error('StackedBarChartRenderer: Invalid data or config:', validation.errors);
            return;
        }

        const responsiveSize = this.getResponsiveSize(config);
        const width = responsiveSize.width;
        const height = responsiveSize.height;
        
        const margin = config.margin || { top: 60, right: 30, bottom: 40, left: 50 };

        this.container.selectAll('*').remove();
        
        // SVGHelperを使用してレスポンシブSVGを作成
        if (window.SVGHelper) {
            this.svg = SVGHelper.initSVG(this.container, width, height, {
                preserveAspectRatio: config.preserveAspectRatio || 'xMidYMid meet',
                responsive: true
            });
        } else {
            this.svg = this.container.append('svg')
                .attr('width', width)
                .attr('height', height);
        }


        try {
            this.renderStackedBarChart(data, { width, height, margin, ...config });
        } catch (error) {
            console.error('StackedBarChartRenderer: Error during chart rendering:', error);
        }
    }

    /**
     * チャートデータとコンフィグを検証
     */
    validateChartData(data, config) {
        const errors = [];
        if (!data || !Array.isArray(data) || data.length === 0) {
            errors.push('Data is invalid or empty');
        }
        if (!config || typeof config !== 'object') {
            errors.push('Config must be an object');
        }
        if (!config.stackKeys || !Array.isArray(config.stackKeys) || config.stackKeys.length < 1) {
            errors.push('Config must include a stackKeys array with at least one key.');
        }
        if (data && data.length > 0 && config.stackKeys) {
            const firstItem = data[0];
            for (const key of config.stackKeys) {
                if (!firstItem.hasOwnProperty(key)) {
                    errors.push(`Data items must have the property '${key}' as defined in stackKeys.`);
                    break;
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }

    /**
     * 積み重ね棒グラフを描画する
     */
    renderStackedBarChart(data, config) {
        const {
            width, height, margin,
            xField = 'year',
            stackKeys,
            colors = ['#66c2a5', '#fc8d62'],
            title = '',
            yAxisLabel = '',
            dataSource = ''
        } = config;

        const svg = this.svg;
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        if (title) {
            g.append('text')
                .attr('class', 'chart-title')
                .attr('x', 0)
                .attr('y', -20) // Adjust title position for legend
                .attr('text-anchor', 'start')
                .style('font-family', 'var(--font-family-serif)')
                .style('font-size', 'var(--font-size-base)')
                .style('font-weight', 'var(--font-weight-bold)')
                .text(title);
        }

        const stack = d3.stack().keys(stackKeys);
        const stackedData = stack(data);

        const xScale = d3.scaleBand()
            .domain(data.map(d => d[xField]))
            .range([0, innerWidth])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(stackedData, d => d3.max(d, item => item[1]))])
            .nice()
            .range([innerHeight, 0]);

        const colorScale = d3.scaleOrdinal().domain(stackKeys).range(colors);

        const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d"));
        const yAxis = d3.axisLeft(yScale);
        
        if (config.yAxisFormat) {
             yAxis.tickFormat(d => ChartFormatterHelper.formatYAxisValue(d, config.yAxisFormat));
        }

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);
            
        if (yAxisLabel) {
            g.append('text')
                .attr('class', 'axis-label')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left)
                .attr('x', 0 - (innerHeight / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .text(yAxisLabel);
        }

        g.append('g')
            .selectAll('g')
            .data(stackedData)
            .enter().append('g')
            .attr('fill', d => colorScale(d.key))
            .selectAll('rect')
            .data(d => d)
            .enter().append('rect')
            .attr('x', d => xScale(d.data[xField]))
            .attr('y', d => yScale(d[1]))
            .attr('height', d => Math.max(0, yScale(d[0]) - yScale(d[1])))
            .attr('width', xScale.bandwidth());

        this.addLegend(svg, stackKeys, colorScale, width, margin);

        // データソースを表示
        if (dataSource) {
            this.addDataSource(svg, dataSource, width, height);
        }
    }

    /**
     * 凡例を追加
     */
    addLegend(svg, keys, colorScale, width, margin) {
        const legendGroup = svg.append('g')
            .attr('class', 'chart-legend');

        const legendItems = legendGroup.selectAll('.legend-item')
            .data(keys)
            .enter()
            .append('g')
            .attr('class', 'legend-item');

        legendItems.append('rect')
            .attr('x', 0)
            .attr('y', -10)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', d => colorScale(d));

        legendItems.append('text')
            .attr('x', 18)
            .attr('y', 0)
            .attr('dy', '-0.1em')
            .style('font-size', '12px')
            .style('text-anchor', 'start')
            .text(d => d);

        let totalLegendWidth = 0;
        const legendPadding = 25;

        legendItems.each(function() {
            const itemWidth = this.getBBox().width;
            d3.select(this).attr('transform', `translate(${totalLegendWidth}, 0)`);
            totalLegendWidth += itemWidth + legendPadding;
        });
        
        totalLegendWidth -= legendPadding; // remove last padding

        const legendX = width - margin.right - totalLegendWidth;
        const legendY = 40;

        legendGroup.attr('transform', `translate(${legendX}, ${legendY})`);
    }

    /**
     * データソースを追加
     */
    addDataSource(svg, dataSource, width, height) {
        if (!dataSource) return;

        svg.append('text')
            .attr('class', 'chart-data-source')
            .attr('x', 10)
            .attr('y', height - 10)
            .attr('text-anchor', 'start')
            .style('font-size', '12px')
            .style('fill', '#888')
            .style('font-style', 'normal')
            .text(`出典: ${dataSource}`);
    }

    /**
     * レスポンシブサイズを取得
     */
    getResponsiveSize(config) {
        if (window.SVGHelper) {
            return SVGHelper.getResponsiveSize(this.container, {
                defaultWidth: 800,
                defaultHeight: 600,
                width: config.width,
                height: config.height,
                minWidth: 300,
                minHeight: 200,
                maxWidth: 1200,
                maxHeight: 800,
                aspectRatio: config.aspectRatio || ((config.width || 800) / (config.height || 600)),
                widthPercent: config.widthPercent || null,
                heightPercent: config.heightPercent || null
            });
        }
        let width = config.width || 800;
        let height = config.height || 600;
        return { width, height };
    }

    /**
     * リサイズ処理
     */
    resize() {
        if (this.currentChart && this.data && this.config) {
            this.renderChart(this.currentChart, this.data, this.config);
        }
    }
}

window.StackedBarChartRenderer = StackedBarChartRenderer;