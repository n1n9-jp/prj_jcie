/**
 * LineChartRenderer - 折れ線グラフの描画と更新を専門的に扱うクラス
 * BaseManagerを継承し、線グラフ特有の機能を提供
 */
class LineChartRenderer extends BaseManager {
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
            margin = config.margin || window.AppDefaults?.chartMargin?.default || { top: 40, right: 20, bottom: 40, left: 50 };
        }
        
        // 完全にコンテナをクリア（stroke-dasharray等の状態もリセット）
        this.container.selectAll('*').remove();
        
        // SVGHelperを使用してレスポンシブSVGを作成
        if (window.SVGHelper) {
            // パーセンテージ指定の場合は実際のピクセルサイズを計算
            let actualWidth = null;
            let actualHeight = null;
            
            if (config.widthPercent) {
                actualWidth = window.innerWidth * (config.widthPercent / 100);
                console.log(`LineChartRenderer: widthPercent=${config.widthPercent}%, actualWidth=${actualWidth}px (window.innerWidth=${window.innerWidth}px)`);
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
            margin = config.margin || window.AppDefaults?.chartMargin?.compact || { top: 20, right: 20, bottom: 40, left: 40 };
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

        // ChartTransitionsを使用して軸を更新
        const newXAxis = isYearData 
            ? d3.axisBottom(newXScale).tickFormat(d3.format("d"))
            : d3.axisBottom(newXScale);
        const newYAxis = d3.axisLeft(newYScale);

        // 統一されたトランジション設定
        const transitionConfig = {
            chartType: 'line',
            duration: transitionDuration
        };

        ChartTransitions.updateAxis(g.select('.x-axis'), newXAxis, transitionConfig);
        ChartTransitions.updateAxis(g.select('.y-axis'), newYAxis, transitionConfig);

        // 新しいライン生成器
        const newLine = d3.line()
            .x(d => isYearData ? newXScale(+d[xField]) : newXScale(new Date(d[xField])))
            .y(d => newYScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        // 色スケール
        const colorScale = d3.scaleOrdinal(config.colors || d3.schemeCategory10)
            .domain(newSeries.map(d => d.name));

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

        // レジェンドを追加（複数系列の場合のみ）
        if (series.length > 1) {
            this.addLegend(svg, series, colorScale, width, height);
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
            this.addCompactLegend(g, series, colorScale, width, height);
        }
    }

    /**
     * レスポンシブサイズを取得
     * @param {Object} config - 設定
     * @returns {Object} {width, height}
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
        if (config.aspectRatio) {
            if (config.widthPercent && !config.heightPercent) {
                height = width / config.aspectRatio;
            } else if (config.heightPercent && !config.widthPercent) {
                width = height * config.aspectRatio;
            }
        }

        // 最小・最大値の制約
        width = Math.max(300, Math.min(1200, width));
        height = Math.max(200, Math.min(800, height));

        return { width, height };
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
     * 注釈（アノテーション）を描画
     */
    renderAnnotations(g, annotations, context) {
        if (!annotations || annotations.length === 0) return;
        
        console.log('LineChartRenderer: Rendering annotations:', annotations);
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
     * データソースを表示
     * @param {d3.Selection} svg - SVG要素
     * @param {string} dataSource - データソース名
     * @param {number} width - チャート幅
     * @param {number} height - チャート高さ
     */
    addDataSource(svg, dataSource, width, height) {
        svg.append('text')
            .attr('class', 'chart-data-source')
            .attr('x', 10)
            .attr('y', height - 10)
            .attr('text-anchor', 'start')
            .attr('font-size', '10px')
            .attr('fill', '#888')
            .text(`出典: ${dataSource}`);
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
        console.log('LineChartRenderer: Starting progressive animation');
        
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
        
        console.log('LineChartRenderer: Progressive animation years:', sortedYears);
        
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
     * すべてのアニメーションタイマーをクリア
     */
    clearAllAnimationTimers() {
        this.animationTimers.forEach(timer => clearTimeout(timer));
        this.animationTimers = [];
        console.log('LineChartRenderer: Cleared all animation timers');
    }

    /**
     * リサイズ処理
     */
    resize() {
        if (this.currentChart && this.data && this.config) {
            console.log('LineChartRenderer: Resizing chart');
            this.renderChart(this.currentChart, this.data, this.config);
        }
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.LineChartRenderer = LineChartRenderer;