/**
 * ChartManager リファクタリングサンプル
 * 共通ユーティリティクラスを使用した実装例
 * 
 * このファイルは、既存のchart-manager.jsをリファクタリングする際の
 * 参考実装として作成されました。
 */

class ChartManagerRefactored {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;
        
        this.init();
    }

    init() {
        // イベントリスナーを設定（エラーハンドリング付き）
        pubsub.subscribe(EVENTS.CHART_UPDATE, ErrorHandler.wrap(
            (data) => this.updateChart(data),
            'ChartManager.updateChart',
            { 
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.HIGH 
            }
        ));

        pubsub.subscribe(EVENTS.RESIZE, ErrorHandler.wrap(
            () => this.resize(),
            'ChartManager.resize',
            { 
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.LOW 
            }
        ));
    }

    /**
     * チャートを描画する（リファクタリング版）
     */
    renderChart(type, data, config) {
        try {
            // データ検証
            if (!this.validateChartData(data, config)) {
                ErrorHandler.handleDataValidationError('chart', { type, data, config }, 'ChartManager.renderChart');
                return;
            }

            // レスポンシブサイズを取得（共通ユーティリティ使用）
            const { width, height } = SVGHelper.getResponsiveSize(this.container, {
                defaultWidth: config.width || 800,
                defaultHeight: config.height || 600,
                scale: 0.8,
                minWidth: 300,
                minHeight: 200
            });

            // SVGを初期化（共通ユーティリティ使用）
            this.svg = SVGHelper.initSVG(this.container, width, height, {
                className: 'chart-svg',
                clearContainer: true
            });

            // マージンを考慮した内部サイズを取得
            const { width: innerWidth, height: innerHeight, margin } = SVGHelper.getInnerSize(
                width, 
                height, 
                config.margin
            );

            // グループ要素を作成
            const g = SVGHelper.createGroup(this.svg, margin, 'chart-group');

            // チャートタイプに応じて描画
            switch (type) {
                case 'line':
                    this.renderLineChart(g, data, { ...config, innerWidth, innerHeight });
                    break;
                case 'bar':
                    this.renderBarChart(g, data, { ...config, innerWidth, innerHeight });
                    break;
                case 'pie':
                    this.renderPieChart(g, data, { ...config, innerWidth, innerHeight });
                    break;
                default:
                    throw new Error(`Unknown chart type: ${type}`);
            }

            // タイトルを追加
            if (config.title) {
                this.renderTitle(config.title, width, margin.top);
            }

        } catch (error) {
            ErrorHandler.handle(error, 'ChartManager.renderChart', {
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.HIGH,
                additionalInfo: { chartType: type }
            });
        }
    }

    /**
     * 折れ線グラフを描画（アニメーション設定の共通化例）
     */
    renderLineChart(g, data, config) {
        const { innerWidth, innerHeight, xField, yField } = config;
        
        // スケールの設定
        const xScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d[xField]))
            .range([0, innerWidth]);
            
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d[yField])])
            .range([innerHeight, 0]);

        // グリッドラインを追加（共通ユーティリティ使用）
        SVGHelper.addGridLines(g, xScale, yScale, innerWidth, innerHeight, {
            showXGrid: true,
            showYGrid: true,
            xGridColor: '#e0e0e0',
            yGridColor: '#e0e0e0'
        });

        // 軸を追加
        const xAxis = g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale));
            
        const yAxis = g.append('g')
            .call(d3.axisLeft(yScale));

        // 軸のスタイルを適用（共通ユーティリティ使用）
        SVGHelper.styleAxis(xAxis);
        SVGHelper.styleAxis(yAxis);

        // ラインを描画
        const line = d3.line()
            .x(d => xScale(d[xField]))
            .y(d => yScale(d[yField]));

        const path = g.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', config.colors?.[0] || '#3b82f6')
            .attr('stroke-width', 2)
            .attr('d', line);

        // アニメーション（共通設定使用）
        const pathLength = path.node().getTotalLength();
        path
            .attr('stroke-dasharray', pathLength)
            .attr('stroke-dashoffset', pathLength);

        AnimationConfig.apply(path, 'SLOW_SMOOTH')
            .attr('stroke-dashoffset', 0);

        // データポイントを追加（スタガーアニメーション）
        const circles = g.selectAll('.data-point')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'data-point')
            .attr('cx', d => xScale(d[xField]))
            .attr('cy', d => yScale(d[yField]))
            .attr('r', 0)
            .attr('fill', config.colors?.[0] || '#3b82f6');

        // スタガーアニメーションを適用
        AnimationConfig.stagger(circles, 'ENTER', 50)
            .attr('r', 4);
    }

    /**
     * チャートの更新（トランジション付き）
     */
    updateChartWithTransition(data, config, direction = 'down') {
        try {
            if (!this.svg || !this.currentChart) {
                throw new Error('No existing chart to update');
            }

            this.data = data;
            this.config = config;

            // 既存の要素を選択
            const g = this.svg.select('.chart-group');
            
            // フィルタリングされたデータを取得
            const filteredData = this.filterData(data, config.filter);

            // スケールの更新（アニメーション付き）
            const xScale = this.updateScale('x', filteredData, config);
            const yScale = this.updateScale('y', filteredData, config);

            // 軸の更新（アニメーション設定使用）
            const xAxis = g.select('.x-axis');
            const yAxis = g.select('.y-axis');

            AnimationConfig.apply(xAxis, 'DEFAULT')
                .call(d3.axisBottom(xScale));
                
            AnimationConfig.apply(yAxis, 'DEFAULT')
                .call(d3.axisLeft(yScale));

            // データの更新
            if (this.currentChart === 'line') {
                this.updateLineChartData(g, filteredData, xScale, yScale, config);
            }

        } catch (error) {
            ErrorHandler.handle(error, 'ChartManager.updateChartWithTransition', {
                type: ErrorHandler.ERROR_TYPES.TRANSITION,
                severity: ErrorHandler.SEVERITY.MEDIUM,
                additionalInfo: { direction, chartType: this.currentChart }
            });
        }
    }

    /**
     * データ検証
     */
    validateChartData(data, config) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return false;
        }

        if (!config || typeof config !== 'object') {
            return false;
        }

        // 必須フィールドの確認
        const requiredFields = this.getRequiredFields(config.type);
        return requiredFields.every(field => 
            data.every(item => item.hasOwnProperty(field))
        );
    }

    /**
     * チャートタイプごとの必須フィールドを取得
     */
    getRequiredFields(chartType) {
        const fieldMap = {
            'line': ['x', 'y'],
            'bar': ['label', 'value'],
            'pie': ['label', 'value']
        };
        return fieldMap[chartType] || [];
    }

    /**
     * エラー状態を表示
     */
    showErrorState() {
        this.container.selectAll('*').remove();
        
        const errorMessage = this.container
            .append('div')
            .attr('class', 'chart-error')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('height', '100%')
            .style('color', '#666')
            .style('font-size', '14px')
            .text('チャートの表示に失敗しました');

        // フェードイン効果
        AnimationConfig.fadeIn(errorMessage);
    }

    /**
     * チャートの表示
     */
    show() {
        AnimationConfig.fadeIn(this.container, AnimationConfig.SPEED.FAST);
    }

    /**
     * チャートの非表示
     */
    hide() {
        AnimationConfig.fadeOut(this.container, AnimationConfig.SPEED.FAST);
    }
}

/**
 * 使用例：
 * 
 * const chartManager = new ChartManagerRefactored('#chart-container');
 * 
 * // チャートの描画（エラーハンドリング付き）
 * chartManager.renderChart('line', data, {
 *     width: 800,
 *     height: 400,
 *     xField: 'year',
 *     yField: 'value',
 *     title: 'サンプルチャート',
 *     colors: ['#3b82f6']
 * });
 * 
 * // アニメーション付き更新
 * chartManager.updateChartWithTransition(newData, newConfig, 'down');
 */