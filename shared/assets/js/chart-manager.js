/**
 * ChartManager - 新しいストリームライン化されたチャート管理クラス
 * 専門化されたレンダラー間の調整と統合に特化
 * BaseManagerを継承し、すべてのチャートタイプを統一的に管理
 */
class ChartManager extends BaseManager {
    constructor(containerId) {
        // position制御を正しく行うため、常に#chart-containerを使用
        const actualContainerId = containerId === '#chart' ? '#chart-container' : containerId;
        
        super(actualContainerId);
        
        // chart要素への参照も保持（描画用）
        this.chartElement = d3.select('#chart');
        
        // 専門化されたレンダラーのインスタンス
        this.renderers = {
            line: null,
            bar: null,
            pie: null,
            grid: null
        };
        
        // レイアウト管理クラスのインスタンス
        this.layouts = {
            dual: null,
            triple: null
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
        this.initializeLayoutManagers();
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
                try {
                    this.renderers.grid = new GridChartRenderer(containerId);
                    console.log('✓ GridChartRenderer initialized successfully');
                } catch (gridError) {
                    console.error('✗ Failed to initialize GridChartRenderer:', gridError);
                    this.renderers.grid = null;
                }
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
     * レイアウト管理クラスを初期化
     */
    initializeLayoutManagers() {
        try {
            // DualLayout
            if (window.DualLayout) {
                this.layouts.dual = new DualLayout(this.containerId);
                console.log('✓ DualLayout initialized successfully');
            } else {
                console.error('✗ DualLayout not available in window');
            }
            
            // TripleLayout
            if (window.TripleLayout) {
                this.layouts.triple = new TripleLayout(this.containerId);
                console.log('✓ TripleLayout initialized successfully');
            } else {
                console.error('✗ TripleLayout not available in window');
            }
        } catch (error) {
            console.error('Error initializing layout managers:', error);
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
     * デュアルレイアウトの処理（完全統一版）
     * DualLayoutクラスを使わず、ChartManagerで直接描画
     * @param {Object} chartData - チャートデータ
     */
    handleDualLayout(chartData) {
        try {
            console.log('ChartManager: Handling dual layout (complete unified version)');
            
            // レイアウト状態の更新
            this.activeRenderer = null;
            this.currentLayout = 'dual';
            this.layoutData = chartData;
            
            // すべてのレンダラーを非表示にしてクリーンな状態にする
            this.hideAllRenderers();
            
            // コンテナを表示
            this.show();
            
            // レンダラー汚染を避けるため、直接SVG描画方式を使用
            this.renderDualLayoutDirect(chartData);
            
        } catch (error) {
            console.error('ChartManager: Error in handleDualLayout:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'ChartManager.handleDualLayout', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: chartData
                });
            }
            this.renderFallbackError('Dual layout error: ' + error.message);
        }
    }

    /**
     * トリプルレイアウトの処理
     * @param {Object} chartData - チャートデータ
     */
    async handleTripleLayout(chartData) {
        try {
            // TripleLayoutクラスに委譲
            const tripleLayout = this.layouts.triple;
            if (!tripleLayout) {
                throw new Error('TripleLayout not initialized');
            }
            
            // レイアウト状態の更新
            this.activeRenderer = null;
            this.currentLayout = 'triple';
            this.layoutData = chartData;
            
            // コンテナを表示
            this.show();
            
            // TripleLayoutで描画（クリア処理はTripleLayoutが責任）
            const success = await tripleLayout.render(chartData);
            if (!success) {
                console.error('Failed to render triple layout');
                this.renderFallbackError('Triple layout rendering failed');
            }
        } catch (error) {
            ErrorHandler.handle(error, {
                context: 'ChartManager.handleTripleLayout',
                chartData
            });
            this.renderFallbackError('Triple layout error: ' + error.message);
        }
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
            
            // LayoutConfigから統一設定を適用
            if (window.LayoutConfig && window.LayoutConfig.getPreset) {
                const preset = chartData.preset || 'GRID_AUTO';
                const layoutConfig = LayoutConfig.getPreset(preset, chartData.position);
                if (layoutConfig) {
                    chartData.position = { ...layoutConfig.position, ...chartData.position };
                    
                    // Grid Layout: 手動設定（columns/rows）が存在する場合はgridMode: autoを適用しない
                    const hasManualGrid = chartData.config?.columns !== undefined && chartData.config?.rows !== undefined;
                    
                    chartData.config = {
                        ...chartData.config,
                        gridMode: hasManualGrid ? 'manual' : (chartData.config?.gridMode || layoutConfig.gridMode),
                        spacing: chartData.config?.spacing || layoutConfig.spacing,
                        chartSize: chartData.config?.chartSize || layoutConfig.chartSize
                    };
                }
            }
            
            // position設定をconfig内に統合してGridChartRendererに渡す
            const enhancedChartData = {
                ...chartData,
                config: {
                    ...chartData.config,
                    position: chartData.position // position設定をconfigに統合
                }
            };
            
            gridRenderer.updateChart(enhancedChartData);
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
        // 単一チャートレンダラーの場合のみ、他のレンダラーを非表示
        if (this.currentLayout === 'single') {
            Object.keys(this.renderers).forEach(type => {
                if (type !== activeType && this.renderers[type]) {
                    this.renderers[type].hide();
                }
            });
        }
        
        // DualLayoutの独立管理を無効化（統一アーキテクチャでは不要）
        // この処理は統一アーキテクチャでは実行しない
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
        this.clearChartContainer();
        this.show();
        
        const errorMessage = this.chartElement.append('div')
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
     * デュアルレイアウトを描画（統一アーキテクチャ版）
     * Single Chart方式を使用して既存レンダラーを活用
     * @param {Object} chartData - チャートデータ
     */
    renderDualLayoutUnified(chartData) {
        const { charts, position } = chartData;
        
        if (!charts || !Array.isArray(charts) || charts.length !== 2) {
            console.error('ChartManager: Invalid charts array for dual layout. Expected exactly 2 charts.', charts);
            return;
        }
        
        console.log('ChartManager: Starting unified dual layout rendering');
        
        // 統一コンテナ管理：一度だけクリア
        this.clearChartContainer();
        
        // 横並びレイアウト用のSVGを作成
        const svg = this.createDualLayoutSVG(chartData);
        if (!svg) {
            console.error('ChartManager: Failed to create SVG for unified dual layout');
            return;
        }
        
        // 2つのチャートグループを作成
        const layout = this.calculateDualLayoutDimensions(position);
        const leftGroup = svg.append('g').attr('class', 'dual-chart-left');
        const rightGroup = svg.append('g').attr('class', 'dual-chart-right')
            .attr('transform', `translate(${layout.chartWidth + layout.spacing}, 0)`);
        
        // 各チャート用の仮想コンテナを作成
        const leftContainer = this.createVirtualContainer(leftGroup, 'dual-left');
        const rightContainer = this.createVirtualContainer(rightGroup, 'dual-right');
        
        // 既存レンダラーを使用して各チャートを描画
        this.renderChartInDualLayout(charts[0], leftContainer, layout, 'left');
        this.renderChartInDualLayout(charts[1], rightContainer, layout, 'right');
        
        console.log('ChartManager: Unified dual layout rendering completed');
    }

    /**
     * デュアルレイアウトを直接描画（レンダラー汚染回避版）
     * 既存レンダラーを使わず、独立したSVG描画を行う
     * @param {Object} chartData - チャートデータ
     */
    renderDualLayoutDirect(chartData) {
        const { charts, position } = chartData;
        
        if (!charts || !Array.isArray(charts) || charts.length !== 2) {
            console.error('ChartManager: Invalid charts array for dual layout. Expected exactly 2 charts.', charts);
            return;
        }
        
        console.log('ChartManager: Starting direct dual layout rendering (no renderer contamination)');
        
        // 統一コンテナ管理：完全にクリア
        this.clearChartContainer();
        
        // 横並びレイアウト用のSVGを作成
        const svg = this.createDualLayoutSVG(chartData);
        if (!svg) {
            console.error('ChartManager: Failed to create SVG for direct dual layout');
            return;
        }
        
        // レイアウト計算
        const layout = this.calculateDualLayoutDimensions(position);
        
        // 2つのチャートエリアを作成（独立したSVGとして）
        const leftChartSVG = svg.append('g')
            .attr('class', 'dual-chart-left')
            .attr('transform', `translate(${layout.marginLeft}, ${layout.marginTop})`);
            
        const rightChartSVG = svg.append('g')
            .attr('class', 'dual-chart-right')
            .attr('transform', `translate(${layout.marginLeft + layout.chartWidth + layout.spacing}, ${layout.marginTop})`);
        
        // 各チャートを独立して描画（既存レンダラーを使わない）
        this.drawSingleChartInSVG(leftChartSVG, charts[0], layout, 'left');
        this.drawSingleChartInSVG(rightChartSVG, charts[1], layout, 'right');
        
        console.log('ChartManager: Direct dual layout rendering completed');
    }

    /**
     * SVG内で単一チャートを直接描画（レンダラー非使用）
     * @param {d3.Selection} svgGroup - SVGグループ
     * @param {Object} chartConfig - チャート設定
     * @param {Object} layout - レイアウト情報
     * @param {string} position - 位置 ('left' | 'right')
     */
    drawSingleChartInSVG(svgGroup, chartConfig, layout, position) {
        console.log(`ChartManager: Drawing ${chartConfig.type} chart directly in ${position} position`);
        
        if (chartConfig.type !== 'line') {
            console.error(`ChartManager: Direct rendering only supports line charts, got: ${chartConfig.type}`);
            return;
        }
        
        // データを取得
        const data = chartConfig.data;
        console.log(`DEBUG: Drawing ${position} chart - dataFile: ${chartConfig.dataFile}, data length: ${data ? data.length : 'null'}`);
        if (data && data.length > 0) {
            console.log(`DEBUG: First row of ${position} data:`, data[0]);
            console.log(`DEBUG: Chart ${position} title: ${chartConfig.title}`);
        }
        if (!data || data.length === 0) {
            console.error(`ChartManager: No data available for ${position} chart`);
            return;
        }
        
        // チャート描画エリアを準備
        const margin = chartConfig.config.margin || { top: 40, right: 30, bottom: 60, left: 80 };
        const width = layout.chartWidth - margin.left - margin.right;
        const height = layout.chartHeight - margin.top - margin.bottom;
        
        const chartGroup = svgGroup.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);
        
        // タイトルを追加
        if (chartConfig.title) {
            svgGroup.append('text')
                .attr('class', 'chart-title')
                .attr('x', layout.chartWidth / 2)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .text(chartConfig.title);
        }
        
        // スケールの設定
        const xField = chartConfig.config.xField || 'year';
        const yField = chartConfig.config.yField || 'value';
        
        const xScale = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[xField]))
            .range([0, width]);
            
        const yScale = d3.scaleLinear()
            .domain(chartConfig.config.yRange || [0, d3.max(data, d => +d[yField])])
            .range([height, 0]);
        
        // 軸の描画
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);
        
