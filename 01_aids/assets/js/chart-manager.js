/**
 * ChartManager - チャート管理クラス
 * D3.jsを使用した各種チャートの描画・更新を管理
 */
class ChartManager {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;
        
        this.init();
    }

    init() {
        // イベントリスナーを設定
        pubsub.subscribe(EVENTS.CHART_UPDATE, (data) => {
            this.updateChart(data);
        });

        pubsub.subscribe(EVENTS.RESIZE, () => {
            this.resize();
        });
    }

    /**
     * チャートを更新する
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        // Dual chart layoutの場合
        if (chartData.layout === 'dual' && chartData.charts) {
            this.updateDualChart(chartData);
            return;
        }
        
        // 従来の単一チャート
        const { type, data, config, visible } = chartData;
        
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
     * Dual チャートを更新する
     * @param {Object} dualChartData - Dual チャートデータ
     */
    updateDualChart(dualChartData) {
        const { charts, visible } = dualChartData;
        
        this.currentChart = 'dual';
        this.dualCharts = charts;

        if (visible) {
            this.show();
            this.renderDualChart(charts);
        } else {
            this.hide();
        }
    }

    /**
     * チャートコンテナを表示
     */
    show() {
        this.container.classed('visible', true);
    }

    /**
     * チャートコンテナを非表示
     */
    hide() {
        this.container.classed('visible', false);
    }

    /**
     * SVG要素を初期化
     */
    initSVG(width, height) {
        this.container.selectAll('*').remove();
        
        this.svg = this.container
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('width', '100%')
            .style('height', '100%');
            
        return this.svg;
    }

    /**
     * レスポンシブなサイズを計算
     * @param {Object} config - 設定
     * @returns {Object} - { width, height }
     */
    getResponsiveSize(config) {
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = containerNode.clientHeight;
        
        // 最大サイズの80%を使用
        const maxWidth = Math.min(containerWidth * 0.8, config.width || 600);
        const maxHeight = Math.min(containerHeight * 0.8, config.height || 400);
        
        // アスペクト比を維持
        const aspectRatio = (config.width || 600) / (config.height || 400);
        
        let width = maxWidth;
        let height = width / aspectRatio;
        
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }
        
        return { width, height };
    }

    /**
     * Dual チャートを描画
     * @param {Array} charts - チャート設定配列
     */
    renderDualChart(charts) {
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = containerNode.clientHeight;
        
        // 全体のSVGサイズを計算
        const totalWidth = Math.min(containerWidth * 0.9, 1000);
        const totalHeight = Math.min(containerHeight * 0.8, 500);
        
        const svg = this.initSVG(totalWidth, totalHeight);
        
        // 各チャートの幅を計算（間隔を含む）
        const chartSpacing = 40;
        const chartWidth = (totalWidth - chartSpacing) / 2;
        const chartHeight = totalHeight - 60; // タイトル分を確保
        
        charts.forEach((chartConfig, index) => {
            const xOffset = index * (chartWidth + chartSpacing);
            this.renderSingleChartInDual(svg, chartConfig, {
                x: xOffset,
                y: 40,
                width: chartWidth,
                height: chartHeight
            });
        });
    }

    /**
     * Dual layout内で単一チャートを描画
     */
    renderSingleChartInDual(svg, chartConfig, layout) {
        const { data, config, title } = chartConfig;
        const { x, y, width, height } = layout;
        
        const margin = config.margin || { top: 20, right: 20, bottom: 40, left: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        // チャートグループを作成
        const chartGroup = svg.append('g')
            .attr('transform', `translate(${x}, ${y})`);
        
        // タイトルを追加
        chartGroup.append('text')
            .attr('x', width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text(title);
        
        // チャート描画エリア
        const g = chartGroup.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);
        
        // 折れ線グラフを描画（他のタイプも後で追加可能）
        this.renderLineChartInGroup(g, data, {
            ...config,
            width: innerWidth,
            height: innerHeight,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });
    }

    /**
     * 指定されたグループ内で折れ線グラフを描画
     */
    renderLineChartInGroup(g, data, config) {
        const { width, height, xField = 'year', yField = 'value', colors = d3.schemeCategory10, multiSeries = true } = config;
        
        // データを系列別に変換
        const series = this.transformToSeries(data, config);
        
        // 全データからドメインを計算
        const allValues = series.flatMap(s => s.values);
        
        // スケール設定
        const isYearData = allValues.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);
        
        const xScale = isYearData 
            ? d3.scaleLinear()
                .domain(d3.extent(allValues, d => +d[xField]))
                .range([0, width])
            : d3.scaleTime()
                .domain(d3.extent(allValues, d => new Date(d[xField])))
                .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(allValues, d => +d[yField]))
            .nice()
            .range([height, 0]);

        // 色スケール設定
        const colorScale = d3.scaleOrdinal(colors)
            .domain(series.map(d => d.name));

        // 軸を描画
        const xAxis = isYearData 
            ? d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(6)
            : d3.axisBottom(xScale).ticks(6);
        const yAxis = d3.axisLeft(yScale).ticks(5);

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

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

        // ラインを描画
        seriesGroups.append('path')
            .attr('class', 'chart-line')
            .attr('d', d => line(d.values))
            .attr('stroke', d => colorScale(d.name))
            .attr('stroke-width', 0)
            .attr('fill', 'none')
            .transition()
            .duration(500)
            .attr('stroke-width', 2);

        // ポイントを描画
        seriesGroups.selectAll('.chart-circle')
            .data(d => d.values.map(v => ({ ...v, seriesName: d.name })))
            .enter()
            .append('circle')
            .attr('class', 'chart-circle')
            .attr('cx', d => isYearData ? xScale(+d[xField]) : xScale(new Date(d[xField])))
            .attr('cy', d => yScale(+d[yField]))
            .attr('r', 0)
            .attr('fill', d => colorScale(d.seriesName))
            .transition()
            .duration(500)
            .delay((d, i) => i * 20)
            .attr('r', 2);

        // レジェンドを追加（小さいサイズ）
        if (series.length > 1) {
            this.addCompactLegend(g, series, colorScale, width, height);
        }
    }

    /**
     * コンパクトなレジェンドを追加
     */
    addCompactLegend(g, series, colorScale, width, height) {
        const legend = g.append('g')
            .attr('class', 'chart-legend')
            .attr('transform', `translate(${width - 140}, 10)`);

        const legendItems = legend.selectAll('.legend-item')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 16})`);

        legendItems.append('circle')
            .attr('cx', 4)
            .attr('cy', 4)
            .attr('r', 3)
            .attr('fill', d => colorScale(d.name));

        legendItems.append('text')
            .attr('x', 12)
            .attr('y', 4)
            .attr('dy', '0.35em')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .text(d => d.name);
    }

    /**
     * チャートを描画
     * @param {string} type - チャートタイプ
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderChart(type, data, config) {
        const { width, height } = this.getResponsiveSize(config);
        const margin = config.margin || { top: 20, right: 20, bottom: 40, left: 40 };
        
        switch (type) {
            case 'line':
                this.renderLineChart(data, { width, height, margin, ...config });
                break;
            case 'bar':
                this.renderBarChart(data, { width, height, margin, ...config });
                break;
            case 'pie':
                this.renderPieChart(data, { width, height, margin, ...config });
                break;
            default:
                console.warn(`Unknown chart type: ${type}`);
        }
    }

    /**
     * データを系列別に変換
     * @param {Array} data - 生データ
     * @param {Object} config - 設定
     * @returns {Array} 系列別データ
     */
    transformToSeries(data, config) {
        const { xField = 'year', yField = 'value', seriesField = 'series' } = config;
        
        if (config.multiSeries === false) {
            // 単一系列として強制的に扱う
            return [{
                name: config.seriesName || 'Data',
                values: data.map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
            }];
        }
        
        // 複数系列の場合
        const seriesNames = [...new Set(data.map(d => d[seriesField]))];
        return seriesNames.map(name => ({
            name,
            values: data
                .filter(d => d[seriesField] === name)
                .map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
        }));
    }

    /**
     * 折れ線グラフを描画
     */
    renderLineChart(data, config) {
        const { 
            width, height, margin, 
            xField = 'year', yField = 'value', 
            colors = d3.schemeCategory10,
            multiSeries = true
        } = config;
        
        const svg = this.initSVG(width, height);
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // データを系列別に変換
        const series = this.transformToSeries(data, config);
        
        // 全データからドメインを計算
        const allValues = series.flatMap(s => s.values);
        
        // スケール設定 - 年データの場合は線形スケールを使用
        const isYearData = allValues.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);
        
        const xScale = isYearData 
            ? d3.scaleLinear()
                .domain(d3.extent(allValues, d => +d[xField]))
                .range([0, innerWidth])
            : d3.scaleTime()
                .domain(d3.extent(allValues, d => new Date(d[xField])))
                .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(allValues, d => +d[yField]))
            .nice()
            .range([innerHeight, 0]);

        // 色スケール設定
        const colorScale = d3.scaleOrdinal(colors)
            .domain(series.map(d => d.name));

        // 軸を描画
        const xAxis = isYearData 
            ? d3.axisBottom(xScale).tickFormat(d3.format("d"))  // 年データは整数表示
            : d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

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

        // ラインを描画
        seriesGroups.append('path')
            .attr('class', 'chart-line')
            .attr('d', d => line(d.values))
            .attr('stroke', d => colorScale(d.name))
            .attr('stroke-width', 0)
            .attr('fill', 'none')
            .transition()
            .duration(500)
            .attr('stroke-width', 2);

        // ポイントを描画
        seriesGroups.selectAll('.chart-circle')
            .data(d => d.values.map(v => ({ ...v, seriesName: d.name })))
            .enter()
            .append('circle')
            .attr('class', 'chart-circle')
            .attr('cx', d => isYearData ? xScale(+d[xField]) : xScale(new Date(d[xField])))
            .attr('cy', d => yScale(+d[yField]))
            .attr('r', 0)
            .attr('fill', d => colorScale(d.seriesName))
            .transition()
            .duration(500)
            .delay((d, i) => i * 30)
            .attr('r', 3);

        // レジェンドを追加（複数系列の場合のみ）
        if (series.length > 1) {
            this.addLegend(svg, series, colorScale, width, height);
        }
    }

    /**
     * レジェンドを追加
     */
    addLegend(svg, series, colorScale, width, height) {
        const legend = svg.append('g')
            .attr('class', 'chart-legend')
            .attr('transform', `translate(${width - 120}, 20)`);

        const legendItems = legend.selectAll('.legend-item')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`);

        legendItems.append('circle')
            .attr('cx', 6)
            .attr('cy', 6)
            .attr('r', 5)
            .attr('fill', d => colorScale(d.name));

        legendItems.append('text')
            .attr('x', 16)
            .attr('y', 6)
            .attr('dy', '0.35em')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(d => d.name);
    }

    /**
     * 棒グラフを描画
     */
    renderBarChart(data, config) {
        const { width, height, margin, xField = 'category', yField = 'value', color = '#10b981' } = config;
        
        const svg = this.initSVG(width, height);
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // スケール設定
        const xScale = d3.scaleBand()
            .domain(data.map(d => d[xField]))
            .range([0, innerWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => +d[yField])])
            .nice()
            .range([innerHeight, 0]);

        // 軸を描画
        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(d3.axisLeft(yScale));

        // 棒を描画
        g.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d[xField]))
            .attr('y', innerHeight)
            .attr('width', xScale.bandwidth())
            .attr('height', 0)
            .attr('fill', color)
            .transition()
            .duration(500)
            .delay((d, i) => i * 100)
            .attr('y', d => yScale(+d[yField]))
            .attr('height', d => innerHeight - yScale(+d[yField]));
    }

    /**
     * 円グラフを描画
     */
    renderPieChart(data, config) {
        const { width, height, labelField = 'label', valueField = 'value', colors = d3.schemeCategory10 } = config;
        
        const svg = this.initSVG(width, height);
        const radius = Math.min(width, height) / 2 - 40;
        
        const g = svg.append('g')
            .attr('transform', `translate(${width/2},${height/2})`);

        const pie = d3.pie()
            .value(d => +d[valueField])
            .sort(null);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        const arcs = g.selectAll('.pie-slice')
            .data(pie(data))
            .enter()
            .append('g')
            .attr('class', 'pie-slice');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => colors[i % colors.length])
            .transition()
            .duration(500)
            .delay((d, i) => i * 100)
            .attrTween('d', function(d) {
                const interpolate = d3.interpolate({startAngle: 0, endAngle: 0}, d);
                return function(t) {
                    return arc(interpolate(t));
                };
            });

        // ラベルを追加
        arcs.append('text')
            .attr('transform', d => `translate(${arc.centroid(d)})`)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', 'white')
            .text(d => d.data[labelField])
            .style('opacity', 0)
            .transition()
            .duration(500)
            .delay(500)
            .style('opacity', 1);
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