/**
 * チャートレンダラーの基底クラス
 * 全チャートレンダラーに共通するメソッドを提供
 *
 * 継承方法:
 * class LineChartRenderer extends ChartRendererBase { ... }
 */
class ChartRendererBase extends BaseManager {
    /**
     * コンストラクタ
     * @param {string} containerId - コンテナのID
     */
    constructor(containerId) {
        super(containerId);
        this.type = 'base'; // 派生クラスで上書き
    }

    /**
     * チャート更新イベントの購読を設定
     * BaseManager の RESIZE リスナーに加えて、CHART_UPDATE リスナーを登録
     */
    setupEventListeners() {
        super.setupEventListeners();  // BaseManager の RESIZE リスナーを呼ぶ

        // チャート更新イベント
        pubsub.subscribe(EVENTS.CHART_UPDATE, (data) => {
            if (this.isMyChart(data)) {
                this.updateChart(data);
            }
        });
    }

    /**
     * このレンダラーが処理すべきチャートデータかを判定
     * 派生クラスでオーバーライド可能
     *
     * @param {Object} data - チャートデータ
     * @returns {boolean} 処理すべき場合は true
     */
    isMyChart(data) {
        // デフォルト実装：type プロパティで判定
        return data.type === this.type;
    }

    /**
     * レスポンシブサイズを計算
     * 全レンダラーで共通実装
     *
     * @param {Object} config - 設定オブジェクト
     * @param {number} config.defaultWidth - デフォルト幅
     * @param {number} config.defaultHeight - デフォルト高さ
     * @param {number} [config.minWidth] - 最小幅
     * @param {number} [config.minHeight] - 最小高さ
     * @param {number} [config.maxWidth] - 最大幅
     * @param {number} [config.maxHeight] - 最大高さ
     * @param {number} [config.aspectRatio] - アスペクト比（幅/高さ）
     * @param {number} [config.widthPercent] - ブラウザ幅に対するパーセンテージ
     * @param {number} [config.heightPercent] - ブラウザ高さに対するパーセンテージ
     * @returns {Object} { width: number, height: number }
     */
    getResponsiveSize(config = {}) {
        if (window.SVGHelper) {
            return SVGHelper.getResponsiveSize(this.container, {
                defaultWidth: 800,
                defaultHeight: 600,
                ...config,
                minWidth: config.minWidth || 300,
                minHeight: config.minHeight || 200,
                maxWidth: config.maxWidth || 1200,
                maxHeight: config.maxHeight || 800,
                aspectRatio: config.aspectRatio,
                widthPercent: config.widthPercent,
                heightPercent: config.heightPercent
            });
        }

        // フォールバック: SVGHelper が利用できない場合
        const defaultWidth = config.defaultWidth || 800;
        const defaultHeight = config.defaultHeight || 600;
        const minWidth = config.minWidth || 300;
        const minHeight = config.minHeight || 200;
        const maxWidth = config.maxWidth || 1200;
        const maxHeight = config.maxHeight || 800;

        let width = defaultWidth;
        let height = defaultHeight;

        // パーセンテージ指定の場合
        if (config.widthPercent) {
            width = Math.max(
                minWidth,
                Math.min(maxWidth, (window.innerWidth * config.widthPercent) / 100)
            );
            // アスペクト比を保持して高さを計算
            if (config.aspectRatio && !config.heightPercent) {
                height = width / config.aspectRatio;
            }
        }

        if (config.heightPercent) {
            height = Math.max(
                minHeight,
                Math.min(maxHeight, (window.innerHeight * config.heightPercent) / 100)
            );
        }

        // 制約条件を適用
        width = Math.max(minWidth, Math.min(maxWidth, width));
        height = Math.max(minHeight, Math.min(maxHeight, height));

        return { width, height };
    }

