/**
 * LineChartRenderer - 折れ線グラフの描画と更新を専門的に扱うクラス
 * ChartRendererBaseを継承し、線グラフ特有の機能を提供
 */
class LineChartRenderer extends ChartRendererBase {
    constructor(containerId) {
        super(containerId);
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;
        this.animationTimers = []; // アニメーションタイマーを管理
        
        // Initialize after properties are set
        this.init();
    }


    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        super.setupEventListeners();
        
        // 線グラフ特有のイベント
        pubsub.subscribe(EVENTS.CHART_UPDATE, (data) => {
            if (data.type === 'line') {
                this.updateChart(data);
            }
        });
    }

    /**
     * チャートを更新する
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        const { type, data, config, visible, updateMode, direction } = chartData;

        // ★重要: Dual/Triple layout の場合はスキップ（ChartSVGDrawer が処理）
        if (this.shouldSkipDualLayout(chartData)) {
            return;
        }

        // updateModeが'transition'で既存チャートと同じタイプ、同じデータファイルの場合
        if (updateMode === 'transition' &&
            this.currentChart === type &&
            this.data &&
            this.svg &&
            config.dataFile === this.config?.dataFile) {

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
     * チャートを描画する
     * @param {string} type - チャートタイプ
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderChart(type, data, config) {
        if (type !== 'line') {
            console.warn(`LineChartRenderer: Unsupported chart type: ${type}`);
            return;
        }

        // レイアウト内かどうかを判定して適切なサイズ計算を選択
        let width, height;
        if (config.width && config.height) {
            // Layout内: ChartManagerが計算したサイズを使用
            width = config.width;
            height = config.height;
        } else {
            // Single: 従来通りgetResponsiveSize使用
            const responsiveSize = this.getResponsiveSize(config);
            width = responsiveSize.width;
            height = responsiveSize.height;
        }

        // マージンを計算（ChartRendererBase のヘルパーメソッドを使用）
        const margin = this.getChartMargin(data, config, {
            chartType: type,
            hasLegend: config.showLegend !== false && config.multiSeries
        });

        // インラインラベル使用時は右マージンを拡大
        if (config.legendType === 'inline' && config.multiSeries) {
            margin.right = Math.max(margin.right, 240); // ラベル用の余白をさらに拡大
        }
        
        // コンテナクリア
        this.container.selectAll('*').remove();
        
        // SVGHelperを使用してレスポンシブSVGを作成
        if (window.SVGHelper) {
            // パーセンテージ指定の場合は実際のピクセルサイズを計算
            let actualWidth = null;
            let actualHeight = null;
            
            if (config.widthPercent) {
                actualWidth = window.innerWidth * (config.widthPercent / 100);
            }
            if (config.heightPercent) {
                actualHeight = window.innerHeight * (config.heightPercent / 100);
            }
            
            this.svg = SVGHelper.initSVG(this.container, width, height, {
                preserveAspectRatio: config.preserveAspectRatio || 'xMidYMid meet',
                responsive: true,
                actualWidth: actualWidth,
                actualHeight: actualHeight
            });
        } else {
            // フォールバック：従来のSVG作成
            this.svg = this.container.append('svg')
                .attr('width', width)
                .attr('height', height);
        }

        this.renderLineChart(data, { width, height, margin, ...config });
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

        // マージンを計算（ChartRendererBase のヘルパーメソッドを使用）
        const margin = this.getChartMargin(data, config, {
            chartType: 'line',
            hasLegend: config.showLegend !== false && config.multiSeries
        });

        // インラインラベル使用時は右マージンを拡大
        if (config.legendType === 'inline' && config.multiSeries) {
            margin.right = Math.max(margin.right, 240); // ラベル用の余白をさらに拡大
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
        
        let newYScale;
        if (config.yAxis && config.yAxis.type === 'log') {
            const yMin = yDomain[0] > 0 ? yDomain[0] : 1;
            newYScale = d3.scaleLog()
                .domain([yMin, yDomain[1]])
                .range([innerHeight, 0]);
        } else {
            newYScale = d3.scaleLinear()
                .domain(yDomain)
                .range([innerHeight, 0]);
        }
        
        // yRangeが明示的に設定されていない場合のみnice()を適用
        if (!(this.config && this.config.yRange && this.config.yRange.length === 2)) {
            newYScale.nice();
        }

        const g = this.svg.select('g');

        // ChartTransitionsを使用して軸を更新
        const newXAxis = isYearData
            ? d3.axisBottom(newXScale).tickFormat(d3.format("d"))
            : d3.axisBottom(newXScale);
        const newYAxis = d3.axisLeft(newYScale)
            .tickFormat(d => ChartFormatterHelper.formatYAxisValue(d, config.yAxisFormat));

        if (config.yAxis && config.yAxis.ticks) {
            newYAxis.ticks(config.yAxis.ticks);
        }

        // 軸をトランジションで更新（ChartRendererBase のヘルパーメソッドを使用）
        const transitionDuration = config.transitionDuration || 1000;
        this.updateChartAxes(g, newXAxis, newYAxis, {
            chartType: 'line',
            duration: transitionDuration
        });

        // 新しいライン生成器
        const newLine = d3.line()
            .x(d => isYearData ? newXScale(+d[xField]) : newXScale(new Date(d[xField])))
            .y(d => newYScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        // 色スケール - 地域別カラースキームを使用
        const colorScale = this.createColorScale(newSeries, config);

        // ChartTransitionsを使用してEnter/Update/Exitパターンを適用
        const seriesUpdateResult = ChartTransitions.applyEnterUpdateExit(
            g.selectAll('.series-group'),
            newSeries,
            d => d.name, // 系列名で一意性を保つ
            {
                onEnter: (enterSelection) => {
                    const enterGroups = enterSelection
                        .append('g')
                        .attr('class', 'series-group');
                    
                    // 新しい系列にラインを追加（非表示状態で開始）
                    enterGroups.append('path')
                        .attr('class', 'chart-line')
                        .attr('stroke', d => colorScale(d.name))
                        .attr('stroke-width', window.AppDefaults?.strokeWidth?.thick || 2)
                        .attr('fill', 'none')
                        .attr('d', d => newLine(d.values))
                        .style('opacity', 0);
                },
                onExit: (exitSelection) => {
                    exitSelection
                        .style('opacity', 0)
                        .remove();
                }
            },
            {
                chartType: 'line',
                exit: { duration: transitionDuration / 2 }
            }
        );
        
        const allSeriesGroups = seriesUpdateResult.all;

        // ChartTransitionsを使用して統一されたトランジションを作成
        const mainTransition = ChartTransitions.createTransition('line', 'update', {
            duration: transitionDuration
        });

        // 線と点を完全に同期するため、newSeriesから正確なデータを取得
        const self = this; // thisのコンテキストを保存
        allSeriesGroups.each(function(seriesData, seriesIndex) {
            const group = d3.select(this);
            
            // ⚠️ 重要: newSeriesから対応する系列データを取得（確実にフィルタリング済み）
            const currentSeriesData = newSeries.find(s => s.name === seriesData.name) || seriesData;
            const currentValues = currentSeriesData.values;
            
            
            // Object Constancy: 一意キーで各データポイントを追跡
            const dataWithKeys = currentValues.map(v => ({
                ...v,
                seriesName: currentSeriesData.name,
                uniqueKey: `${currentSeriesData.name}-${v[xField]}` // 系列名と年度で一意キー生成
            }));
            
            // シンプルな差分ベース更新を開始
            self.updateSeriesWithDiff(group, currentSeriesData, newXScale, newYScale, newLine, colorScale, transitionDuration);
        });

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
                let yExtent = d3.extent(allCurrentData, d => +d[yField]);

                if (newYScale.base) { // scaleLogにはbaseプロパティがある
                    yExtent[0] = yExtent[0] > 0 ? yExtent[0] : 1;
                }
                
                newXScale.domain(xExtent);
                newYScale.domain(yExtent);
                
                // yRangeが明示的に設定されていない場合のみnice()を適用
                if (!(this.config && this.config.yRange && this.config.yRange.length === 2)) {
                    newYScale.nice();
                }
                
                // 軸を更新（ChartLayoutHelperのフォーマッターを使用）
                const isYearData = allCurrentData.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);
                let xAxis, yAxis;
                
                // カスタムフォーマットが設定されている場合はそれを使用
                if (this.config && this.config.yAxisFormat) {
                    xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                    yAxis = d3.axisLeft(newYScale).tickFormat(d => ChartFormatterHelper.formatYAxisValue(d, this.config.yAxisFormat));
                    
                    if (this.config.yAxis && this.config.yAxis.type === 'log') {
                        const tickValues = newYScale.ticks().filter(d => Number.isInteger(Math.log10(d)) || d === 1);
                        yAxis.tickValues(tickValues);
                    } else if (this.config.yAxis && this.config.yAxis.tickValues) {
                        yAxis.tickValues(this.config.yAxis.tickValues);
                    } else if (this.config.yAxis && this.config.yAxis.ticks) {
                        yAxis.ticks(this.config.yAxis.ticks);
                    }
                } else if (window.ChartLayoutHelper) {
                    // 単位情報を分析（現在表示中のデータから）
                    const unitInfo = ChartLayoutHelper.analyzeUnits(allCurrentData, this.config || {});
                    const yFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.yAxis);
                    xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                    yAxis = d3.axisLeft(newYScale).tickFormat(yFormatter);
                    
                    // yAxisのtickValues設定がある場合は適用
                    if (this.config && this.config.yAxis && this.config.yAxis.tickValues) {
                        yAxis.tickValues(this.config.yAxis.tickValues);
                    } else if (this.config && this.config.yAxis && this.config.yAxis.ticks) {
                        yAxis.ticks(this.config.yAxis.ticks);
                    }
                } else {
                    xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                    yAxis = d3.axisLeft(newYScale);
                    
                    // yAxisのtickValues設定がある場合は適用
                    if (this.config && this.config.yAxis && this.config.yAxis.tickValues) {
                        yAxis.tickValues(this.config.yAxis.tickValues);
                    } else if (this.config && this.config.yAxis && this.config.yAxis.ticks) {
                        yAxis.ticks(this.config.yAxis.ticks);
                    }
                }
                
                g.select('.x-axis').transition().duration(200).call(xAxis);
                g.select('.y-axis').transition().duration(200).call(yAxis);
            }
        }
        
        // ChartTransitionsを使用して線を更新
        ChartTransitions.animateLine(
            group.selectAll('.chart-line'),
            () => newLine(currentData),
            {
                chartType: 'line',
                phase: 'update',
                duration: 200
            }
        ).attr('stroke', colorScale(seriesData.name));
        
        // ChartTransitionsを使用して点を更新
        const dataWithKeys = ChartTransitions.addObjectKeys(currentData, xField, seriesData.name);
        
        const scales = { x: newXScale, y: newYScale };
        const pointConfig = {
            chartType: 'line',
            xField: xField,
            yField: yField,
            radius: 3,
            duration: 200
        };
        
        ChartTransitions.applyEnterUpdateExit(
            group.selectAll('.chart-circle'),
            dataWithKeys,
            d => d._uniqueKey,
            {
                onEnter: (enterSelection) => {
                    ChartTransitions.animatePoints(
                        enterSelection
                            .append('circle')
                            .attr('class', 'chart-circle')
                            .attr('fill', colorScale(seriesData.name)),
                        scales,
                        { ...pointConfig, phase: 'enter' }
                    );
                },
                onUpdate: (allSelection, { allWithTransition }) => {
                    ChartTransitions.animatePoints(
                        allSelection,
                        scales,
                        { ...pointConfig, phase: 'update' }
                    );
                },
                onExit: (exitSelection) => {
                    exitSelection
                        .attr('r', 0)
                        .remove();
                }
            },
            { chartType: 'line', duration: 200 }
        );
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
        }
        
        if (config.multiSeries === false) {
            // 単一系列として強制的に扱う
            const result = [{
                name: config.seriesName || 'Data',
                values: filteredData.map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
            }];
            return result;
        }
        
        // 複数系列の場合
        const seriesNames = [...new Set(filteredData.map(d => d[seriesField]))];
        
        if (seriesNames.length === 1 && seriesNames[0] === undefined) {
            // seriesFieldが存在しない場合は単一系列として扱う
            const result = [{
                name: config.title || 'Data',
                values: filteredData.map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
            }];
            return result;
        }
        
        const result = seriesNames.map(name => ({
            name,
            values: filteredData
                .filter(d => d[seriesField] === name)
                .map(d => ({
                    [xField]: d[xField],
                    [yField]: d[yField]
                }))
        }));
        return result;
    }

    /**
     * 折れ線グラフを描画する
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderLineChart(data, config) {
        const { 
            width, height, margin, 
            xField = 'year', yField = 'value', 
            colors = d3.schemeCategory10,
            multiSeries = true,
            title = '',
            dataSource = ''
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
                .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
                .style('font-family', 'var(--font-family-serif)')
                .style('font-size', 'var(--font-size-base)')
                .style('font-weight', 'var(--font-weight-bold)')
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
        
        let yScale;
        if (config.yAxis && config.yAxis.type === 'log') {
            const yMin = yDomain[0] > 0 ? yDomain[0] : 1;
            yScale = d3.scaleLog()
                .domain([yMin, yDomain[1]])
                .range([innerHeight, 0]);
        } else {
            yScale = d3.scaleLinear()
                .domain(yDomain)
                .range([innerHeight, 0]);
        }
        
        // yRangeが明示的に設定されていない場合のみnice()を適用
        if (!(config.yRange && config.yRange.length === 2)) {
            yScale.nice();
        }

        // D3標準のカラースケール：地域名から直接色を取得
        const colorScale = this.createColorScale(series, config);

        // 単位情報を分析
        let unitInfo = { xAxis: {}, yAxis: {} };
        if (window.ChartLayoutHelper) {
            unitInfo = ChartLayoutHelper.analyzeUnits(data, config);
        }

        // 軸を描画（カスタムフォーマット優先、ChartLayoutHelper、D3デフォルトの順）
        let xAxis, yAxis;
        
        // Y軸フォーマッターを決定（優先順位：カスタム > ChartLayoutHelper > D3デフォルト）
        let yFormatter;
        if (config.yAxisFormat) {
            // カスタムフォーマットが指定されている場合
            yFormatter = (value) => ChartFormatterHelper.formatYAxisValue(value, config.yAxisFormat);
        } else if (window.ChartLayoutHelper) {
            // ChartLayoutHelperが利用可能な場合
            yFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.yAxis);
        } else {
            // デフォルト（D3の標準フォーマット）
            yFormatter = null; // D3のデフォルトを使用
        }
        
        xAxis = isYearData 
            ? d3.axisBottom(xScale).tickFormat(d3.format("d"))  // 年データは整数表示
            : d3.axisBottom(xScale);
        yAxis = yFormatter 
            ? d3.axisLeft(yScale).tickFormat(yFormatter)
            : d3.axisLeft(yScale);
            
        // yAxisのtickValues設定がある場合は適用
        if (config.yAxis && config.yAxis.type === 'log') {
            const tickValues = yScale.ticks().filter(d => Number.isInteger(Math.log10(d)) || d === 1);
            yAxis.tickValues(tickValues);
        } else if (config.yAxis && config.yAxis.tickValues) {
            yAxis.tickValues(config.yAxis.tickValues);
        } else if (config.yAxis && config.yAxis.ticks) {
            yAxis.ticks(config.yAxis.ticks);
        }
        
        // X軸フォーマッター（将来の拡張用）
        if (window.ChartLayoutHelper && !config.xAxisFormat) {
            const xFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.xAxis);
            if (xAxis && !isYearData) {
                xAxis.tickFormat(xFormatter);
            }
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

        // プログレッシブアニメーションかどうかをチェック
        const hasProgressiveAnimation = config.animation && config.animation.mode === 'progressive';
        
        let lineElements;
        if (!hasProgressiveAnimation) {
            // 通常のライン描画
            lineElements = seriesGroups.append('path')
                .attr('class', 'chart-line')
                .datum(d => d) // 系列データを設定
                .attr('stroke', d => colorScale(d.name))
                .attr('stroke-width', window.AppDefaults?.strokeWidth?.thick || 2)
                .attr('fill', 'none');

            // ChartTransitionsを使用してライン描画
            ChartTransitions.animateLine(lineElements, line, {
                chartType: 'line',
                phase: 'enter',
                animateEntry: true,
                duration: 600
            });
        }

        // ChartTransitionsを使用してポイント描画（progressiveモード以外）
        if (!config.animation || config.animation.mode !== 'progressive') {
            seriesGroups.each(function(seriesData) {
                const group = d3.select(this);
                
                // 一意キーでデータポイントを追跡
                const dataWithKeys = ChartTransitions.addObjectKeys(seriesData.values, xField, seriesData.name);
                
                const scales = { x: xScale, y: yScale };
                const pointConfig = {
                    chartType: 'line',
                    phase: 'enter',
                    xField: xField,
                    yField: yField,
                    radius: 3,
                    isYearData: isYearData,
                    duration: 600
                };

                // ポイントのエンターアニメーション
                ChartTransitions.createStaggered(
                group.selectAll('.chart-circle')
                    .data(dataWithKeys, d => d._uniqueKey)
                    .enter()
                    .append('circle')
                    .attr('class', 'chart-circle')
                    .attr('fill', d => colorScale(seriesData.name)),
                { delay: 15, duration: 600 }
            ).call(function(selection) {
                ChartTransitions.animatePoints(selection, scales, pointConfig);
            });
            });
        }

        // プログレッシブアニメーションが設定されている場合の処理
        if (hasProgressiveAnimation) {
            this.renderProgressiveAnimation(seriesGroups, series, line, xScale, yScale, xField, yField, colorScale, config);
        }

        // プログレッシブアニメーション完了後にインラインラベルを追加
        if (hasProgressiveAnimation && config.legendType === 'inline' && series.length > 1) {
            const animationDuration = config.animation?.duration || 3000;
            setTimeout(() => {
                const context = { 
                    xScale, 
                    yScale, 
                    width: innerWidth, 
                    height: innerHeight, 
                    isYearData, 
                    xField, 
                    yField,
                    isDualLayout: false // 通常の折れ線グラフは常にfalse
                };
                this.addInlineLabelsWithAnimation(g, series, colorScale, context);
            }, animationDuration + 500); // アニメーション完了後500ms待機
        }

        // レジェンドを追加（複数系列の場合のみ）
        if (series.length > 1) {
            const legendType = config.legendType || 'traditional';
            if (legendType === 'inline' && !hasProgressiveAnimation) {
                // プログレッシブアニメーションがない場合はすぐに表示
                const context = { 
                    xScale, 
                    yScale, 
                    width: innerWidth, 
                    height: innerHeight, 
                    isYearData, 
                    xField, 
                    yField,
                    isDualLayout: false // 通常の折れ線グラフは常にfalse
                };
                this.addInlineLabels(g, series, colorScale, context);
            } else if (legendType === 'traditional') {
                this.addLegend(svg, series, colorScale, width, height);
            }
        }

        // 注釈（アノテーション）を描画
        if (config.annotations) {
            this.renderAnnotations(g, config.annotations, { xScale, yScale, width: innerWidth, height: innerHeight, isYearData, xField, yField });
        }

        // データソースを表示
        if (dataSource) {
            this.addDataSource(svg, dataSource, width, height);
        }
    }

    /**
     * 指定されたグループ内で折れ線グラフを描画
     */
    renderLineChartInGroup(g, data, config) {
        const { width, height, xField = 'year', yField = 'value', colors = d3.schemeCategory10, multiSeries = true, dataSource = '' } = config;
        
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
            .range([height, 0]);
        
        // yRangeが明示的に設定されていない場合のみnice()を適用
        if (!(config.yRange && config.yRange.length === 2)) {
            yScale.nice();
        }

        // D3標準のカラースケール：地域名から直接色を取得
        const colorScale = this.createColorScale(series, config);

        // 単位情報を分析
        let unitInfo = { xAxis: {}, yAxis: {} };
        if (window.ChartLayoutHelper) {
            unitInfo = ChartLayoutHelper.analyzeUnits(data, config);
        }

        // 軸を描画（カスタムフォーマット優先、ChartLayoutHelper、D3デフォルトの順）
        let xAxis, yAxis;
        
        // Y軸フォーマッターを決定（優先順位：カスタム > ChartLayoutHelper > D3デフォルト）
        let yFormatter;
        if (config.yAxisFormat) {
            // カスタムフォーマットが指定されている場合
            yFormatter = (value) => ChartFormatterHelper.formatYAxisValue(value, config.yAxisFormat);
        } else if (window.ChartLayoutHelper) {
            // ChartLayoutHelperが利用可能な場合
            yFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.yAxis);
        } else {
            // デフォルト（D3の標準フォーマット）
            yFormatter = null; // D3のデフォルトを使用
        }
        
        xAxis = isYearData 
            ? d3.axisBottom(xScale).tickFormat(d3.format("d"))  // 年データは整数表示
            : d3.axisBottom(xScale);
        yAxis = yFormatter 
            ? d3.axisLeft(yScale).tickFormat(yFormatter)
            : d3.axisLeft(yScale);
            
        // yAxisのtickValues設定がある場合は適用
        if (config.yAxis && config.yAxis.type === 'log') {
            const tickValues = yScale.ticks().filter(d => Number.isInteger(Math.log10(d)) || d === 1);
            yAxis.tickValues(tickValues);
        } else if (config.yAxis && config.yAxis.tickValues) {
            yAxis.tickValues(config.yAxis.tickValues);
        } else if (config.yAxis && config.yAxis.ticks) {
            yAxis.ticks(config.yAxis.ticks);
        }
        
        // X軸フォーマッター（将来の拡張用）
        if (window.ChartLayoutHelper && !config.xAxisFormat) {
            const xFormatter = (value) => ChartLayoutHelper.formatAxisWithUnits(value, unitInfo.xAxis);
            if (xAxis && !isYearData) {
                xAxis.tickFormat(xFormatter);
            }
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

        // プログレッシブアニメーションの設定をチェック
        const hasProgressiveAnimation = config.animation && config.animation.mode === 'progressive';

        if (hasProgressiveAnimation) {
            // プログレッシブアニメーションが設定されている場合は、アニメーション関数で描画
            this.renderProgressiveAnimation(seriesGroups, series, line, xScale, yScale, xField, yField, colorScale, config);
        } else {
            // 通常の描画
            // ラインを描画
            seriesGroups.append('path')
                .attr('class', 'chart-line')
                .datum(d => d) // 系列データを設定
                .attr('d', d => line(d.values))
                .attr('stroke', d => colorScale(d.name))
                .attr('stroke-width', window.AppDefaults?.strokeWidth?.thick || 2)
                .attr('fill', 'none');

            // ポイントを描画
            seriesGroups.each(function(seriesData) {
                const group = d3.select(this);
                
                const circles = group.selectAll('.chart-circle')
                    .data(seriesData.values)
                    .enter()
                    .append('circle')
                    .attr('class', 'chart-circle')
                    .attr('cx', d => isYearData ? xScale(+d[xField]) : xScale(new Date(d[xField])))
                    .attr('cy', d => yScale(+d[yField]))
                    .attr('r', 3)
                    .attr('fill', colorScale(seriesData.name));
            });
        }

        // コンパクトなレジェンドを追加（複数系列の場合のみ）
        if (series.length > 1) {
            const legendType = config.legendType || 'traditional';
            if (legendType === 'inline') {
                const context = { 
                    xScale, 
                    yScale, 
                    width, 
                    height, 
                    isYearData, 
                    xField, 
                    yField,
                    isDualLayout: config.isDualLayout || false // デュアルレイアウトフラグを追加
                };
                this.addInlineLabels(g, series, colorScale, context);
            } else {
                this.addCompactLegend(g, series, colorScale, width, height);
            }
        }

        // データソースを表示
        if (dataSource) {
            g.append('text')
                .attr('class', 'chart-data-source')
                .attr('x', 0)
                .attr('y', height + 35) // X軸の下に配置
                .attr('text-anchor', 'start')
                .style('font-size', '12px')
                .style('fill', '#888')
                .style('font-style', 'normal')
                .text(`出典: ${dataSource}`);
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
            .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333');
        
        // テキスト省略処理
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
                // テキストを省略
                let shortenedText = text;
                if (text.length > 10) {
                    shortenedText = text.substring(0, 8) + '...';
                }
                textElement.text(shortenedText);
                
                // ツールチップで完全なテキストを表示
                textElement.append('title').text(text);
            }
        });
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
            .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333');
        
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
            }
        });
    }

    /**
     * インライン（線末）ラベルを追加
     * @param {d3.Selection} g - グラフのメインg要素
     * @param {Array} series - 系列データ
     * @param {Function} colorScale - 色スケール
     * @param {Object} context - コンテキスト（スケール、サイズ等）
     */
    addInlineLabels(g, series, colorScale, context) {
        if (!series || series.length <= 1) return;
        
        const { xScale, yScale, width, height, isYearData, xField, yField, isDualLayout = false } = context;
        
        // デュアルレイアウト（二個並び）用の設定
        if (isDualLayout) {
            this.addInlineLabelsDualLayout(g, series, colorScale, context);
            return;
        }
        
        // インライン設定のデフォルト値（D3-Labelerに最適化）
        const inlineConfig = {
            fontSize: '12px',
            fontFamily: 'var(--font-family-serif), "Shippori Mincho", serif',
            offsetX: 15, // 適度なオフセット
            offsetY: 0, // D3-Labelerが垂直位置を制御するため0に
            minDistance: 20, // D3-Labelerの重複検出で十分
            useLabeler: true,
            enableLeaderLines: true,
            leaderLineLength: 30, // 適度な長さ
            maxLabelWidth: width * 0.3, // 最大ラベル幅
            responsiveThreshold: 600, // この幅以下では従来の凡例にフォールバック
            verticalSpacing: 25, // 垂直方向の最小間隔（前処理用）
            allowExtendedPlacement: true, // チャート外への配置を許可
            maxExtensionWidth: 200, // チャート右端からの最大拡張幅を増加
            labelPadding: 6 // ラベル周りの余白
        };

        // 小画面の場合は従来の凡例を使用
        if (window.innerWidth < inlineConfig.responsiveThreshold) {
            this.addCompactLegend(g, series, colorScale, width, height);
            return;
        }

        // 各系列の最後のデータポイントを取得
        const endPoints = series.map(seriesData => {
            const lastPoint = seriesData.values[seriesData.values.length - 1];
            if (!lastPoint) return null;

            const x = isYearData ? xScale(+lastPoint[xField]) : xScale(new Date(lastPoint[xField]));
            const y = yScale(+lastPoint[yField]);
            
            return {
                name: seriesData.name,
                x: x,
                y: y,
                color: colorScale(seriesData.name),
                originalX: x,
                originalY: y
            };
        }).filter(point => point !== null);

        if (endPoints.length === 0) {
            console.warn('LineChartRenderer: No valid end points found for inline labels');
            return;
        }

        // ラベルの初期位置を計算
        const labels = endPoints.map(point => {
            const labelText = window.TextMeasurement 
                ? window.TextMeasurement.truncateText(point.name, inlineConfig.maxLabelWidth, { 
                    fontSize: inlineConfig.fontSize,
                    fontFamily: inlineConfig.fontFamily
                })
                : point.name;

            const labelWidth = window.TextMeasurement 
                ? window.TextMeasurement.measureTextWidth(labelText, {
                    fontSize: inlineConfig.fontSize,
                    fontFamily: inlineConfig.fontFamily
                })
                : labelText.length * 8;

            const labelHeight = window.TextMeasurement 
                ? window.TextMeasurement.measureTextHeight(labelText, {
                    fontSize: inlineConfig.fontSize,
                    fontFamily: inlineConfig.fontFamily
                })
                : 14;

            // より積極的な初期位置設定で重複を事前に避ける
            const baseX = point.x + inlineConfig.offsetX;
            const adjustedX = Math.min(baseX, width + (inlineConfig.maxExtensionWidth || 100) - labelWidth - 5);
            
            // D3-Labelerはy座標をラベルの下端として扱うことに注意
            return {
                x: adjustedX,
                y: point.y + labelHeight / 2, // ラベルの下端位置に調整
                width: labelWidth,
                height: labelHeight,
                text: labelText,
                color: point.color,
                anchorX: point.x,
                anchorY: point.y,
                originalName: point.name,
                centerY: point.y // 元の中心Y座標を保持
            };
        });

        // シンプルで確実な重複回避を使用
        this.applyDeterministicLabelPlacement(labels, width, height, inlineConfig);

        // ラベルグループを作成
        const labelGroup = g.append('g')
            .attr('class', 'inline-labels');

        // 引き出し線を描画（必要な場合）
        if (inlineConfig.enableLeaderLines) {
            this.addLeaderLines(labelGroup, labels);
        }

        // ラベルを描画
        this.renderInlineLabels(labelGroup, labels, inlineConfig);
    }
    
    /**
     * デュアルレイアウト（二個並び）専用のインラインラベル配置
     * @param {d3.Selection} g - グラフのメインg要素
     * @param {Array} series - 系列データ
     * @param {Function} colorScale - 色スケール
     * @param {Object} context - コンテキスト（スケール、サイズ等）
     */
    addInlineLabelsDualLayout(g, series, colorScale, context) {
        const { xScale, yScale, width, height, isYearData, xField, yField } = context;
        
        // デュアルレイアウト専用設定
        const dualConfig = {
            fontSize: '11px', // 若干小さくして見やすく
            fontFamily: 'var(--font-family-serif), "Shippori Mincho", serif',
            offsetX: 8, // 小さめのオフセット
            offsetY: 0,
            minDistance: 15, // 最小距離を短く
            enableLeaderLines: false, // 引き出し線は無効化
            maxLabelWidth: width * 0.4, // 最大ラベル幅を広げる
            verticalSpacing: 18, // 垂直間隔を狭く
            maxExtensionWidth: 50, // 拡張幅を小さく
            labelPadding: 4, // パディングを調整
            layoutStrategy: 'compact' // コンパクト配置
        };
        
        // 各系列の最後のデータポイントを取得
        const endPoints = series.map(seriesData => {
            const lastPoint = seriesData.values[seriesData.values.length - 1];
            if (!lastPoint) return null;

            const x = isYearData ? xScale(+lastPoint[xField]) : xScale(new Date(lastPoint[xField]));
            const y = yScale(+lastPoint[yField]);
            
            return {
                name: seriesData.name,
                x: x,
                y: y,
                color: colorScale(seriesData.name),
                originalX: x,
                originalY: y
            };
        }).filter(point => point !== null);

        if (endPoints.length === 0) {
            console.warn('LineChartRenderer: No valid end points found for dual layout inline labels');
            return;
        }

        // ラベルの初期位置を計算
        const labels = endPoints.map(point => {
            const labelText = window.TextMeasurement 
                ? window.TextMeasurement.truncateText(point.name, dualConfig.maxLabelWidth, { 
                    fontSize: dualConfig.fontSize,
                    fontFamily: dualConfig.fontFamily
                })
                : point.name;

            const labelWidth = window.TextMeasurement 
                ? window.TextMeasurement.measureTextWidth(labelText, {
                    fontSize: dualConfig.fontSize,
                    fontFamily: dualConfig.fontFamily
                })
                : labelText.length * 7; // 小さめのフォントサイズに合わせて調整

            const labelHeight = window.TextMeasurement 
                ? window.TextMeasurement.measureTextHeight(labelText, {
                    fontSize: dualConfig.fontSize,
                    fontFamily: dualConfig.fontFamily
                })
                : 12;

            // デュアルレイアウト用のX座標計算（より近くに配置）
            const baseX = point.x + dualConfig.offsetX;
            const adjustedX = Math.min(baseX, width + dualConfig.maxExtensionWidth - labelWidth - 3);
            
            return {
                x: adjustedX,
                y: point.y, // デュアルレイアウトでは中心位置に配置
                width: labelWidth,
                height: labelHeight,
                text: labelText,
                color: point.color,
                anchorX: point.x,
                anchorY: point.y,
                originalName: point.name,
                centerY: point.y
            };
        });

        // デュアルレイアウト専用の配置アルゴリズム
        this.applyDualLayoutPlacement(labels, width, height, dualConfig);

        // ラベルグループを作成
        const labelGroup = g.append('g')
            .attr('class', 'inline-labels dual-layout');

        // デュアルレイアウト用のラベル描画
        this.renderDualLayoutLabels(labelGroup, labels, dualConfig);
    }
    
    /**
     * デュアルレイアウト専用の配置アルゴリズム
     * @param {Array} labels - ラベル配列
     * @param {number} width - グラフ幅
     * @param {number} height - グラフ高さ
     * @param {Object} config - デュアルレイアウト設定
     */
    applyDualLayoutPlacement(labels, width, height, config) {
        
        // Y座標でソート
        const sortedLabels = [...labels].sort((a, b) => a.anchorY - b.anchorY);
        
        // 全体的に上にオフセット（折れ線との重複を避けるため）
        const upwardOffset = -60; // 上に60px移動
        
        // 縦方向の重複を回避（シンプルで確実な方法）
        for (let i = 0; i < sortedLabels.length; i++) {
            const currentLabel = sortedLabels[i];
            
            if (i === 0) {
                // 最初のラベルは上方向オフセットを適用
                currentLabel.y = currentLabel.anchorY + upwardOffset;
            } else {
                const previousLabel = sortedLabels[i - 1];
                const requiredSpacing = config.verticalSpacing;
                
                // 前のラベルからの最小間隔を確保
                const minY = previousLabel.y + requiredSpacing;
                const preferredY = currentLabel.anchorY + upwardOffset;
                
                currentLabel.y = Math.max(minY, preferredY);
            }
            
            // チャート範囲内に収まるように調整
            currentLabel.y = Math.max(0, Math.min(currentLabel.y, height - 10));
        }
        
        // X座標は固定位置に配置（階段状にしない）
        const targetX = width + config.offsetX;
        labels.forEach(label => {
            label.x = Math.min(targetX, width + config.maxExtensionWidth - label.width - 5);
        });
        
    }
    
    /**
     * デュアルレイアウト用のラベル描画
     * @param {d3.Selection} labelGroup - ラベルグループ
     * @param {Array} labels - ラベル配列
     * @param {Object} config - デュアルレイアウト設定
     */
    renderDualLayoutLabels(labelGroup, labels, config) {
        const labelTexts = labelGroup.selectAll('.inline-label')
            .data(labels)
            .enter()
            .append('text')
            .attr('class', 'inline-label dual-layout-label')
            .attr('x', d => d.x)
            .attr('y', d => d.y)
            .attr('dy', '0.35em')
            .attr('font-size', config.fontSize)
            .attr('font-family', config.fontFamily)
            .attr('fill', d => d.color)
            .attr('text-anchor', 'start')
            .style('user-select', 'none')
            .style('pointer-events', 'none')
            .text(d => d.text);

        // 背景（オプション：視認性向上のため）
        const backgrounds = labelGroup.selectAll('.label-background')
            .data(labels)
            .enter()
            .insert('rect', '.inline-label')
            .attr('class', 'label-background dual-layout-bg')
            .attr('x', d => d.x - config.labelPadding)
            .attr('y', d => d.y - d.height / 2 - config.labelPadding)
            .attr('width', d => d.width + config.labelPadding * 2)
            .attr('height', d => d.height + config.labelPadding * 2)
            .attr('fill', 'rgba(255, 255, 255, 0.8)')
            .attr('stroke', 'rgba(0, 0, 0, 0.1)')
            .attr('stroke-width', 0.5)
            .attr('rx', 2)
            .style('pointer-events', 'none');
    }

    /**
     * アニメーション付きでインラインラベルを追加
     * @param {d3.Selection} g - グラフのメインg要素
     * @param {Array} series - 系列データ
     * @param {Function} colorScale - 色スケール
     * @param {Object} context - コンテキスト（スケール、サイズ等）
     */
    addInlineLabelsWithAnimation(g, series, colorScale, context) {
        // まず通常のインラインラベル追加処理を実行
        this.addInlineLabels(g, series, colorScale, context);
        
        // アニメーションを適用
        const labelGroup = g.select('.inline-labels');
        if (labelGroup.empty()) return;
        
        // ラベルテキストのエントリーアニメーション
        labelGroup.selectAll('.inline-label')
            .style('opacity', 0)
            .style('transform', 'translateX(-15px)')
            .transition()
            .duration(600)
            .delay((d, i) => i * 150) // 各ラベルを順次表示
            .ease(d3.easeBackOut.overshoot(1.2))
            .style('opacity', 1)
            .style('transform', 'translateX(0px)');
        
        // 背景の段階的表示
        labelGroup.selectAll('rect')
            .style('opacity', 0)
            .transition()
            .duration(400)
            .delay((d, i) => i * 150 + 200) // テキストより少し遅れて表示
            .ease(d3.easeQuadOut)
            .style('opacity', 0.9);
        
        // 引き出し線の段階的表示
        labelGroup.selectAll('.leader-line')
            .style('opacity', 0)
            .style('stroke-dasharray', '0,100')
            .transition()
            .duration(800)
            .delay((d, i) => i * 150 + 300)
            .ease(d3.easeQuadInOut)
            .style('opacity', 0.7)
            .style('stroke-dasharray', '2,2');
        
    }

    /**
     * D3-Labelerを使用してラベル位置を最適化
     * @param {Array} labels - ラベル配列
     * @param {number} width - グラフ幅
     * @param {number} height - グラフ高さ
     * @param {Object} config - インライン設定
     */
    optimizeLabelPositions(labels, width, height, config) {
        try {
            // D3-Labelerの存在確認
            if (!window.d3 || !window.d3.labeler) {
                console.error('LineChartRenderer: D3-Labeler is not loaded!');
                this.applySimpleCollisionAvoidance(labels, config);
                return;
            }

            // アンカーポイント（線の終点）
            const anchors = labels.map(label => ({
                x: label.anchorX,
                y: label.anchorY,
                r: 5 // 適度な半径
            }));

            // ラベルの初期配置を改善：重複を事前に避ける
            this.preProcessLabelPositions(labels, config);

            // デバッグ：初期位置を記録
            const beforePositions = labels.map(label => ({
                text: label.text,
                x: label.x,
                y: label.y
            }));
            beforePositions.forEach((pos, i) => {
            });

            // D3-Labelerを実行（座標系を正しく設定）
            const labeler = d3.labeler()
                .label(labels)
                .anchor(anchors)
                .width(width + 150) // チャート幅を右に拡張
                .height(height + 50) // 高さも少し拡張
                .start(1000); // イテレーション数


            // デバッグ：最適化後の位置を確認
            labels.forEach((label, i) => {
                const before = beforePositions[i];
                const moved = Math.abs(label.x - before.x) > 1 || Math.abs(label.y - before.y) > 1;
            });
            
            // 後処理：チャート範囲外に出たラベルを調整
            this.postProcessLabelPositions(labels, width, height, config);
            
        } catch (error) {
            console.error('LineChartRenderer: D3-Labeler optimization failed:', error);
            console.error(error.stack);
            // フォールバックとして簡易重複回避を実行
            this.applySimpleCollisionAvoidance(labels, config);
        }
    }

    /**
     * ラベル位置の前処理：事前に重複しやすい配置を避ける
     * @param {Array} labels - ラベル配列
     * @param {Object} config - インライン設定
     */
    preProcessLabelPositions(labels, config) {
        // Y座標でソート（D3-Labelerのy座標は下端なので調整）
        const sortedLabels = [...labels].sort((a, b) => (a.y - a.height) - (b.y - b.height));
        
        // 初期配置を少し散らして、D3-Labelerの作業を助ける
        sortedLabels.forEach((label, index) => {
            // 軽微なランダム化で初期位置を微調整（D3-Labelerが最適化しやすくする）
            label.x += (Math.random() - 0.5) * 10;
            label.y += (Math.random() - 0.5) * 5;
            
            // 中心座標を更新
            label.centerY = label.y - label.height / 2;
        });
    }

    /**
     * ラベル位置の後処理：チャート範囲外のラベルを調整
     * @param {Array} labels - ラベル配列
     * @param {number} width - グラフ幅
     * @param {number} height - グラフ高さ
     * @param {Object} config - インライン設定
     */
    postProcessLabelPositions(labels, width, height, config) {
        labels.forEach(label => {
            // X座標の調整：拡張配置を考慮
            const maxExtension = config.allowExtendedPlacement 
                ? (config.maxExtensionWidth || 120) 
                : 50; // デフォルトの小さな拡張
            const maxX = width + maxExtension - label.width - 5;
            
            if (label.x > maxX) {
                label.x = maxX;
            }
            
            // 最小X位置の制限（チャート内の最低位置）
            const minX = Math.max(width * 0.7, width - 50); // チャート幅の70%位置または右端から50px
            if (label.x < minX) {
                label.x = minX;
            }
            
            // Y座標の調整：ラベルがチャートの上下端を超えないように
            const minY = label.height / 2 + 5;
            const maxY = height - label.height / 2 - 5;
            
            if (label.y < minY) {
                label.y = minY;
            } else if (label.y > maxY) {
                label.y = maxY;
            }
        });
    }

    /**
     * 確実で理解しやすい重複回避アルゴリズム
     * @param {Array} labels - ラベル配列
     * @param {number} width - チャート幅
     * @param {number} height - チャート高さ
     * @param {Object} config - インライン設定
     */
    applyDeterministicLabelPlacement(labels, width, height, config) {
        
        // アンカーY座標でソート（上から下へ）
        const sortedLabels = [...labels].sort((a, b) => a.anchorY - b.anchorY);
        
        // ラベル間の最小間隔
        const minSpacing = 20;
        const labelCount = sortedLabels.length;
        
        // 必要な総高さ
        const totalLabelHeight = sortedLabels.reduce((sum, label) => sum + label.height, 0);
        const totalSpacing = (labelCount - 1) * minSpacing;
        const requiredHeight = totalLabelHeight + totalSpacing;
        
        // チャート中央を基準にラベルを配置
        this.distributeLabelsCentered(sortedLabels, height, requiredHeight, minSpacing);
        
        // X座標を調整（より右寄りで統一された配置）
        this.adjustXPositionsImproved(sortedLabels, width, config);
        
        sortedLabels.forEach((label, i) => {
        });
    }

    /**
     * ラベルをチャート中央基準で配置
     */
    distributeLabelsCentered(labels, chartHeight, requiredHeight, minSpacing) {
        // チャート中央を基準点として計算
        const chartCenter = chartHeight / 2;
        
        // ラベル全体の高さの半分を中央から上下に配置
        const startY = chartCenter - requiredHeight / 2;
        
        // 上端・下端の制限
        const minY = Math.max(20, startY);
        const maxY = chartHeight - 20;
        const availableHeight = maxY - minY;
        
        // 実際の配置開始位置を調整
        let actualStartY = minY;
        if (requiredHeight <= availableHeight) {
            // 十分なスペースがある場合は中央寄せ
            actualStartY = chartCenter - requiredHeight / 2;
            actualStartY = Math.max(minY, actualStartY);
        }
        
        // ラベルを順次配置
        let currentY = actualStartY;
        labels.forEach((label, index) => {
            label.y = currentY + label.height / 2; // ラベル中心位置
            currentY += label.height + minSpacing;
        });
        
    }

    /**
     * X座標を改善された方法で調整（より右寄り、統一感のある配置）
     */
    adjustXPositionsImproved(labels, width, config) {
        // チャート右端からさらに右寄りの位置に配置（引き出し線と折れ線の重複を避ける）
        const baseX = width + 60; // チャート右端から60px右に移動
        const maxExtension = config.maxExtensionWidth || 200; // 拡張幅も増加
        
        labels.forEach((label, index) => {
            // 全て同じX位置に揃える（階段状ではなく垂直に整列）
            label.x = Math.min(baseX, width + maxExtension - label.width - 10);
        });
        
    }

    /**
     * ラベルを等間隔で配置（レガシー）
     */
    distributeLabelsEvenly(labels, minY, maxY, minSpacing) {
        let currentY = minY;
        
        labels.forEach((label, index) => {
            label.y = currentY + label.height / 2; // ラベル中心位置
            currentY += label.height + minSpacing;
        });
    }

    /**
     * ラベルを圧縮して配置（レガシー）
     */
    distributeLabelsCompressed(labels, minY, maxY) {
        const availableHeight = maxY - minY;
        const totalLabelHeight = labels.reduce((sum, label) => sum + label.height, 0);
        const spacingPerGap = Math.max(5, (availableHeight - totalLabelHeight) / (labels.length - 1));
        
        let currentY = minY;
        labels.forEach((label, index) => {
            label.y = currentY + label.height / 2; // ラベル中心位置
            currentY += label.height + spacingPerGap;
        });
    }

    /**
     * X座標を階段状に調整（レガシー）
     */
    adjustXPositions(labels, width, config) {
        const baseX = width * 0.85; // チャート右端から少し左
        const maxExtension = config.maxExtensionWidth || 100;
        const staggerStep = 15; // 階段の段差
        
        labels.forEach((label, index) => {
            // 階段状に配置（3段階のパターンを繰り返し）
            const staggerOffset = (index % 3) * staggerStep;
            label.x = Math.min(baseX + staggerOffset, width + maxExtension - label.width - 10);
        });
    }

    /**
     * 簡易的な重複回避アルゴリズム（フォールバック）
     * @param {Array} labels - ラベル配列
     * @param {Object} config - インライン設定
     */
    applySimpleCollisionAvoidance(labels, config) {
        
        // Y座標でソートして上から順に配置
        const sortedLabels = [...labels].sort((a, b) => a.anchorY - b.anchorY);
        
        for (let i = 0; i < sortedLabels.length; i++) {
            const currentLabel = sortedLabels[i];
            
            // 他のラベルとの重複をチェック
            for (let j = 0; j < i; j++) {
                const otherLabel = sortedLabels[j];
                
                if (this.isLabelsOverlapping(currentLabel, otherLabel, config.minDistance)) {
                    // 重複している場合は位置を調整
                    this.adjustLabelPosition(currentLabel, otherLabel, config);
                }
            }
        }
        
    }

    /**
     * 2つのラベルが重複しているかチェック
     * @param {Object} label1 - ラベル1
     * @param {Object} label2 - ラベル2  
     * @param {number} minDistance - 最小距離
     * @returns {boolean} 重複しているかどうか
     */
    isLabelsOverlapping(label1, label2, minDistance) {
        // ラベルの境界ボックスを計算（パディングを含む）
        const padding = 5;
        const box1 = {
            left: label1.x - padding,
            right: label1.x + label1.width + padding,
            top: label1.y - label1.height / 2 - padding,
            bottom: label1.y + label1.height / 2 + padding
        };
        
        const box2 = {
            left: label2.x - padding,
            right: label2.x + label2.width + padding,
            top: label2.y - label2.height / 2 - padding,
            bottom: label2.y + label2.height / 2 + padding
        };
        
        // より厳格な重複チェック
        const horizontalOverlap = box1.right + minDistance > box2.left && box1.left < box2.right + minDistance;
        const verticalOverlap = box1.bottom + minDistance > box2.top && box1.top < box2.bottom + minDistance;
        
        return horizontalOverlap && verticalOverlap;
    }

    /**
     * ラベル位置を調整して重複を解消
     * @param {Object} currentLabel - 調整対象のラベル
     * @param {Object} otherLabel - 重複している他のラベル
     * @param {Object} config - インライン設定
     */
    adjustLabelPosition(currentLabel, otherLabel, config) {
        const dy = currentLabel.y - otherLabel.y;
        const requiredVerticalSpace = (currentLabel.height + otherLabel.height) / 2 + config.verticalSpacing;
        
        if (Math.abs(dy) < requiredVerticalSpace) {
            // 垂直方向に移動
            if (dy >= 0) {
                // currentLabelが下にある場合は、さらに下に移動
                currentLabel.y = otherLabel.y + requiredVerticalSpace;
            } else {
                // currentLabelが上にある場合は、さらに上に移動
                currentLabel.y = otherLabel.y - requiredVerticalSpace;
            }
        }
        
        // X方向の調整：引き出し線を長くして右に移動
        const dx = currentLabel.x - otherLabel.x;
        if (Math.abs(dx) < config.minDistance) {
            currentLabel.x = Math.max(currentLabel.x, otherLabel.x + config.minDistance + currentLabel.width);
        }
    }

    /**
     * 引き出し線を追加
     * @param {d3.Selection} labelGroup - ラベルグループ
     * @param {Array} labels - ラベル配列
     */
    addLeaderLines(labelGroup, labels) {
        const leaderLines = labelGroup.selectAll('.leader-line')
            .data(labels)
            .enter()
            .append('line')
            .attr('class', 'leader-line')
            .attr('x1', d => d.anchorX)
            .attr('y1', d => d.anchorY)
            .attr('x2', d => d.x)
            // 新しいアルゴリズムではyは既にラベルの中心位置
            .attr('y2', d => d.y)
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2')
            .attr('opacity', 0.7)
            .style('pointer-events', 'none');

        // 引き出し線が短い場合は非表示
        leaderLines.style('display', d => {
            const dx = d.x - d.anchorX;
            const dy = d.y - d.anchorY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 10 ? 'none' : 'block';
        });
    }

    /**
     * インラインラベルを描画
     * @param {d3.Selection} labelGroup - ラベルグループ
     * @param {Array} labels - ラベル配列
     * @param {Object} config - 設定
     */
    renderInlineLabels(labelGroup, labels, config) {
        const labelTexts = labelGroup.selectAll('.inline-label')
            .data(labels)
            .enter()
            .append('text')
            .attr('class', 'inline-label')
            .attr('x', d => d.x)
            // 新しいアルゴリズムではyは既にラベルの中心位置
            .attr('y', d => d.y)
            .attr('dy', '0.35em')
            .attr('font-size', config.fontSize)
            .attr('font-family', config.fontFamily)
            .attr('font-weight', 'bold')
            .attr('fill', d => d.color)
            .text(d => d.text)
            .style('pointer-events', 'none');

        // ラベルの背景を追加（可読性向上）
        labelTexts.each(function(d) {
            const textElement = d3.select(this);
            let bbox;
            
            try {
                bbox = this.getBBox();
            } catch (error) {
                // getBBoxが失敗した場合のフォールバック
                bbox = {
                    x: d.x - d.width / 2,
                    y: d.y - d.height / 2,
                    width: d.width,
                    height: d.height
                };
            }

            labelGroup.insert('rect', '.inline-label')
                .attr('x', bbox.x - 2)
                .attr('y', bbox.y - 2)
                .attr('width', bbox.width + 4)
                .attr('height', bbox.height + 4)
                .attr('fill', 'rgba(255, 255, 255, 0.9)')
                .attr('stroke', d.color)
                .attr('stroke-width', 0.5)
                .attr('rx', 2)
                .style('pointer-events', 'none');
        });

        // ツールチップを追加（省略されたテキストの場合）
        labelTexts.filter(d => d.text !== d.originalName)
            .append('title')
            .text(d => d.originalName);
    }

    /**
     * 注釈（アノテーション）を描画
     */
    renderAnnotations(g, annotations, context) {
        if (!annotations || annotations.length === 0) return;
        
        const { xScale, yScale, width, height, isYearData, xField, yField } = context;
        
        // スケールが存在しない場合は処理をスキップ
        if (!xScale || !yScale) {
            console.warn('LineChartRenderer: xScale or yScale is undefined, skipping annotations');
            return;
        }
        
        const annotationGroup = g.append('g')
            .attr('class', 'chart-annotations');
        
        annotations.forEach((annotation, index) => {
            let { type, x, y, text, style = {} } = annotation;
            
            // 古い形式のアノテーションをサポート
            if (annotation.year !== undefined) {
                x = annotation.year;
                y = annotation.y || yScale.domain()[1]; // デフォルトで上端
                text = annotation.label || text;
                
                // verticalLine を line に変換
                if (type === 'verticalLine') {
                    type = 'line';
                }
            }
            
            // horizontalLine の場合
            if (type === 'horizontalLine' && annotation.value !== undefined) {
                y = annotation.value;
                x = x || xScale.domain()[0]; // デフォルトで左端
                text = annotation.label || text;
                type = 'horizontalLine';
            }
            
            // X座標の変換
            let xPos;
            try {
                if (isYearData) {
                    xPos = xScale(+x);
                } else {
                    xPos = xScale(new Date(x));
                }
            } catch (error) {
                console.warn(`LineChartRenderer: Failed to convert x coordinate for annotation ${index}:`, x, error);
                xPos = 0;
            }
            
            // Y座標の変換
            let yPos;
            try {
                yPos = yScale(+y);
            } catch (error) {
                console.warn(`LineChartRenderer: Failed to convert y coordinate for annotation ${index}:`, y, error);
                yPos = 0;
            }
            
            // 座標が有効かチェック
            if (isNaN(xPos) || isNaN(yPos)) {
                console.warn(`LineChartRenderer: Invalid coordinates for annotation ${index}: x=${xPos}, y=${yPos}`);
                return;
            }
            
            // 注釈要素を作成
            const annotationElement = annotationGroup.append('g')
                .attr('class', `annotation annotation-${index}`)
                .attr('transform', `translate(${xPos}, ${yPos})`);
            
            switch (type) {
                case 'point':
                    // ポイント注釈
                    annotationElement.append('circle')
                        .attr('r', style.radius || 5)
                        .attr('fill', style.color || window.AppConstants?.APP_COLORS?.ANNOTATIONS?.POINT || '#ff6b6b')
                        .attr('stroke', style.strokeColor || window.AppConstants?.APP_COLORS?.ANNOTATIONS?.STROKE || '#fff')
                        .attr('stroke-width', style.strokeWidth || 2);
                    break;
                    
                case 'line':
                    // 線注釈（垂直線）
                    annotationElement.append('line')
                        .attr('x1', 0)
                        .attr('y1', -yPos) // チャート上端まで
                        .attr('x2', 0)
                        .attr('y2', height - yPos) // チャート下端まで
                        .attr('stroke', style.color || window.AppDefaults?.colors?.text?.secondary || '#999')
                        .attr('stroke-width', style.strokeWidth || window.AppDefaults?.strokeWidth?.normal || 1)
                        .attr('stroke-dasharray', style.dashArray || '3,3');
                    
                    // ラベルテキストを追加
                    if (text) {
                        const position = annotation.position || 'top-left';
                        let textX = 5; // デフォルトは右側
                        let textY = -yPos + 15; // デフォルトは上側
                        let textAnchor = 'start'; // デフォルトは左寄せ
                        
                        if (position.includes('right')) {
                            textX = 5; // 線の右側に配置
                            textAnchor = 'start'; // テキストを左寄せ
                        } else if (position.includes('left')) {
                            textX = -5; // 線の左側に配置
                            textAnchor = 'end'; // テキストを右寄せ
                        }
                        
                        if (position.includes('bottom')) {
                            textY = height - yPos - 5;
                        }
                        
                        annotationElement.append('text')
                            .attr('x', textX)
                            .attr('y', textY)
                            .attr('text-anchor', textAnchor)
                            .attr('font-size', style.fontSize || '12px')
                            .attr('fill', style.textColor || window.AppDefaults?.colors?.text?.primary || '#333')
                            .text(text);
                    }
                    break;
                    
                case 'horizontalLine':
                    // 水平線注釈
                    annotationElement.append('line')
                        .attr('x1', -xPos) // チャート左端まで
                        .attr('y1', 0)
                        .attr('x2', width - xPos) // チャート右端まで
                        .attr('y2', 0)
                        .attr('stroke', style.color || window.AppDefaults?.colors?.text?.secondary || '#999')
                        .attr('stroke-width', style.strokeWidth || window.AppDefaults?.strokeWidth?.normal || 1)
                        .attr('stroke-dasharray', style.dashArray || '3,3');
                    
                    // ラベルテキストを追加
                    if (text) {
                        const position = annotation.position || 'right';
                        let textX = width - xPos - 5; // デフォルトは右端
                        let textY = -5; // 線の上側
                        let textAnchor = 'end'; // デフォルトは右寄せ
                        
                        if (position.includes('left')) {
                            textX = -xPos + 5; // 左端に配置
                            textAnchor = 'start'; // テキストを左寄せ
                        } else if (position.includes('center')) {
                            textX = (width - xPos) / 2; // 中央に配置
                            textAnchor = 'middle'; // テキストを中央寄せ
                        }
                        
                        if (position.includes('below')) {
                            textY = 15; // 線の下側
                        }
                        
                        annotationElement.append('text')
                            .attr('x', textX)
                            .attr('y', textY)
                            .attr('text-anchor', textAnchor)
                            .attr('font-size', style.fontSize || '12px')
                            .attr('fill', style.textColor || window.AppDefaults?.colors?.text?.primary || '#333')
                            .text(text);
                    }
                    break;
                    
                case 'text':
                default:
                    // テキスト注釈
                    const textElement = annotationElement.append('text')
                        .attr('dx', style.dx || 5)
                        .attr('dy', style.dy || -5)
                        .attr('font-size', style.fontSize || '12px')
                        .attr('fill', style.color || '#333')
                        .attr('text-anchor', style.textAnchor || 'start')
                        .text(text);
                    
                    // 背景を追加（可読性向上）
                    if (style.background !== false) {
                        const bbox = textElement.node().getBBox();
                        annotationElement.insert('rect', 'text')
                            .attr('x', bbox.x - 2)
                            .attr('y', bbox.y - 2)
                            .attr('width', bbox.width + 4)
                            .attr('height', bbox.height + 4)
                            .attr('fill', style.backgroundColor || 'rgba(255, 255, 255, 0.8)')
                            .attr('stroke', style.borderColor || window.AppConstants?.APP_COLORS?.ANNOTATIONS?.BORDER || '#ccc')
                            .attr('stroke-width', 0.5)
                            .attr('rx', 2);
                    }
                    break;
            }
        });
    }


    /**
     * 段階的アニメーション描画
     * @param {d3.Selection} seriesGroups - 系列グループ
     * @param {Array} series - 系列データ
     * @param {Function} line - D3ライン生成器
     * @param {Function} xScale - X軸スケール
     * @param {Function} yScale - Y軸スケール
     * @param {string} xField - X軸フィールド名
     * @param {string} yField - Y軸フィールド名
     * @param {Function} colorScale - 色スケール
     * @param {Object} config - 設定
     */
    renderProgressiveAnimation(seriesGroups, series, line, xScale, yScale, xField, yField, colorScale, config) {
        
        const animationConfig = config.animation || {};
        const totalDuration = animationConfig.duration || 3000;
        const stepDelay = animationConfig.stepDelay || 200;
        
        // 全系列の年度データを収集してソート
        const allYears = new Set();
        series.forEach(seriesData => {
            seriesData.values.forEach(d => {
                allYears.add(+d[xField]);
            });
        });
        const sortedYears = Array.from(allYears).sort((a, b) => a - b);
        
        
        // 既存のすべてのアニメーションタイマーをクリア
        this.clearAllAnimationTimers();
        
        // 既存のすべてのトランジションを停止
        seriesGroups.selectAll('*').interrupt();
        
        // 既存のstroke-dash属性を完全にクリア
        seriesGroups.selectAll('path')
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)
            .style('stroke-dasharray', null)
            .style('stroke-dashoffset', null);
        
        // 既存のpath要素とpoint要素をすべて削除して、完全にリセット
        seriesGroups.selectAll('path').remove();
        seriesGroups.selectAll('circle').remove();
        seriesGroups.selectAll('.points-container').remove();
        
        // thisのスコープを保存
        const self = this;
        
        // 各系列に対して段階的アニメーションを実行
        seriesGroups.each(function(seriesData, seriesIndex) {
            const group = d3.select(this);
            const color = colorScale(seriesData.name);
            
            // 最終的な完全なラインパスを準備
            const fullLinePath = line(seriesData.values);
            
            // ラインパスを作成
            const linePath = group.append('path')
                .attr('class', 'chart-line')
                .attr('stroke', color)
                .attr('stroke-width', window.AppDefaults?.strokeWidth?.thick || 2)
                .attr('fill', 'none')
                .attr('d', fullLinePath); // 完全なパスを設定
            
            // パスの全長を取得
            const totalLength = linePath.node().getTotalLength();
            
            // stroke-dasharrayとstroke-dashoffsetを設定して線を非表示に
            linePath
                .attr('stroke-dasharray', totalLength + ' ' + totalLength)
                .attr('stroke-dashoffset', totalLength);
            
            // ポイントコンテナを準備
            const pointsContainer = group.append('g')
                .attr('class', 'points-container');
            
            // すべてのポイントを事前に作成（非表示状態）
            const allPoints = pointsContainer.selectAll('.chart-circle')
                .data(seriesData.values)
                .enter()
                .append('circle')
                .attr('class', 'chart-circle')
                .attr('cx', d => xScale(+d[xField]))
                .attr('cy', d => yScale(+d[yField]))
                .attr('r', 0)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1)
                .style('opacity', 0);
            
            // 系列全体の開始遅延
            const seriesStartDelay = seriesIndex * 300;
            
            // 滑らかなライン描画アニメーション
            const lineTimer = setTimeout(() => {
                linePath
                    .transition()
                    .duration(totalDuration * 0.8) // 全期間の80%で線を描画
                    .ease(d3.easeQuadInOut)
                    .attr('stroke-dashoffset', 0);
            }, seriesStartDelay);
            self.animationTimers.push(lineTimer);
            
            // 年度ごとに点を順次表示
            sortedYears.forEach((year, yearIndex) => {
                const pointDelay = seriesStartDelay + (yearIndex / sortedYears.length) * totalDuration * 0.8;
                
                const pointTimer = setTimeout(() => {
                    // 該当年度の点を表示
                    allPoints
                        .filter(function(d) { return +d[xField] === year; })
                        .transition()
                        .duration(300)
                        .ease(d3.easeBackOut.overshoot(1.2))
                        .attr('r', 3)
                        .style('opacity', 1);
                }, pointDelay);
                self.animationTimers.push(pointTimer);
            });
        });
    }

    /**
     * 地域別カラースキームを使用した色スケールを作成
     * @param {Array} series - 系列データ
     * @param {Object} config - 設定オブジェクト
     * @returns {Function} D3カラースケール
     */
    createColorScale(series, config) {
        // 単一色設定が指定されている場合（dualレイアウト対応）
        if (config.color) {
            return () => config.color;
        } else if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            // 単一系列の明示色
            return d3.scaleOrdinal(config.colors).domain(series.map(d => d.name));
        } else if (window.ColorScheme && config.useUnifiedColors !== false) {
            // 統一カラースキーム：地域名→色の直接マッピング
            
            // ColorSchemeインスタンスを取得または作成
            let colorScheme = window.colorScheme;
            if (!colorScheme) {
                colorScheme = new ColorScheme();
                window.colorScheme = colorScheme;
            }
            
            const regionColors = series.map(s => {
                const color = colorScheme.getRegionColor(s.name);
                return color;
            });
            return d3.scaleOrdinal()
                .domain(series.map(s => s.name))
                .range(regionColors);
        } else {
            // フォールバック
            const colors = config.colors || window.AppConstants?.APP_COLORS?.PRIMARY_PALETTE || d3.schemeCategory10;
            return d3.scaleOrdinal(colors).domain(series.map(d => d.name));
        }
    }

    /**
     * すべてのアニメーションタイマーをクリア
     */
    clearAllAnimationTimers() {
        this.animationTimers.forEach(timer => clearTimeout(timer));
        this.animationTimers = [];
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

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.LineChartRenderer = LineChartRenderer;Renderer = LineChartRenderer;