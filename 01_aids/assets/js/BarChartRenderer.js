/**
 * BarChartRenderer - 棒グラフの描画と更新を専門的に扱うクラス
 * BaseManagerを継承し、棒グラフ特有の機能を提供
 */
class BarChartRenderer extends BaseManager {
    constructor(containerId) {
        super(containerId);
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;
        
        // Initialize after properties are set
        this.init();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        super.setupEventListeners();
        
        // 棒グラフ特有のイベント
        pubsub.subscribe(EVENTS.CHART_UPDATE, (data) => {
            if (data.type === 'bar') {
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
            
            console.log(`Updating bar chart with transition mode (direction: ${direction || 'unknown'})`);
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
        if (type !== 'bar') {
            console.warn(`BarChartRenderer: Unsupported chart type: ${type}`);
            return;
        }

        // データとコンフィグの検証
        const validation = this.validateChartData(data, config);
        if (!validation.valid) {
            console.error('BarChartRenderer: Invalid data or config:', validation.errors);
            if (window.ErrorHandler) {
                ErrorHandler.handle(new Error(validation.errors.join(', ')), 'BarChartRenderer.renderChart', {
                    type: ErrorHandler.ERROR_TYPES.VALIDATION,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { data, config }
                });
            }
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
        
        // SVGHelperを使用してレスポンシブSVGを作成
        if (window.SVGHelper) {
            // パーセンテージ指定の場合は実際のピクセルサイズを計算
            let actualWidth = null;
            let actualHeight = null;
            
            if (config.widthPercent) {
                actualWidth = window.innerWidth * (config.widthPercent / 100);
                console.log(`BarChartRenderer: widthPercent=${config.widthPercent}%, actualWidth=${actualWidth}px (window.innerWidth=${window.innerWidth}px)`);
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
            this.container.selectAll('*').remove();
            this.svg = this.container.append('svg')
                .attr('width', width)
                .attr('height', height);
        }

        try {
            this.renderBarChart(data, { width, height, margin, ...config });
        } catch (error) {
            console.error('BarChartRenderer: Error during chart rendering:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'BarChartRenderer.renderChart', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { type, data, config }
                });
            }
        }
    }

    /**
     * チャートをトランジションで更新する（再描画しない）
     * @param {Array} data - 新しいデータ
     * @param {Object} config - 新しい設定
     * @param {string} direction - スクロール方向 ('up' | 'down')
     */
    updateChartWithTransition(data, config, direction = 'down') {
        if (!this.svg || this.currentChart !== 'bar') {
            console.warn('Cannot update chart with transition: no existing bar chart');
            return;
        }

        try {
            this.data = data;
            this.config = config;

        const { width, height } = this.getResponsiveSize(config);
        
        // ChartLayoutHelperを使用して動的マージンを計算
        let margin;
        if (window.ChartLayoutHelper) {
            margin = ChartLayoutHelper.calculateDynamicMargins(data, config, {
                chartType: 'bar',
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
        
        const { xField = 'category', yField = 'value' } = config;
        
        // 新しいスケールを計算
        const newXScale = d3.scaleBand()
            .domain(data.map(d => d[xField]))
            .range([0, innerWidth])
            .padding(0.1);

        const newYScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => +d[yField])])
            .nice()
            .range([innerHeight, 0]);

        const g = this.svg.select('g');
        const transitionDuration = config.transitionDuration || 1000;

        // ChartTransitionsを使用して軸を更新
        const newXAxis = d3.axisBottom(newXScale);
        const newYAxis = d3.axisLeft(newYScale);

        const transitionConfig = {
            chartType: 'bar',
            duration: transitionDuration
        };

        ChartTransitions.updateAxis(g.select('.x-axis'), newXAxis, transitionConfig);
        ChartTransitions.updateAxis(g.select('.y-axis'), newYAxis, transitionConfig);

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
            const defaultColor = config.color || window.AppDefaults?.colors?.accent?.success || '#10b981';
            barColors = [defaultColor];
        }
        
        // 特別なケース：単一系列で色が明示されている場合のみそれを優先
        if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            barColors = config.colors;
        }

        // ChartTransitionsを使用してEnter/Update/Exitパターンを適用
        const scales = { x: newXScale, y: newYScale };
        const barUpdateResult = ChartTransitions.applyEnterUpdateExit(
            g.selectAll('.bar'),
            data,
            d => d[xField], // xFieldで一意性を保つ
            {
                onEnter: (enterSelection) => {
                    ChartTransitions.animateBars(
                        enterSelection
                            .append('rect')
                            .attr('class', 'bar')
                            .attr('x', d => newXScale(d[xField]))
                            .attr('width', newXScale.bandwidth())
                            .attr('fill', (d, i) => barColors[i % barColors.length]),
                        scales,
                        {
                            chartType: 'bar',
                            phase: 'enter',
                            xField: xField,
                            yField: yField,
                            innerHeight: innerHeight,
                            duration: transitionDuration
                        }
                    );
                },
                onUpdate: (allSelection, { allWithTransition }) => {
                    ChartTransitions.animateBars(
                        allWithTransition,
                        scales,
                        {
                            chartType: 'bar',
                            phase: 'update',
                            xField: xField,
                            yField: yField,
                            innerHeight: innerHeight,
                            duration: transitionDuration
                        }
                    );
                },
                onExit: (exitSelection) => {
                    exitSelection
                        .attr('height', 0)
                        .attr('y', innerHeight)
                        .style('opacity', 0)
                        .remove();
                }
            },
            {
                chartType: 'bar',
                exit: { duration: transitionDuration / 2 }
            }
        );

            console.log(`Bar chart updated with transition: ${data.length} bars displayed`);
        } catch (error) {
            console.error('BarChartRenderer: Error during transition update:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'BarChartRenderer.updateChartWithTransition', {
                    type: ErrorHandler.ERROR_TYPES.TRANSITION,
                    severity: ErrorHandler.SEVERITY.MEDIUM,
                    context: { data, config, direction }
                });
            }
        }
    }

    /**
     * チャートデータとコンフィグを検証
     * @param {Array} data - データ
     * @param {Object} config - 設定
     * @returns {Object} 検証結果 {valid: boolean, errors: Array}
     */
    validateChartData(data, config) {
        const errors = [];

        // データの検証
        if (!data || !Array.isArray(data)) {
            errors.push('Data must be an array');
        } else if (data.length === 0) {
            errors.push('Data array is empty');
        }

        // 設定の検証
        if (!config || typeof config !== 'object') {
            errors.push('Config must be an object');
        }

        // フィールドの存在確認
        if (data && data.length > 0 && config) {
            const xField = config.xField || 'category';
            const yField = config.yField || 'value';
            
            const hasXField = data.every(d => d.hasOwnProperty(xField));
            const hasYField = data.every(d => d.hasOwnProperty(yField));
            
            if (!hasXField) {
                errors.push(`X field '${xField}' not found in all data items`);
            }
            if (!hasYField) {
                errors.push(`Y field '${yField}' not found in all data items`);
            }
            
            // Y値が数値かどうかチェック
            if (hasYField) {
                const hasValidYValues = data.every(d => !isNaN(+d[yField]));
                if (!hasValidYValues) {
                    errors.push(`Y field '${yField}' contains non-numeric values`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
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

            default:
                console.warn(`Unknown filter type: ${type}`);
                return data;
        }

        return data;
    }

    /**
     * 棒グラフを描画する
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderBarChart(data, config) {
        const { 
            width, height, margin, 
            xField = 'category', yField = 'value', 
            color = window.AppDefaults?.colors?.accent?.success || '#10b981',
            title = '',
            dataSource = ''
        } = config;
        
        // フィルタが設定されている場合は適用
        let filteredData = data;
        if (config.filter) {
            filteredData = this.applyFilter(data, config.filter);
            console.log(`Filter applied to bar chart: ${data.length} -> ${filteredData.length} records`);
        }
        
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

        // スケール設定
        const xScale = d3.scaleBand()
            .domain(filteredData.map(d => d[xField]))
            .range([0, innerWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(filteredData, d => +d[yField])])
            .nice()
            .range([innerHeight, 0]);

        // 単位情報を分析
        let unitInfo = { xAxis: {}, yAxis: {} };
        if (window.ChartLayoutHelper) {
            unitInfo = ChartLayoutHelper.analyzeUnits(filteredData, config);
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
            ChartLayoutHelper.addAxisLabels(g, filteredData, config, innerWidth, innerHeight);
        }

        // 統一された色設定
        let barColors;
        if (window.ColorScheme && config.useUnifiedColors !== false && config.multiColor) {
            // 複数色の場合は統一カラースキームを使用
            barColors = window.ColorScheme.generateColorsForChart(filteredData, { 
                ...config, 
                seriesField: xField 
            });
        } else if (window.ColorScheme && config.useUnifiedColors !== false && filteredData.length === 1) {
            // 単一データの場合は地域に応じた色を使用
            const regionName = filteredData[0][xField];
            barColors = [window.ColorScheme.getColorForRegion(regionName)];
        } else {
            // フォールバック：設定で指定された色
            barColors = [color];
        }
        
        // 特別なケース：単一系列で色が明示されている場合のみそれを優先
        if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            barColors = config.colors;
        }

        // ChartTransitionsを使用して棒を描画
        const scales = { x: xScale, y: yScale };
        
        ChartTransitions.createStaggered(
            g.selectAll('.bar')
                .data(filteredData)
                .enter()
                .append('rect')
                .attr('class', 'bar')
                .attr('x', d => xScale(d[xField]))
                .attr('width', xScale.bandwidth())
                .attr('fill', (d, i) => barColors[i % barColors.length]),
            { delay: 100, duration: 600 }
        ).call(function(selection) {
            ChartTransitions.animateBars(selection, scales, {
                chartType: 'bar',
                phase: 'enter',
                xField: xField,
                yField: yField,
                innerHeight: innerHeight,
                duration: 600
            });
        });

        // レジェンドを追加（明示的に要求された場合のみ）
        if (config.showLegend && filteredData.length > 1) {
            this.addLegend(svg, filteredData, barColors, width, height, config);
        }

        // 注釈（アノテーション）を描画
        if (config.annotations) {
            this.renderAnnotations(g, config.annotations, { xScale, yScale, width: innerWidth, height: innerHeight, xField, yField });
        }

        // データソースを表示
        if (dataSource) {
            this.addDataSource(svg, dataSource, width, height);
        }
    }

    /**
     * 指定されたグループ内で棒グラフを描画
     */
    renderBarChartInGroup(g, data, config) {
        const { width, height, xField = 'category', yField = 'value', color = window.AppDefaults?.colors?.accent?.success || '#10b981' } = config;
        
        // スケール設定
        const xScale = d3.scaleBand()
            .domain(data.map(d => d[xField]))
            .range([0, width])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => +d[yField])])
            .nice()
            .range([height, 0]);

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
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'chart-axis y-axis')
            .call(yAxis);

        // 軸ラベルを統一的に追加（カスタム優先、デフォルト単位フォールバック）
        if (window.ChartLayoutHelper) {
            ChartLayoutHelper.addAxisLabels(g, data, config, width, height);
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
            .attr('y', d => yScale(+d[yField]))
            .attr('width', xScale.bandwidth())
            .attr('height', d => height - yScale(+d[yField]))
            .attr('fill', (d, i) => barColors[i % barColors.length]);
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
     * レジェンドを追加（棒グラフ用）
     * @param {d3.Selection} svg - SVG要素
     * @param {Array} data - データ
     * @param {Array} colors - 色配列
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Object} config - 設定
     */
    addLegend(svg, data, colors, width, height, config) {
        if (!data || data.length <= 1) return;
        
        const xField = config.xField || 'category';
        const categories = data.map(d => d[xField]);
        
        // ChartLayoutHelperを使用して最適な凡例レイアウトを計算
        let legendLayout;
        if (window.ChartLayoutHelper) {
            legendLayout = ChartLayoutHelper.calculateLegendLayout(categories, width, height);
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
        
        if (!legendLayout.show) return;
        
        // 凡例コンテナを作成
        const legend = svg.append('g')
            .attr('class', 'chart-legend');
        
        // 凡例位置を計算
        let legendX, legendY;
        if (legendLayout.position === 'bottom') {
            legendX = width / 2 - (legendLayout.itemWidth * categories.length) / 2;
            legendY = height - (legendLayout.itemHeight * categories.length) - 10;
        } else {
            // 右側配置（デフォルト）
            legendX = Math.max(20, width - (legendLayout.totalWidth || legendLayout.itemWidth));
            legendY = 20;
        }
        
        legend.attr('transform', `translate(${legendX}, ${legendY})`);
        
        // 凡例アイテムを作成
        const legendItems = legend.selectAll('.legend-item')
            .data(categories)
            .enter()
            .append('g')
            .attr('class', 'legend-item');
        
        // アイテムの配置
        if (legendLayout.orientation === 'horizontal') {
            legendItems.attr('transform', (d, i) => `translate(${i * legendLayout.itemWidth}, 0)`);
        } else {
            legendItems.attr('transform', (d, i) => `translate(0, ${i * legendLayout.itemHeight})`);
        }
        
        // 凡例アイコン（四角形 - 棒グラフにふさわしい）
        legendItems.append('rect')
            .attr('x', 2)
            .attr('y', 2)
            .attr('width', 8)
            .attr('height', 8)
            .attr('fill', (d, i) => colors[i % colors.length]);
        
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
            const text = d;
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
     * 注釈（アノテーション）を描画
     */
    renderAnnotations(g, annotations, context) {
        if (!annotations || annotations.length === 0) return;
        
        const { xScale, yScale, width, height, xField, yField } = context;
        
        // スケールが存在しない場合は処理をスキップ
        if (!xScale || !yScale) {
            console.warn('BarChartRenderer: xScale or yScale is undefined, skipping annotations');
            return;
        }
        
        const annotationGroup = g.append('g')
            .attr('class', 'chart-annotations');
        
        annotations.forEach((annotation, index) => {
            const { type, x, y, text, style = {} } = annotation;
            
            // X座標の変換（カテゴリの場合はband scaleを使用）
            let xPos;
            try {
                if (typeof xScale.bandwidth === 'function') {
                    // Band scale (カテゴリ軸)
                    xPos = xScale(x) + xScale.bandwidth() / 2;
                } else {
                    // Linear scale (数値軸)
                    xPos = xScale(+x);
                }
            } catch (error) {
                console.warn(`BarChartRenderer: Failed to convert x coordinate for annotation ${index}:`, x, error);
                xPos = 0;
            }
            
            // Y座標の変換
            let yPos;
            try {
                yPos = yScale(+y);
            } catch (error) {
                console.warn(`BarChartRenderer: Failed to convert y coordinate for annotation ${index}:`, y, error);
                yPos = 0;
            }
            
            // 座標が有効かチェック
            if (isNaN(xPos) || isNaN(yPos)) {
                console.warn(`BarChartRenderer: Invalid coordinates for annotation ${index}: x=${xPos}, y=${yPos}`);
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
                        .attr('y1', -yPos) // 上端まで
                        .attr('x2', 0)
                        .attr('y2', height - yPos) // 下端まで
                        .attr('stroke', style.color || window.AppConstants?.APP_COLORS?.ANNOTATIONS?.LINE || '#999')
                        .attr('stroke-width', style.strokeWidth || 1)
                        .attr('stroke-dasharray', style.dashArray || '3,3');
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
     * リサイズ処理
     */
    resize() {
        if (this.currentChart && this.data && this.config) {
            console.log('BarChartRenderer: Resizing chart');
            this.renderChart(this.currentChart, this.data, this.config);
        }
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.BarChartRenderer = BarChartRenderer;