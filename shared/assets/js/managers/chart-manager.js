import * as d3 from 'd3';
import { BaseManager } from '../utils/base-manager.js';
import { LineChartRenderer } from '../renderers/line-chart-renderer.js';
import { BarChartRenderer } from '../renderers/bar-chart-renderer.js';
import { PieChartRenderer } from '../renderers/pie-chart-renderer.js';
import { GridChartRenderer } from '../renderers/grid-chart-renderer.js';
import { StackedBarChartRenderer } from '../renderers/stacked-bar-chart-renderer.js';
import { VennChartRenderer } from '../renderers/venn-chart-renderer.js';
import { BaseLayout } from '../utils/base-layout.js';
import { ChartTransitions } from '../utils/chart-transitions.js';
import { LayoutConfig } from '../config/layout-config.js';
import { configLoader } from '../utils/config-loader.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { SVGHelper } from '../utils/svg-helper.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { ChartSVGRenderer } from '../utils/chart-svg-renderer.js'; // Assuming it exists or will be created
import { pubsub, EVENTS } from '../core/pubsub.js';
import { AppDefaults } from '../config/defaults.js';

/**
 * ChartManager - 新しいストリームライン化されたチャート管理クラス
 * 専門化されたレンダラー間の調整と統合に特化
 * BaseManagerを継承し、すべてのチャートタイプを統一的に管理
 */
