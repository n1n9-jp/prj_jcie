class ChartManager {
    constructor() {
        this.margins = { top: 40, right: 60, bottom: 60, left: 60 };
        this.width = 800 - this.margins.left - this.margins.right;
        this.height = 500 - this.margins.top - this.margins.bottom;
        this.svg = null;
        this.currentChart = null;
    }

    // チャートの初期化
    initializeCharts() {
        // SVGの作成
        this.svg = d3.select('#mainFigure')
            .append('svg')
            .attr('width', this.width + this.margins.left + this.margins.right)
            .attr('height', this.height + this.margins.top + this.margins.bottom)
            .append('g')
            .attr('transform', `translate(${this.margins.left},${this.margins.top})`);

        // 背景の追加
        this.svg.append('rect')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', '#f8f9fa');
    }

    // 折れ線グラフの描画
    async drawLineChart(data, title) {
        if (this.currentChart) {
            // 既存のチャートをフェードアウト
            this.svg.selectAll('*')
                .transition()
                .duration(500)
                .style('opacity', 0)
                .remove();
        }

        // データの整形
        const years = Object.keys(data[0]).filter(key => !isNaN(key) && key !== '地域名');
        const regions = data.map(d => d['地域名']);

        // スケールの設定
        const x = d3.scalePoint()
            .domain(years)
            .range([0, this.width]);

        // 最大値の計算（NaNを除外）
        const maxValue = d3.max(data, d => 
            d3.max(years, year => {
                const value = +d[year];
                return isNaN(value) ? 0 : value;
            })
        );

        const y = d3.scaleLinear()
            .domain([0, maxValue])
            .range([this.height, 0]);

        // 色スケール
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // 線の生成
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
            .defined(d => !isNaN(d.value)); // NaNの値を除外

        // 軸の描画
        this.svg.append('g')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');

        this.svg.append('g')
            .call(d3.axisLeft(y));

        // タイトルの追加
        this.svg.append('text')
            .attr('x', this.width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .text(title);

        // 各地域の線を描画
        regions.forEach(region => {
            const regionData = years.map(year => ({
                year: year,
                value: +data.find(d => d['地域名'] === region)[year] || 0
            }));

            this.svg.append('path')
                .datum(regionData)
                .attr('fill', 'none')
                .attr('stroke', color(region))
                .attr('stroke-width', 2)
                .attr('d', line)
                .style('opacity', 0)
                .transition()
                .duration(1000)
                .style('opacity', 1);
        });

        // 凡例の追加
        const legend = this.svg.append('g')
            .attr('transform', `translate(${this.width - 100}, 0)`);

        regions.forEach((region, i) => {
            legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`)
                .call(g => g.append('rect')
                    .attr('width', 10)
                    .attr('height', 10)
                    .attr('fill', color(region)))
                .call(g => g.append('text')
                    .attr('x', 15)
                    .attr('y', 10)
                    .text(region)
                    .style('font-size', '10px'));
        });

        this.currentChart = 'line';
    }

    // 円グラフの描画
    async drawPieCharts(data) {
        if (this.currentChart) {
            this.svg.selectAll('*')
                .transition()
                .duration(500)
                .style('opacity', 0)
                .remove();
        }

        const radius = Math.min(this.width, this.height) / 3;
        const pie = d3.pie()
            .value(d => parseFloat(d['抗HIV治療を受けているHIV陽性者の割合(合計)'].replace('%', '')));

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // データの整形
        const chartData = data.filter(d => d[''] !== '全世界');

        // 円グラフの描画
        const pieGroup = this.svg.append('g')
            .attr('transform', `translate(${this.width / 2},${this.height / 2})`);

        const paths = pieGroup.selectAll('path')
            .data(pie(chartData))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => color(i))
            .style('opacity', 0)
            .transition()
            .duration(1000)
            .style('opacity', 1);

        // ラベルの追加
        pieGroup.selectAll('text')
            .data(pie(chartData))
            .enter()
            .append('text')
            .attr('transform', d => `translate(${arc.centroid(d)})`)
            .attr('dy', '.35em')
            .text(d => d.data[''])
            .style('font-size', '12px')
            .style('text-anchor', 'middle')
            .style('opacity', 0)
            .transition()
            .duration(1000)
            .style('opacity', 1);
            
        // 円グラフの凡例
        const legendPie = this.svg.append('g')
            .attr('transform', `translate(${this.width - 100}, 0)`);
        
        chartData.forEach((d, i) => {
            legendPie.append('g')
                .attr('transform', `translate(0, ${i * 20})`)
                .call(g => g.append('circle')
                    .attr('r', 5)
                    .attr('cy', 5)
                    .attr('fill', color(i)))
                .call(g => g.append('text')
                    .attr('x', 15)
                    .attr('y', 10)
                    .text(d[''])
                    .style('font-size', '10px'));
        });

        this.currentChart = 'pie';
    }
} 