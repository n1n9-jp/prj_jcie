class ChartManager {
    constructor() {
        // アスペクト比
        this.aspectRatio = 16/9;
        
        // マージン（相対値: パーセンテージ）
        this.margins = {
            top: 0.08,    // 8%
            right: 0.12,  // 12% 
            bottom: 0.15, // 15%
            left: 0.12    // 12%
        };
        
        // 動的サイズ計算用
        this.currentContainerSize = {
            width: 800,  // デフォルト値
            height: 450  // デフォルト値
        };
        
        // 単一SVGコンテナを管理
        this.svgContainer = null;
        this.resizeObserver = null;
        this.defaultContainerId = 'smallFigure';
        
        // チャート状態管理
        this.currentChart = null;
        this.currentData = null;
        this.currentTitle = null;
        this.isTransitioning = false;
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

    // チャートの初期化（単一コンテナ用）
    initializeCharts() {
        console.log('ChartManager: Initializing charts');
        const result = this.createSvgContainer();
        console.log('ChartManager: SVG container created:', !!result);
        return result;
    }

    // SVGコンテナの作成
    createSvgContainer() {
        console.log(`ChartManager: Looking for container: ${this.defaultContainerId}`);
        const container = document.getElementById(this.defaultContainerId);
        if (!container) {
            console.error(`Container with id '${this.defaultContainerId}' not found`);
            return null;
        }
        console.log('ChartManager: Container found:', container);

        // 既存のSVGがあれば削除
        if (this.svgContainer) {
            this.removeSvgContainer();
        }

        // 初期サイズを計算
        const containerRect = container.getBoundingClientRect();
        let containerWidth = containerRect.width || 800; // フォールバック値
        let containerHeight = containerWidth / this.aspectRatio;
        
        // large-modeの場合は画面サイズを基準にする
        if (container.classList.contains('large-mode')) {
            containerWidth = Math.min(window.innerWidth - 80, containerWidth); // 左右40pxずつの余白
            containerHeight = containerWidth / this.aspectRatio;
        }
        
        // 現在のコンテナサイズを保存
        this.currentContainerSize = {
            width: containerWidth,
            height: containerHeight
        };
        
        console.log(`ChartManager: Container size: ${containerWidth}x${containerHeight}`);

        // SVGの作成（viewBoxを動的に設定）
        const svg = d3.select(`#${this.defaultContainerId}`)
            .append('svg')
            .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid')
            .attr('width', containerWidth)
            .attr('height', containerHeight);
            
        console.log(`ChartManager: SVG created with size: ${containerWidth}x${containerHeight}`);

        // 背景の追加
        svg.append('rect')
            .attr('width', containerWidth)
            .attr('height', containerHeight)
            .attr('fill', '#f8f9fa');

        // コンテナを保存
        this.svgContainer = svg;

        // ResizeObserverの設定
        this.setupResizeObserver();

        return svg;
    }

    // SVGコンテナを取得（なければ作成）
    getSvgContainer() {
        if (!this.svgContainer) {
            return this.createSvgContainer();
        }
        return this.svgContainer;
    }

    // SVGコンテナの削除
    removeSvgContainer() {
        if (this.svgContainer) {
            this.svgContainer.remove();
            this.svgContainer = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    // ResizeObserverの設定
    setupResizeObserver() {
        const container = document.getElementById(this.defaultContainerId);
        if (!container) return;

        this.resizeObserver = new ResizeObserver(this.debounce(() => {
            this.handleResize();
        }, 250));

        this.resizeObserver.observe(container);
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
    handleResize() {
        if (!this.svgContainer) return;

        const container = d3.select(`#${this.defaultContainerId}`);
        const containerNode = container.node();
        if (!containerNode) {
            console.warn('ChartManager: Container not found during resize');
            return;
        }
        
        let containerWidth = containerNode.getBoundingClientRect().width;
        let containerHeight = containerWidth / this.aspectRatio;
        
        // large-modeの場合は画面サイズを基準にする
        if (containerNode.classList.contains('large-mode')) {
            containerWidth = Math.min(window.innerWidth - 80, containerWidth);
            containerHeight = containerWidth / this.aspectRatio;
        }
        
        // サイズが変更された場合のみ更新
        if (Math.abs(this.currentContainerSize.width - containerWidth) > 10) {
            this.currentContainerSize = {
                width: containerWidth,
                height: containerHeight
            };

            console.log(`ChartManager: Resizing SVG to ${containerWidth}x${containerHeight}`);

            // SVGのサイズとviewBoxを更新
            this.svgContainer
                .attr('width', containerWidth)
                .attr('height', containerHeight)
                .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`);
                
            // 背景のサイズも更新
            this.svgContainer.select('rect:first-child')
                .attr('width', containerWidth)
                .attr('height', containerHeight);

            // 現在のチャートを再描画
            if (this.currentChart && !this.isTransitioning) {
                console.log('ChartManager: Redrawing chart due to resize');
                this.redrawCurrentChart();
            }
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

    // 折れ線グラフの描画（スムーズ遷移対応）
    async drawLineChart(data, title) {
        console.log(`ChartManager: drawLineChart called with title: ${title}`);
        console.log('ChartManager: Data:', data);
        
        if (this.isTransitioning) {
            console.log('ChartManager: Already transitioning, skipping');
            return;
        }
        this.isTransitioning = true;
        
        try {
            // SVGコンテナを取得または作成
            const svg = this.getSvgContainer();
            if (!svg) {
                console.error('ChartManager: Failed to get SVG container');
                this.isTransitioning = false;
                return;
            }
            console.log('ChartManager: SVG container ready:', svg);

        // 既存のチャートをフェードアウト
        const existingElements = svg.selectAll('*:not(rect:first-child)');
        if (!existingElements.empty()) {
            const fadeOutPromise = new Promise(resolve => {
                let completed = 0;
                const total = existingElements.size();
                
                existingElements
                    .transition()
                    .duration(300)
                    .style('opacity', 0)
                    .on('end', () => {
                        completed++;
                        if (completed === total) {
                            svg.selectAll('*:not(rect:first-child)').remove();
                            resolve();
                        }
                    });
            });
            await fadeOutPromise;
        } else {
            svg.selectAll('*:not(rect:first-child)').remove();
        }

        // 動的マージンとサイズ計算
        const marginTop = this.currentContainerSize.height * this.margins.top;
        const marginRight = this.currentContainerSize.width * this.margins.right;
        const marginBottom = this.currentContainerSize.height * this.margins.bottom;
        const marginLeft = this.currentContainerSize.width * this.margins.left;
        
        const chartWidth = this.currentContainerSize.width - marginLeft - marginRight;
        const chartHeight = this.currentContainerSize.height - marginTop - marginBottom;
        
        console.log(`ChartManager: Chart area: ${chartWidth}x${chartHeight} (margins: ${marginLeft}, ${marginTop}, ${marginRight}, ${marginBottom})`);

        // データの整形
        const years = Object.keys(data[0]).filter(key => !isNaN(key) && key !== '地域名');
        const regions = data.map(d => d['地域名']);

        // スケールの設定
        const x = d3.scalePoint()
            .domain(years)
            .range([0, chartWidth]);

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
            .range([chartHeight, 0]);

        // カラースケール
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // 線の生成
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
            .defined(d => !isNaN(d.value));

        // グラフの描画グループを作成
        const chartGroup = svg.append('g')
            .attr('transform', `translate(${marginLeft},${marginTop})`);

        // X軸の描画
        const xAxis = chartGroup.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
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
                .attr('y', -marginLeft + 20)
                .attr('x', -(chartHeight / 2))
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .text(yAxisLabel);
        }

        // タイトルの追加
        svg.append('text')
            .attr('x', this.currentContainerSize.width / 2)
            .attr('y', marginTop / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', Math.max(14, this.currentContainerSize.width * 0.02) + 'px')
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
                x: this.currentContainerSize.width - marginRight - Math.min(150, this.currentContainerSize.width * 0.2),
                y: marginTop,
                orientation: 'vertical'
            });

            this.currentChart = 'line';
            this.currentData = data;
            this.currentTitle = title;
            console.log('ChartManager: Line chart drawn successfully');
        } catch (error) {
            console.error('Error in drawLineChart:', error);
        } finally {
            this.isTransitioning = false;
        }
    }

    // 2つの折れ線グラフを横並びに描画（スムーズ遷移対応）
    async drawDualLineCharts(data1, title1, data2, title2) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        try {
            // SVGコンテナを取得または作成
            const svg = this.getSvgContainer();
            if (!svg) {
                this.isTransitioning = false;
                return;
            }

        // 既存のチャートをフェードアウト
        const existingElements = svg.selectAll('*:not(rect:first-child)');
        if (!existingElements.empty()) {
            const fadeOutPromise = new Promise(resolve => {
                existingElements
                    .transition()
                    .duration(300)
                    .style('opacity', 0)
                    .on('end', () => {
                        svg.selectAll('*:not(rect:first-child)').remove();
                        resolve();
                    });
            });
            await fadeOutPromise;
        } else {
            svg.selectAll('*:not(rect:first-child)').remove();
        }

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
            this.currentData = { data1, data2 };
            this.currentTitle = { title1, title2 };
        } catch (error) {
            console.error('Error in drawDualLineCharts:', error);
        } finally {
            this.isTransitioning = false;
        }
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

    // 円グラフの描画（スムーズ遷移対応）
    async drawPieCharts(data, title = '') {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        try {
            // SVGコンテナを取得または作成
            const svg = this.getSvgContainer();
            if (!svg) {
                this.isTransitioning = false;
                return;
            }

        // 既存のチャートをフェードアウト
        const existingElements = svg.selectAll('*:not(rect:first-child)');
        if (!existingElements.empty()) {
            const fadeOutPromise = new Promise(resolve => {
                existingElements
                    .transition()
                    .duration(300)
                    .style('opacity', 0)
                    .on('end', () => {
                        svg.selectAll('*:not(rect:first-child)').remove();
                        resolve();
                    });
            });
            await fadeOutPromise;
        } else {
            svg.selectAll('*:not(rect:first-child)').remove();
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
            this.currentData = data;
        } catch (error) {
            console.error('Error in drawPieCharts:', error);
        } finally {
            this.isTransitioning = false;
        }
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
        if (this.currentData && this.currentTitle) {
            this.drawPieCharts(this.currentData, this.currentTitle);
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

    // チャートをクリア
    async clearChart() {
        if (!this.svgContainer) return;
        
        const existingElements = this.svgContainer.selectAll('*:not(rect:first-child)');
        
        if (!existingElements.empty()) {
            await new Promise(resolve => {
                let completed = 0;
                const total = existingElements.size();
                
                existingElements
                    .transition()
                    .duration(300)
                    .style('opacity', 0)
                    .on('end', function() {
                        d3.select(this).remove();
                        completed++;
                        if (completed === total) {
                            resolve();
                        }
                    });
            });
        }
        
        // 現在のチャート情報をクリア
        this.currentChart = null;
        this.currentData = null;
        this.currentTitle = null;
        this.isTransitioning = false;
    }

    // すべてのチャートをクリア（単一コンテナのためclearChartと同等）
    clearAllCharts() {
        return this.clearChart();
    }

    // クリーンアップ
    cleanup() {
        // ResizeObserverを切断
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // SVGコンテナを削除
        if (this.svgContainer) {
            this.svgContainer.remove();
            this.svgContainer = null;
        }
        
        // 状態をリセット
        this.currentChart = null;
        this.currentData = null;
        this.currentTitle = null;
        this.isTransitioning = false;
    }
}