        // 日本語フォーマットが設定されている場合
        if (chartConfig.config.yAxisFormat && chartConfig.config.yAxisFormat.type === 'japanese') {
            yAxis.tickFormat(d => {
                if (d >= 10000) {
                    return (d / 10000) + '万';
                }
                return d;
            });
        }
        
        chartGroup.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${height})`)
            .call(xAxis);
            
        chartGroup.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);
        
        // 軸ラベル
        if (chartConfig.config.yAxisLabel) {
            chartGroup.append('text')
                .attr('class', 'y-axis-label')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left)
                .attr('x', 0 - (height / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .style('font-size', '12px')
                .text(chartConfig.config.yAxisLabel);
        }
        
        // ラインの描画
        const line = d3.line()
            .x(d => xScale(+d[xField]))
            .y(d => yScale(+d[yField]))
            .curve(d3.curveMonotoneX);
        
        chartGroup.append('path')
            .datum(data)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', '#4ecdc4')
            .attr('stroke-width', 2)
            .attr('d', line);
        
        // データポイントの描画
        chartGroup.selectAll('.dot')
            .data(data)
            .enter().append('circle')
            .attr('class', 'dot')
            .attr('cx', d => xScale(+d[xField]))
            .attr('cy', d => yScale(+d[yField]))
            .attr('r', 3)
            .attr('fill', '#4ecdc4');
        
        console.log(`ChartManager: Successfully drew ${chartConfig.type} chart in ${position} position`);
    }

    /**
     * デュアルレイアウト用のSVGを作成
     * @param {Object} chartData - チャートデータ
     * @returns {d3.Selection} SVG要素
     */
    createDualLayoutSVG(chartData) {
        const containerNode = this.container.node();
        const containerRect = containerNode.getBoundingClientRect();
        
        // ビューポートサイズを基準としたサイズ計算
        const viewportWidth = window.innerWidth || 1200;
        const viewportHeight = window.innerHeight || 800;
        
        let totalWidth = Math.min(viewportWidth * 0.9, 1400);
        let totalHeight = Math.min(viewportHeight * 0.8, 700);
        
        // position設定がある場合はそれを優先
        if (chartData.position) {
            if (chartData.position.width) {
                totalWidth = this.calculateDimensionFromPosition(chartData.position.width, viewportWidth, 'width');
            }
            if (chartData.position.height) {
                totalHeight = this.calculateDimensionFromPosition(chartData.position.height, viewportHeight, 'height');
            }
        }
        
        // SVGHelperを使用してレスポンシブSVGを作成
        // 重要：single layoutと同様に#chart-containerに直接作成
        if (window.SVGHelper) {
            return SVGHelper.initSVG(this.container, totalWidth, totalHeight, {
                preserveAspectRatio: 'xMidYMid meet',
                responsive: true
            });
        } else {
            // フォールバック
            this.container.selectAll('*').remove();
            return this.container.append('svg')
                .attr('width', totalWidth)
                .attr('height', totalHeight);
        }
    }

    /**
     * デュアルレイアウトの寸法を計算（統一版）
     * @param {Object} position - position設定
     * @returns {Object} レイアウト情報
     */
    calculateDualLayoutDimensions(position = {}) {
        const viewportWidth = window.innerWidth || 1200;
        const viewportHeight = window.innerHeight || 800;
        
        let totalWidth = Math.min(viewportWidth * 0.9, 1400);
        let totalHeight = Math.min(viewportHeight * 0.8, 700);
        
        // position設定での上書き
        if (position.width) {
            totalWidth = this.calculateDimensionFromPosition(position.width, viewportWidth, 'width');
        }
        if (position.height) {
            totalHeight = this.calculateDimensionFromPosition(position.height, viewportHeight, 'height');
        }
        
        const spacing = 40;
        const marginTop = 40;
        const marginBottom = 40;
        const marginLeft = 20;
        const marginRight = 20;
        
        const availableWidth = totalWidth - marginLeft - marginRight;
        const availableHeight = totalHeight - marginTop - marginBottom;
        
        const chartWidth = Math.max((availableWidth - spacing) / 2, 400);
        const chartHeight = Math.max(availableHeight, 300);
        
        return {
            totalWidth,
            totalHeight,
            chartWidth,
            chartHeight,
            spacing,
            marginTop,
            marginBottom,
            marginLeft,
            marginRight
        };
    }

    /**
     * 仮想コンテナを作成（既存レンダラー用）
     * @param {d3.Selection} group - SVGグループ
     * @param {string} id - コンテナID
     * @returns {Object} 仮想コンテナオブジェクト
     */
    createVirtualContainer(group, id) {
        return {
            selection: group,
            id: id,
            node: () => group.node(),
            selectAll: (selector) => group.selectAll(selector),
            append: (element) => group.append(element),
            select: (selector) => group.select(selector),
            classed: (className, value) => group.classed(className, value),
            style: (property, value) => group.style(property, value),
            attr: (attribute, value) => group.attr(attribute, value),
            // レンダラーが期待するD3セレクションインターフェースを提供
            empty: () => group.empty(),
            size: () => group.size()
        };
    }

    /**
     * デュアルレイアウト内でチャートを描画
     * @param {Object} chartConfig - チャート設定
     * @param {Object} container - 仮想コンテナ
     * @param {Object} layout - レイアウト情報
     * @param {string} position - 位置 ('left' | 'right')
     */
    renderChartInDualLayout(chartConfig, container, layout, position) {
        const { type, data } = chartConfig;
        
        console.log(`ChartManager: Rendering ${type} chart in ${position} position`);
        
        // 既存レンダラーを取得
        const renderer = this.getRenderer(type);
        if (!renderer) {
            console.error(`ChartManager: No renderer available for type: ${type}`);
            return;
        }
        
        // レンダラーの一時的なコンテナ変更
        const originalContainer = renderer.container;
        renderer.container = container.selection;
        
        try {
            // チャート設定を準備
            const renderConfig = {
                ...chartConfig.config,
                ...chartConfig,
                width: layout.chartWidth,
                height: layout.chartHeight,
                data: data,
                visible: true
            };
            
            // 既存レンダラーで描画
            renderer.renderChart(type, data, renderConfig);
            
            console.log(`ChartManager: Successfully rendered ${type} chart in ${position} position`);
            
        } catch (error) {
            console.error(`ChartManager: Error rendering ${type} chart in ${position} position:`, error);
            
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'ChartManager.renderChartInDualLayout', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { chartConfig, position }
                });
            }
        } finally {
            // コンテナを元に戻す
            renderer.container = originalContainer;
        }
    }

    /**
     * チャートのデータを読み込んでから描画
     * @param {d3.Selection} svg - SVG要素
     * @param {Array} charts - チャート設定配列
     * @param {Object} layout - レイアウト情報
     */
    async loadChartsDataAndRender(svg, charts, layout) {
        try {
            // 各チャートのデータを並列で読み込み
            const dataPromises = charts.map(async (chartConfig, index) => {
                
                if (chartConfig.dataFile) {
                    // dataFileが指定されている場合はCSVを読み込み
                    const dataPath = window.ConfigLoader ? 
                        window.ConfigLoader.resolveDataPath(chartConfig.dataFile) : 
                        chartConfig.dataFile;
                    
                    
                    try {
                        const data = await d3.csv(dataPath);
                        return { ...chartConfig, data };
                    } catch (csvError) {
                        console.error(`ChartManager: CSV loading error for chart ${index}:`, csvError);
                        console.error(`ChartManager: Failed path:`, dataPath);
                        return { ...chartConfig, data: [] };
                    }
                } else if (chartConfig.data) {
                    // データが直接指定されている場合はそのまま使用
                    return chartConfig;
                } else {
                    console.warn('ChartManager: No data or dataFile specified for chart:', chartConfig);
                    return { ...chartConfig, data: [] };
                }
            });
            
            const chartsWithData = await Promise.all(dataPromises);
            
            // データが読み込まれたチャートを描画
            chartsWithData.forEach((chartConfig, index) => {
                // 個別チャートのサイズ設定を考慮したレイアウト計算
                let chartWidth = layout.chartWidth;
                let chartHeight = layout.chartHeight;
                
                // 個別チャートのconfig内にwidthPercent/heightPercentがある場合は適用
                if (chartConfig.config) {
                    const containerNode = this.container.node();
                    const containerWidth = containerNode.clientWidth || 800;
                    const containerHeight = containerNode.clientHeight || 600;
                    
                    if (chartConfig.config.widthPercent) {
                        // widthPercentを使用してサイズを再計算
                        const totalAvailableWidth = containerWidth * 0.95;
                        chartWidth = Math.max((totalAvailableWidth * chartConfig.config.widthPercent / 100 - layout.spacing) / 2, 400);
                    }
                    
                    if (chartConfig.config.heightPercent) {
                        // heightPercentを使用してサイズを再計算
                        chartHeight = Math.max(containerHeight * chartConfig.config.heightPercent / 100 - layout.marginTop - 20, 350);
                    }
                }
                
                const chartLayout = {
                    x: index * (chartWidth + layout.spacing),
                    y: layout.marginTop,
                    width: chartWidth,
                    height: chartHeight
                };
                
                
                this.renderSingleChartInLayout(svg, chartConfig, chartLayout);
            });
            
        } catch (error) {
            console.error('ChartManager: Error in loadChartsDataAndRender:', error);
            console.error('ChartManager: Error stack:', error.stack);
            console.error('ChartManager: Charts that failed:', charts);
            
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'ChartManager.loadChartsDataAndRender', {
                    type: ErrorHandler.ERROR_TYPES.DATA_LOAD,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { charts }
                });
            } else {
                console.error('ChartManager: ErrorHandler not available');
            }
        }
    }

    /**
     * トリプルレイアウトを描画（統一版）
     * @param {Object} chartData - チャートデータ
     */
    renderTripleLayout(chartData) {
        const { charts } = chartData;
        
        if (!charts || !Array.isArray(charts)) {
            console.error('ChartManager: Invalid charts array for triple layout', charts);
            return;
        }
        
        // コンテナをクリアしてSVGを作成
        this.clearChartContainer();
        const svg = this.createLayoutSVG('triple');
        
        if (!svg) {
            console.error('ChartManager: Failed to create SVG for triple layout');
            return;
        }
        
        // レイアウト計算
        const layout = this.calculateTripleLayout(chartData.position);
        
        // 各チャートのデータを読み込んでから描画
        this.loadChartsDataAndRender(svg, charts, layout);
    }

    /**
     * レイアウト用のSVGを作成（position設定対応版）
     * @param {string} layoutType - レイアウトタイプ
     * @param {Object} chartData - チャートデータ（position設定含む）
     * @returns {d3.Selection} SVG要素
     */
    createLayoutSVG(layoutType, chartData = {}) {
        // SVGは#chart要素に作成するが、サイズは#chart-containerから取得
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth || 800;
        const containerHeight = containerNode.clientHeight || 600;
        
        let totalWidth, totalHeight;
        
        // position設定からサイズを計算
        const position = chartData.position || {};
        
        if (position.width && position.height) {
            // position設定で明示的にサイズが指定されている場合
            totalWidth = this.calculateDimensionFromPosition(position.width, containerWidth, 'width');
            totalHeight = this.calculateDimensionFromPosition(position.height, containerHeight, 'height');
        } else {
            // 従来のデフォルト計算 - より大きなサイズに調整
            switch (layoutType) {
                case 'dual':
                    totalWidth = Math.min(containerWidth * 0.95, 1400); // 幅を拡大
                    totalHeight = Math.max(Math.min(containerHeight * 0.85, 800), 500); // 高さを拡大、最小高さ500px
                    break;
                case 'triple':
                    totalWidth = Math.min(containerWidth * 0.95, 1200);
                    totalHeight = Math.max(Math.min(containerHeight * 0.8, 500), 400); // 最小高さ400px
                    break;
                default:
                    totalWidth = 800;
                    totalHeight = 600;
            }
        }
        
        // SVGHelperを使用してSVGを作成（#chart要素に作成）
        if (window.SVGHelper) {
            return SVGHelper.initSVG(this.chartElement, totalWidth, totalHeight, {
                className: 'chart-svg',
                responsive: true,
                preserveAspectRatio: 'xMidYMid meet',
                actualWidth: layoutType === 'dual' ? totalWidth : null,
                actualHeight: layoutType === 'dual' ? totalHeight : null
            });
        } else {
            // フォールバック
            const svg = this.chartElement.append('svg')
                .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
            
            if (layoutType === 'dual') {
                // dual layoutでもレスポンシブ表示（コンテナサイズに合わせる）
                svg.style('width', '100%')
                   .style('height', 'auto')
                   .style('max-width', '100%');
            } else {
                // 通常のレスポンシブ表示
                svg.style('width', '100%')
                   .style('height', 'auto');
            }
            
            return svg;
        }
    }

    /**
     * デュアルレイアウトの寸法を計算（position設定対応版）
     * @param {Object} position - position設定
     * @returns {Object} レイアウト情報
     */
    calculateDualLayout(position = {}) {
        // ビューポートサイズを基準とした制約計算
        const viewportWidth = window.innerWidth || 1200;
        const viewportHeight = window.innerHeight || 800;
        
        let totalWidth, totalHeight;
        
        if (position.width && position.height) {
            // position設定で明示的にサイズが指定されている場合
            // ビューポートサイズに対する割合で計算
            totalWidth = this.calculateDimensionFromPosition(position.width, viewportWidth, 'width');
            totalHeight = this.calculateDimensionFromPosition(position.height, viewportHeight, 'height');
        } else {
            // 従来のデフォルト計算
            const containerNode = this.container.node();
            const containerWidth = containerNode.clientWidth || 800;
            const containerHeight = containerNode.clientHeight || 600;
            totalWidth = Math.min(containerWidth * 0.95, 1400);
            totalHeight = Math.max(Math.min(containerHeight * 0.85, 800), 500);
        }
        
        // position制約がない場合のみ最小サイズを確保
        if (!position.width && !position.height) {
            // dual layout では2つのチャートが収まる十分なサイズを確保
            totalWidth = Math.max(totalWidth, 1200); // dual layout の最小幅を確保
            totalHeight = Math.max(totalHeight, 700); // dual layout の最小高さを確保
        }
        
        const spacing = 40;
        const marginTop = 40;
        
        // より大きなチャートサイズを確保
        const chartWidth = Math.max((totalWidth - spacing) / 2, 500); // 最小幅500px
        const chartHeight = Math.max(totalHeight - marginTop - 20, 400); // 最小高さ400px
        
        return {
            totalWidth,
            totalHeight,
            chartWidth,
            chartHeight,
            spacing,
            marginTop
        };
    }

    /**
     * トリプルレイアウトの寸法を計算
     * @param {Object} position - position設定
     * @returns {Object} レイアウト情報
     */
    calculateTripleLayout(position = {}) {
        const containerNode = this.container.node();
        const containerWidth = containerNode.clientWidth || 800;
        const containerHeight = containerNode.clientHeight || 600;
        
        let totalWidth, totalHeight;
        
        if (position.width && position.height) {
            // position設定で明示的にサイズが指定されている場合
            totalWidth = this.calculateDimensionFromPosition(position.width, containerWidth, 'width');
            totalHeight = this.calculateDimensionFromPosition(position.height, containerHeight, 'height');
        } else {
            // 従来のデフォルト計算
            totalWidth = Math.min(containerWidth * 0.95, 1200);
            totalHeight = Math.min(containerHeight * 0.8, 500);
        }
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
        const { data, config } = chartConfig;
        const title = config.title;
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
                .attr('y', 20) // より見やすい位置に調整
                .attr('text-anchor', 'middle')
                .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
                .style('font-family', 'var(--font-family-serif)')
                .style('font-size', '14px') // フォントサイズを明示
                .style('font-weight', 'bold')
                .text(title);
        }
        
        // チャートタイプに基づいて適切なレンダリング関数を呼び出し
        const chartType = chartConfig.type || config.type || 'line';
        
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
        
        // チャートタイプ別に描画
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        // チャート描画エリア（座標系をチャートタイプに応じて設定）
        let g;
        if (chartType === 'pie') {
            // 極座標系：円グラフの中心を描画領域の中央に配置
            g = chartGroup.append('g')
                .attr('transform', `translate(${margin.left + innerWidth / 2}, ${margin.top + innerHeight / 2})`);
        } else {
            // 直交座標系：従来通りマージン適用後の左上を原点に設定
            g = chartGroup.append('g')
                .attr('transform', `translate(${margin.left}, ${margin.top})`);
        }
        
        const adjustedConfig = {
            ...config,
            width: innerWidth,
            height: innerHeight,
            radius: Math.min(innerWidth, innerHeight) / 2 - 20, // 円グラフ用のradius設定
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
                console.error('ChartManager: Error stack:', error.stack);
            }
        } else {
            console.warn('ChartManager: LineChartRenderer.renderLineChartInGroup not available');
            console.warn('ChartManager: Available renderers:', Object.keys(this.renderers || {}));
            console.warn('ChartManager: Line renderer type:', typeof this.renderers?.line);
            
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
     * position設定から実際の寸法を計算
     * @param {string|number} value - position設定値（"100%", "70%", 500等）
     * @param {number} containerSize - コンテナサイズ
     * @param {string} dimension - "width" または "height"
     * @returns {number} 計算された寸法
     */
    calculateDimensionFromPosition(value, containerSize, dimension) {
        if (typeof value === 'number') {
            return value;
        }
        
        if (typeof value === 'string') {
            if (value.endsWith('%')) {
                const percentage = parseFloat(value) / 100;
                return containerSize * percentage;
            } else if (value.endsWith('px')) {
                return parseFloat(value);
            } else if (value.endsWith('vh')) {
                return window.innerHeight * parseFloat(value) / 100;
            } else if (value.endsWith('vw')) {
                return window.innerWidth * parseFloat(value) / 100;
            }
        }
        
        // デフォルト値
        return dimension === 'width' ? containerSize : 400;
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
     * フォールバックエラー表示
     * @param {string} message - エラーメッセージ
     */
    renderFallbackError(message) {
        try {
            this.clearChartContainer();
            
            // containerのD3セレクションを安全に取得
            let container;
            if (this.container && this.container.node) {
                // 既にD3セレクション
                container = this.container;
            } else if (this.container) {
                // DOM要素
                container = d3.select(this.container);
            } else {
                // フォールバック
                container = d3.select('#chart-container');
            }
            
            container
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('justify-content', 'center')
                .style('min-height', '400px')
                .append('div')
                .style('text-align', 'center')
                .style('color', '#666')
                .style('font-family', 'sans-serif')
                .html(`
                    <h3 style="margin: 0 0 10px 0; color: #d32f2f;">チャート表示エラー</h3>
                    <p style="margin: 0; font-size: 0.9em;">${message}</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.8em; color: #999;">
                        ページを再読み込みしてお試しください
                    </p>
                `);
        } catch (error) {
            console.error('Error rendering fallback error:', error);
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
     * チャート専用のコンテナクリア処理（SVG削除ではなく非表示）
     */
    clearChartContainer() {
        // #chart-containerの内容を直接クリア（single layoutと統一）
        if (this.container && !this.container.empty()) {
            this.container.selectAll('svg').remove();
        }
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