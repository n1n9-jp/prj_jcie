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
        const margin = config.margin || { top: 20, right: 20, bottom: 40, left: 40 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        const { xField = 'year', yField = 'value' } = config;
        const isYearData = allNewValues.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);
        
        // 新しいスケールを計算
        const newXScale = isYearData 
            ? d3.scaleLinear()
                .domain(d3.extent(allNewValues, d => +d[xField]))
                .range([0, innerWidth])
            : d3.scaleTime()
                .domain(d3.extent(allNewValues, d => new Date(d[xField])))
                .range([0, innerWidth]);

        const newYScale = d3.scaleLinear()
            .domain(d3.extent(allNewValues, d => +d[yField]))
            .nice()
            .range([innerHeight, 0]);

        const g = this.svg.select('g');
        const transitionDuration = config.transitionDuration || 1000;

        // 軸をトランジションで更新
        const newXAxis = isYearData 
            ? d3.axisBottom(newXScale).tickFormat(d3.format("d"))
            : d3.axisBottom(newXScale);
        const newYAxis = d3.axisLeft(newYScale);

        g.select('.x-axis')
            .transition()
            .duration(transitionDuration)
            .call(newXAxis);

        g.select('.y-axis')
            .transition()
            .duration(transitionDuration)
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

        // 線と点を完全に同期するため、newSeriesから正確なデータを取得
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
            
            // ⚠️ 重要: 線描画で全く同じデータソースを使用
            // 線の更新（dataWithKeysと同一のデータで描画）
            group.selectAll('.chart-line')
                .transition()
                .duration(transitionDuration)
                .ease(d3.easeBackOut.overshoot(0.1))
                .attr('stroke', colorScale(currentSeriesData.name))
                .attr('d', newLine(currentValues)) // ⚠️ 点と同じデータソース
                .style('opacity', 1);

            // 点の描画（同じデータソース）
            const circles = group.selectAll('.chart-circle')
                .data(dataWithKeys, d => d.uniqueKey); // Object Constancy: 一意キーでバインディング

            // EXIT: 不要なデータポイントの削除（先に実行）
            circles.exit()
                .transition()
                .duration(transitionDuration / 3)
                .ease(d3.easeBackIn)
                .attr('r', 0)
                .style('opacity', 0)
                .remove();

            // ENTER: 新しいデータポイントの追加
            const enterCircles = circles.enter()
                .append('circle')
                .attr('class', 'chart-circle')
                .attr('r', 0)
                .attr('fill', d => colorScale(d.seriesName))
                .attr('cx', d => isYearData ? newXScale(+d[xField]) : newXScale(new Date(d[xField])))
                .attr('cy', d => newYScale(+d[yField]))
                .style('opacity', 0);

            // UPDATE: 既存データポイントの更新
            const updateCircles = circles
                .attr('fill', d => colorScale(d.seriesName)); // 色も更新

            // ENTER + UPDATE: 線と同じタイミング・イージングで実行
            enterCircles.merge(updateCircles)
                .transition()
                .duration(transitionDuration)
                .ease(d3.easeBackOut.overshoot(0.1)) // 線と同じイージング
                .attr('cx', d => isYearData ? newXScale(+d[xField]) : newXScale(new Date(d[xField])))
                .attr('cy', d => newYScale(+d[yField]))
                .attr('r', 3)
                .style('opacity', 1);
        });

        console.log(`Chart updated with transition: ${data.length} records displayed`);
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

        // ラインを描画（同期的なアニメーション）
        seriesGroups.append('path')
            .attr('class', 'chart-line')
            .attr('d', d => line(d.values))
            .attr('stroke', d => colorScale(d.name))
            .attr('stroke-width', 0)
            .attr('fill', 'none')
            .style('opacity', 0)
            .transition()
            .duration(500)
            .ease(d3.easeBackOut.overshoot(0.1))
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

            // 新しいポイントの追加（線と同じタイミング・イージング）
            circles.enter()
                .append('circle')
                .attr('class', 'chart-circle')
                .attr('cx', d => isYearData ? xScale(+d[xField]) : xScale(new Date(d[xField])))
                .attr('cy', d => yScale(+d[yField]))
                .attr('r', 0)
                .attr('fill', d => colorScale(d.seriesName))
                .style('opacity', 0)
                .transition()
                .duration(500)
                .ease(d3.easeBackOut.overshoot(0.1)) // 線と同じイージング
                .delay((d, i) => i * 20) // 少し差をつけて自然に
                .attr('r', 3)
                .style('opacity', 1);
        });

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