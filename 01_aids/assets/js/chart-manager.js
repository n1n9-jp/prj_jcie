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
        this.defaultContainerId = 'smallFigure';
    }

    // 統一された凡例を描画するメソッド
    drawLegend(container, items, colorScale, options = {}) {
        // 項目が1つ以下の場合は凡例を描画しない
        if (!items || items.length <= 1) {
            return null;
        }

        const {
            x = 10,
            y = 10,
            itemHeight = 20,
            rectSize = 12,
            spacing = 5,
            fontSize = '11px',
            orientation = 'vertical' // 'vertical' or 'horizontal'
        } = options;

        const legendGroup = container.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${x}, ${y})`);

        items.forEach((item, i) => {
            const legendItem = legendGroup.append('g')
                .attr('class', 'legend-item')
                .attr('transform', orientation === 'vertical' 
                    ? `translate(0, ${i * itemHeight})`
                    : `translate(${i * 150}, 0)`);

            // 色付きの正方形
            legendItem.append('rect')
                .attr('x', 0)
                .attr('y', -rectSize/2)
                .attr('width', rectSize)
                .attr('height', rectSize)
                .attr('fill', colorScale(item))
                .attr('stroke', 'none');

            // テキストラベル
            legendItem.append('text')
                .attr('x', rectSize + spacing)
                .attr('y', 0)
                .attr('dy', '0.32em')
                .style('font-size', fontSize)
                .style('font-family', 'sans-serif')
                .text(item);
        });

        return legendGroup;
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

        // タイトルに基づいてY軸の範囲を設定
        let yDomain = [0, maxValue];
        if (title === '母子感染の推移') {
            // 母子感染の推移の場合は0-22の範囲に設定
            yDomain = [0, 22];
        }

        const y = d3.scaleLinear()
            .domain(yDomain)
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

        // Y軸のラベルを追加（チャートに応じて適切なラベルを設定）
        let yAxisLabel = '';
        
        if (title === 'エイズ対策の資金不足の推移') {
            yAxisLabel = '金額（ドル）';
        } else if (title === '新規感染者数の推移') {
            yAxisLabel = '感染者数（人）';
        } else if (title === 'エイズ関連死亡者数の推移') {
            yAxisLabel = '死亡者数（人）';
        } else if (title === '母子感染の推移') {
            yAxisLabel = '母子感染率（％）';
        } else if (title === '抗レトロウイルス療法を受けている感染者の割合' || title === '抗レトロウイルス療法を受けている感染者の割合の推移') {
            yAxisLabel = '割合（％）';
        } else if (title === 'PrEPを受けている人の数の推移') {
            yAxisLabel = '人数（人）';
        }
        
        // ラベルが定義されていれば表示
        if (yAxisLabel) {
            chartGroup.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -this.margins.left + 20)
                .attr('x', -(this.height / 2))
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .text(yAxisLabel);
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

        // 凡例の追加（統一されたメソッドを使用）
            this.drawLegend(svg, regions, color, {
                x: this.viewBox.width - this.margins.right - 150,
                y: this.margins.top,
                orientation: 'vertical'
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

        // 共通の凡例を下部に配置（2行に分けて表示）
        const regions = data1.map(d => d['地域名']);
        
        // 各行の項目数を調整
        // 長いラベルがあるため、1行目には少なめに配置
        const firstRowCount = 4; // 1行目の項目数
        
        // 1行目の凡例
        this.drawLegend(svg, regions.slice(0, firstRowCount), color, {
            x: this.margins.left + 20, // 左寄せ
            y: this.viewBox.height - this.margins.bottom + 10, // 下部に配置
            orientation: 'horizontal',
            fontSize: '11px'
        });
        
        // 2行目の凡例
        this.drawLegend(svg, regions.slice(firstRowCount), color, {
            x: this.margins.left + 20, // 左寄せ
            y: this.viewBox.height - this.margins.bottom + 50, // 1行目の下に配置（間隔を広げる）
            orientation: 'horizontal',
            fontSize: '11px'
        });

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
            
        // Y軸のラベルを追加
        group.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -40) // 左余白を考慮した位置
            .attr('x', -graphHeight / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .text('新規感染者数（人）');

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

        // 注：個別の凡例は削除し、共通凡例をdrawDualLineChartsで描画
    }

    // 円グラフの描画
    async drawPieCharts(data, title = '', containerId = this.defaultContainerId) {
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

        // タイトルの追加
        if (title) {
            svg.append('text')
                .attr('x', this.viewBox.width / 2)
                .attr('y', this.margins.top / 2)
                .attr('text-anchor', 'middle')
                .style('font-size', '16px')
                .style('font-weight', 'bold')
                .text(title);
        }

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
        this.drawLegend(svg, chartData.map(d => d['']), color, {
            x: this.viewBox.width - this.margins.right - 150,
            y: this.margins.top,
            orientation: 'vertical'
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