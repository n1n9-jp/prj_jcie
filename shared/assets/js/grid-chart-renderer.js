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
        this.isUpdating = false; // 重複呼び出し防止フラグ
        
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
            // 厳密なチェック：grid layoutが明示的に指定されている場合のみ処理
            if (data && data.layout === 'grid' && data.visible !== false) {
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
        
        // 厳密なチェック：grid layout以外は処理しない
        if (layout !== 'grid') {
            return; // ワーニングも表示しないように変更
        }
        
        // グリッドレイアウトの必須設定をチェック
        if (!config || (!config.columns && !config.rows)) {
            console.warn('GridChartRenderer: Grid layout requires columns/rows configuration');
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
            const optimalGrid = this.calculateOptimalGrid(data.length, mergedConfig);
            mergedConfig.columns = optimalGrid.columns;
            mergedConfig.rows = optimalGrid.rows;
            console.log('GridChartRenderer: Auto-calculated grid:', optimalGrid);
        }
        
        const { 
            columns, 
            rows, 
            chartWidth, 
            chartHeight,
            title,
            showLabels,
            showPercentages,
            rowSpacing = chartHeight * 0.5,  // デフォルトの行間スペーシング（チャート高さの50%）
            dataSource = '',
            rowTitles = []
        } = mergedConfig;
        
        try {
            // データを適切な形式に変換
            const gridData = this.transformToGridData(data, mergedConfig);
            
            // レスポンシブサイズを取得（他のレンダラーと統一）
            const { width: containerWidth, height: containerHeight } = this.getResponsiveSize(mergedConfig);
            
            const isFullViewport = (mergedConfig.widthPercent === 100 && mergedConfig.heightPercent === 100);
            let actualContainerWidth = containerWidth;
            if (mergedConfig.position && mergedConfig.position.width === "100%") {
                if (isFullViewport) {
                    actualContainerWidth = Math.max(containerWidth, window.innerWidth * 0.95);
                } else {
                    actualContainerWidth = Math.max(containerWidth, window.innerWidth * 0.8);
                }
            }

            const rowTitleWidth = (rowTitles && rowTitles.length > 0) ? 80 : 0;
            
            const availableWidth = actualContainerWidth - 40 - rowTitleWidth;
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
            
            const totalWidth = columns * calculatedChartWidth + 40 + rowTitleWidth;
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

            if (rowTitles && rowTitles.length > 0) {
                const rowHeight = calculatedChartHeight + rowSpacing;
                rowTitles.forEach((rowTitle, i) => {
                    if (i < rows) {
                        this.svg.append('text')
                            .attr('class', 'grid-row-title')
                            .attr('x', rowTitleWidth / 2)
                            .attr('y', (title ? 40 : 20) + (i * rowHeight) + (calculatedChartHeight / 2))
                            .attr('text-anchor', 'middle')
                            .attr('dominant-baseline', 'central')
                            .style('font-size', '14px')
                            .style('font-weight', 'bold')
                            .style('fill', '#333')
                            .text(rowTitle);
                    }
                });
            }
            
            const gridContainer = this.svg.append('g')
                .attr('transform', `translate(${rowTitleWidth}, ${title ? 40 : 0})`);
            
            gridData.forEach((cellData, index) => {
                const col = index % columns;
                const row = Math.floor(index / columns);
                const x = col * calculatedChartWidth + 20;
                const y = row * (calculatedChartHeight + rowSpacing) + 20;
                
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
     * レスポンシブなサイズを取得（他のレンダラーと統一）
     * position設定からwidth/heightを取得し、コンテナサイズを計算
     * @param {Object} config - 設定オブジェクト
     * @returns {Object} 計算された幅と高さ
     */
    getResponsiveSize(config) {
        // position設定からコンテナサイズを取得
        const containerRect = this.container.node().getBoundingClientRect();
        let containerWidth = containerRect.width;
        let containerHeight = containerRect.height;
        
        // widthPercent/heightPercent が100%の場合は制約を回避
        const isFullViewport = (config.widthPercent === 100 && config.heightPercent === 100);
        
        // position設定でwidth/heightが指定されている場合
        if (config.position) {
            const { width: posWidth, height: posHeight } = config.position;
            
            // width設定の処理
            if (posWidth === "100%") {
                containerWidth = isFullViewport ? window.innerWidth * 0.98 : window.innerWidth * 0.9;
            } else if (typeof posWidth === "string" && posWidth.endsWith("%")) {
                const percent = parseFloat(posWidth) / 100;
                containerWidth = window.innerWidth * percent;
            } else if (typeof posWidth === "number") {
                containerWidth = posWidth;
            }
            
            // height設定の処理
            if (posHeight === "100%") {
                containerHeight = isFullViewport ? window.innerHeight * 0.95 : window.innerHeight * 0.8;
            } else if (typeof posHeight === "string" && posHeight.endsWith("%")) {
                const percent = parseFloat(posHeight) / 100;
                containerHeight = window.innerHeight * percent;
            } else if (typeof posHeight === "number") {
                containerHeight = posHeight;
            }
        }
        
        // SVGHelperが利用可能な場合は共通ユーティリティを使用
        if (window.SVGHelper) {
            return SVGHelper.getResponsiveSize(this.container, {
                defaultWidth: containerWidth,
                defaultHeight: containerHeight,
                width: containerWidth,
                height: containerHeight,
                minWidth: 600,
                minHeight: 400,
                maxWidth: 1600,
                maxHeight: 1000,
                widthPercent: config.widthPercent || null,
                heightPercent: config.heightPercent || null,
                isGridChart: true // グリッドチャート専用フラグ
            });
        }

        // フォールバック
        return { 
            width: containerWidth || 800, 
            height: containerHeight || 600 
        };
    }
    
    /**
     * データ構造を自動分析
     * @param {Array} data - 生データ
     * @returns {Object} データ構造の分析結果
     */
    analyzeDataStructure(data) {
        if (!data || data.length === 0) return null;
        
        const firstRow = data[0];
        const columns = Object.keys(firstRow);
        
        // 最初の列（地域/ラベル列）を特定
        const labelField = columns[0] === '' ? '' : columns[0];
        
        // 値列を特定（数値またはパーセンテージを含む列）
        const valueFields = columns.slice(1).filter(col => {
            const sampleValue = firstRow[col];
            return sampleValue && (sampleValue.includes('%') || !isNaN(parseFloat(sampleValue)));
        });
        
        return {
            labelField,
            valueFields,
            hasPercentages: valueFields.some(field => firstRow[field]?.includes('%')),
            dataType: valueFields.length > 1 ? 'multi-category' : 'single-value'
        };
    }
    
    /**
     * 生データをグリッド用データに変換（汎用版）
     * @param {Array} data - 生データ
     * @param {Object} config - 設定
     * @returns {Array} 変換されたグリッドデータ
     */
    transformToGridData(data, config) {
        const result = [];
        
        try {
            // データ構造を自動分析
            const structure = this.analyzeDataStructure(data);
            if (!structure) {
                throw new Error('Unable to analyze data structure');
            }
            
            // 設定から値フィールドを取得（設定優先、なければ自動検出）
            const valueField = config.valueField || structure.valueFields[0];
            const labelField = config.labelField || structure.labelField;
            
            // AIDS型（複数カテゴリ）とマラリア型（単一値）を判定
            const isMultiCategory = structure.dataType === 'multi-category' && structure.valueFields.length > 1;
            
            if (isMultiCategory) {
                // AIDS型：複数カテゴリのパーセンテージデータ（成人・子供など）
                return this.transformMultiCategoryData(data, structure, config);
            } else {
                // マラリア型：単一値の分布データ（地域別割合など）
                return this.transformSingleValueData(data, structure, config, valueField, labelField);
            }
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
     * 複数カテゴリデータの変換（AIDS型）
     * @param {Array} data - 生データ
     * @param {Object} structure - データ構造
     * @param {Object} config - 設定
     * @returns {Array} 変換されたデータ
     */
    transformMultiCategoryData(data, structure, config) {
        const result = [];
        const regions = [];
        const { labelField, valueFields } = structure;
        
        data.forEach(row => {
            const region = row[labelField];
            if (!region || !region.trim()) return;
            
            // ColorSchemeから色を取得
            const colorScheme = window.ColorScheme;
            const treatmentColor = colorScheme ? 
                colorScheme.getRegionColor(region) : 
                window.AppDefaults?.colors?.accent?.info || '#3b82f6';
            const untreatedColor = window.AppDefaults?.colors?.background?.light || '#e5e7eb';
            
            const categoryData = [];
            
            valueFields.forEach((field, index) => {
                const valueStr = row[field];
                const value = parseInt(valueStr?.replace('%', '') || '0');
                
                // カテゴリごとに異なる色を使用
                const categoryColor = index === 0 ? treatmentColor : 
                    (colorScheme ? colorScheme.getLighterColor(treatmentColor) : '#60a5fa');
                
                categoryData.push({
                    region: region,
                    ageGroup: field,
                    percentage: value,
                    pieData: [
                        { label: '対象', value: value, color: categoryColor },
                        { label: 'その他', value: 100 - value, color: untreatedColor }
                    ]
                });
            });
            
            regions.push(categoryData);
        });
        
        // 行ごとに配置（1行目：全地域の1カテゴリ目、2行目：全地域の2カテゴリ目）
        for (let categoryIndex = 0; categoryIndex < valueFields.length; categoryIndex++) {
            regions.forEach(regionData => {
                if (regionData[categoryIndex]) {
                    result.push(regionData[categoryIndex]);
                }
            });
        }
        
        return result;
    }
    
    /**
     * 単一値データの変換（マラリア型）
     * @param {Array} data - 生データ
     * @param {Object} structure - データ構造
     * @param {Object} config - 設定
     * @param {string} valueField - 値フィールド名
     * @param {string} labelField - ラベルフィールド名
     * @returns {Array} 変換されたデータ
     */
    transformSingleValueData(data, structure, config, valueField, labelField) {
        const result = [];
        const colorScheme = window.ColorScheme;
        
        // マラリアの場合：複数の値フィールドが指定されているかチェック
        const valueFields = config.valueFields || [valueField];
        
        if (valueFields.length > 1) {
            // 複数値フィールド：感染者と死亡者の割合を別々に表示
            // 1行目：全地域の感染者割合、2行目：全地域の死亡者割合
            valueFields.forEach((field, fieldIndex) => {
                data.forEach((row, regionIndex) => {
                    const label = row[labelField];
                    const valueStr = row[field];
                    
                    if (!label || !label.trim()) return;
                    
                    const value = parseFloat(valueStr?.replace('%', '') || '0');
                    const baseColor = colorScheme ? 
                        colorScheme.getRegionColor(label) : 
                        window.AppDefaults?.colors?.accent?.info || '#3b82f6';
                    
                    // フィールドごとに色の調子を変える
                    const color = fieldIndex === 0 ? baseColor : 
                        (colorScheme ? colorScheme.getDarkerColor(baseColor) : baseColor);
                    
                    result.push({
                        region: label,
                        ageGroup: field, // 「感染者の割合」または「死亡者の割合」
                        percentage: value,
                        pieData: [
                            { label: '対象地域', value: value, color: color },
                            { label: 'その他地域', value: Math.max(0, 100 - value), color: window.AppDefaults?.colors?.background?.light || '#e5e7eb' }
                        ]
                    });
                });
            });
        } else {
            // 単一値フィールド：従来の動作
            data.forEach(row => {
                const label = row[labelField];
                const valueStr = row[valueField];
                
                if (!label || !label.trim()) return;
                
                const value = parseFloat(valueStr?.replace('%', '') || '0');
                const color = colorScheme ? 
                    colorScheme.getRegionColor(label) : 
                    window.AppDefaults?.colors?.accent?.info || '#3b82f6';
                
                result.push({
                    region: label,
                    ageGroup: config.title || '分布',
                    percentage: value,
                    pieData: [
                        { label: label, value: value, color: color },
                        { label: 'その他', value: Math.max(0, 100 - value), color: window.AppDefaults?.colors?.background?.light || '#e5e7eb' }
                    ]
                });
            });
        }
        
        return result;
    }

    /**
     * データ数から最適なグリッドレイアウトを計算
     * @param {number} itemCount - アイテム数
     * @param {Object} config - 設定
     * @returns {Object} 最適なグリッド設定
     */
    calculateOptimalGrid(itemCount, config = {}) {
        // LayoutConfigが利用可能な場合は使用
        if (window.LayoutConfig && typeof LayoutConfig.calculateOptimalGrid === 'function') {
            const containerNode = this.container.node();
            const containerWidth = containerNode.offsetWidth || 800;
            const containerHeight = containerNode.offsetHeight || 600;
            
            return LayoutConfig.calculateOptimalGrid(itemCount, {
                maxColumns: config.maxColumns || 10,
                maxRows: config.maxRows || 5,
                aspectRatio: config.chartWidth / config.chartHeight || 1,
                containerAspectRatio: containerWidth / containerHeight
            });
        }
        
        // フォールバック実装
        const maxColumns = config.maxColumns || 10;
        const maxRows = config.maxRows || 5;
        
        // 正方形に近い形を目指す
        let optimalColumns = Math.ceil(Math.sqrt(itemCount));
        optimalColumns = Math.min(optimalColumns, maxColumns);
        
        let optimalRows = Math.ceil(itemCount / optimalColumns);
        optimalRows = Math.min(optimalRows, maxRows);
        
        // 収まらない場合は列数を調整
        if (optimalColumns * optimalRows < itemCount) {
            optimalColumns = Math.ceil(itemCount / optimalRows);
        }
        
        return {
            columns: optimalColumns,
            rows: optimalRows,
            totalItems: itemCount,
            actualItems: optimalColumns * optimalRows
        };
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