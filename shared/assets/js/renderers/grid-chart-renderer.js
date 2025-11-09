/**
 * GridChartRenderer - グリッドレイアウトでの複数チャート描画を専門的に扱うクラス
 * ChartRendererBaseを継承し、グリッド特有の機能を提供
 */
class GridChartRenderer extends ChartRendererBase {
    constructor(containerId) {
        super(containerId);
        this.type = 'grid';  // チャート種別を設定
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;
        this.isUpdating = false; // 重複呼び出し防止フラグ

        // データ変換用マネージャーをインスタンス化
        this.dataTransformer = new GridDataTransformer();

        // Initialize after properties are set
        this.init();
    }

    /**
     * このレンダラーが処理すべきチャートデータかを判定
     * GridChartRenderer は layout === 'grid' で判定
     *
     * @param {Object} data - チャートデータ
     * @returns {boolean} 処理すべき場合は true
     */
    isMyChart(data) {
        return data && data.layout === 'grid' && data.visible !== false;
    }

    /**
     * チャートを更新する
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        const { layout, data, config, visible } = chartData;
        
        // 厳密なチェック：grid layout以外は処理しない
        if (layout !== 'grid') {
            return; // ワーニングも表示しないように変更
        }
        
        // グリッドレイアウトの必須設定をチェック
        if (!config || (!config.columns && !config.rows)) {
            console.warn('GridChartRenderer: Grid layout requires columns/rows configuration');
            return;
        }

        // データとコンフィグの検証（GridChartRenderer は独自データ構造を使用）
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

        // 重複呼び出しを防ぐ
        if (this.isUpdating) {
            console.warn('GridChartRenderer: Already updating, skipping duplicate call');
            return;
        }
        this.isUpdating = true;

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
        
        // 更新完了後にフラグをリセット
        setTimeout(() => {
            this.isUpdating = false;
        }, 100);
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
        // レイアウト設定を統合
        const layoutDefaults = window.LayoutConfig ? 
            LayoutConfig.getLayoutConfig('grid') : {};
        
        // デフォルト設定をAppDefaultsから取得
        const defaultConfig = {
            gridMode: 'fixed',  // 'fixed' または 'auto'
            columns: 7, 
            rows: 2, 
            chartWidth: layoutDefaults.chartSize?.width || 120,
            chartHeight: layoutDefaults.chartSize?.height || 120,
            title: '',
            showLabels: true,
            showPercentages: true,
            rowSpacing: null,  // nullの場合、chartHeightの50%を使用
            position: layoutDefaults.position,
            rowTitles: [] // 行ごとの見出し
        };

        // AppDefaultsとの設定マージ
        const mergedConfig = BaseManager.mergeConfig(defaultConfig, config);
        
        // gridMode が 'auto' の場合、データから最適なグリッドを計算
        if (mergedConfig.gridMode === 'auto' && data && data.length > 0) {
            const optimalGrid = this.dataTransformer.calculateOptimalGrid(data.length, mergedConfig);
            mergedConfig.columns = optimalGrid.columns;
            mergedConfig.rows = optimalGrid.rows;
        }
        
        const { 
            columns, 
            rows, 
            chartWidth, 
            chartHeight,
            title,
            showLabels,
            showPercentages,
            rowSpacing = chartHeight * 0.5,
            dataSource = '',
            rowTitles = []
        } = mergedConfig;
        
        try {
            const gridData = this.dataTransformer.transformToGridData(data, mergedConfig);
            const { width: containerWidth, height: containerHeight } = this.getResponsiveSize(mergedConfig);
            
            const isFullViewport = (mergedConfig.widthPercent === 100 && mergedConfig.heightPercent === 100);
            let actualContainerWidth = containerWidth;
            if (mergedConfig.position && mergedConfig.position.width === "100%") {
                actualContainerWidth = isFullViewport ? Math.max(containerWidth, window.innerWidth * 0.95) : Math.max(containerWidth, window.innerWidth * 0.8);
            }
            
            const availableWidth = actualContainerWidth - 40;
            const availableHeight = containerHeight - (title ? 40 : 0) - (dataSource ? 30 : 0) - 40;
            
            let maxWidth, maxHeight;
            if (isFullViewport) {
                maxWidth = Math.floor(availableWidth / columns * 0.9);
                maxHeight = Math.floor(availableHeight / rows * 0.9);
            } else {
                maxWidth = mergedConfig.maxChartWidth || 140;
                maxHeight = mergedConfig.maxChartHeight || 140;
            }
            const minWidth = mergedConfig.minChartWidth || 80;
            const minHeight = mergedConfig.minChartHeight || 80;
            
            const calculatedChartWidth = Math.min(maxWidth, Math.max(minWidth, availableWidth / columns));
            const calculatedChartHeight = Math.min(maxHeight, Math.max(minHeight, (availableHeight - (rows - 1) * rowSpacing) / rows));
            
            const totalWidth = columns * calculatedChartWidth + 40;
            const totalHeight = rows * calculatedChartHeight + (rows - 1) * rowSpacing + (title ? 40 : 0) + (dataSource ? 30 : 0) + 40;
            
            this.svg = this.initSVG(totalWidth, totalHeight);
            
            mergedConfig.chartWidth = calculatedChartWidth;
            mergedConfig.chartHeight = calculatedChartHeight;
            
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

            const gridContainer = this.svg.append('g')
                .attr('transform', `translate(20, ${title ? 50 : 30})`);

            if (rowTitles && rowTitles.length > 0) {
                const rowHeight = calculatedChartHeight + rowSpacing;
                rowTitles.forEach((rowTitle, i) => {
                    if (i < rows) {
                        gridContainer.append('text')
                            .attr('class', 'grid-row-title')
                            .attr('x', (columns * calculatedChartWidth) / 2)
                            .attr('y', (i * rowHeight) + 15)
                            .attr('text-anchor', 'middle')
                            .style('font-size', '14px')
                            .style('font-weight', 'bold')
                            .style('fill', '#333')
                            .text(rowTitle);
                    }
                });
            }
            
            gridData.forEach((cellData, index) => {
                const col = index % columns;
                const row = Math.floor(index / columns);
                const x = col * calculatedChartWidth;
                const y = row * (calculatedChartHeight + rowSpacing);
                
                this.renderGridCell(gridContainer, cellData, {
                    x: x,
                    y: y,
                    width: calculatedChartWidth,
                    height: calculatedChartHeight,
                    showLabels,
                    showPercentages
                });
            });
            
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
        const radius = Math.min(width, height) / 2 - 10;  // 余白を調整して円グラフサイズを最適化
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        console.log('GridChartRenderer: renderGridCell - width:', width, 'height:', height, 'radius:', radius);
        
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
                        .attr('y', -height/3)
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
                        .attr('y', height/3)
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
                const formattedPercentage = (window.ChartFormatterHelper)
                    ? ChartFormatterHelper.formatYAxisValue(cellData.percentage / 100, { type: 'percentage' })
                    : `${cellData.percentage}%`;

                ChartTransitions.animateText(
                    cellGroup.append('text')
                        .attr('class', 'percentage-label')
                        .attr('x', 0)
                        .attr('y', 5)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '12px')
                        .attr('font-weight', 'bold')
                        .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333')
                        .text(formattedPercentage),
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
        
        console.log('GridChartRenderer: initSVG called with width:', width, 'height:', height);
        
        // グリッドチャートでは固定サイズを使用（レスポンシブではなく）
        this.svg = this.container
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .classed('grid-chart-svg', true)
            .style('display', 'block')
            .style('margin', '0 auto'); // センタリング
            
        console.log('GridChartRenderer: SVG created with actual size:', width, 'x', height);
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
