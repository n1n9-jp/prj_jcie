import { BaseLayout } from './base-layout.js';
import { ChartLayoutHelper } from './chart-layout-helper.js';
import { ErrorHandler } from './error-handler.js';
import { BarChartRenderer } from '../renderers/bar-chart-renderer.js';
import { GridChartRenderer } from '../renderers/grid-chart-renderer.js';
import { LineChartRenderer } from '../renderers/line-chart-renderer.js';
import { PieChartRenderer } from '../renderers/pie-chart-renderer.js';
import { StackedBarChartRenderer } from '../renderers/stacked-bar-chart-renderer.js';

/**
 * ChartLayoutManager - チャートレイアウト管理クラス（統合版）
 *
 * 統合内容:
 * - ChartLayoutManager（レイアウト状態管理、レンダラー管理）
 * - ChartLayoutHelper（マージン計算、データ分析、フォーマッティング）
 *
 * 責務:
 * - 複数チャートのレイアウト管理（Dual, Triple）
 * - レイアウト寸法計算（動的マージン、サイズ最適化）
 * - SVG作成とチャート描画の統合
 * - データ分析とフォーマッティング
 * - 凡例・軸ラベル管理
 */

export class ChartLayoutManager extends BaseLayout {

    // ================================================
    // セクション1: コンストラクタと状態管理
    // ================================================

    /**
     * コンストラクタ
     * @param {string} containerId - コンテナの ID
     */
    constructor(containerId) {
        super(containerId);
        this.layoutType = null; // 'dual', 'triple', 'single'
        this.layoutState = {};
        this.renderers = {}; // レンダラーキャッシュ
        this.chartsData = {}; // チャートデータキャッシュ
    }

    /**
     * レイアウトを初期化
     * @param {string} type - レイアウトタイプ
     * @param {Object} config - レイアウト設定
     */
    initializeLayout(type, config = {}) {
        this.layoutType = type;
        this.layoutState = {
            type,
            config,
            initialized: true,
            timestamp: Date.now()
        };
        console.log(`ChartLayoutManager: Initialized ${type} layout`);
    }

    /**
     * レイアウト状態を更新
     * @param {string} type - レイアウトタイプ
     * @param {Object} data - チャートデータ
     */
    updateLayoutState(type, data) {
        this.layoutType = type;
        this.layoutState = {
            type,
            data,
            timestamp: Date.now()
        };
    }

    /**
     * 現在のレイアウト状態を取得
     * @returns {Object} レイアウト状態
     */
    getCurrentLayoutState() {
        return { ...this.layoutState };
    }

    // ================================================
    // セクション2: レイアウト作成（委譲）
    // ================================================

    /**
     * デュアルレイアウトを作成
     * BaseLayout (DualLayout logic) クラスへ委譲
     * @param {Object} chartData - チャートデータ
     */
    async createDualLayout(chartData) {
        try {
            this.initializeLayout('dual', chartData);
            // BaseLayout.render handles dual layout if configured
            await this.render(chartData);
        } catch (error) {
            ErrorHandler.handle(
                error,
                'ChartLayoutManager.createDualLayout',
                {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { chartData }
                }
            );
        }
    }

    /**
     * トリプルレイアウトを作成
     * BaseLayout (TripleLayout logic) クラスへ委譲
     * @param {Object} chartData - チャートデータ
     */
    async createTripleLayout(chartData) {
        try {
            this.initializeLayout('triple', chartData);
            // BaseLayout.render handles triple layout if configured
            await this.render(chartData);
        } catch (error) {
            ErrorHandler.handle(
                error,
                'ChartLayoutManager.createTripleLayout',
                {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { chartData }
                }
            );
        }
    }

    // ================================================
    // セクション3: レンダラー管理
    // ================================================

    /**
     * チャートレンダラーを取得または作成
     * @param {string} type - チャートタイプ
     * @returns {Object} レンダラーインスタンス
     */
    getOrCreateRenderer(type) {
        if (!this.renderers[type]) {
            // 新規コンテナを作成してレンダラーをインスタンス化
            const containerId = `chart-renderer-${type}-${Date.now()}`;
            const div = this.container.append('div')
                .attr('id', containerId)
                .style('display', 'none'); // 非表示

            try {
                let RendererClass;
                switch (type) {
                    case 'bar':
                        RendererClass = BarChartRenderer;
                        break;
                    case 'grid':
                        RendererClass = GridChartRenderer;
                        break;
                    case 'line':
                        RendererClass = LineChartRenderer;
                        break;
                    case 'pie':
                        RendererClass = PieChartRenderer;
                        break;
                    case 'stackedBar':
                    case 'stacked-bar':
                        RendererClass = StackedBarChartRenderer;
                        break;
                    default:
                        console.warn(`ChartLayoutManager: Unknown renderer type: ${type}`);
                        return null;
                }

                if (RendererClass) {
                    this.renderers[type] = new RendererClass(containerId);
                }
            } catch (error) {
                ErrorHandler.handle(
                    error,
                    `ChartLayoutManager.createRenderer(${type})`,
                    { type: ErrorHandler.ERROR_TYPES.RENDER, severity: ErrorHandler.SEVERITY.MEDIUM }
                );
                return null;
            }
        }

        return this.renderers[type];
    }

