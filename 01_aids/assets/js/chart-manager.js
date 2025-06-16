/**
 * ChartManager - チャート管理クラス
 * D3.jsを使用した各種チャートの描画・更新を管理
 */
class ChartManager {
    constructor(containerId) {
        // コンテナIDが#chart-containerの場合、#chartを使用
        const actualContainerId = containerId === '#chart-container' ? '#chart' : containerId;
        this.container = d3.select(actualContainerId);
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;
        
        console.log('ChartManager initialized with container:', actualContainerId);
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
        
        // Triple chart layoutの場合
        if (chartData.layout === 'triple' && chartData.charts) {
            this.updateTripleChart(chartData);
            return;
        }
        
        // Grid chart layoutの場合
        if (chartData.layout === 'grid' && chartData.config) {
            this.updateGridChart(chartData);
            return;
        }
        
        // 従来の単一チャート
        const { type, data, config, visible, updateMode, direction } = chartData;
        
        
        // updateModeが'transition'で既存チャートと同じタイプ、同じデータファイルの場合
        if (updateMode === 'transition' && 
            this.currentChart === type && 
            this.data && 
            this.svg &&
            config.dataFile === this.config?.dataFile) {
            
            console.log(`Updating chart with transition mode (direction: ${direction || 'unknown'})`);
            this.updateChartWithTransition(data, config, direction);
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
     * チャートをトランジションで更新する（再描画しない）
     * @param {Array} data - 新しいデータ
     * @param {Object} config - 新しい設定
     * @param {string} direction - スクロール方向 ('up' | 'down')
     */
    updateChartWithTransition(data, config, direction = 'down') {
        if (!this.svg || this.currentChart !== 'line') {
            console.warn('Cannot update chart with transition: no existing line chart');
            return;
        }

        this.data = data;
        this.config = config;

        // 新しいデータを系列別に変換
        const newSeries = this.transformToSeries(data, config);
        const allNewValues = newSeries.flatMap(s => s.values);
        
        const { width, height } = this.getResponsiveSize(config);
        
        // ChartLayoutHelperを使用して動的マージンを計算
        let margin;
        if (window.ChartLayoutHelper) {
            margin = ChartLayoutHelper.calculateDynamicMargins(data, config, {
                chartType: 'line',
                hasLegend: config.showLegend !== false && config.multiSeries,
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight
            });
        } else {
            // フォールバック：従来の固定マージン
            margin = config.margin || { top: 20, right: 20, bottom: 40, left: 40 };
        }
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        const { xField = 'year', yField = 'value' } = config;
        const isYearData = allNewValues.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);
        
        // X軸のドメインを決定（設定で年度範囲が指定されていればそれを使用、なければデータ範囲）
        let xDomain;
        if (config.yearRange && config.yearRange.length === 2) {
            // 設定ファイルで年度範囲が指定されている場合
            xDomain = config.yearRange;
        } else if (isYearData) {
            // 年データの場合はデータの範囲を使用
            xDomain = d3.extent(allNewValues, d => +d[xField]);
        } else {
            // 時間データの場合
            xDomain = d3.extent(allNewValues, d => new Date(d[xField]));
        }
        
        // 新しいスケールを計算
        const newXScale = isYearData 
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
            yDomain = d3.extent(allNewValues, d => +d[yField]);
        }
        
        const newYScale = d3.scaleLinear()
            .domain(yDomain)
            .nice()
            .range([innerHeight, 0]);

        const g = this.svg.select('g');
        const transitionDuration = config.transitionDuration || 1000;

        // 軸をトランジションで更新（より自然なイージング）
        const newXAxis = isYearData 
            ? d3.axisBottom(newXScale).tickFormat(d3.format("d"))
            : d3.axisBottom(newXScale);
        const newYAxis = d3.axisLeft(newYScale);

        const axisTransition = d3.transition()
            .duration(transitionDuration)
            .ease(d3.easeQuadInOut); // より自然なイージング

        g.select('.x-axis')
            .transition(axisTransition)
            .call(newXAxis);

        g.select('.y-axis')
            .transition(axisTransition)
            .call(newYAxis);

        // 新しいライン生成器
        const newLine = d3.line()
            .x(d => isYearData ? newXScale(+d[xField]) : newXScale(new Date(d[xField])))
            .y(d => newYScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        // 色スケール
        const colorScale = d3.scaleOrdinal(config.colors || d3.schemeCategory10)
            .domain(newSeries.map(d => d.name));

        // Object Constancy: 系列グループをデータバインディング
        const seriesGroups = g.selectAll('.series-group')
            .data(newSeries, d => d.name); // 系列名で一意性を保つ

        // ENTER: 新しい系列を追加
        const enterSeriesGroups = seriesGroups.enter()
            .append('g')
            .attr('class', 'series-group');

        // 新しい系列にラインを追加（非表示状態で開始）
        enterSeriesGroups.append('path')
            .attr('class', 'chart-line')
            .attr('stroke', d => colorScale(d.name))
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('d', d => newLine(d.values))
            .style('opacity', 0);

        // UPDATE: 既存系列の更新
        const updateSeriesGroups = seriesGroups;

        // ENTER + UPDATE: 共通処理
        const allSeriesGroups = enterSeriesGroups.merge(updateSeriesGroups);

        // EXIT: 不要な系列を削除（先に処理）
        seriesGroups.exit()
            .transition()
            .duration(transitionDuration / 2)
            .ease(d3.easeBackIn)
            .style('opacity', 0)
            .remove();

        // 統一されたトランジションを作成
        const mainTransition = d3.transition()
            .duration(transitionDuration)
            .ease(d3.easeQuadInOut); // 軸と同じ自然なイージング

        const fastTransition = d3.transition()
            .duration(transitionDuration * 0.4)
            .ease(d3.easeQuadIn); // 削除用の高速トランジション

        // 線と点を完全に同期するため、newSeriesから正確なデータを取得
        const self = this; // thisのコンテキストを保存
        allSeriesGroups.each(function(seriesData, seriesIndex) {
            const group = d3.select(this);
            
            // ⚠️ 重要: newSeriesから対応する系列データを取得（確実にフィルタリング済み）
            const currentSeriesData = newSeries.find(s => s.name === seriesData.name) || seriesData;
            const currentValues = currentSeriesData.values;
            
            console.log(`Series ${seriesData.name}: Using ${currentValues.length} data points for both line and circles`);
            
            // Object Constancy: 一意キーで各データポイントを追跡
            const dataWithKeys = currentValues.map(v => ({
                ...v,
                seriesName: currentSeriesData.name,
                uniqueKey: `${currentSeriesData.name}-${v[xField]}` // 系列名と年度で一意キー生成
            }));
            
            // シンプルな差分ベース更新を開始
            self.updateSeriesWithDiff(group, currentSeriesData, newXScale, newYScale, newLine, colorScale, transitionDuration);
        });

        console.log(`Chart updated with transition: ${data.length} records displayed`);
    }

    /**
     * 差分ベースでシリーズを段階的に更新（シンプル実装）
     */
    updateSeriesWithDiff(group, newSeriesData, newXScale, newYScale, newLine, colorScale, transitionDuration) {
        const lineElement = group.selectAll('.chart-line');
        const currentLineData = lineElement.datum();
        const oldValues = currentLineData ? currentLineData.values : [];
        const newValues = newSeriesData.values;
        
        // 差分を計算
        const oldKeys = new Set(oldValues.map(d => d[this.config?.xField || 'year']));
        const newKeys = new Set(newValues.map(d => d[this.config?.xField || 'year']));
        
        const toAdd = newValues.filter(d => !oldKeys.has(d[this.config?.xField || 'year']));
        const toRemove = oldValues.filter(d => !newKeys.has(d[this.config?.xField || 'year']));
        
        console.log(`Series ${newSeriesData.name}: +${toAdd.length} -${toRemove.length}`);
        
        // 現在表示中のデータ
        let currentDisplayData = [...oldValues];
        
        // 段階的更新の間隔
        const totalChanges = toAdd.length + toRemove.length;
        const intervalTime = totalChanges > 0 ? transitionDuration / totalChanges : 0;
        
        let updateIndex = 0;
        const self = this; // thisコンテキストを保存
        
        // 削除処理（右端から）
        toRemove.reverse().forEach((dataPoint) => {
            setTimeout(() => {
                currentDisplayData = currentDisplayData.filter(d => 
                    d[self.config?.xField || 'year'] !== dataPoint[self.config?.xField || 'year']
                );
                // 線のデータを即座に更新
                lineElement.datum({ ...newSeriesData, values: currentDisplayData });
                self.updateLineAndAxes(group, currentDisplayData, newXScale, newYScale, newLine, colorScale);
            }, updateIndex * intervalTime);
            updateIndex++;
        });
        
        // 追加処理（左端から右端へ）
        toAdd.forEach((dataPoint) => {
            setTimeout(() => {
                currentDisplayData.push(dataPoint);
                currentDisplayData.sort((a, b) => a[self.config?.xField || 'year'] - b[self.config?.xField || 'year']);
                // 線のデータを即座に更新
                lineElement.datum({ ...newSeriesData, values: currentDisplayData });
                self.updateLineAndAxes(group, currentDisplayData, newXScale, newYScale, newLine, colorScale);
            }, updateIndex * intervalTime);
            updateIndex++;
        });
        
        // 最終的にデータを確実に設定
        setTimeout(() => {
            lineElement.datum({ ...newSeriesData, values: newValues });
        }, transitionDuration);
    }
    
    /**
     * 線と軸を同期更新
     */
    updateLineAndAxes(group, currentData, newXScale, newYScale, newLine, colorScale) {
        const seriesData = group.datum();
        
        // 軸はすべての系列の現在データに基づいて更新
        const xField = this.config?.xField || 'year';
        const yField = this.config?.yField || 'value';
        
        if (currentData.length > 0) {
            // 全系列の現在データを収集
            const g = this.svg.select('g');
            const allCurrentData = [];
            
            g.selectAll('.series-group').each(function() {
                const seriesGroup = d3.select(this);
                const lineData = seriesGroup.select('.chart-line').datum();
                if (lineData && lineData.values) {
                    allCurrentData.push(...lineData.values);
                }
            });
            
            // データが存在する場合のみ軸を更新
            if (allCurrentData.length > 0) {
                const xExtent = d3.extent(allCurrentData, d => +d[xField]);
                const yExtent = d3.extent(allCurrentData, d => +d[yField]);
                
                newXScale.domain(xExtent);
                newYScale.domain(yExtent).nice();
                
                // 軸を更新（ChartLayoutHelperのフォーマッターを使用）
                const isYearData = allCurrentData.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);
                let xAxis, yAxis;
                
                if (window.ChartLayoutHelper) {
                    // 単位情報を分析（現在表示中のデータから）
                    const unitInfo = ChartLayoutHelper.analyzeUnits(allCurrentData, this.config || {});
                    const yFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.yAxis);
                    xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                    yAxis = d3.axisLeft(newYScale).tickFormat(yFormatter);
                } else {
                    xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                    yAxis = d3.axisLeft(newYScale);
                }
                
                g.select('.x-axis').transition().duration(200).call(xAxis);
                g.select('.y-axis').transition().duration(200).call(yAxis);
            }
        }
        
