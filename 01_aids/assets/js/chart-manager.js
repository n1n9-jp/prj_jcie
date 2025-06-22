/**
 * ChartManager - 新しいストリームライン化されたチャート管理クラス
 * 専門化されたレンダラー間の調整と統合に特化
 * BaseManagerを継承し、すべてのチャートタイプを統一的に管理
 */
class ChartManager extends BaseManager {
    constructor(containerId) {
        // コンテナIDが#chart-containerの場合、#chartを使用（後方互換性）
        const actualContainerId = containerId === '#chart-container' ? '#chart' : containerId;
        
        super(actualContainerId);
        
        // 専門化されたレンダラーのインスタンス
        this.renderers = {
            line: null,
            bar: null,
            pie: null,
            grid: null
        };
        
        // 現在アクティブなレンダラーとレイアウト情報
        this.activeRenderer = null;
        this.currentLayout = null;
        this.layoutData = null;
        
        // トランジション管理
        this.transitionManager = null;
        
        
        // Now that all properties are set up, call init
        this.init();
    }

    /**
     * 初期化処理
     */
    init() {
        
        super.init();
        
        
        this.initializeRenderers();
        this.initializeTransitionManager();
        
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        super.setupEventListeners();
        
        // チャート更新イベント
        pubsub.subscribe(EVENTS.CHART_UPDATE, (data) => {
            this.updateChart(data);
        });
    }

