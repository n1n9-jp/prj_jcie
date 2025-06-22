/**
 * GridChartRenderer - グリッドレイアウトでの複数チャート描画を専門的に扱うクラス
 * BaseManagerを継承し、グリッド特有の機能を提供
 */
class GridChartRenderer extends BaseManager {
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
        
        // グリッドチャート特有のイベント
        pubsub.subscribe(EVENTS.CHART_UPDATE, (data) => {
            if (data.layout === 'grid') {
                this.updateChart(data);
            }
        });
    }

    /**
     * チャートを更新する
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        const { layout, data, config, visible } = chartData;
        
        if (layout !== 'grid') {
            console.warn(`GridChartRenderer: Unsupported layout: ${layout}`);
            return;
        }

        // データとコンフィグの検証
        const validation = this.validateChartData(data, config);
        if (!validation.valid) {
            console.error('GridChartRenderer: Invalid data or config:', validation.errors);
            if (window.ErrorHandler) {
                ErrorHandler.handle(new Error(validation.errors.join(', ')), 'GridChartRenderer.updateChart', {
                    type: ErrorHandler.ERROR_TYPES.VALIDATION,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { data, config }
                });
            }
            return;
        }

        // 状態を更新
        this.data = data;
        this.config = config;
        this.currentChart = layout;

        if (visible) {
            this.show();
            this.updateGridChart(chartData);
        } else {
            this.hide();
        }
    }

    /**
     * Grid chart layoutを描画
     * @param {Object} chartData - チャートデータ
     */
    updateGridChart(chartData) {
        try {
            this.show();
            
            // SVG要素をクリア
            this.clearContainer();
            
            // データファイルから実際のデータを取得
            const data = chartData.data;
            
            this.renderGridChart(data, chartData.config);
        } catch (error) {
            console.error('GridChartRenderer: Error during grid chart update:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'GridChartRenderer.updateGridChart', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { chartData }
                });
            }
        }
    }
    
    /**
     * Grid layoutで複数の円グラフを描画
     * @param {Array} data - チャートデータ
     * @param {Object} config - 設定
     */
    renderGridChart(data, config) {
        // デフォルト設定をAppDefaultsから取得
        const defaultConfig = {
            columns: 7, 
            rows: 2, 
            chartWidth: 120, 
            chartHeight: 120,
            title: '',
            showLabels: true,
            showPercentages: true,
            rowSpacing: null  // nullの場合、chartHeightの50%を使用
        };

        // AppDefaultsとの設定マージ
        const mergedConfig = BaseManager.mergeConfig(defaultConfig, config);
        
        const { 
            columns, 
            rows, 
            chartWidth, 
            chartHeight,
            title,
            showLabels,
            showPercentages,
            rowSpacing = chartHeight * 0.5,  // デフォルトの行間スペーシング（チャート高さの50%）
            dataSource = ''
        } = mergedConfig;
        
        try {
            // データを適切な形式に変換
            const gridData = this.transformToGridData(data, mergedConfig);
            
            // 全体のサイズを計算（行間スペーシングを含む）
            const totalWidth = columns * chartWidth;
            const totalHeight = rows * chartHeight + (rows - 1) * rowSpacing + (title ? 40 : 0) + (dataSource ? 30 : 0);
            
            this.svg = this.initSVG(totalWidth, totalHeight);
            
            // タイトルを追加
            if (title) {
                this.svg.append('text')
                    .attr('class', 'chart-title')
                    .attr('x', totalWidth / 2)
                    .attr('y', 25)
                    .attr('text-anchor', 'middle')
                    .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
                    .style('font-family', 'var(--font-family-serif)')
                    .style('font-size', 'var(--font-size-base)')
                    .style('font-weight', 'var(--font-weight-bold)')
                    .text(title);
            }
            
            // グリッドコンテナ
            const gridContainer = this.svg.append('g')
                .attr('transform', `translate(0, ${title ? 40 : 0})`);
            
            // 各セルを描画（行間スペーシングを考慮）
            gridData.forEach((cellData, index) => {
                const col = index % columns;
                const row = Math.floor(index / columns);
                const x = col * chartWidth;
                const y = row * (chartHeight + rowSpacing);  // 行間スペーシングを追加
                
                this.renderGridCell(gridContainer, cellData, {
                    x: x,
                    y: y,
                    width: chartWidth,
                    height: chartHeight,
                    showLabels,
                    showPercentages
                });
            });
            
            // データソースを表示
            if (dataSource) {
                this.addDataSource(this.svg, dataSource, totalWidth, totalHeight);
            }
        } catch (error) {
            console.error('GridChartRenderer: Error during grid chart rendering:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'GridChartRenderer.renderGridChart', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { data, config: mergedConfig }
                });
            }
        }
    }
    
    /**
     * グリッドの各セルを描画
     * @param {d3.Selection} container - 親コンテナ
     * @param {Object} cellData - セルデータ
     * @param {Object} layout - レイアウト設定
     */
    renderGridCell(container, cellData, layout) {
        const { x, y, width, height, showLabels, showPercentages } = layout;
        const radius = Math.min(width, height) / 2 - 20;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        try {
            // セルグループを作成
            const cellGroup = container.append('g')
                .attr('class', 'grid-cell')
                .attr('transform', `translate(${centerX}, ${centerY})`);
            
            // パイチャートデータの検証
            if (!cellData.pieData || !Array.isArray(cellData.pieData)) {
                throw new Error('Invalid pie data for grid cell');
            }
            
            // パイチャートデータ
            const pieData = d3.pie()
                .value(d => d.value)
                .sort(null)(cellData.pieData);
            
            // アーク生成器
            const arc = d3.arc()
                .innerRadius(0)
                .outerRadius(radius);
            
            // パイスライスを描画
            const slices = cellGroup.selectAll('.pie-slice')
                .data(pieData)
                .enter()
                .append('g')
                .attr('class', 'pie-slice');
            
            // ChartTransitionsを使用してアークを描画
            ChartTransitions.createStaggered(
                slices.append('path')
                    .attr('fill', d => d.data.color)
                    .attr('stroke', window.AppDefaults?.colors?.text?.white || '#fff')
                    .attr('stroke-width', window.AppDefaults?.strokeWidth?.normal || 1),
                { delay: 100, duration: window.AppDefaults?.animation?.shortDuration || 500 }
            ).call(function(selection) {
                ChartTransitions.animateArcs(selection, arc, {
                    chartType: 'grid',
                    phase: 'enter',
                    duration: window.AppDefaults?.animation?.shortDuration || 500
                });
            });
            
            // ChartTransitionsを使用してラベルを追加
            if (showLabels) {
                // 地域名
                ChartTransitions.animateText(
                    cellGroup.append('text')
                        .attr('class', 'region-label')
                        .attr('x', 0)
                        .attr('y', -height/2 + 15)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '10px')
                        .attr('font-weight', 'bold')
                        .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
                        .text(cellData.region || ''),
                    {
                        chartType: 'grid',
                        phase: 'enter',
                        delay: 300,
                        duration: 500
                    }
                );
                
                // 年齢層
                ChartTransitions.animateText(
                    cellGroup.append('text')
                        .attr('class', 'age-label')
                        .attr('x', 0)
                        .attr('y', height/2 - 5)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '9px')
                        .attr('fill', window.AppDefaults?.colors?.text?.secondary || '#666')
                        .text(cellData.ageGroup || ''),
                    {
                        chartType: 'grid',
                        phase: 'enter',
                        delay: 400,
                        duration: 500
                    }
                );
            }
            
            // パーセンテージを中央に表示
            if (showPercentages && cellData.percentage !== undefined) {
                ChartTransitions.animateText(
                    cellGroup.append('text')
                        .attr('class', 'percentage-label')
                        .attr('x', 0)
                        .attr('y', 5)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '12px')
                        .attr('font-weight', 'bold')
                        .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
                        .text(`${cellData.percentage}%`),
                    {
                        chartType: 'grid',
                        phase: 'enter',
                        delay: 500,
                        duration: 500
                    }
                );
            }
        } catch (error) {
            console.error('GridChartRenderer: Error rendering grid cell:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'GridChartRenderer.renderGridCell', {
                    type: ErrorHandler.ERROR_TYPES.RENDER,
                    severity: ErrorHandler.SEVERITY.MEDIUM,
                    context: { cellData, layout }
                });
            }
        }
    }
    
    /**
     * 生データをグリッド用データに変換
     * @param {Array} data - 生データ
     * @param {Object} config - 設定
     * @returns {Array} 変換されたグリッドデータ
     */
    transformToGridData(data, config) {
        const result = [];
        const regions = [];
        
        
        try {
            data.forEach(row => {
                // CSVの最初の列は空白のキー名になっている
                const region = row[''] || row[Object.keys(row)[0]]; 
                const adultPercentStr = row['成人（15歳以上）'];
                const childPercentStr = row['こども（0歳から14歳）'];
                
                // パーセント記号を除去して数値に変換
                const adultPercent = parseInt(adultPercentStr?.replace('%', '') || '0');
                const childPercent = parseInt(childPercentStr?.replace('%', '') || '0');
                
                // 地域名が有効な場合のみ追加
                if (region && region.trim()) {
                    // ColorSchemeから色を取得
                    const colorScheme = window.ColorScheme;
                    const treatmentColor = colorScheme ? 
                        colorScheme.getRegionColor(region) : 
                        window.AppDefaults?.colors?.accent?.info || '#3b82f6';
                    const untreatedColor = window.AppDefaults?.colors?.background?.light || '#e5e7eb';
                    
                    // 成人データとこどもデータを保存
                    const adultData = {
                        region: region,
                        ageGroup: '成人（15歳以上）',
                        percentage: adultPercent,
                        pieData: [
                            { label: '治療中', value: adultPercent, color: treatmentColor },
                            { label: '未治療', value: 100 - adultPercent, color: untreatedColor }
                        ]
                    };
                    
                    // こどもデータ（少し明るい色を使用）
                    const childTreatmentColor = colorScheme ? 
                        colorScheme.getLighterColor(treatmentColor) : 
                        window.AppDefaults?.colors?.accent?.info || '#60a5fa';
                    const childData = {
                        region: region,
                        ageGroup: 'こども（0-14歳）',
                        percentage: childPercent,
                        pieData: [
                            { label: '治療中', value: childPercent, color: childTreatmentColor },
                            { label: '未治療', value: 100 - childPercent, color: untreatedColor }
                        ]
                    };
                    
                    // 地域ごとにグループ化してテンポラリに保存
                    regions.push({ adult: adultData, child: childData });
                }
            });
            
            // 1行目：すべての地域の成人データ（左から右へ）
            regions.forEach(regionData => {
                result.push(regionData.adult);
            });
            
            // 2行目：すべての地域のこどもデータ（左から右へ、上段と同じ順序）
            regions.forEach(regionData => {
                result.push(regionData.child);
            });
            
            return result;
        } catch (error) {
            console.error('GridChartRenderer: Error transforming data:', error);
            if (window.ErrorHandler) {
                ErrorHandler.handle(error, 'GridChartRenderer.transformToGridData', {
                    type: ErrorHandler.ERROR_TYPES.DATA_PROCESSING,
                    severity: ErrorHandler.SEVERITY.HIGH,
                    context: { data, config }
                });
            }
            return [];
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

        // グリッド設定の検証
        if (config) {
            if (config.columns && (!Number.isInteger(config.columns) || config.columns <= 0)) {
                errors.push('Columns must be a positive integer');
            }
            if (config.rows && (!Number.isInteger(config.rows) || config.rows <= 0)) {
                errors.push('Rows must be a positive integer');
            }
            if (config.chartWidth && (typeof config.chartWidth !== 'number' || config.chartWidth <= 0)) {
                errors.push('Chart width must be a positive number');
            }
            if (config.chartHeight && (typeof config.chartHeight !== 'number' || config.chartHeight <= 0)) {
                errors.push('Chart height must be a positive number');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
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
     * レスポンシブなグリッドレイアウトを計算
     * @param {Object} config - 設定
     * @returns {Object} レスポンシブレイアウト設定
     */
    calculateResponsiveLayout(config) {
        const containerBounds = this.getContainerBounds();
        if (!containerBounds) return config;

        const containerWidth = containerBounds.width;
        const containerHeight = containerBounds.height;

        // AppDefaultsのブレークポイントを使用
        const breakpoints = window.AppDefaults?.breakpoints;
        let responsiveConfig = { ...config };

        if (breakpoints) {
            if (containerWidth < breakpoints.mobile) {
                // モバイル: グリッドを縦に配置
                responsiveConfig.columns = Math.min(2, config.columns || 7);
                responsiveConfig.chartWidth = Math.min(100, config.chartWidth || 120);
                responsiveConfig.chartHeight = Math.min(100, config.chartHeight || 120);
            } else if (containerWidth < breakpoints.tablet) {
                // タブレット: 中間サイズ
                responsiveConfig.columns = Math.min(4, config.columns || 7);
                responsiveConfig.chartWidth = Math.min(110, config.chartWidth || 120);
                responsiveConfig.chartHeight = Math.min(110, config.chartHeight || 120);
            }
            // デスクトップはそのまま
        }

        return responsiveConfig;
    }

    /**
     * SVG要素を初期化
     * @param {number} width - SVG幅
     * @param {number} height - SVG高さ
     * @returns {d3.Selection} SVG要素
     */
    initSVG(width, height) {
        this.clearContainer();
        
        // SVGHelperを使用してレスポンシブSVGを作成
        if (window.SVGHelper) {
            this.svg = SVGHelper.initSVG(this.container, width, height, {
                className: 'grid-chart-svg',
                responsive: true,
                preserveAspectRatio: 'xMidYMid meet'
            });
        } else {
            // フォールバック：従来のSVG作成
            this.svg = this.container
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('viewBox', `0 0 ${width} ${height}`)
                .style('width', '100%')
                .style('height', '100%');
        }
            
        return this.svg;
    }

    /**
     * リサイズ処理
     */
    resize() {
        if (this.currentChart && this.data && this.config) {
            
            // レスポンシブレイアウトを再計算
            const responsiveConfig = this.calculateResponsiveLayout(this.config);
            
            // チャートを再描画
            this.renderGridChart(this.data, responsiveConfig);
        }
    }

    /**
     * グリッドチャートをトランジションで更新する（将来の拡張用）
     * @param {Array} data - 新しいデータ
     * @param {Object} config - 新しい設定
     * @param {string} direction - スクロール方向 ('up' | 'down')
     */
    updateChartWithTransition(data, config, direction = 'down') {
        // 将来の拡張: グリッドチャートのスムーズな更新機能
        
        // 現状は通常の再描画を実行
        this.renderGridChart(data, config);
    }

    /**
     * グリッドチャートに注釈を追加
     * @param {Array} annotations - 注釈設定
     */
    renderAnnotations(annotations) {
        if (!annotations || annotations.length === 0 || !this.svg) return;
        
        const annotationGroup = this.svg.append('g')
            .attr('class', 'grid-chart-annotations');
        
        annotations.forEach((annotation, index) => {
            const { type, text, style = {}, position = { x: 0, y: 0 } } = annotation;
            
            const annotationElement = annotationGroup.append('g')
                .attr('class', `grid-annotation grid-annotation-${index}`)
                .attr('transform', `translate(${position.x}, ${position.y})`);
            
            switch (type) {
                case 'text':
                default:
                    annotationElement.append('text')
                        .attr('font-size', style.fontSize || '12px')
                        .attr('fill', style.color || window.AppDefaults?.colors?.text?.primary || '#333')
                        .attr('text-anchor', style.textAnchor || 'start')
                        .text(text);
                    break;
            }
        });
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        const baseInfo = super.getDebugInfo();
        return {
            ...baseInfo,
            gridSpecific: {
                hasData: !!this.data,
                dataLength: this.data ? this.data.length : 0,
                configKeys: this.config ? Object.keys(this.config) : [],
                svgExists: !!this.svg
            }
        };
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.GridChartRenderer = GridChartRenderer;