        // 線を更新
        group.selectAll('.chart-line')
            .transition()
            .duration(200)
            .ease(d3.easeQuadInOut)
            .attr('d', newLine(currentData))
            .attr('stroke', colorScale(seriesData.name));
        
        // 点を更新
        const dataWithKeys = currentData.map(v => ({
            ...v,
            seriesName: seriesData.name,
            uniqueKey: `${seriesData.name}-${v[xField]}`
        }));
        
        const circles = group.selectAll('.chart-circle')
            .data(dataWithKeys, d => d.uniqueKey);
        
        // 新しい点を追加
        circles.enter()
            .append('circle')
            .attr('class', 'chart-circle')
            .attr('r', 0)
            .attr('fill', colorScale(seriesData.name))
            .attr('cx', d => newXScale(+d[xField]))
            .attr('cy', d => newYScale(+d[yField]))
            .transition()
            .duration(200)
            .attr('r', 3);
        
        // 既存の点を更新
        circles.transition()
            .duration(200)
            .attr('cx', d => newXScale(+d[xField]))
            .attr('cy', d => newYScale(+d[yField]));
        
        // 不要な点を削除
        circles.exit()
            .transition()
            .duration(200)
            .attr('r', 0)
            .remove();
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
            // SVGを新規作成（既存要素をクリア）
            this.createSVGForLayout('dual');
            this.renderDualChart(charts);
        } else {
            this.hide();
        }
    }

    /**
     * Triple chart layout用の更新メソッド
     * @param {Object} tripleChartData - Triple chart データ
     */
    updateTripleChart(tripleChartData) {
        const { charts, visible } = tripleChartData;
        
        this.currentChart = 'triple';
        this.tripleCharts = charts;

        if (visible) {
            this.show();
            // SVGを新規作成（既存要素をクリア）
            this.createSVGForLayout('triple');
            this.renderTripleChart(charts);
        } else {
            this.hide();
        }
    }

    /**
     * レイアウト用のSVGを作成（既存要素をクリア）
     * @param {string} layout - レイアウトタイプ（dual, triple）
     */
    createSVGForLayout(layout) {
        // コンテナをクリア
        this.container.selectAll('*').remove();
        
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth || 800; // フォールバック値
        const containerHeight = containerNode.clientHeight || 600; // フォールバック値
        
        console.log('ChartManager: createSVGForLayout container dimensions:', { containerWidth, containerHeight });
        
        let totalWidth, totalHeight;
        
        switch (layout) {
            case 'dual':
                totalWidth = Math.min(containerWidth * 0.9, 1000);
                totalHeight = Math.min(containerHeight * 0.8, 500);
                break;
            case 'triple':
                totalWidth = Math.min(containerWidth * 0.95, 1200);
                totalHeight = Math.min(containerHeight * 0.8, 500);
                break;
            default:
                totalWidth = 800;
                totalHeight = 600;
        }
        
        // SVGHelperを使用してSVGを作成
        if (window.SVGHelper) {
            this.svg = SVGHelper.initSVG(this.container, totalWidth, totalHeight, {
                className: 'chart-svg',
                responsive: true,
                preserveAspectRatio: 'xMidYMid meet'
            });
        } else {
            // フォールバック
            this.svg = this.container.append('svg')
                .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
                .style('width', '100%')
                .style('height', 'auto');
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
        // コンテンツも完全にクリア
        this.container.selectAll('*').remove();
        this.svg = null;
        this.currentChart = null;
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
     * レスポンシブなサイズを計算（viewBox基準版）
     * @param {Object} config - 設定
     * @returns {Object} - { width, height }
     */
    getResponsiveSize(config) {
        // SVGHelperが利用可能な場合は共通ユーティリティを使用
        if (window.SVGHelper) {
            return SVGHelper.getResponsiveSize(this.container, {
                defaultWidth: 800,  // viewBoxの基準幅
                defaultHeight: 600, // viewBoxの基準高さ
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

        // フォールバック（SVGHelperが利用できない場合）
        let width = config.width || 800;
        let height = config.height || 600;

        // パーセンテージ指定の場合
        if (config.widthPercent) {
            width = window.innerWidth * (config.widthPercent / 100);
        }
        if (config.heightPercent) {
            height = window.innerHeight * (config.heightPercent / 100);
        }

        // アスペクト比を維持
        if (config.widthPercent && !config.heightPercent && config.aspectRatio) {
            height = width / config.aspectRatio;
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
        
        // 既存のSVGを使用（createSVGForLayoutで作成済み）
        const svg = this.svg;
        
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
        
        // データの存在確認
        if (!data || data.length === 0) {
            console.warn('renderSingleChartInDual: No data provided', { data, config, title });
            return;
        }
        
        // ChartLayoutHelperを使用して動的マージンを計算
        let margin;
        if (window.ChartLayoutHelper) {
            margin = ChartLayoutHelper.calculateDynamicMargins(data, config, {
                chartType: 'line',
                hasLegend: config.showLegend !== false && config.multiSeries,
                screenWidth: width,  // 個別チャートの幅を使用
                screenHeight: height // 個別チャートの高さを使用
            });
        } else {
            // フォールバック：従来の固定マージン
            margin = config.margin || { top: 20, right: 20, bottom: 40, left: 50 };
        }
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
            .nice()
            .range([height, 0]);

        // D3標準のカラースケール：地域名から直接色を取得
        let colorScale;
        if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            // 単一系列の明示色
            colorScale = d3.scaleOrdinal(config.colors).domain(series.map(d => d.name));
        } else if (window.ColorScheme && config.useUnifiedColors !== false) {
            // 統一カラースキーム：地域名→色の直接マッピング
            colorScale = d3.scaleOrdinal()
                .domain(series.map(s => s.name))
                .range(series.map(s => window.ColorScheme.getRegionColor(s.name)));
        } else {
            // フォールバック
            colorScale = d3.scaleOrdinal(colors).domain(series.map(d => d.name));
        }

        // 単位情報を分析
        let unitInfo = { xAxis: {}, yAxis: {} };
        if (window.ChartLayoutHelper) {
            unitInfo = ChartLayoutHelper.analyzeUnits(data, config);
        }

        // 軸を描画（単位情報を使ったフォーマッターを使用）
        let xAxis, yAxis;
        if (window.ChartLayoutHelper) {
            const xFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.xAxis);
            const yFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.yAxis);
            
            xAxis = isYearData 
                ? d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(6)
                : d3.axisBottom(xScale).ticks(6);
            yAxis = d3.axisLeft(yScale).tickFormat(yFormatter).ticks(5);
        } else {
            xAxis = isYearData 
                ? d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(6)
                : d3.axisBottom(xScale).ticks(6);
            yAxis = d3.axisLeft(yScale).ticks(5);
        }

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

        // 軸ラベルを統一的に追加（カスタム優先、デフォルト単位フォールバック）
        if (window.ChartLayoutHelper) {
            ChartLayoutHelper.addAxisLabels(g, data, config, width, height);
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

        // 注釈（アノテーション）を描画
        if (config.annotations) {
            this.renderAnnotations(g, config.annotations, { xScale, yScale, width, height, isYearData, xField, yField });
        }
    }

    /**
     * コンパクトなレジェンドを追加
     */
    addCompactLegend(g, series, colorScale, width, height) {
        if (!series || series.length <= 1) return;
        
        // ChartLayoutHelperを使用して最適な凡例レイアウトを計算（コンパクト版）
        let legendLayout;
        if (window.ChartLayoutHelper) {
            const seriesNames = series.map(s => s.name);
            legendLayout = ChartLayoutHelper.calculateLegendLayout(seriesNames, width, height);
            // コンパクト版の調整：もう少し余裕を持たせる
            legendLayout.itemHeight = 16;
            legendLayout.itemWidth = Math.min(legendLayout.itemWidth, width * 0.4); // 0.3から0.4に拡大
        } else {
            // フォールバック：従来の固定レイアウト（幅を広げる）
            legendLayout = {
                show: true,
                position: 'right',
                orientation: 'vertical',
                itemWidth: 140, // 100から140に拡大
                itemHeight: 16,
                totalWidth: 140 // 100から140に拡大
            };
        }
        
        if (!legendLayout.show) return;
        
        // 凡例位置を計算（コンパクト版はより保守的に）
        const legendX = Math.max(10, width - legendLayout.totalWidth - 10);
        const legendY = 10;
        
        const legend = g.append('g')
            .attr('class', 'chart-legend compact-legend')
            .attr('transform', `translate(${legendX}, ${legendY})`);

        const legendItems = legend.selectAll('.legend-item')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * legendLayout.itemHeight})`);

        // コンパクトな凡例アイコン（小さな円）
        legendItems.append('circle')
            .attr('cx', 4)
            .attr('cy', 4)
            .attr('r', 3)
            .attr('fill', d => colorScale(d.name));

        // コンパクトな凡例テキスト
        const legendTexts = legendItems.append('text')
            .attr('x', 12)
            .attr('y', 4)
            .attr('dy', '0.35em')
            .attr('font-size', '10px')
            .attr('fill', '#333');
        
        // 改善されたテキスト省略処理
        legendTexts.each(function(d) {
            const textElement = d3.select(this);
            const text = d.name;
            const maxWidth = legendLayout.itemWidth - 16; // アイコン分を除く
            
            // まず完全なテキストを設定
            textElement.text(text);
            
            // テキスト幅を安全に測定
            let textWidth;
            try {
                textWidth = this.getBBox().width;
            } catch (e) {
                // getBBoxが失敗した場合のフォールバック（文字数ベース）
                textWidth = text.length * 6;
            }
            
            if (textWidth > maxWidth) {
                // 地域名の適切な省略戦略
                let shortenedText = text;
                
                // 地域名の場合は意味のある省略を行う
                if (text.includes('・')) {
                    // 「東部・南部アフリカ」→「東・南部アフリカ」のような省略
                    shortenedText = text.replace(/部・/g, '・');
                } else if (text.includes('（') && text.includes('）')) {
                    // 括弧内の詳細を除去 「中南米（ラテンアメリカ）」→「中南米」
                    shortenedText = text.replace(/（[^）]*）/g, '');
                }
                
                // まだ長い場合は文字数で調整
                if (shortenedText.length > 8) {
                    shortenedText = shortenedText.substring(0, 7) + '...';
                }
                
                textElement.text(shortenedText);
                
                // ツールチップで完全なテキストを表示
                textElement.append('title').text(text);
                
                console.log(`Legend text truncated: "${text}" → "${shortenedText}"`);
            }
        });
    }

    /**
     * チャートを描画（レスポンシブ対応版）
     * @param {string} type - チャートタイプ
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderChart(type, data, config) {
        const { width, height } = this.getResponsiveSize(config);
        
        // ChartLayoutHelperを使用して動的マージンを計算
        let margin;
        if (window.ChartLayoutHelper) {
            margin = ChartLayoutHelper.calculateDynamicMargins(data, config, {
                chartType: type,
                hasLegend: config.showLegend !== false && config.multiSeries,
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight
            });
        } else {
            // フォールバック：従来の固定マージン
            margin = config.margin || { top: 40, right: 20, bottom: 40, left: 50 };
        }
        
        // SVGHelperを使用してレスポンシブSVGを作成
        if (window.SVGHelper) {
            // パーセンテージ指定の場合は実際のピクセルサイズを計算
            let actualWidth = null;
            let actualHeight = null;
            
            if (config.widthPercent) {
                actualWidth = window.innerWidth * (config.widthPercent / 100);
                console.log(`ChartManager: widthPercent=${config.widthPercent}%, actualWidth=${actualWidth}px (window.innerWidth=${window.innerWidth}px)`);
            }
            if (config.heightPercent) {
                actualHeight = window.innerHeight * (config.heightPercent / 100);
            }
            
            // コンテナの実際のサイズを確認
            const containerRect = this.container.node().getBoundingClientRect();
            console.log(`ChartManager: Container size: ${containerRect.width}x${containerRect.height}px`);
            
            this.svg = SVGHelper.initSVG(this.container, width, height, {
                className: 'chart-svg',
                responsive: true,
                preserveAspectRatio: 'xMidYMid meet',
                actualWidth: actualWidth,
                actualHeight: actualHeight
            });
            
            // デバッグ用：チャート背景を緑色に
            this.svg.append('rect')
                .attr('width', width)
                .attr('height', height)
                .attr('fill', 'lightgreen')
                .attr('opacity', 0.3);
        } else {
            // フォールバック
            this.container.selectAll('*').remove();
            this.svg = this.container.append('svg')
                .attr('viewBox', `0 0 ${width} ${height}`)
                .style('width', config.widthPercent ? `${config.widthPercent}%` : '100%')
                .style('height', 'auto');
                
            // デバッグ用：チャート背景を緑色に
            this.svg.append('rect')
                .attr('width', width)
                .attr('height', height)
                .attr('fill', 'lightgreen')
                .attr('opacity', 0.3);
        }
        
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
     * データにフィルタを適用
     * @param {Array} data - 生データ
     * @param {Object} filterConfig - フィルタ設定
     * @returns {Array} フィルタ済みデータ
     */
    applyFilter(data, filterConfig) {
        if (!filterConfig || !data || data.length === 0) {
            return data;
        }

        const { type, field, range, values, exclude } = filterConfig;

        switch (type) {
            case 'range':
                if (range && range.length === 2 && field) {
                    const [min, max] = range;
                    return data.filter(d => {
                        const value = +d[field];
                        return value >= min && value <= max;
                    });
                }
                break;

            case 'values':
                if (values && values.length > 0 && field) {
                    return data.filter(d => values.includes(d[field]));
                }
                break;

            case 'exclude':
                if (exclude && exclude.length > 0 && field) {
                    return data.filter(d => !exclude.includes(d[field]));
                }
                break;

            case 'series':
                if (values && values.length > 0) {
                    const seriesField = filterConfig.seriesField || 'series';
                    return data.filter(d => values.includes(d[seriesField]));
                }
                break;

            default:
                console.warn(`Unknown filter type: ${type}`);
                return data;
        }

        return data;
    }

    /**
     * データを系列別に変換
     * @param {Array} data - 生データ
     * @param {Object} config - 設定
     * @returns {Array} 系列別データ
     */
    transformToSeries(data, config) {
        const { xField = 'year', yField = 'value', seriesField = 'series' } = config;
        
        
        // フィルタが設定されている場合は適用
        let filteredData = data;
        if (config.filter) {
            filteredData = this.applyFilter(data, config.filter);
            console.log(`Filter applied: ${data.length} -> ${filteredData.length} records`);
        }
        
        if (config.multiSeries === false) {
            // 単一系列として強制的に扱う
            return [{
                name: config.seriesName || 'Data',
                values: filteredData.map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
            }];
        }
        
        // 複数系列の場合
        const seriesNames = [...new Set(filteredData.map(d => d[seriesField]))];
        
        return seriesNames.map(name => ({
            name,
            values: filteredData
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
            multiSeries = true,
            title = ''
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
                .attr('font-size', '16px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(title);
        }

        // データを系列別に変換
        const series = this.transformToSeries(data, config);
        
        
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
        
        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .nice()
            .range([innerHeight, 0]);

        // D3標準のカラースケール：地域名から直接色を取得
        let colorScale;
        if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            // 単一系列の明示色
            colorScale = d3.scaleOrdinal(config.colors).domain(series.map(d => d.name));
        } else if (window.ColorScheme && config.useUnifiedColors !== false) {
            // 統一カラースキーム：地域名→色の直接マッピング
            colorScale = d3.scaleOrdinal()
                .domain(series.map(s => s.name))
                .range(series.map(s => window.ColorScheme.getRegionColor(s.name)));
        } else {
            // フォールバック
            colorScale = d3.scaleOrdinal(colors).domain(series.map(d => d.name));
        }

        // 単位情報を分析
        let unitInfo = { xAxis: {}, yAxis: {} };
        if (window.ChartLayoutHelper) {
            unitInfo = ChartLayoutHelper.analyzeUnits(data, config);
        }

        // 軸を描画（単位情報を使ったフォーマッターを使用）
        let xAxis, yAxis;
        if (window.ChartLayoutHelper) {
            const xFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.xAxis);
            const yFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.yAxis);
            
            xAxis = isYearData 
                ? d3.axisBottom(xScale).tickFormat(d3.format("d"))  // 年データは整数表示
                : d3.axisBottom(xScale);
            yAxis = d3.axisLeft(yScale).tickFormat(yFormatter);
        } else {
            xAxis = isYearData 
                ? d3.axisBottom(xScale).tickFormat(d3.format("d"))  // 年データは整数表示
                : d3.axisBottom(xScale);
            yAxis = d3.axisLeft(yScale);
        }

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

        // 軸ラベルを統一的に追加（カスタム優先、デフォルト単位フォールバック）
        if (window.ChartLayoutHelper) {
            ChartLayoutHelper.addAxisLabels(g, data, config, innerWidth, innerHeight);
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

        // 統一されたトランジションを作成（初期描画用）
        const initialTransition = d3.transition()
            .duration(600)
            .ease(d3.easeQuadOut); // 自然な立ち上がり

        // ラインを描画（統一トランジション + データ設定）
        seriesGroups.append('path')
            .attr('class', 'chart-line')
            .datum(d => d) // 系列データを設定
            .attr('d', d => line(d.values))
            .attr('stroke', d => colorScale(d.name))
            .attr('stroke-width', 0)
            .attr('fill', 'none')
            .style('opacity', 0)
            .transition(initialTransition)
            .attr('stroke-width', 2)
            .style('opacity', 1);

        // Object Constancyを使ったポイント描画（線と同期）
        seriesGroups.each(function(seriesData) {
            const group = d3.select(this);
            
            // 一意キーでデータポイントを追跡
            const dataWithKeys = seriesData.values.map(v => ({
                ...v,
                seriesName: seriesData.name,
                uniqueKey: `${seriesData.name}-${v[xField]}`
            }));
            
            const circles = group.selectAll('.chart-circle')
                .data(dataWithKeys, d => d.uniqueKey);

            // 新しいポイントの追加（線と同じイージング、わずかな遅延）
            circles.enter()
                .append('circle')
                .attr('class', 'chart-circle')
                .attr('cx', d => isYearData ? xScale(+d[xField]) : xScale(new Date(d[xField])))
                .attr('cy', d => yScale(+d[yField]))
                .attr('r', 0)
                .attr('fill', d => colorScale(d.seriesName))
                .style('opacity', 0)
                .transition(initialTransition)
                .delay((d, i) => i * 15) // 自然な順次表示
                .attr('r', 3)
                .style('opacity', 1);
        });

        // レジェンドを追加（複数系列の場合のみ）
        if (series.length > 1) {
            this.addLegend(svg, series, colorScale, width, height);
        }

        // 注釈（アノテーション）を描画
        if (config.annotations) {
            this.renderAnnotations(g, config.annotations, { xScale, yScale, width: innerWidth, height: innerHeight, isYearData, xField, yField });
        }
    }

    /**
     * レジェンドを追加
     */
    addLegend(svg, series, colorScale, width, height) {
        if (!series || series.length <= 1) return;
        
        // ChartLayoutHelperを使用して最適な凡例レイアウトを計算
        let legendLayout;
        if (window.ChartLayoutHelper) {
            const seriesNames = series.map(s => s.name);
            legendLayout = ChartLayoutHelper.calculateLegendLayout(seriesNames, width, height);
            console.log('ChartLayoutHelper legend layout:', legendLayout);
        } else {
            // フォールバック：従来の固定レイアウト
            legendLayout = {
                show: true,
                position: 'right',
                orientation: 'vertical',
                itemWidth: 120,
                itemHeight: 20,
                totalWidth: 120
            };
        }
        
        // bottomポジションが問題を起こしている場合は強制的にrightに変更
        if (legendLayout.position === 'bottom') {
            console.log('Forcing legend position from bottom to right to avoid overflow');
            legendLayout.position = 'right';
            legendLayout.orientation = 'vertical';
        }
        
        if (!legendLayout.show) return;
        
        // 凡例コンテナを作成
        const legend = svg.append('g')
            .attr('class', 'chart-legend');
        
        // 凡例位置を計算
        let legendX, legendY;
        if (legendLayout.position === 'bottom') {
            legendX = width / 2 - (legendLayout.itemWidth * series.length) / 2;
            // チャートエリア内の下部に配置（コンテナの外に出ないように）
            legendY = height - (legendLayout.itemHeight * series.length) - 10;
        } else {
            // 右側配置（デフォルト）
            legendX = Math.max(20, width - (legendLayout.totalWidth || legendLayout.itemWidth));
            legendY = 20;
        }
        
        console.log('Legend position:', { x: legendX, y: legendY, width, height, position: legendLayout.position });
        
        legend.attr('transform', `translate(${legendX}, ${legendY})`);
        
        // 凡例アイテムを作成
        const legendItems = legend.selectAll('.legend-item')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'legend-item');
        
        // アイテムの配置
        if (legendLayout.orientation === 'horizontal') {
            legendItems.attr('transform', (d, i) => `translate(${i * legendLayout.itemWidth}, 0)`);
        } else {
            legendItems.attr('transform', (d, i) => `translate(0, ${i * legendLayout.itemHeight})`);
        }
        
        // 凡例アイコン（円）
        legendItems.append('circle')
            .attr('cx', 6)
            .attr('cy', 6)
            .attr('r', 5)
            .attr('fill', d => colorScale(d.name));
        
        // 凡例テキスト
        const legendTexts = legendItems.append('text')
            .attr('x', 16)
            .attr('y', 6)
            .attr('dy', '0.35em')
            .attr('font-size', '12px')
            .attr('fill', '#333');
        
        // 改善されたテキスト省略処理
        legendTexts.each(function(d) {
            const textElement = d3.select(this);
            const text = d.name;
            const maxWidth = legendLayout.itemWidth - 25; // アイコン分を除く
            
            // まず完全なテキストを設定
            textElement.text(text);
            
            // テキスト幅を安全に測定
            let textWidth;
            try {
                textWidth = this.getBBox().width;
            } catch (e) {
                // getBBoxが失敗した場合のフォールバック
                textWidth = text.length * 7;
            }
            
            if (textWidth > maxWidth) {
                // 地域名の適切な省略戦略
                let shortenedText = text;
                
                // 地域名の場合は意味のある省略を行う
                if (text.includes('・')) {
                    // 「東部・南部アフリカ」→「東・南部アフリカ」のような省略
                    shortenedText = text.replace(/部・/g, '・');
                } else if (text.includes('（') && text.includes('）')) {
                    // 括弧内の詳細を除去 「中南米（ラテンアメリカ）」→「中南米」
                    shortenedText = text.replace(/（[^）]*）/g, '');
                }
                
                // 再測定して、まだ長い場合は文字数で調整
                textElement.text(shortenedText);
                try {
                    if (this.getBBox().width > maxWidth && shortenedText.length > 10) {
                        shortenedText = shortenedText.substring(0, 9) + '...';
                        textElement.text(shortenedText);
                    }
                } catch (e) {
                    // getBBoxが使えない場合は文字数でフォールバック
                    if (shortenedText.length > 10) {
                        shortenedText = shortenedText.substring(0, 9) + '...';
                        textElement.text(shortenedText);
                    }
                }
                
                // ツールチップで完全なテキストを表示
                textElement.append('title').text(text);
                
                console.log(`Main legend text truncated: "${text}" → "${shortenedText}"`);
            }
        });
    }

    /**
     * 棒グラフを描画
     */
    renderBarChart(data, config) {
        const { 
            width, height, margin, 
            xField = 'category', yField = 'value', 
            color = '#10b981',
            title = ''
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
                .attr('font-size', '16px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(title);
        }

        // スケール設定
        const xScale = d3.scaleBand()
            .domain(data.map(d => d[xField]))
            .range([0, innerWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => +d[yField])])
            .nice()
            .range([innerHeight, 0]);

        // 単位情報を分析
        let unitInfo = { xAxis: {}, yAxis: {} };
        if (window.ChartLayoutHelper) {
            unitInfo = ChartLayoutHelper.analyzeUnits(data, config);
        }

        // 軸を描画（単位情報を使ったフォーマッターを使用）
        let xAxis, yAxis;
        if (window.ChartLayoutHelper) {
            const xFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.xAxis);
            const yFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.yAxis);
            
            xAxis = d3.axisBottom(xScale);
            yAxis = d3.axisLeft(yScale).tickFormat(yFormatter);
        } else {
            xAxis = d3.axisBottom(xScale);
            yAxis = d3.axisLeft(yScale);
        }

        g.append('g')
            .attr('class', 'chart-axis x-axis')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

        // 軸ラベルを統一的に追加（カスタム優先、デフォルト単位フォールバック）
        if (window.ChartLayoutHelper) {
            ChartLayoutHelper.addAxisLabels(g, data, config, innerWidth, innerHeight);
        }

        // 統一された色設定
        let barColors;
        if (window.ColorScheme && config.useUnifiedColors !== false && config.multiColor) {
            // 複数色の場合は統一カラースキームを使用
            barColors = window.ColorScheme.generateColorsForChart(data, { 
                ...config, 
                seriesField: xField 
            });
        } else if (window.ColorScheme && config.useUnifiedColors !== false && data.length === 1) {
            // 単一データの場合は地域に応じた色を使用
            const regionName = data[0][xField];
            barColors = [window.ColorScheme.getColorForRegion(regionName)];
        } else {
            // フォールバック：設定で指定された色
            barColors = [color];
        }
        
        // 特別なケース：単一系列で色が明示されている場合のみそれを優先
        if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            barColors = config.colors;
        }

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
            .attr('fill', (d, i) => barColors[i % barColors.length])
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
        const { width, height, labelField = 'label', valueField = 'value', colors = d3.schemeCategory10, title = '' } = config;
        
        const svg = this.initSVG(width, height);
        const radius = Math.min(width, height) / 2 - 40;
        
        const g = svg.append('g')
            .attr('transform', `translate(${width/2},${height/2})`);
        
        // タイトルを追加
        if (title) {
            svg.append('text')
                .attr('class', 'chart-title')
                .attr('x', 20)
                .attr('y', 30)
                .attr('text-anchor', 'start')
                .attr('font-size', '16px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(title);
        }

        const pie = d3.pie()
            .value(d => +d[valueField])
            .sort(null);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        // 統一された色スケール設定
        let chartColors;
        if (window.ColorScheme && config.useUnifiedColors !== false) {
            // 統一カラースキームを使用
            chartColors = window.ColorScheme.generateColorsForChart(data, { 
                ...config, 
                seriesField: labelField 
            });
        } else {
            // フォールバック：設定で指定された色または既定色
            chartColors = colors;
        }
        
        // 特別なケース：単一系列で色が明示されている場合のみそれを優先
        if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            chartColors = config.colors;
        }

        const arcs = g.selectAll('.pie-slice')
            .data(pie(data))
            .enter()
            .append('g')
            .attr('class', 'pie-slice');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => chartColors[i % chartColors.length])
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
     * Triple チャートを描画
     * @param {Array} charts - チャート設定配列（3つ）
     */
    renderTripleChart(charts) {
        console.log('ChartManager: renderTripleChart called with:', charts);
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = containerNode.clientHeight;
        console.log('ChartManager: Container dimensions:', { containerWidth, containerHeight });
        
        // 全体のSVGサイズを計算
        const totalWidth = Math.min(containerWidth * 0.95, 1200);
        const totalHeight = Math.min(containerHeight * 0.8, 500);
        
        // 既存のSVGを使用（createSVGForLayoutで作成済み）
        const svg = this.svg;
        
        // 各チャートの幅を計算（間隔を含む）
        const chartSpacing = 30;
        const chartWidth = (totalWidth - chartSpacing * 2) / 3;
        const chartHeight = totalHeight - 60; // タイトル分を確保
        
        charts.forEach((chartConfig, index) => {
            const xOffset = index * (chartWidth + chartSpacing);
            this.renderSinglePieChartInTriple(svg, chartConfig, {
                x: xOffset,
                y: 40,
                width: chartWidth,
                height: chartHeight
            });
        });
    }

    /**
     * Triple layout内で単一の円グラフを描画
     */
    renderSinglePieChartInTriple(svg, chartConfig, layout) {
        console.log('ChartManager: renderSinglePieChartInTriple called with:', { chartConfig, layout });
        const { data, config, title } = chartConfig;
        const { x, y, width, height } = layout;
        console.log('ChartManager: Data for pie chart:', data);
        
        const radius = Math.min(width, height - 80) / 2; // タイトル分を除く
        
        // チャートグループを作成
        const chartGroup = svg.append('g')
            .attr('transform', `translate(${x}, ${y})`);
        
        // タイトルを追加
        chartGroup.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text(title);
        
        // 円グラフ描画エリア
        const g = chartGroup.append('g')
            .attr('transform', `translate(${width/2}, ${height/2 + 20})`);
        
        // 円グラフを描画
        this.renderPieChartInGroup(g, data, {
            ...config,
            radius: radius
        });
    }

    /**
     * 指定されたグループ内で円グラフを描画
     */
    renderPieChartInGroup(g, data, config) {
        const { radius, labelField = 'label', valueField = 'value', colors = d3.schemeCategory10 } = config;
        
        // データの合計を計算
        const total = data.reduce((sum, d) => sum + (+d[valueField]), 0);
        
        // パイ生成器
        const pie = d3.pie()
            .value(d => +d[valueField])
            .sort(null);
        
        // アーク生成器
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);
        
        // 統一された色スケール設定
        let chartColors;
        if (window.ColorScheme && config.useUnifiedColors !== false) {
            // 統一カラースキームを使用
            chartColors = window.ColorScheme.generateColorsForChart(data, { 
                ...config, 
                seriesField: labelField 
            });
        } else {
            // フォールバック：設定で指定された色または既定色
            chartColors = colors;
        }
        
        // 特別なケース：単一系列で色が明示されている場合のみそれを優先
        if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            chartColors = config.colors;
        }
        
        const colorScale = d3.scaleOrdinal(chartColors)
            .domain(data.map(d => d[labelField]));
        
        // パイデータを生成
        const pieData = pie(data);
        
        // パイスライスを描画
        const slices = g.selectAll('.slice')
            .data(pieData)
            .enter()
            .append('g')
            .attr('class', 'slice');
        
        slices.append('path')
            .attr('class', 'pie-slice')
            .attr('d', arc)
            .attr('fill', d => colorScale(d.data[labelField]))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .style('opacity', 0)
            .transition()
            .duration(500)
            .delay((d, i) => i * 100)
            .style('opacity', 1);
        
        // ラベルを追加
        const labelArc = d3.arc()
            .innerRadius(radius * 0.7)
            .outerRadius(radius * 0.7);
        
        // ラベルグループを作成
        const labelGroups = slices.append('g')
            .attr('class', 'pie-label-group')
            .attr('transform', d => `translate(${labelArc.centroid(d)})`)
            .style('opacity', 0);
        
        // ラベル名を追加
        labelGroups.append('text')
            .attr('class', 'pie-label-name')
            .attr('text-anchor', 'middle')
            .attr('y', '-0.3em')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text(d => d.data[labelField]);
        
        // パーセンテージを追加
        labelGroups.append('text')
            .attr('class', 'pie-label-value')
            .attr('text-anchor', 'middle')
            .attr('y', '0.8em')
            .attr('font-size', '11px')
            .attr('fill', '#666')
            .text(d => {
                // 実際のパーセンテージを計算
                const percentage = (d.data[valueField] / total * 100).toFixed(1);
                return `${percentage}%`;
            });
        
        // ラベルグループをフェードイン
        labelGroups.transition()
            .duration(500)
            .delay((d, i) => i * 100 + 200)
            .style('opacity', 1);
    }

    /**
     * チャートに注釈（アノテーション）を描画
     * @param {Object} g - D3選択オブジェクト（グループ要素）
     * @param {Array} annotations - 注釈設定の配列
     * @param {Object} scales - スケールオブジェクト
     */
    renderAnnotations(g, annotations, scales) {
        const { xScale, yScale, width, height, isYearData, xField, yField } = scales;

        annotations.forEach((annotation, index) => {
            if (annotation.type === 'verticalLine') {
                const { year, label, position = 'top-right' } = annotation;
                
                // 年度がデータ範囲内かチェック
                const xDomain = xScale.domain();
                if (year < xDomain[0] || year > xDomain[1]) {
                    console.warn(`Annotation year ${year} is outside data range [${xDomain[0]}, ${xDomain[1]}]`);
                    return;
                }

                const x = xScale(year);
                
                // 垂直の点線を描画
                g.append('line')
                    .attr('class', 'annotation-line')
                    .attr('x1', x)
                    .attr('x2', x)
                    .attr('y1', 0)
                    .attr('y2', height)
                    .attr('stroke', '#666')
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '5,5')
                    .style('opacity', 0)
                    .transition()
                    .duration(500)
                    .delay(800) // チャート描画後に表示
                    .style('opacity', 0.7);

                // ラベルテキストを描画
                const labelGroup = g.append('g')
                    .attr('class', 'annotation-label')
                    .style('opacity', 0);

                // ラベル位置を計算
                let labelX, labelY, textAnchor;
                switch (position) {
                    case 'top-left':
                        labelX = x - 10;
                        labelY = 20;
                        textAnchor = 'end';
                        break;
                    case 'top-right':
                        labelX = x + 10;
                        labelY = 20;
                        textAnchor = 'start';
                        break;
                    case 'bottom-left':
                        labelX = x - 10;
                        labelY = height - 10;
                        textAnchor = 'end';
                        break;
                    case 'bottom-right':
                        labelX = x + 10;
                        labelY = height - 10;
                        textAnchor = 'start';
                        break;
                    default:
                        labelX = x + 10;
                        labelY = 20;
                        textAnchor = 'start';
                }

                // ラベル背景（読みやすさ向上）
                const labelText = labelGroup.append('text')
                    .attr('x', labelX)
                    .attr('y', labelY)
                    .attr('text-anchor', textAnchor)
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#333')
                    .text(label);

                // 背景の白い矩形（オプション）
                const bbox = labelText.node().getBBox();
                labelGroup.insert('rect', 'text')
                    .attr('x', bbox.x - 3)
                    .attr('y', bbox.y - 2)
                    .attr('width', bbox.width + 6)
                    .attr('height', bbox.height + 4)
                    .attr('fill', 'rgba(255, 255, 255, 0.9)')
                    .attr('stroke', '#ccc')
                    .attr('stroke-width', 0.5)
                    .attr('rx', 3);

                // ラベルをフェードイン
                labelGroup.transition()
                    .duration(500)
                    .delay(1000) // 点線の後に表示
                    .style('opacity', 1);
            }
        });
    }

    /**
     * Grid chart layoutを描画
     * @param {Object} chartData - チャートデータ
     */
    updateGridChart(chartData) {
        this.show();
        
        // SVG要素をクリア
        this.container.selectAll('*').remove();
        
        // データファイルから実際のデータを取得
        const data = chartData.data;
        
        this.renderGridChart(data, chartData.config);
    }
    
    /**
     * Grid layoutで複数の円グラフを描画
     * @param {Array} data - チャートデータ
     * @param {Object} config - 設定
     */
    renderGridChart(data, config) {
        const { 
            columns = 7, 
            rows = 2, 
            chartWidth = 120, 
            chartHeight = 120,
            title = '',
            showLabels = true,
            showPercentages = true,
            rowSpacing = chartHeight * 0.5  // デフォルトの行間スペーシング（チャート高さの50%）
        } = config;
        
        // データを適切な形式に変換
        const gridData = this.transformToGridData(data, config);
        console.log('Grid data:', gridData);
        
        // 全体のサイズを計算（行間スペーシングを含む）
        const totalWidth = columns * chartWidth;
        const totalHeight = rows * chartHeight + (rows - 1) * rowSpacing + (title ? 40 : 0);
        
        const svg = this.initSVG(totalWidth, totalHeight);
        
        // タイトルを追加
        if (title) {
            svg.append('text')
                .attr('class', 'chart-title')
                .attr('x', totalWidth / 2)
                .attr('y', 25)
                .attr('text-anchor', 'middle')
                .attr('font-size', '18px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(title);
        }
        
        // グリッドコンテナ
        const gridContainer = svg.append('g')
            .attr('transform', `translate(0, ${title ? 40 : 0})`);
        
        // 各セルを描画（行間スペーシングを考慮）
        gridData.forEach((cellData, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = col * chartWidth;
            const y = row * (chartHeight + rowSpacing);  // 行間スペーシングを追加
            
            this.renderGridCell(gridContainer, cellData, {
                x: x,
                y: y,
                width: chartWidth,
                height: chartHeight,
                showLabels,
                showPercentages
            });
        });
    }
    
    /**
     * グリッドの各セルを描画
     */
    renderGridCell(container, cellData, layout) {
        const { x, y, width, height, showLabels, showPercentages } = layout;
        const radius = Math.min(width, height) / 2 - 20;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        // セルグループを作成
        const cellGroup = container.append('g')
            .attr('class', 'grid-cell')
            .attr('transform', `translate(${centerX}, ${centerY})`);
        
        // パイチャートデータ
        const pieData = d3.pie()
            .value(d => d.value)
            .sort(null)(cellData.pieData);
        
        // アーク生成器
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);
        
        // パイスライスを描画
        const slices = cellGroup.selectAll('.pie-slice')
            .data(pieData)
            .enter()
            .append('g')
            .attr('class', 'pie-slice');
        
        slices.append('path')
            .attr('d', arc)
            .attr('fill', d => d.data.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .style('opacity', 0)
            .transition()
            .duration(500)
            .delay((d, i) => i * 100)
            .style('opacity', 1);
        
        // ラベルを追加
        if (showLabels) {
            // 地域名
            cellGroup.append('text')
                .attr('class', 'region-label')
                .attr('x', 0)
                .attr('y', -height/2 + 15)
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(cellData.region);
            
            // 年齢層
            cellGroup.append('text')
                .attr('class', 'age-label')
                .attr('x', 0)
                .attr('y', height/2 - 5)
                .attr('text-anchor', 'middle')
                .attr('font-size', '9px')
                .attr('fill', '#666')
                .text(cellData.ageGroup);
        }
        
        // パーセンテージを中央に表示
        if (showPercentages) {
            cellGroup.append('text')
                .attr('class', 'percentage-label')
                .attr('x', 0)
                .attr('y', 5)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(`${cellData.percentage}%`);
        }
    }
    
    /**
     * 生データをグリッド用データに変換
     */
    transformToGridData(data, config) {
        const result = [];
        const regions = [];
        
        console.log('Raw data for transformation:', data);
        
        data.forEach(row => {
            // CSVの最初の列は空白のキー名になっている
            const region = row[''] || row[Object.keys(row)[0]]; 
            const adultPercentStr = row['成人（15歳以上）'];
            const childPercentStr = row['こども（0歳から14歳）'];
            
            // パーセント記号を除去して数値に変換
            const adultPercent = parseInt(adultPercentStr?.replace('%', '') || '0');
            const childPercent = parseInt(childPercentStr?.replace('%', '') || '0');
            
            // 地域名が有効な場合のみ追加
            if (region && region.trim()) {
                // ColorSchemeから色を取得
                const colorScheme = window.ColorScheme;
                const treatmentColor = colorScheme ? colorScheme.getRegionColor(region) : '#2563eb';
                const untreatedColor = '#e5e7eb';
                
                
                // 成人データとこどもデータを保存
                const adultData = {
                    region: region,
                    ageGroup: '成人（15歳以上）',
                    percentage: adultPercent,
                    pieData: [
                        { label: '治療中', value: adultPercent, color: treatmentColor },
                        { label: '未治療', value: 100 - adultPercent, color: untreatedColor }
                    ]
                };
                
                // こどもデータ（少し明るい色を使用）
                const childTreatmentColor = colorScheme ? colorScheme.getLighterColor(treatmentColor) : '#3b82f6';
                const childData = {
                    region: region,
                    ageGroup: 'こども（0-14歳）',
                    percentage: childPercent,
                    pieData: [
                        { label: '治療中', value: childPercent, color: childTreatmentColor },
                        { label: '未治療', value: 100 - childPercent, color: untreatedColor }
                    ]
                };
                
                // 地域ごとにグループ化してテンポラリに保存
                regions.push({ adult: adultData, child: childData });
            }
        });
        
        // 1行目：すべての地域の成人データ（左から右へ）
        regions.forEach(regionData => {
            result.push(regionData.adult);
        });
        
        // 2行目：すべての地域のこどもデータ（左から右へ、上段と同じ順序）
        regions.forEach(regionData => {
            result.push(regionData.child);
        });
        
        console.log('Transformed grid data:', result);
        return result;
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