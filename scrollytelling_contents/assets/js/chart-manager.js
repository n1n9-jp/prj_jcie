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
     * チャートを描画
     * @param {string} type - チャートタイプ
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderChart(type, data, config) {
        const { width = 600, height = 400, margin = { top: 20, right: 20, bottom: 40, left: 40 } } = config;
        
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
     * 折れ線グラフを描画
     */
    renderLineChart(data, config) {
        const { width, height, margin, xField = 'x', yField = 'y', color = '#3b82f6' } = config;
        
        const svg = this.initSVG(width, height);
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // スケール設定
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => new Date(d[xField])))
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[yField]))
            .nice()
            .range([innerHeight, 0]);

        // 軸を描画
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

        // ラインを描画
        const line = d3.line()
            .x(d => xScale(new Date(d[xField])))
            .y(d => yScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        const path = g.append('path')
            .datum(data)
            .attr('class', 'chart-line')
            .attr('d', line)
            .attr('stroke', color)
            .attr('stroke-width', 0)
            .transition()
            .duration(500)
            .attr('stroke-width', 2);

        // ポイントを描画
        g.selectAll('.chart-circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'chart-circle')
            .attr('cx', d => xScale(new Date(d[xField])))
            .attr('cy', d => yScale(+d[yField]))
            .attr('r', 0)
            .attr('fill', color)
            .transition()
            .duration(500)
            .delay((d, i) => i * 50)
            .attr('r', 4);
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