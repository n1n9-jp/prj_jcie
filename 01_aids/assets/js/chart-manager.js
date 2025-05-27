class ChartManager {
    constructor() {
        // 固定の内部座標系
        this.viewBox = {
            width: 960,
            height: 400
        };
        
        // アスペクト比
        this.aspectRatio = 16/9;
        
        // マージン（内部座標系に対する相対値）
        this.margins = {
            top: 40,
            right: 100,
            bottom: 80,
            left: 80
        };

        // 内部座標系での実際の描画領域
        this.width = this.viewBox.width - this.margins.left - this.margins.right;
        this.height = this.viewBox.height - this.margins.top - this.margins.bottom;
        
        // 複数のSVGコンテナを管理
        this.svgContainers = new Map();
        this.resizeObservers = new Map();
        this.currentChart = null;
        this.currentContainerId = null;
        this.defaultContainerId = 'mainFigure';
    }

    // チャートの初期化（デフォルトコンテナ用）
    initializeCharts(containerId = this.defaultContainerId) {
        this.createSvgContainer(containerId);
    }

    // SVGコンテナの作成
    createSvgContainer(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with id '${containerId}' not found`);
            return null;
        }

        // 既存のSVGがあれば削除
        if (this.svgContainers.has(containerId)) {
            this.removeSvgContainer(containerId);
        }

        // SVGの作成と基本設定
        const svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('viewBox', `0 0 ${this.viewBox.width} ${this.viewBox.height}`)
            .attr('preserveAspectRatio', 'xMidYMid');

        // 背景の追加
        svg.append('rect')
            .attr('width', this.viewBox.width)
            .attr('height', this.viewBox.height)
            .attr('fill', '#f8f9fa');

        // コンテナを保存
        this.svgContainers.set(containerId, svg);

        // ResizeObserverの設定
        this.setupResizeObserver(containerId);

        return svg;
    }

    // 特定のコンテナのSVGを取得（なければ作成）
    getSvgContainer(containerId = this.defaultContainerId) {
        if (!this.svgContainers.has(containerId)) {
            return this.createSvgContainer(containerId);
        }
        return this.svgContainers.get(containerId);
    }

    // SVGコンテナの削除
    removeSvgContainer(containerId) {
        const svg = this.svgContainers.get(containerId);
        if (svg) {
            svg.remove();
            this.svgContainers.delete(containerId);
        }

        const observer = this.resizeObservers.get(containerId);
        if (observer) {
            observer.disconnect();
            this.resizeObservers.delete(containerId);
        }
    }

    // ResizeObserverの設定
    setupResizeObserver(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const resizeObserver = new ResizeObserver(this.debounce(() => {
            this.handleResize(containerId);
        }, 250));

        resizeObserver.observe(container);
        this.resizeObservers.set(containerId, resizeObserver);
    }

    // デバウンス関数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // リサイズ処理
    handleResize(containerId) {
        const svg = this.svgContainers.get(containerId);
        if (!svg) return;

        const container = d3.select(`#${containerId}`);
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = containerWidth / this.aspectRatio;

        // SVGのサイズをコンテナに合わせて更新
        svg
            .attr('width', containerWidth)
            .attr('height', containerHeight);

        // 現在のチャートを再描画（該当コンテナの場合のみ）
        if (this.currentChart && this.currentContainerId === containerId) {
            this.redrawCurrentChart();
        }
    }

    // 現在のチャートを再描画
    redrawCurrentChart() {
        if (this.currentChart === 'line') {
            // 折れ線グラフの再描画
            this.redrawLineChart();
        } else if (this.currentChart === 'pie') {
            // 円グラフの再描画
            this.redrawPieChart();
        } else if (this.currentChart === 'dual-line') {
            // 2つの折れ線グラフの再描画
            this.redrawDualLineChart();
        }
    }

    // 折れ線グラフの描画
    async drawLineChart(data, title, containerId = this.defaultContainerId) {
        // SVGコンテナを取得または作成
        const svg = this.getSvgContainer(containerId);
        if (!svg) return;

        // 現在のチャート情報を更新
        this.currentContainerId = containerId;

        // 既存のチャートをフェードアウト
        svg.selectAll('*:not(rect:first-child)')
            .transition()
            .duration(500)
            .style('opacity', 0)
            .remove();

        // データの整形
        const years = Object.keys(data[0]).filter(key => !isNaN(key) && key !== '地域名');
        const regions = data.map(d => d['地域名']);

        // スケールの設定
        const x = d3.scalePoint()
            .domain(years)
            .range([0, this.width]);

        // 最大値の計算
        const maxValue = d3.max(data, d => 
            d3.max(years, year => {
                const value = +d[year];
                return isNaN(value) ? 0 : value;
            })
        );

        const y = d3.scaleLinear()
            .domain([0, maxValue])
            .range([this.height, 0]);

        // カラースケール
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // 線の生成
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
            .defined(d => !isNaN(d.value));

        // グラフの描画グループを作成
        const chartGroup = svg.append('g')
            .attr('transform', `translate(${this.margins.left},${this.margins.top})`);

        // X軸の描画
        const xAxis = chartGroup.append('g')
            .attr('transform', `translate(0,${this.height})`)
            .call(d3.axisBottom(x));

        // X軸のラベルを回転
        xAxis.selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em');

        // Y軸の描画
        const yAxis = chartGroup.append('g')
            .call(d3.axisLeft(y));

        // Y軸のラベルを追加（資金不足データの場合）
        if (title === 'エイズ対策の資金不足の推移') {
            chartGroup.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -this.margins.left + 20)
                .attr('x', -(this.height / 2))
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .text('金額（10億ドル）');
        }

        // タイトルの追加
        svg.append('text')
            .attr('x', this.viewBox.width / 2)
            .attr('y', this.margins.top / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '18px')
            .style('font-weight', 'bold')
            .text(title);

        // 各地域の線を描画
        regions.forEach(region => {
            const regionData = years.map(year => ({
                year: year,
                value: +data.find(d => d['地域名'] === region)[year] || 0
            }));

            chartGroup.append('path')
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
        const legend = svg.append('g')
            .attr('transform', `translate(${this.viewBox.width - this.margins.right - 150},${this.margins.top})`);

        regions.forEach((region, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);
            
            // 凡例の線
            legendItem.append('line')
                .attr('x1', 0)
                .attr('x2', 20)
                .attr('y1', 5)
                .attr('y2', 5)
                .attr('stroke', color(region))
                .attr('stroke-width', 2);
            
            // 凡例のテキスト
            legendItem.append('text')
                .attr('x', 25)
                .attr('y', 5)
                .attr('dy', '0.32em')
                .text(region)
                .style('font-size', '11px');
        });

        this.currentChart = 'line';
        // 再描画用にデータを保存
        this.currentData = data;
        this.currentTitle = title;
    }

    // 2つの折れ線グラフを横並びに描画
    async drawDualLineCharts(data1, title1, data2, title2, containerId = this.defaultContainerId) {
        // SVGコンテナを取得または作成
        const svg = this.getSvgContainer(containerId);
        if (!svg) return;

        // 現在のチャート情報を更新
        this.currentContainerId = containerId;

        // 既存のチャートをフェードアウト
        svg.selectAll('*:not(rect:first-child)')
            .transition()
            .duration(500)
            .style('opacity', 0)
            .remove();

        // 各グラフの幅を計算（中央にスペースを設ける）
        const chartWidth = (this.width - 40) / 2; // 40pxの中央スペース
        const chartHeight = this.height;

        // 左側のグラフグループ
        const leftGroup = svg.append('g')
            .attr('transform', `translate(${this.margins.left},${this.margins.top})`);

        // 右側のグラフグループ
        const rightGroup = svg.append('g')
            .attr('transform', `translate(${this.margins.left + chartWidth + 40},${this.margins.top})`);

        // カラースケール（共通）
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // 左側のグラフを描画
        this.drawLineChartInGroup(data1, title1, leftGroup, chartWidth, chartHeight, color);

        // 右側のグラフを描画
        this.drawLineChartInGroup(data2, title2, rightGroup, chartWidth, chartHeight, color);

        this.currentChart = 'dual-line';
        // 再描画用にデータを保存
        this.currentData = { data1, data2 };
        this.currentTitle = { title1, title2 };
    }

    // グループ内に折れ線グラフを描画（ヘルパーメソッド）
    drawLineChartInGroup(data, title, group, width, height, color) {
        // データの整形
        const years = Object.keys(data[0]).filter(key => !isNaN(key) && key !== '地域名');
        const regions = data.map(d => d['地域名']);

        // グラフエリアの高さを調整（凡例のスペースを確保）
        const graphHeight = height - 80; // 凡例用のスペース

        // スケールの設定
        const x = d3.scalePoint()
            .domain(years)
            .range([0, width]);

        // 最大値の計算
        const maxValue = d3.max(data, d => 
            d3.max(years, year => {
                const value = +d[year];
                return isNaN(value) ? 0 : value;
            })
        );

        const y = d3.scaleLinear()
            .domain([0, maxValue * 1.1])
            .range([graphHeight, 0]);

        // ラインジェネレーター
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
            .defined(d => !isNaN(d.value));

        // X軸の描画
        group.append('g')
            .attr('transform', `translate(0,${graphHeight})`)
            .call(d3.axisBottom(x).tickValues(x.domain().filter((d, i) => i % 5 === 0)))
            .style('font-size', '10px');

        // Y軸の描画
        group.append('g')
            .call(d3.axisLeft(y).ticks(5))
            .style('font-size', '10px');

        // タイトルの追加
        group.append('text')
            .attr('x', width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .text(title);

        // 各地域の線を描画
        regions.forEach((region, i) => {
            const regionData = years.map(year => ({
                year: year,
                value: +data[i][year]
            }));

            group.append('path')
                .datum(regionData)
                .attr('fill', 'none')
                .attr('stroke', color(i))
                .attr('stroke-width', 2)
                .attr('d', line)
                .style('opacity', 0)
                .transition()
                .duration(1000)
                .style('opacity', 1);
        });

        // 凡例を各グラフの下部に追加
        const legendGroup = group.append('g')
            .attr('transform', `translate(10,${graphHeight + 50})`); // 左寄せに変更

        const legendItemWidth = Math.min(100, width / regions.length); // 動的な幅計算

        regions.forEach((region, i) => {
            const legendItem = legendGroup.append('g')
                .attr('transform', `translate(${i * legendItemWidth}, 0)`);

            // 凡例の線
            legendItem.append('line')
                .attr('x1', 0)
                .attr('x2', 15)
                .attr('y1', 5)
                .attr('y2', 5)
                .attr('stroke', color(i))
                .attr('stroke-width', 2);

            // 凡例のテキスト
            legendItem.append('text')
                .attr('x', 18)
                .attr('y', 5)
                .attr('dy', '0.32em')
                .style('font-size', '10px')
                .text(region);
        });
    }

    // 円グラフの描画
    async drawPieCharts(data, containerId = this.defaultContainerId) {
        // SVGコンテナを取得または作成
        const svg = this.getSvgContainer(containerId);
        if (!svg) return;

        // 現在のチャート情報を更新
        this.currentContainerId = containerId;

        // 既存のチャートをフェードアウト
        svg.selectAll('*:not(rect:first-child)')
            .transition()
            .duration(500)
            .style('opacity', 0)
            .remove();

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
        const pieGroup = svg.append('g')
            .attr('transform', `translate(${this.viewBox.width / 2},${this.viewBox.height / 2})`);

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
        const legendPie = svg.append('g')
            .attr('transform', `translate(${this.viewBox.width - this.margins.right - 100},${this.margins.top})`);
        
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
        // 再描画用にデータを保存
        this.currentData = data;
    }

    // 折れ線グラフの再描画
    redrawLineChart() {
        // 現在のデータを保持
        const currentData = this.currentData;
        const currentTitle = this.currentTitle;
        if (currentData && currentTitle) {
            this.drawLineChart(currentData, currentTitle);
        }
    }

    // 円グラフの再描画
    redrawPieChart() {
        // 現在のデータで円グラフを再描画
        if (this.currentData) {
            this.drawPieCharts(this.currentData, this.currentContainerId);
        }
    }

    // 2つの折れ線グラフの再描画
    redrawDualLineChart() {
        // 現在のデータを保持
        const currentData = this.currentData;
        const currentTitle = this.currentTitle;
        if (currentData && currentTitle) {
            this.drawDualLineCharts(currentData.data1, currentTitle.title1, currentData.data2, currentTitle.title2);
        }
    }

    // 特定のコンテナのチャートをクリア
    clearChart(containerId = this.currentContainerId) {
        if (!containerId) return;
        
        const svg = this.svgContainers.get(containerId);
        if (svg) {
            svg.selectAll('*:not(rect:first-child)')
                .transition()
                .duration(500)
                .style('opacity', 0)
                .on('end', function() {
                    d3.select(this).remove();
                });
        }
        
        // 現在のチャート情報をクリア（該当コンテナの場合）
        if (this.currentContainerId === containerId) {
            this.currentChart = null;
            this.currentContainerId = null;
            this.currentData = null;
            this.currentTitle = null;
        }
    }

    // すべてのチャートをクリア
    clearAllCharts() {
        this.svgContainers.forEach((svg, containerId) => {
            this.clearChart(containerId);
        });
    }

    // クリーンアップ
    cleanup() {
        // すべてのResizeObserverを切断
        this.resizeObservers.forEach(observer => {
            observer.disconnect();
        });
        this.resizeObservers.clear();

        // すべてのSVGコンテナを削除
        this.svgContainers.forEach(svg => {
            svg.remove();
        });
        this.svgContainers.clear();
    }
}