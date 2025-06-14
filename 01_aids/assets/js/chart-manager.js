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
        
        // Triple chart layoutの場合
        if (chartData.layout === 'triple' && chartData.charts) {
            this.updateTripleChart(chartData);
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
                
                // 軸を更新
                const isYearData = allCurrentData.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);
                const xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                const yAxis = d3.axisLeft(newYScale);
                
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
            this.renderTripleChart(charts);
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
        const margin = config.margin || { top: 40, right: 20, bottom: 40, left: 50 };
        
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
        
        const svg = this.initSVG(width, height);
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
     * Triple チャートを描画
     * @param {Array} charts - チャート設定配列（3つ）
     */
    renderTripleChart(charts) {
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth;
        const containerHeight = containerNode.clientHeight;
        
        // 全体のSVGサイズを計算
        const totalWidth = Math.min(containerWidth * 0.95, 1200);
        const totalHeight = Math.min(containerHeight * 0.8, 500);
        
        const svg = this.initSVG(totalWidth, totalHeight);
        
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
        const { data, config, title } = chartConfig;
        const { x, y, width, height } = layout;
        
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
        
        // パイ生成器
        const pie = d3.pie()
            .value(d => +d[valueField])
            .sort(null);
        
        // アーク生成器
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);
        
        // 色スケール
        const colorScale = d3.scaleOrdinal(colors)
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
        
        slices.append('text')
            .attr('class', 'pie-label')
            .attr('transform', d => `translate(${labelArc.centroid(d)})`)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .style('opacity', 0)
            .text(d => `${d.data[valueField]}%`)
            .transition()
            .duration(500)
            .delay((d, i) => i * 100 + 200)
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