export class ChartManager extends BaseManager {
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
            grid: null,
            'stacked-bar': null
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
                grid: null,
                'stacked-bar': null,
                'venn-grid': null
            };
        }

        const containerId = this.container.node().id ? `#${this.container.node().id}` : '.chart-container';

        try {
            // LineChartRenderer
            if (LineChartRenderer) {
                this.renderers.line = new LineChartRenderer(containerId);
            } else {
                ErrorHandler.handle(new Error('LineChartRenderer not available'), 'ChartManager.initializeRenderers', {
                    type: ErrorHandler.ERROR_TYPES.INITIALIZATION,
                    severity: ErrorHandler.SEVERITY.MEDIUM
                });
            }

            // BarChartRenderer
            if (BarChartRenderer) {
                this.renderers.bar = new BarChartRenderer(containerId);
            } else {
                ErrorHandler.handle(new Error('BarChartRenderer not available'), 'ChartManager.initializeRenderers', {
                    type: ErrorHandler.ERROR_TYPES.INITIALIZATION,
                    severity: ErrorHandler.SEVERITY.MEDIUM
                });
            }

            // PieChartRenderer
            if (PieChartRenderer) {
                this.renderers.pie = new PieChartRenderer(containerId);
            } else {
                ErrorHandler.handle(new Error('PieChartRenderer not available'), 'ChartManager.initializeRenderers', {
                    type: ErrorHandler.ERROR_TYPES.INITIALIZATION,
                    severity: ErrorHandler.SEVERITY.MEDIUM
                });
            }

            // GridChartRenderer
            if (GridChartRenderer) {
                try {
                    this.renderers.grid = new GridChartRenderer(containerId);
                } catch (gridError) {
                    this.renderers.grid = null;
                }
            } else {
                // console.error('✗ GridChartRenderer not available');
            }

            // StackedBarChartRenderer
            if (StackedBarChartRenderer) {
                this.renderers['stacked-bar'] = new StackedBarChartRenderer(containerId);
            } else {
                // console.error('✗ StackedBarChartRenderer not available');
            }

            // VennChartRenderer
            if (VennChartRenderer) {
                this.renderers['venn-grid'] = new VennChartRenderer(containerId);
            } else {
                // console.error('✗ VennChartRenderer not available');
            }
        } catch (error) {
            if (ErrorHandler) {
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
            ErrorHandler.handle(new Error('No renderers were successfully initialized'), 'ChartManager.initializeRenderers', {
                type: ErrorHandler.ERROR_TYPES.INITIALIZATION,
                severity: ErrorHandler.SEVERITY.HIGH
            });
        }
    }

    /**
     * レイアウト管理クラスを初期化
     * BaseLayout で Dual/Triple レイアウトを統合管理
     */
    initializeLayoutManagers() {
        try {
            // Dual レイアウト（BaseLayout で統合）
            if (BaseLayout) {
                this.layouts.dual = new BaseLayout(this.container.node().id, 'dual');
            }

            // Triple レイアウト（BaseLayout で統合）
            if (BaseLayout) {
                this.layouts.triple = new BaseLayout(this.container.node().id, 'triple');
            }
        } catch (error) {
            console.warn('ChartManager: Error initializing layout managers:', error);
        }
    }

    /**
     * トランジション管理を初期化
     */
    initializeTransitionManager() {
        if (ChartTransitions) {
            this.transitionManager = ChartTransitions;
        } else {
            console.warn('ChartTransitions not available, transitions may be less smooth');
        }
    }

    /**
     * チャートデータの検証
     * @param {Object} chartData - 検証するチャートデータ
     * @returns {{valid: boolean, errors: string[]}} 検証結果
     */
    validateChartData(chartData) {
        const errors = [];

        if (!chartData) {
            errors.push('No chart data provided.');
        } else {
            // レイアウトが指定されている場合はtypeは必須ではない
            if (!chartData.type && !chartData.layout) {
                errors.push('Chart type is missing.');
            }
            // Add more validation rules as needed
            // For example, check for data presence if type is specified
            // if (!chartData.data && !chartData.config?.dataFile) {
            //     errors.push('Chart data or dataFile is missing.');
            // }
        }

        return { valid: errors.length === 0, errors: errors };
    }

    /**
     * チャートの更新
     * @param {Object} chartData - チャート設定データ
     */
    async updateChart(chartData) {
        try {
            // 表示設定の確認
            if (chartData && chartData.visible === false) {
                this.hide();
                return;
            }

            // データの検証
            const validation = this.validateChartData(chartData);
            if (!validation.valid) {
                console.warn('ChartManager: Invalid chart data:', validation.errors);
                this.hide();
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
                    await this.handleDualLayout(chartData);
                    break;
                case 'triple':
                    await this.handleTripleLayout(chartData);
                    break;
                case 'grid':
                    this.handleGridLayout(chartData);
                    break;
                case 'venn-grid':
                    this.handleVennGridLayout(chartData);
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
            if (ErrorHandler) {
                ErrorHandler.handle(error, 'ChartManager.updateChart', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: chartData
                });
            } else {
                console.error('ChartManager: Error updating chart:', error);
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
    async handleDualLayout(chartData) {
        console.log('ChartManager: handleDualLayout called with:', chartData);
        try {
            // データ読み込み（不足している場合）
            if (chartData.charts) {
                const loadPromises = chartData.charts.map(async (chart) => {
                    if ((!chart.data || chart.data.length === 0) && chart.dataFile) {
                        try {
                            const dataPath = configLoader.resolveDataPath(chart.dataFile);
                            console.log(`ChartManager: Loading data for ${chart.id} from ${dataPath}`);
                            chart.data = await d3.csv(dataPath);
                        } catch (e) {
                            ErrorHandler.handle(e, `ChartManager.handleDualLayout (loading ${chart.id})`, {
                                type: ErrorHandler.ERROR_TYPES.DATA_LOAD,
                                severity: ErrorHandler.SEVERITY.HIGH
                            });
                        }
                    }
                });
                await Promise.all(loadPromises);
            }

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
            if (ErrorHandler) {
                ErrorHandler.handle(error, 'ChartManager.handleDualLayout', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: chartData
                });
            } else {
                console.error('ChartManager: Error in handleDualLayout:', error);
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
            // Note: BaseLayout doesn't have render method for triple layout logic specifically implemented here?
            // Actually, BaseLayout is a base class. ChartManager seems to handle triple layout rendering logic itself in renderTripleLayout method below.
            // But here it calls tripleLayout.render(chartData).
            // If BaseLayout is used as a placeholder, we might need to implement renderTripleLayout logic here or use a dedicated TripleLayout class.
            // The original code used `this.layouts.triple.render(chartData)`.
            // If BaseLayout doesn't implement render, this will fail.
            // However, looking at the original code, it seems ChartManager had `renderTripleLayout` method but `handleTripleLayout` called `this.layouts.triple.render`.
            // This suggests `this.layouts.triple` was an instance of `TripleLayout` (which extended BaseLayout).
            // Since I only have `BaseLayout` now, I should probably implement the logic in `ChartManager` or ensure `BaseLayout` can handle it.
            // Or I should use `this.renderTripleLayout(chartData)` directly if `TripleLayout` class is gone.
            // The original code had `renderTripleLayout` method defined in ChartManager.
            // I will use `this.renderTripleLayout(chartData)` instead of `this.layouts.triple.render(chartData)` to be safe,
            // or I should check if `TripleLayout` exists.
            // I'll assume I should use `this.renderTripleLayout(chartData)` which is defined in this class.

            this.renderTripleLayout(chartData);

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
            if (LayoutConfig && LayoutConfig.getPreset) {
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
     * Venn Grid レイアウトの処理
     * @param {Object} chartData - チャートデータ
     */
    handleVennGridLayout(chartData) {
        const vennRenderer = this.renderers['venn-grid'];

        if (vennRenderer) {
            // 前のレンダラーを非表示
            this.hideInactiveRenderers('venn-grid');

            this.activeRenderer = vennRenderer;
            this.currentLayout = 'venn-grid';

            vennRenderer.updateChart(chartData);
        } else {
            console.warn('ChartManager: VennChartRenderer not available');
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
            .style('color', AppDefaults?.colors?.text?.secondary || '#666');

        errorMessage.append('p')
            .text(`Chart renderer for "${chartData.type || 'unknown'}" is not available`);

        errorMessage.append('p')
            .style('font-size', '0.9em')
            .text('Please check that all required chart renderer scripts are loaded');
    }

    /**
     * position設定から寸法を計算
     * @param {string|number} value - 設定値
     * @param {number} containerSize - コンテナサイズ
     * @param {string} dimension - 'width' or 'height'
     * @returns {number} 計算された寸法
     */
    calculateDimensionFromPosition(value, containerSize, dimension) {
        if (!value) return containerSize;

        if (typeof value === 'string') {
            if (value.endsWith('%')) {
                const percent = parseFloat(value) / 100;
                return containerSize * percent;
            } else if (value.endsWith('px')) {
                return parseFloat(value);
            }
        }

        if (typeof value === 'number') {
            return value;
        }

        return containerSize;
    }

    /**
     * チャートコンテナをクリア
     */
    clearChartContainer() {
        if (this.container) {
            this.container.selectAll('*').remove();
        }
    }

    /**
     * エラーメッセージを表示
     * @param {string} message - エラーメッセージ
     */
    renderFallbackError(message) {
        ErrorHandler.handle(new Error(message), 'ChartManager.renderFallbackError', {
            type: ErrorHandler.ERROR_TYPES.RENDER,
            severity: ErrorHandler.SEVERITY.HIGH,
            showNotification: false // フォールバック表示自体が通知の役割を果たすため
        });
        this.clearChartContainer();
        this.show();

        const containerWidth = this.container.node().clientWidth || 800;
        const containerHeight = this.container.node().clientHeight || 600;

        const svg = this.container.append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight);

        svg.append('text')
            .attr('x', containerWidth / 2)
            .attr('y', containerHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', 'red')
            .text(message);
    }

    /**
     * デュアルレイアウトを直接描画（レンダラー汚染回避版）
     * 既存レンダラーを使わず、独立したSVG描画を行う
     * @param {Object} chartData - チャートデータ
     */
    renderDualLayoutDirect(chartData) {
        const { charts, position } = chartData;

        if (!charts || !Array.isArray(charts) || charts.length !== 2) {
            ErrorHandler.handle(new Error('Invalid charts array for dual layout. Expected exactly 2 charts.'), 'ChartManager.renderDualLayoutDirect', {
                type: ErrorHandler.ERROR_TYPES.VALIDATION,
                severity: ErrorHandler.SEVERITY.HIGH,
                context: { charts }
            });
            return;
        }

        // 統一コンテナ管理：完全にクリア
        this.clearChartContainer();

        // 横並びレイアウト用のSVGを作成
        const svg = this.createDualLayoutSVG(chartData);
        if (!svg) {
            ErrorHandler.handle(new Error('Failed to create SVG for direct dual layout'), 'ChartManager.renderDualLayoutDirect', {
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.HIGH
            });
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
    }

    /**
     * SVG内で単一チャートを直接描画（レンダラー非使用）
     * ChartSVGRenderer のロジックを統合
     * @param {d3.Selection} svgGroup - SVGグループ
     * @param {Object} chartConfig - チャート設定
     * @param {Object} layout - レイアウト情報
     * @param {string} position - 位置 ('left' | 'right')
     */
    drawSingleChartInSVG(svgGroup, chartConfig, layout, position) {
        // ChartSVGRenderer に委譲（共通化）
        if (ChartSVGRenderer) {
            ChartSVGRenderer.drawSingleChartInSVGStatic(svgGroup, chartConfig, layout, position);
        } else {
            ErrorHandler.handle(new Error('ChartSVGRenderer not available'), 'ChartManager.drawSingleChartInSVG', {
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.HIGH
            });
        }
    }

    /**
     * デュアルレイアウト用のSVGを作成
     * @param {Object} chartData - チャートデータ
     * @returns {d3.Selection} SVG要素
     */
    createDualLayoutSVG(chartData) {
        const containerNode = this.container.node();

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
        if (SVGHelper) {
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
                    const dataPath = ConfigLoader ?
                        ConfigLoader.resolveDataPath(chartConfig.dataFile) :
                        chartConfig.dataFile;

                    try {
                        const data = await d3.csv(dataPath);
                        return { ...chartConfig, data };
                    } catch (csvError) {
                        ErrorHandler.handle(csvError, `ChartManager.loadChartsDataAndRender (chart ${index})`, {
                            type: ErrorHandler.ERROR_TYPES.DATA_LOAD,
                            severity: ErrorHandler.SEVERITY.HIGH,
                            additionalInfo: { path: dataPath }
                        });
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
            if (ErrorHandler) {
                ErrorHandler.handle(error, 'ChartManager.loadChartsDataAndRender', {
                    type: ErrorHandler.ERROR_TYPES.DATA_LOAD,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { charts }
                });
            } else {
                console.error('ChartManager: Error in loadChartsDataAndRender:', error);
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
        if (SVGHelper) {
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
            totalWidth = this.calculateDimensionFromPosition(position.width, containerWidth, 'width');
            totalHeight = this.calculateDimensionFromPosition(position.height, containerHeight, 'height');
        } else {
            totalWidth = Math.min(containerWidth * 0.95, 1200);
            totalHeight = Math.max(Math.min(containerHeight * 0.8, 500), 400);
        }

        const spacing = 30;
        const marginTop = 40;

        const chartWidth = (totalWidth - spacing * 2) / 3;
        const chartHeight = totalHeight - 60;

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
     * Layout内で単一チャートを描画
     * @param {d3.Selection} svg - SVG要素
     * @param {Object} chartConfig - チャート設定
     * @param {Object} layout - レイアウト情報
     */
    renderSingleChartInLayout(svg, chartConfig, layout) {
        const { type, data, config } = chartConfig;

        // チャートグループを作成
        const chartGroup = svg.append('g')
            .attr('transform', `translate(${layout.x}, ${layout.y})`);

        // レンダラーに委譲（一時的なレンダラーインスタンスを作成するか、既存のメソッドを使用）
        // ここではChartSVGRendererのような静的メソッドがあればそれを使うのがベスト
        // しかし、各レンダラーのインスタンスメソッド `renderChartInGroup` を使う手もある

        if (type === 'pie' && this.renderers.pie) {
            // PieChartRendererのメソッドを再利用
            // タイトル描画
            if (chartConfig.title) {
                chartGroup.append('text')
                    .attr('x', layout.width / 2)
                    .attr('y', 20)
                    .attr('text-anchor', 'middle')
                    .attr('fill', AppDefaults?.colors?.text?.primary || '#333')
                    .style('font-family', 'var(--font-family-serif)')
                    .style('font-size', 'var(--font-size-base)')
                    .style('font-weight', 'var(--font-weight-bold)')
                    .text(chartConfig.title);
            }

            const g = chartGroup.append('g')
                .attr('transform', `translate(${layout.width / 2}, ${layout.height / 2 + 20})`);

            const radius = Math.min(layout.width, layout.height - 40) / 2;
            this.renderers.pie.renderPieChartInGroup(g, data, { ...config, radius });

        } else if (type === 'line' && this.renderers.line) {
            // LineChartRendererのメソッドを再利用
            if (chartConfig.title) {
                chartGroup.append('text')
                    .attr('x', layout.width / 2)
                    .attr('y', 20)
                    .attr('text-anchor', 'middle')
                    .attr('fill', AppDefaults?.colors?.text?.primary || '#333')
                    .style('font-family', 'var(--font-family-serif)')
                    .style('font-size', 'var(--font-size-base)')
                    .style('font-weight', 'var(--font-weight-bold)')
                    .text(chartConfig.title);
            }

            const g = chartGroup.append('g')
                .attr('transform', `translate(30, 40)`); // マージン調整

            this.renderers.line.renderLineChartInGroup(g, data, {
                ...config,
                width: layout.width - 60,
                height: layout.height - 60
            });

        } else if (type === 'bar' && this.renderers.bar) {
            // BarChartRendererのメソッドを再利用
            if (chartConfig.title) {
                chartGroup.append('text')
                    .attr('x', layout.width / 2)
                    .attr('y', 20)
                    .attr('text-anchor', 'middle')
                    .attr('fill', AppDefaults?.colors?.text?.primary || '#333')
                    .style('font-family', 'var(--font-family-serif)')
                    .style('font-size', 'var(--font-size-base)')
                    .style('font-weight', 'var(--font-weight-bold)')
                    .text(chartConfig.title);
            }

            const g = chartGroup.append('g')
                .attr('transform', `translate(30, 40)`); // マージン調整

            this.renderers.bar.renderBarChartInGroup(g, data, {
                ...config,
                width: layout.width - 60,
                height: layout.height - 60
            });
        } else {
            console.warn(`ChartManager: Unsupported chart type for layout rendering: ${type}`);
        }
    }
}