    /**
     * データソース表記をSVGに追加
     * 全レンダラーで共通実装
     *
     * @param {Object} svg - D3.jsで選択されたSVG要素
     * @param {string} dataSource - データソーステキスト
     * @param {number} width - SVG幅
     * @param {number} height - SVG高さ
     */
    addDataSource(svg, dataSource, width, height) {
        if (!dataSource) return;

        svg.append('text')
            .attr('class', 'chart-data-source')
            .attr('x', 10)
            .attr('y', height - 10)
            .attr('text-anchor', 'start')
            .style('font-size', '12px')
            .style('fill', '#888')
            .style('font-style', 'normal')
            .text(`出典: ${dataSource}`);
    }

    /**
     * チャートマージンを計算（ChartLayoutHelper統合版）
     * 全レンダラーで共通実装
     *
     * @param {Array} data - チャートデータ
     * @param {Object} config - チャート設定
     * @param {Object} options - オプション
     * @param {string} [options.chartType] - チャートタイプ（デフォルト: this.type）
     * @param {boolean} [options.hasLegend] - 凡例の有無（デフォルト: false）
     * @returns {Object} マージン {top, right, bottom, left}
     */
    getChartMargin(data, config, options = {}) {
        const chartType = options.chartType || this.type;
        const hasLegend = options.hasLegend !== undefined ? options.hasLegend : false;

        if (!window.ChartLayoutHelper) {
            // フォールバック：従来の固定マージン
            return config.margin || {
                top: 40,
                right: 20,
                bottom: 40,
                left: 50
            };
        }

        return ChartLayoutHelper.calculateDynamicMargins(data, config, {
            chartType,
            hasLegend,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight
        });
    }

    /**
     * トランジション設定を生成（ChartTransitions統合版）
     * 全レンダラーで共通実装
     *
     * @param {string} chartType - チャートタイプ（デフォルト: this.type）
     * @param {number} [customDuration] - カスタム期間（省略時は設定から自動取得）
     * @returns {Object} トランジション設定 {chartType, duration}
     */
    getTransitionConfig(chartType, customDuration = null) {
        const duration = customDuration !== null ? customDuration :
                        (this.config?.transitionDuration || 600);
        return {
            chartType: chartType || this.type,
            duration
        };
    }

    /**
     * X/Y軸をトランジションで更新（ChartTransitions統合版）
     * 全レンダラーで共通実装
     *
     * @param {Object} g - D3グループ要素
     * @param {Object} xAxis - X軸オブジェクト
     * @param {Object} yAxis - Y軸オブジェクト
     * @param {Object} options - オプション
     * @param {string} [options.chartType] - チャートタイプ（デフォルト: this.type）
     * @param {number} [options.duration] - トランジション期間
     */
    updateChartAxes(g, xAxis, yAxis, options = {}) {
        const transitionConfig = this.getTransitionConfig(
            options.chartType || this.type,
            options.duration
        );
        ChartTransitions.updateAxis(g.select('.x-axis'), xAxis, transitionConfig);
        ChartTransitions.updateAxis(g.select('.y-axis'), yAxis, transitionConfig);
    }

    /**
     * チャート用の色配列を生成（ColorScheme統合版）
     * 全レンダラーで共通実装
     *
     * @param {Array|Object} dataOrSeries - チャートデータまたは系列データ
     * @param {Object} config - チャート設定
     * @param {string} [fieldName] - データから色を取得する際のフィールド名（系列名など）
     * @returns {Array} 色の配列
     */
    getChartColors(dataOrSeries, config, fieldName = null) {
        // 優先度1: 単一色指定（config.color）
        if (config.color) {
            return [config.color];
        }

        // 優先度2: 明示的な色指定（config.colors + config.multiSeries === false）
        if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            return config.colors;
        }

        // 優先度3: ColorScheme統一カラースキーム
        if (window.ColorScheme && config.useUnifiedColors !== false) {
            // 系列データの場合（Array of objects with name/label field）
            if (Array.isArray(dataOrSeries) && fieldName) {
                const field = fieldName || 'name';
                return dataOrSeries.map(item => {
                    const key = item[field];
                    return window.ColorScheme.getColorForRegion(key) ||
                           window.ColorScheme.generateColorsForChart([item], { ...config, seriesField: field })[0] ||
                           window.AppDefaults?.colors?.accent?.primary || '#3b82f6';
                });
            }
        }

