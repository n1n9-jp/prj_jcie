/**
 * PieChartRenderer - 円グラフの描画と更新を専門的に扱うクラス
 * ChartRendererBaseを継承し、円グラフ特有の機能を提供
 */
class PieChartRenderer extends ChartRendererBase {
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
        
        // 円グラフ特有のイベント
        pubsub.subscribe(EVENTS.CHART_UPDATE, (data) => {
            if (data.type === 'pie') {
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

        // Dual/Triple layout では個別レンダラーは動作しない
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
        if (type !== 'pie') {
            console.warn(`PieChartRenderer: Unsupported chart type: ${type}`);
            return;
        }

        // データとコンフィグの検証
        const validation = this.validateChartData(data, config);
        if (!validation.valid) {
            console.error('PieChartRenderer: Invalid data or config:', validation.errors);
            if (window.ErrorHandler) {
                ErrorHandler.handle(new Error(validation.errors.join(', ')), 'PieChartRenderer.renderChart', {
                    type: ErrorHandler.ERROR_TYPES.VALIDATION,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { data, config }
                });
            }
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
        
        // ChartLayoutHelperを使用して動的マージンを計算
        let margin;
        if (window.ChartLayoutHelper) {
            margin = ChartLayoutHelper.calculateDynamicMargins(data, config, {
                chartType: type,
                hasLegend: config.showLegend !== false,
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
            this.renderPieChart(data, { width, height, margin, ...config });
        } catch (error) {
            console.error('PieChartRenderer: Error during chart rendering:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'PieChartRenderer.renderChart', {
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
        if (!this.svg || this.currentChart !== 'pie') {
            console.warn('Cannot update chart with transition: no existing pie chart');
            return;
        }

        try {
            this.data = data;
            this.config = config;

            const { width, height } = this.getResponsiveSize(config);
            const { labelField = 'label', valueField = 'value' } = config;
            
            // 新しい円グラフデータを生成
            const pie = d3.pie()
                .value(d => +d[valueField])
                .sort(null);
            
            const radius = Math.min(width, height) / 2 - 40;
            const arc = d3.arc()
                .innerRadius(0)
                .outerRadius(radius);

            // 統一された色スケール設定
            let chartColors;
            if (window.ColorScheme && config.useUnifiedColors !== false) {
                chartColors = window.ColorScheme.generateColorsForChart(data, { 
                    ...config, 
                    seriesField: labelField 
                });
            } else {
                chartColors = config.colors || d3.schemeCategory10;
            }
            
            const colorScale = d3.scaleOrdinal(chartColors)
                .domain(data.map(d => d[labelField]));

            const g = this.svg.select('g');
            const transitionDuration = config.transitionDuration || 1000;

            // 新しいデータでパイを更新
            const newPieData = pie(data);
            
            // ChartTransitionsを使用してEnter/Update/Exitパターンを適用
            const sliceUpdateResult = ChartTransitions.applyEnterUpdateExit(
                g.selectAll('.pie-slice'),
                newPieData,
                d => d.data[labelField],
                {
                    onEnter: (enterSelection) => {
                        const enterGroups = enterSelection
                            .append('g')
                            .attr('class', 'pie-slice');
                        
                        ChartTransitions.animateArcs(
                            enterGroups.append('path')
                                .attr('fill', d => colorScale(d.data[labelField]))
                                .attr('stroke', window.AppDefaults?.colors?.text?.white || '#fff')
                                .attr('stroke-width', window.AppDefaults?.strokeWidth?.normal || 1),
                            arc,
                            {
                                chartType: 'pie',
                                phase: 'enter',
                                duration: transitionDuration
                            }
                        );
                    },
                    onUpdate: (allSelection, { allWithTransition }) => {
                        ChartTransitions.animateArcs(
                            allSelection.select('path')
                                .attr('fill', d => colorScale(d.data[labelField])),
                            arc,
                            {
                                chartType: 'pie',
                                phase: 'update',
                                duration: transitionDuration
                            }
                        );
                    },
                    onExit: (exitSelection) => {
                        exitSelection
                            .style('opacity', 0)
                            .remove();
                    }
                },
                {
                    chartType: 'pie',
                    exit: { duration: transitionDuration / 2 }
                }
            );

        } catch (error) {
            console.error('PieChartRenderer: Error during transition update:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'PieChartRenderer.updateChartWithTransition', {
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
            const labelField = config.labelField || 'label';
            const valueField = config.valueField || 'value';
            
            const hasLabelField = data.every(d => d.hasOwnProperty(labelField));
            const hasValueField = data.every(d => d.hasOwnProperty(valueField));
            
            if (!hasLabelField) {
                errors.push(`Label field '${labelField}' not found in all data items`);
            }
            if (!hasValueField) {
                errors.push(`Value field '${valueField}' not found in all data items`);
            }
            
            // Value値が数値かどうかチェック
            if (hasValueField) {
                const hasValidValues = data.every(d => !isNaN(+d[valueField]) && +d[valueField] >= 0);
                if (!hasValidValues) {
                    errors.push(`Value field '${valueField}' contains non-numeric or negative values`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 円グラフを描画する
     * @param {Array} data - データ
     * @param {Object} config - 設定
     */
    renderPieChart(data, config) {
        const { 
            width, height, margin,
            labelField = 'label', valueField = 'value', 
            colors = d3.schemeCategory10, 
            title = '',
            dataSource = ''
        } = config;
        
        // フィルタが設定されている場合は適用
        let filteredData = data;
        if (config.filter) {
            filteredData = this.applyFilter(data, config.filter);
        }
        
        const svg = this.svg;
        
        // 内側の描画エリアを計算
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        const radius = Math.min(innerWidth, innerHeight) / 2 - 40;
        
        // マージンを考慮したグループを作成
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
            
        // パイチャート用の中央グループを作成
        const pieGroup = g.append('g')
            .attr('transform', `translate(${innerWidth/2},${innerHeight/2})`);
        
        // タイトルを追加
        if (title) {
            svg.append('text')
                .attr('class', 'chart-title')
                .attr('x', 20)
                .attr('y', 30)
                .attr('text-anchor', 'start')
                .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
                .style('font-family', 'var(--font-family-serif)')
                .style('font-size', 'var(--font-size-base)')
                .style('font-weight', 'var(--font-weight-bold)')
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
            chartColors = window.ColorScheme.generateColorsForChart(filteredData, { 
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

        const arcs = pieGroup.selectAll('.pie-slice')
            .data(pie(filteredData))
            .enter()
            .append('g')
            .attr('class', 'pie-slice');

        // ChartTransitionsを使用してアークを描画
        ChartTransitions.createStaggered(
            arcs.append('path')
                .attr('fill', (d, i) => chartColors[i % chartColors.length])
                .attr('stroke', window.AppDefaults?.colors?.text?.white || '#fff')
                .attr('stroke-width', window.AppDefaults?.strokeWidth?.normal || 1),
            { delay: 100, duration: 600 }
        ).call(function(selection) {
            ChartTransitions.animateArcs(selection, arc, {
                chartType: 'pie',
                phase: 'enter',
                duration: 600
            });
        });

        // ChartTransitionsを使用してラベルを追加
        ChartTransitions.animateText(
            arcs.append('text')
                .attr('transform', d => `translate(${arc.centroid(d)})`)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('fill', window.AppDefaults?.colors?.text?.white || '#fff')
                .text(d => d.data[labelField]),
            {
                chartType: 'pie',
                phase: 'enter',
                delay: 500,
                duration: 600
            }
        );

        // レジェンドを追加（要求された場合のみ）
        if (config.showLegend && filteredData.length > 1) {
            this.addLegend(svg, filteredData, chartColors, width, height, config);
        }

        // 注釈（アノテーション）を描画
        if (config.annotations) {
            this.renderAnnotations(g, config.annotations, { width, height, labelField, valueField });
        }

        // データソースを表示
        if (dataSource) {
            this.addDataSource(svg, dataSource, width, height);
        }
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
            .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
            .style('font-family', 'var(--font-family-serif)')
            .style('font-size', 'var(--font-size-base)')
            .style('font-weight', 'var(--font-weight-bold)')
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
        
        // 値変換関数（パーセンテージ対応）
        const parseValue = (value) => {
            if (typeof value === 'string' && value.includes('%')) {
                return parseFloat(value.replace('%', ''));
            }
            return +value;
        };
        
        // データの合計を計算
        const total = data.reduce((sum, d) => sum + parseValue(d[valueField]), 0);
        
        // パイ生成器
        const pie = d3.pie()
            .value(d => parseValue(d[valueField]))
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
        
        // デフォルトカラーパレットを確保（より明確に区別可能な色）
        if (!chartColors || chartColors.length === 0) {
            chartColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'];
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
            .attr('fill', d => colorScale(d.data[labelField]))
            .attr('stroke', window.AppDefaults?.colors?.text?.white || '#fff')
            .attr('stroke-width', window.AppDefaults?.strokeWidth?.normal || 1)
            .style('opacity', 0)
            .attr('d', arc) // パスデータを設定
            .transition()
            .duration(500)
            .delay((d, i) => i * 100)
            .style('opacity', 1);
        
        // radiusの値チェック
        if (!radius || isNaN(radius) || radius <= 0) {
            console.warn('Invalid radius for pie chart labels:', radius);
            return;
        }
        
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
            .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
            .text(d => d.data[labelField]);
        
        // パーセンテージを追加
        labelGroups.append('text')
            .attr('class', 'pie-label-value')
            .attr('text-anchor', 'middle')
            .attr('y', '0.8em')
            .attr('font-size', '11px')
            .attr('fill', window.AppDefaults?.colors?.text?.secondary || '#666')
            .text(d => {
                // parseValueを使って正しい値を取得
                const value = parseValue(d.data[valueField]);
                return `${value}%`;
            });
        
        // ラベルグループをフェードイン
        labelGroups.transition()
            .duration(500)
            .delay((d, i) => i * 100 + 200)
            .style('opacity', 1);
    }


    /**
     * レジェンドを追加（円グラフ用）
     * @param {d3.Selection} svg - SVG要素
     * @param {Array} data - データ
     * @param {Array} colors - 色配列
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Object} config - 設定
     */
    addLegend(svg, data, colors, width, height, config) {
        if (!data || data.length <= 1) return;
        
        const labelField = config.labelField || 'label';
        const categories = data.map(d => d[labelField]);
        
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
        
        // 凡例アイコン（円 - 円グラフにふさわしい）
        legendItems.append('circle')
            .attr('cx', 6)
            .attr('cy', 6)
            .attr('r', 5)
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
        
        const { width, height, labelField, valueField } = context;
        
        const annotationGroup = g.append('g')
            .attr('class', 'chart-annotations');
        
        annotations.forEach((annotation, index) => {
            const { type, text, style = {}, position = 'top' } = annotation;
            
            // 円グラフでは位置指定は相対的
            let xPos = 0, yPos = 0;
            
            switch (position) {
                case 'top':
                    xPos = 0;
                    yPos = -height/4;
                    break;
                case 'bottom':
                    xPos = 0;
                    yPos = height/4;
                    break;
                case 'left':
                    xPos = -width/4;
                    yPos = 0;
                    break;
                case 'right':
                    xPos = width/4;
                    yPos = 0;
                    break;
                case 'center':
                default:
                    xPos = 0;
                    yPos = 0;
                    break;
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
                    
                case 'text':
                default:
                    // テキスト注釈
                    const textElement = annotationElement.append('text')
                        .attr('dx', style.dx || 0)
                        .attr('dy', style.dy || 0)
                        .attr('font-size', style.fontSize || '12px')
                        .attr('fill', style.color || '#333')
                        .attr('text-anchor', style.textAnchor || 'middle')
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
     * リサイズ処理
     */
    resize() {
        if (this.currentChart && this.data && this.config) {
            this.renderChart(this.currentChart, this.data, this.config);
        }
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.PieChartRenderer = PieChartRenderer;