    /**
     * 専門化されたレンダラーを初期化
     */
    initializeRenderers() {
        
        // renderersオブジェクトが存在しない場合は初期化
        if (!this.renderers) {
            this.renderers = {
                line: null,
                bar: null,
                pie: null,
                grid: null
            };
        }
        
        const containerId = this.container.node().id ? `#${this.container.node().id}` : '.chart-container';
        
        // レンダラークラスの確認ログは削除済み
        
        try {
            // LineChartRenderer
            if (window.LineChartRenderer) {
                this.renderers.line = new LineChartRenderer(containerId);
            } else {
                console.error('✗ LineChartRenderer not available in window');
            }
            
            // BarChartRenderer
            if (window.BarChartRenderer) {
                this.renderers.bar = new BarChartRenderer(containerId);
            } else {
                console.error('✗ BarChartRenderer not available in window');
            }
            
            // PieChartRenderer
            if (window.PieChartRenderer) {
                this.renderers.pie = new PieChartRenderer(containerId);
            } else {
                console.error('✗ PieChartRenderer not available in window');
            }
            
            // GridChartRenderer
            if (window.GridChartRenderer) {
                this.renderers.grid = new GridChartRenderer(containerId);
            } else {
                console.error('✗ GridChartRenderer not available in window');
            }
        } catch (error) {
            console.error('ChartManager: Error initializing renderers:', error);
            
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'ChartManager.initializeRenderers', {
                    type: ErrorHandler.ERROR_TYPES.INITIALIZATION,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { containerId }
                });
            }
        }
        
        // 初期化結果のサマリー
        const initializedRenderers = Object.keys(this.renderers).filter(key => this.renderers[key] !== null);
        
        if (initializedRenderers.length === 0) {
            console.error('ChartManager: WARNING - No renderers were successfully initialized!');
        }
    }

    /**
     * トランジション管理を初期化
     */
    initializeTransitionManager() {
        if (window.ChartTransitions) {
            this.transitionManager = ChartTransitions;
        } else {
            console.warn('ChartTransitions not available, transitions may be less smooth');
        }
    }

    /**
     * メインのチャート更新メソッド
     * レイアウトとチャートタイプに基づいて適切なレンダラーに委譲
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        try {
            // 入力データの検証
            const validation = this.validateChartData(chartData);
            if (!validation.valid) {
                console.error('ChartManager: Invalid chart data:', validation.errors);
                return;
            }

            const { layout, type, visible } = chartData;

            // 可視性に基づく処理
            if (!visible) {
                this.hide();
                return;
            }

            // レイアウトベースの振り分け
            switch (layout) {
                case 'dual':
                    this.handleDualLayout(chartData);
                    break;
                case 'triple':
                    this.handleTripleLayout(chartData);
                    break;
                case 'grid':
                    this.handleGridLayout(chartData);
                    break;
                default:
                    this.handleSingleChart(chartData);
                    break;
            }

            // 状態を更新
            this.updateState({
                layout: layout || 'single',
                type: type,
                data: chartData
            });

        } catch (error) {
            console.error('ChartManager: Error updating chart:', error);
            
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'ChartManager.updateChart', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: chartData
                });
            }
        }
    }

    /**
     * 単一チャートの処理
     * @param {Object} chartData - チャートデータ
     */
    handleSingleChart(chartData) {
        const { type } = chartData;
        
        // 前のレンダラーを非表示にする
        this.hideInactiveRenderers(type);
        
        // 適切なレンダラーを取得して委譲
        const renderer = this.getRenderer(type);
        if (renderer) {
            this.activeRenderer = renderer;
            this.currentLayout = 'single';
            
            // レンダラーに処理を委譲
            renderer.updateChart(chartData);
            
        } else {
            console.warn(`ChartManager: No renderer available for chart type: ${type}`);
            this.handleFallback(chartData);
        }
    }

    /**
     * デュアルレイアウトの処理
     * @param {Object} chartData - チャートデータ
     */
    handleDualLayout(chartData) {
        
        // 全レンダラーを非表示
        this.hideAllRenderers();
        
        // デュアルレイアウト専用の処理
        this.activeRenderer = null;
        this.currentLayout = 'dual';
        this.layoutData = chartData;
        
        // コンテナを確実に表示する
        this.show();
        
        // chart-containerも確実に表示する
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            chartContainer.classList.add('visible');
            chartContainer.style.display = 'block';
            chartContainer.style.opacity = '1';
        }
        
        this.renderDualLayout(chartData);
    }

    /**
     * トリプルレイアウトの処理
     * @param {Object} chartData - チャートデータ
     */
    handleTripleLayout(chartData) {
        
        // 全レンダラーを非表示
        this.hideAllRenderers();
        
        // トリプルレイアウト専用の処理
        this.activeRenderer = null;
        this.currentLayout = 'triple';
        this.layoutData = chartData;
        
        // 直接描画（従来のロジックを使用）
        this.show();
        this.renderTripleLayout(chartData);
    }

    /**
     * グリッドレイアウトの処理
     * @param {Object} chartData - チャートデータ
     */
    handleGridLayout(chartData) {
        
        // GridChartRendererに委譲
        const gridRenderer = this.renderers.grid;
        if (gridRenderer) {
            // 他のレンダラーを非表示
            this.hideInactiveRenderers('grid');
            
            this.activeRenderer = gridRenderer;
            this.currentLayout = 'grid';
            
            gridRenderer.updateChart(chartData);
        } else {
            console.warn('ChartManager: GridChartRenderer not available');
            this.handleFallback(chartData);
        }
    }

    /**
     * 指定されたタイプ以外のレンダラーを非表示にする
     * @param {string} activeType - アクティブなチャートタイプ
     */
    hideInactiveRenderers(activeType) {
        Object.keys(this.renderers).forEach(type => {
            if (type !== activeType && this.renderers[type]) {
                this.renderers[type].hide();
            }
        });
    }

    /**
     * すべてのレンダラーを非表示にする
     */
    hideAllRenderers() {
        Object.values(this.renderers).forEach(renderer => {
            if (renderer) {
                renderer.hide();
            }
        });
    }

    /**
     * チャートタイプに対応するレンダラーを取得
     * @param {string} type - チャートタイプ
     * @returns {Object|null} レンダラーインスタンス
     */
    getRenderer(type) {
        
        const renderer = this.renderers[type];
        if (!renderer) {
            console.warn(`ChartManager: No renderer available for type: ${type}`);
        } else {
        }
        return renderer;
    }

    /**
     * フォールバック処理（レンダラーが利用できない場合）
     * @param {Object} chartData - チャートデータ
     */
    handleFallback(chartData) {
        console.warn('ChartManager: Using fallback rendering');
        
        // 基本的なエラー表示
        this.clearContainer();
        this.show();
        
        const errorMessage = this.container.append('div')
            .attr('class', 'chart-error')
            .style('text-align', 'center')
            .style('padding', '40px')
            .style('color', window.AppDefaults?.colors?.text?.secondary || '#666');
        
        errorMessage.append('p')
            .text(`Chart renderer for "${chartData.type || 'unknown'}" is not available`);
            
        errorMessage.append('p')
            .style('font-size', '0.9em')
            .text('Please check that all required chart renderer scripts are loaded');
    }

    /**
     * デュアルレイアウトを描画（従来のロジック）
     * @param {Object} chartData - チャートデータ
     */
    renderDualLayout(chartData) {
        const { charts } = chartData;
        
        if (!charts || !Array.isArray(charts)) {
            console.error('ChartManager: Invalid charts array for dual layout', charts);
            return;
        }
        
        // コンテナをクリアしてSVGを作成
        this.clearContainer();
        const svg = this.createLayoutSVG('dual');
        
        if (!svg) {
            console.error('ChartManager: Failed to create SVG for dual layout');
            return;
        }
        
        // レイアウト計算
        const layout = this.calculateDualLayout();
        
        // 各チャートを描画
        charts.forEach((chartConfig, index) => {
            const chartLayout = {
                x: index * (layout.chartWidth + layout.spacing),
                y: layout.marginTop,
                width: layout.chartWidth,
                height: layout.chartHeight
            };
            
            this.renderSingleChartInLayout(svg, chartConfig, chartLayout);
        });
    }

    /**
     * トリプルレイアウトを描画（従来のロジック）
     * @param {Object} chartData - チャートデータ
     */
    renderTripleLayout(chartData) {
        const { charts } = chartData;
        
        // コンテナをクリアしてSVGを作成
        this.clearContainer();
        const svg = this.createLayoutSVG('triple');
        
        // レイアウト計算
        const layout = this.calculateTripleLayout();
        
        // 各チャートを描画
        charts.forEach((chartConfig, index) => {
            const chartLayout = {
                x: index * (layout.chartWidth + layout.spacing),
                y: layout.marginTop,
                width: layout.chartWidth,
                height: layout.chartHeight
            };
            
            this.renderSingleChartInLayout(svg, chartConfig, chartLayout);
        });
    }

    /**
     * レイアウト用のSVGを作成
     * @param {string} layoutType - レイアウトタイプ
     * @returns {d3.Selection} SVG要素
     */
    createLayoutSVG(layoutType) {
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth || 800;
        const containerHeight = containerNode.clientHeight || 600;
        
        let totalWidth, totalHeight;
        
        switch (layoutType) {
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
            return SVGHelper.initSVG(this.container, totalWidth, totalHeight, {
                className: 'chart-svg',
                responsive: true,
                preserveAspectRatio: 'xMidYMid meet'
            });
        } else {
            // フォールバック
            return this.container.append('svg')
                .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
                .style('width', '100%')
                .style('height', 'auto');
        }
    }

    /**
     * デュアルレイアウトの寸法を計算
     * @returns {Object} レイアウト情報
     */
    calculateDualLayout() {
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth || 800;
        const containerHeight = containerNode.clientHeight || 600;
        
        const totalWidth = Math.min(containerWidth * 0.9, 1000);
        const totalHeight = Math.min(containerHeight * 0.8, 500);
        const spacing = 40;
        const marginTop = 40;
        
        return {
            totalWidth,
            totalHeight,
            chartWidth: (totalWidth - spacing) / 2,
            chartHeight: totalHeight - marginTop - 20,
            spacing,
            marginTop
        };
    }

    /**
     * トリプルレイアウトの寸法を計算
     * @returns {Object} レイアウト情報
     */
    calculateTripleLayout() {
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth || 800;
        const containerHeight = containerNode.clientHeight || 600;
        
        const totalWidth = Math.min(containerWidth * 0.95, 1200);
        const totalHeight = Math.min(containerHeight * 0.8, 500);
        const spacing = 30;
        const marginTop = 40;
        
        return {
            totalWidth,
            totalHeight,
            chartWidth: (totalWidth - spacing * 2) / 3,
            chartHeight: totalHeight - marginTop - 20,
            spacing,
            marginTop
        };
    }

    /**
     * レイアウト内で単一チャートを描画
     * @param {d3.Selection} svg - SVG要素
     * @param {Object} chartConfig - チャート設定
     * @param {Object} layout - レイアウト情報
     */
    renderSingleChartInLayout(svg, chartConfig, layout) {
        const { data, config, title } = chartConfig;
        const { x, y, width, height } = layout;
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.error('ChartManager: No data for chart in layout', chartConfig);
            return;
        }
        
        // チャートグループを作成
        const chartGroup = svg.append('g')
            .attr('transform', `translate(${x}, ${y})`);
        
        // タイトルを追加
        if (title) {
            chartGroup.append('text')
                .attr('class', 'chart-title')
                .attr('x', width / 2)
                .attr('y', -10)
                .attr('text-anchor', 'middle')
                .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
                .style('font-family', 'var(--font-family-serif)')
                .style('font-size', 'var(--font-size-base)')
                .style('font-weight', 'var(--font-weight-bold)')
                .text(title);
        }
        
        // チャートタイプに基づいて適切なレンダリング関数を呼び出し
        // Dual layoutの場合は明示的にline chartとして扱う
        const chartType = config.type || 'line';
        
        // マージンを計算
        let margin;
        if (window.ChartLayoutHelper) {
            margin = ChartLayoutHelper.calculateDynamicMargins(data, config, {
                chartType: chartType,
                hasLegend: config.showLegend !== false && config.multiSeries,
                screenWidth: width,
                screenHeight: height
            });
        } else {
            margin = config.margin || { top: 20, right: 20, bottom: 40, left: 50 };
        }
        
        // チャート描画エリア
        const g = chartGroup.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);
        
        // チャートタイプ別に描画
        const adjustedConfig = {
            ...config,
            width: width - margin.left - margin.right,
            height: height - margin.top - margin.bottom,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        };
        
        try {
            switch (chartType) {
                case 'line':
                    this.renderLineChartInGroup(g, data, adjustedConfig);
                    break;
                case 'bar':
                    this.renderBarChartInGroup(g, data, adjustedConfig);
                    break;
                case 'pie':
                    this.renderPieChartInGroup(g, data, adjustedConfig);
                    break;
                default:
                    console.warn(`ChartManager: Unsupported chart type in layout: ${chartType}`);
                    this.renderLineChartInGroup(g, data, adjustedConfig); // フォールバック
            }
            
            // データソースを表示（チャート外の適切な位置に）
            const { dataSource = '' } = config;
            if (dataSource) {
                this.addDataSourceToLayout(chartGroup, dataSource, width, height, margin);
            }
        } catch (error) {
            console.error(`ChartManager: Error rendering ${chartType} chart in layout:`, error);
        }
    }

    /**
     * レイアウト内チャートにデータソースを追加
     * @param {d3.Selection} chartGroup - チャートグループ
     * @param {string} dataSource - データソース名
     * @param {number} width - チャート幅
     * @param {number} height - チャート高さ
     * @param {Object} margin - マージン情報
     */
    addDataSourceToLayout(chartGroup, dataSource, width, height, margin) {
        chartGroup.append('text')
            .attr('class', 'chart-data-source')
            .attr('x', margin.left + 10)
            .attr('y', height - 5) // チャートグループの下端から5px上
            .attr('text-anchor', 'start')
            .attr('font-size', '10px')
            .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.LIGHT || '#888')
            .text(`出典: ${dataSource}`);
    }

    /**
     * グループ内で折れ線グラフを描画（LineChartRendererのロジックを使用）
     */
    renderLineChartInGroup(g, data, config) {
        if (this.renderers.line && typeof this.renderers.line.renderLineChartInGroup === 'function') {
            try {
                // デュアルレイアウトのフラグを追加
                const isDualLayout = this.currentLayout === 'dual';
                const configWithDualFlag = {
                    ...config,
                    isDualLayout: isDualLayout
                };
                
                this.renderers.line.renderLineChartInGroup(g, data, configWithDualFlag);
            } catch (error) {
                console.error('ChartManager: Error calling LineChartRenderer.renderLineChartInGroup:', error);
            }
        } else {
            console.warn('ChartManager: LineChartRenderer.renderLineChartInGroup not available');
            
            // フォールバック: 基本的な線グラフを直接描画
            this.fallbackLineChartInGroup(g, data, config);
        }
    }
    
    /**
     * LineChartRendererが利用できない場合のフォールバック
     */
    fallbackLineChartInGroup(g, data, config) {
        
        const { 
            width, 
            height, 
            xField = 'year', 
            yField = 'value', 
            seriesField = 'series',
            multiSeries = true,
            yRange,
            colors = window.AppConstants?.APP_COLORS?.PRIMARY_PALETTE || ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed']
        } = config;
        
        if (!data || data.length === 0) {
            console.warn('No data for fallback chart');
            return;
        }
        
        // データを系列別に分ける
        let seriesData;
        if (multiSeries && seriesField) {
            // 系列別にデータをグループ化
            const grouped = d3.group(data, d => d[seriesField]);
            seriesData = Array.from(grouped, ([key, values]) => ({
                name: key,
                values: values.sort((a, b) => +a[xField] - +b[xField])
            }));
        } else {
            // 単一系列
            seriesData = [{
                name: 'データ',
                values: data.sort((a, b) => +a[xField] - +b[xField])
            }];
        }
        
        
        // スケール設定
        const allValues = seriesData.flatMap(s => s.values);
        
        const xScale = d3.scaleLinear()
            .domain(d3.extent(allValues, d => +d[xField]))
            .range([0, width]);
            
        let yDomain;
        if (yRange && yRange.length === 2) {
            yDomain = yRange;
        } else {
            yDomain = d3.extent(allValues, d => +d[yField]);
        }
        
        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .nice()
            .range([height, 0]);
            
        // 線生成器
        const line = d3.line()
            .x(d => xScale(+d[xField]))
            .y(d => yScale(+d[yField]))
            .curve(d3.curveMonotoneX); // スムーズな曲線
            
        // 各系列を描画
        seriesData.forEach((series, index) => {
            const color = colors[index % colors.length];
            
            // 線を描画
            g.append('path')
                .datum(series.values)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', 2)
                .attr('stroke-opacity', 0.8)
                .attr('d', line);
                
            // データポイントを描画
            g.selectAll(`.dots-${index}`)
                .data(series.values)
                .enter().append('circle')
                .attr('class', `dots-${index}`)
                .attr('cx', d => xScale(+d[xField]))
                .attr('cy', d => yScale(+d[yField]))
                .attr('r', 3)
                .attr('fill', color)
                .attr('fill-opacity', 0.7);
        });
            
        // 軸を追加
        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));
            
        g.append('g')
            .call(d3.axisLeft(yScale));
            
        // 凡例を追加（複数系列の場合）
        if (seriesData.length > 1) {
            const legend = g.append('g')
                .attr('class', 'legend')
                .attr('transform', `translate(${width - 120}, 20)`);
                
            seriesData.forEach((series, index) => {
                const legendRow = legend.append('g')
                    .attr('transform', `translate(0, ${index * 20})`);
                    
                legendRow.append('rect')
                    .attr('width', 15)
                    .attr('height', 3)
                    .attr('fill', colors[index % colors.length]);
                    
                legendRow.append('text')
                    .attr('x', 20)
                    .attr('y', 0)
                    .attr('dy', '0.35em')
                    .attr('font-size', '12px')
                    .attr('fill', window.AppConstants?.APP_COLORS?.TEXT?.PRIMARY || '#333')
                    .text(series.name);
            });
        }
    }

    /**
     * グループ内で棒グラフを描画
     */
    renderBarChartInGroup(g, data, config) {
        if (this.renderers.bar && this.renderers.bar.renderBarChartInGroup) {
            this.renderers.bar.renderBarChartInGroup(g, data, config);
        } else {
            console.warn('ChartManager: BarChartRenderer not available for group rendering');
        }
    }

    /**
     * グループ内で円グラフを描画
     */
    renderPieChartInGroup(g, data, config) {
        if (this.renderers.pie && this.renderers.pie.renderPieChartInGroup) {
            this.renderers.pie.renderPieChartInGroup(g, data, config);
        } else {
            console.warn('ChartManager: PieChartRenderer not available for group rendering');
        }
    }

    /**
     * チャートデータの検証
     * @param {Object} chartData - チャートデータ
     * @returns {Object} 検証結果
     */
    validateChartData(chartData) {
        const errors = [];
        
        if (!chartData) {
            errors.push('Chart data is required');
            return { valid: false, errors };
        }
        
        // visible: false の場合は最小限の検証のみ
        if (chartData.visible === false) {
            return { valid: true, errors: [] };
        }
        
        // レイアウト特定の検証
        if (chartData.layout) {
            if (['dual', 'triple'].includes(chartData.layout)) {
                if (!chartData.charts || !Array.isArray(chartData.charts)) {
                    errors.push(`${chartData.layout} layout requires charts array`);
                }
            } else if (chartData.layout === 'grid') {
                if (!chartData.config) {
                    errors.push('Grid layout requires config object');
                }
            }
        } else {
            // 単一チャートの検証
            if (!chartData.type) {
                errors.push('Chart type is required for single charts');
            }
            if (!chartData.data) {
                errors.push('Chart data is required');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * レンダラー間のトランジション調整
     * @param {string} fromType - 元のチャートタイプ
     * @param {string} toType - 新しいチャートタイプ
     * @param {Object} options - トランジションオプション
     */
    coordinateTransition(fromType, toType, options = {}) {
        if (!this.transitionManager) {
            return;
        }
        
        try {
            // クロスフェードトランジション
            const fadeOutDuration = options.fadeOutDuration || 300;
            const fadeInDuration = options.fadeInDuration || 600;
            
            const fromRenderer = this.renderers[fromType];
            const toRenderer = this.renderers[toType];
            
            if (fromRenderer && toRenderer) {
                // フェードアウト -> フェードイン のシーケンス
                fromRenderer.hide({ transitionDuration: fadeOutDuration })
                    .on('end', () => {
                        toRenderer.show({ transitionDuration: fadeInDuration });
                    });
            }
        } catch (error) {
            console.warn('ChartManager: Error coordinating transition:', error);
        }
    }

    /**
     * リサイズ処理
     */
    resize() {
        super.resize();
        
        // アクティブなレンダラーをリサイズ
        if (this.activeRenderer) {
            this.activeRenderer.resize();
        }
        
        // レイアウトの場合は再描画
        if (this.currentLayout && ['dual', 'triple'].includes(this.currentLayout) && this.layoutData) {
            if (this.currentLayout === 'dual') {
                this.renderDualLayout(this.layoutData);
            } else if (this.currentLayout === 'triple') {
                this.renderTripleLayout(this.layoutData);
            }
        }
    }

    /**
     * すべてのレンダラーの状態を取得（デバッグ用）
     * @returns {Object} レンダラー状態
     */
    getRendererStates() {
        const states = {};
        Object.keys(this.renderers).forEach(type => {
            const renderer = this.renderers[type];
            if (renderer) {
                states[type] = {
                    available: true,
                    visible: renderer.getVisibility(),
                    currentState: renderer.getCurrentState()
                };
            } else {
                states[type] = { available: false };
            }
        });
        return states;
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            activeRenderer: this.activeRenderer?.constructor.name || null,
            currentLayout: this.currentLayout,
            rendererStates: this.getRendererStates(),
            transitionManagerAvailable: !!this.transitionManager
        };
    }

    /**
     * クリーンアップ処理
     */
    destroy() {
        // すべてのレンダラーを破棄
        Object.values(this.renderers).forEach(renderer => {
            if (renderer && renderer.destroy) {
                renderer.destroy();
            }
        });
        
        this.renderers = {};
        this.activeRenderer = null;
        this.currentLayout = null;
        this.layoutData = null;
        
        super.destroy();
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.ChartManager = ChartManager;