        // 優先度4: フォールバック
        return config.colors ||
               window.AppConstants?.APP_COLORS?.PRIMARY_PALETTE ||
               window.AppDefaults?.colors?.accent?.primary ? [window.AppDefaults.colors.accent.primary] :
               d3.schemeCategory10;
    }

    /**
     * チャートデータの基本検証
     * 派生クラスで fieldConfig を設定して拡張可能
     *
     * @param {Array} data - チャートデータ
     * @param {Object} config - チャート設定
     * @param {Object} fieldConfig - フィールド設定 { xField, yField, labelField, valueField, ... }
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateChartData(data, config = {}, fieldConfig = null) {
        const errors = [];

        // データ配列の確認
        if (!Array.isArray(data) || data.length === 0) {
            errors.push('Data must be a non-empty array');
            return { valid: false, errors };
        }

        // 設定オブジェクトの確認
        if (typeof config !== 'object' || config === null) {
            errors.push('Config must be an object');
            return { valid: false, errors };
        }

        // フィールド検証（fieldConfig が指定されている場合）
        if (fieldConfig) {
            // デフォルトフィールド名
            const xField = fieldConfig.xField || 'x';
            const yField = fieldConfig.yField || 'value';
            const labelField = fieldConfig.labelField || 'label';
            const valueField = fieldConfig.valueField || 'value';

            // X軸フィールドの検証（棒グラフ、折れ線グラフなど）
            if (fieldConfig.xField || fieldConfig.yField) {
                const hasXField = data.every(d => d.hasOwnProperty(xField));
                const hasYField = data.every(d => d.hasOwnProperty(yField));

                if (!hasXField) {
                    errors.push(`X field '${xField}' not found in all data items`);
                }
                if (!hasYField) {
                    errors.push(`Y field '${yField}' not found in all data items`);
                }

                // Y値が数値かどうかチェック
                if (hasYField && fieldConfig.numericY !== false) {
                    const hasValidYValues = data.every(d => !isNaN(+d[yField]));
                    if (!hasValidYValues) {
                        errors.push(`Y field '${yField}' contains non-numeric values`);
                    }
                }
            }

            // ラベル・値フィールドの検証（円グラフなど）
            if (fieldConfig.labelField || fieldConfig.valueField) {
                const hasLabelField = data.every(d => d.hasOwnProperty(labelField));
                const hasValueField = data.every(d => d.hasOwnProperty(valueField));

                if (!hasLabelField && fieldConfig.labelField) {
                    errors.push(`Label field '${labelField}' not found in all data items`);
                }
                if (!hasValueField && fieldConfig.valueField) {
                    errors.push(`Value field '${valueField}' not found in all data items`);
                }

                // 値が数値かどうかチェック
                if (hasValueField && fieldConfig.numericValue !== false) {
                    const hasValidValues = data.every(d => !isNaN(+d[valueField]));
                    if (!hasValidValues) {
                        errors.push(`Value field '${valueField}' contains non-numeric values`);
                    }
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * フィルタを適用
     * 派生クラスでオーバーライド可能
     *
     * @param {Array} data - チャートデータ
     * @param {Object} filterConfig - フィルタ設定
     * @param {string} filterConfig.type - フィルタタイプ ('range', 'values', 'exclude', 'series')
     * @returns {Array} フィルタ済みデータ
     */
    applyFilter(data, filterConfig = {}) {
        if (!filterConfig || !filterConfig.type) {
            return data;
        }

        if (!Array.isArray(data)) {
            return data;
        }

        const { type, field, range, values, exclude, series } = filterConfig;

        switch (type) {
            case 'range':
                return this._applyRangeFilter(data, field, range);
            case 'values':
                return this._applyValuesFilter(data, field, values);
            case 'exclude':
                return this._applyExcludeFilter(data, field, exclude);
            case 'series':
                return this._applySeriesFilter(data, series);
            default:
                return data;
        }
    }

    /**
     * 範囲フィルタを適用（内部メソッド）
     * @private
     */
    _applyRangeFilter(data, field, range) {
        if (!range || range.length !== 2) return data;
        const [min, max] = range;

        return data.filter(item => {
            const value = item[field];
            return value >= min && value <= max;
        });
    }

    /**
     * 値一致フィルタを適用（内部メソッド）
     * @private
     */
    _applyValuesFilter(data, field, values) {
        if (!Array.isArray(values) || values.length === 0) return data;

        return data.filter(item => {
            const value = item[field];
            return values.includes(value);
        });
    }

    /**
     * 値除外フィルタを適用（内部メソッド）
     * @private
     */
    _applyExcludeFilter(data, field, exclude) {
        if (!Array.isArray(exclude) || exclude.length === 0) return data;

        return data.filter(item => {
            const value = item[field];
            return !exclude.includes(value);
        });
    }

    /**
     * 系列フィルタを適用（内部メソッド）
     * LineChartRenderer用
     * @private
     */
    _applySeriesFilter(data, series) {
        if (!Array.isArray(series) || series.length === 0) return data;

        const seriesSet = new Set(series);
        return data.filter(item => {
            // 各データが系列フィルタの対象か確認
            // 実装は派生クラスに依存
            return true;
        });
    }

    /**
     * 凡例を追加
     * 派生クラスでオーバーライド推奨
     *
     * @param {Object} svg - D3.jsで選択されたSVG要素
     * @param {Array} data - チャートデータ
     * @param {Object} colorScale - D3スケール関数
     * @param {number} width - SVG幅
     * @param {number} height - SVG高さ
     * @param {Object} config - 凡例設定
     * @param {boolean} [config.show=true] - 凡例表示フラグ
     * @param {string} [config.position='bottom'] - 凡例位置
     */
    addLegend(svg, data, colorScale, width, height, config = {}) {
        if (config.show === false) return;

        // 基本的な凡例処理のテンプレート
        // 派生クラスで詳細実装を推奨
        console.debug(`${this.type}: addLegend - override in derived class for custom implementation`);
    }

    /**
     * 注釈を描画
     * 派生クラスでオーバーライド推奨
     *
     * @param {Object} g - D3.jsのグループ要素
     * @param {Array} annotations - 注釈データ
     * @param {Object} context - 描画コンテキスト
     */
    renderAnnotations(g, annotations, context = {}) {
        if (!annotations || annotations.length === 0) return;

        // 基本的な注釈処理のテンプレート
        // 派生クラスで詳細実装を推奨
        console.debug(`${this.type}: renderAnnotations - override in derived class for custom implementation`);
    }

    /**
     * チャートを更新（派生クラスで実装必須）
     * @abstract
     * @param {Object} chartData - チャートデータ
     */
    updateChart(chartData) {
        throw new Error(`${this.constructor.name}.updateChart() must be implemented in derived class`);
    }

    /**
     * チャートを描画（派生クラスで実装必須）
     * @abstract
     * @param {Array} data - チャートデータ
     * @param {Object} config - チャート設定
     */
    renderChart(data, config) {
        throw new Error(`${this.constructor.name}.renderChart() must be implemented in derived class`);
    }

    /**
     * Dual/Triple layout の場合に描画をスキップすべきかを判定
     * 各レンダラーで利用：個別レンダラーは dual/triple では動作しない
     * @param {Object} chartData - チャートデータ
     * @returns {boolean} スキップすべき場合は true
     */
    shouldSkipDualLayout(chartData) {
        const { layout } = chartData;
        return layout === 'dual' || layout === 'triple';
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            type: this.type,
            hasData: !!this.data,
            dataLength: this.data ? this.data.length : 0,
            hasRenderers: !!this.renderers
        };
    }
}

// グローバルスコープで提供
window.ChartRendererBase = ChartRendererBase;