    /**
     * チャートデータを検証
     * @param {Object} chartData - チャートデータ
     * @returns {Object} {valid: boolean, errors: string[]}
     */
    validateChartData(chartData) {
        const errors = [];

        if (!chartData || typeof chartData !== 'object') {
            errors.push('chartData must be an object');
            return { valid: false, errors };
        }

        if (!chartData.type) {
            errors.push('chartData.type is required');
        }

        if (!chartData.data || !Array.isArray(chartData.data)) {
            errors.push('chartData.data must be an array');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // ================================================
    // セクション4: 静的メソッド - 計算・分析系 (Delegated to ChartLayoutHelper)
    // ================================================

    static safeNumericConversion(value, fallback = 0) {
        return ChartLayoutHelper.safeNumericConversion(value, fallback);
    }

    static isYearData(data, field) {
        return ChartLayoutHelper.isYearData(data, field);
    }

    static calculateDynamicMargins(data, config, options = {}) {
        return ChartLayoutHelper.calculateDynamicMargins(data, config, options);
    }

    static getBaseMargins(chartType) {
        return ChartLayoutHelper.getBaseMargins(chartType);
    }

    static analyzeData(data, config) {
        return ChartLayoutHelper.analyzeData(data, config);
    }

    static analyzeUnits(data, config) {
        return ChartLayoutHelper.analyzeUnits(data, config);
    }

    static calculateTopMargin(baseTop, analysis, config) {
        return ChartLayoutHelper.calculateTopMargin(baseTop, analysis, config);
    }

    static calculateRightMargin(baseRight, analysis, hasLegend) {
        return ChartLayoutHelper.calculateRightMargin(baseRight, analysis, hasLegend);
    }

    static calculateBottomMargin(baseBottom, analysis) {
        return ChartLayoutHelper.calculateBottomMargin(baseBottom, analysis);
    }

    static calculateLeftMargin(baseLeft, analysis, unitInfo = null) {
        return ChartLayoutHelper.calculateLeftMargin(baseLeft, analysis, unitInfo);
    }

    static applyResponsiveAdjustments(margins, screenWidth, screenHeight) {
        return ChartLayoutHelper.applyResponsiveAdjustments(margins, screenWidth, screenHeight);
    }

    static formatAxisNumber(value, options = {}) {
        return ChartLayoutHelper.formatAxisNumber(value, options);
    }

    static formatAxisWithUnits(value, unitConfig = {}, options = {}) {
        return ChartLayoutHelper.formatAxisWithUnits(value, unitConfig, options);
    }

    static addAxisLabels(g, data, config, width, height, options = {}) {
        return ChartLayoutHelper.addAxisLabels(g, data, config, width, height, options);
    }

    static getUnitDefinitions(locale = 'ja') {
        return ChartLayoutHelper.getUnitDefinitions(locale);
    }

    static calculateOptimalLabelInterval(values, availableSpace, labelWidth = 50) {
        return ChartLayoutHelper.calculateOptimalLabelInterval(values, availableSpace, labelWidth);
    }

    static calculateLegendLayout(seriesNames, chartWidth, chartHeight) {
        return ChartLayoutHelper.calculateLegendLayout(seriesNames, chartWidth, chartHeight);
    }

    static optimizeInnerSize(containerWidth, containerHeight, margins, legendLayout) {
        return ChartLayoutHelper.optimizeInnerSize(containerWidth, containerHeight, margins, legendLayout);
    }

    static measureTextWidth(text, font = '12px Arial') {
        return ChartLayoutHelper.measureTextWidth(text, font);
    }

    static calculateCompleteLayout(config, data, containerWidth, containerHeight) {
        return ChartLayoutHelper.calculateCompleteLayout(config, data, containerWidth, containerHeight);
    }

    // ================================================
    // セクション8: クリーンアップ
    // ================================================

    /**
     * コンテナをクリア
     */
    clearContainer() {
        if (this.container) {
            this.container.selectAll('*').remove();
        }
    }

    /**
     * リソースをクリーンアップ
     */
    cleanup() {
        this.clearContainer();

        // レンダラーをクリーンアップ
        Object.values(this.renderers).forEach(renderer => {
            if (renderer && typeof renderer.destroy === 'function') {
                renderer.destroy();
            }
        });

        this.renderers = {};
        this.chartsData = {};
        this.layoutState = {};
    }

    /**
     * リソースを破棄
     */
    destroy() {
        this.cleanup();
        super.destroy();
    }
}
