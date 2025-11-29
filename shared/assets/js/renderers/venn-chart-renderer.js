import * as d3 from 'd3';
import { ChartRendererBase } from '../utils/chart-renderer-base.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { SVGHelper } from '../utils/svg-helper.js';
import { AppDefaults } from '../config/defaults.js';

/**
 * VennChartRenderer - ベン図のグリッドレイアウト描画を専門的に扱うクラス
 * ChartRendererBaseを継承し、d3-eulerを使用してベン図を描画
 */
export class VennChartRenderer extends ChartRendererBase {
    constructor(containerId) {
        super(containerId);
        this.type = 'venn-grid';
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;

        // Initialize after properties are set
        this.init();
    }

    /**
     * チャートを更新する
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        const { layout, config, visible } = chartData;

        // venn-grid layout以外は処理しない
        if (layout !== 'venn-grid') {
            return;
        }

        this.config = config;
        this.currentChart = layout;

        if (visible) {
            this.show();
            this.renderVennGrid(config);
        } else {
            this.hide();
        }
    }

    /**
     * ベン図グリッドを描画する
     * @param {Object} config - 設定
     */
    async renderVennGrid(config) {
        try {
            const {
                dataFiles = [],
                columns = 4,
                rows = 2,
                chartWidth = 200,
                chartHeight = 200,
                title = '',
                colors = {
                    'エイズ': '#e74c3c',
                    '結核': '#3498db'
                },
                dataSource = ''
            } = config;

            // 複数のJSONファイルを並列読み込み
            const vennDataArray = await this.loadVennData(dataFiles);

            // コンテナサイズを計算
            const spacing = 20;
            const totalWidth = columns * chartWidth + (columns - 1) * spacing + 40;
            const totalHeight = rows * chartWidth + (rows - 1) * spacing + (title ? 60 : 20) + (dataSource ? 40 : 20);

            // SVGを初期化
            this.clearContainer();
            this.svg = this.container
                .append('svg')
                .attr('width', totalWidth)
                .attr('height', totalHeight)
                .classed('venn-grid-svg', true)
                .style('display', 'block')
                .style('margin', '0 auto');

            // タイトルを追加
            if (title) {
                this.svg.append('text')
                    .attr('class', 'chart-title')
                    .attr('x', totalWidth / 2)
                    .attr('y', 30)
                    .attr('text-anchor', 'middle')
                    .attr('fill', AppDefaults?.colors?.text?.primary || '#333')
                    .style('font-family', 'var(--font-family-serif)')
                    .style('font-size', 'var(--font-size-large)')
                    .style('font-weight', 'var(--font-weight-bold)')
                    .text(title);
            }

            // グリッドコンテナ
            const gridContainer = this.svg.append('g')
                .attr('transform', `translate(20, ${title ? 60 : 20})`);

            // 各ベン図を描画
            vennDataArray.forEach((vennData, index) => {
                const row = Math.floor(index / columns);
                const col = index % columns;

                // 下段（2行目）は3つなので中央揃え
                let x, y;
                if (row === 1 && vennDataArray.length === 7) {
                    // 下段は3つを中央配置
                    const offset = (chartWidth + spacing) / 2;
                    x = col * (chartWidth + spacing) + offset;
                } else {
                    x = col * (chartWidth + spacing);
                }
                y = row * (chartHeight + spacing);

                this.renderSingleVenn(gridContainer, vennData, {
                    x,
                    y,
                    width: chartWidth,
                    height: chartHeight,
                    colors
                });
            });

            // データソースを追加
            if (dataSource) {
                this.addDataSource(this.svg, dataSource, totalWidth, totalHeight);
            }

        } catch (error) {
            ErrorHandler.handle(
                error,
                'VennChartRenderer.renderVennGrid',
                { type: ErrorHandler.ERROR_TYPES.RENDER, severity: ErrorHandler.SEVERITY.HIGH }
            );
        }
    }

    /**
     * 複数のベン図データファイルを読み込む
     * @param {Array} dataFiles - データファイルパスの配列
     * @returns {Promise<Array>} ベン図データの配列
     */
    async loadVennData(dataFiles) {
        try {
            const promises = dataFiles.map(file => d3.json(file));
            return await Promise.all(promises);
        } catch (error) {
            ErrorHandler.handle(
                error,
                'VennChartRenderer.loadVennData',
                { type: ErrorHandler.ERROR_TYPES.DATA_LOAD, severity: ErrorHandler.SEVERITY.HIGH }
            );
            return [];
        }
    }

    /**
     * 単一のベン図を描画する
     * @param {d3.Selection} container - 親コンテナ
     * @param {Object} vennData - ベン図データ
     * @param {Object} layout - レイアウト設定
     */
    renderSingleVenn(container, vennData, layout) {
        const { x, y, width, height, colors } = layout;

        try {
            // ベン図グループを作成
            const vennGroup = container.append('g')
                .attr('class', 'venn-diagram')
                .attr('transform', `translate(${x}, ${y})`);

            // タイトルを追加
            if (vennData.title) {
                vennGroup.append('text')
                    .attr('class', 'venn-title')
                    .attr('x', width / 2)
                    .attr('y', 15)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .attr('fill', AppDefaults?.colors?.text?.primary || '#333')
                    .text(vennData.title);
            }

            // ベン図描画エリア
            const diagramArea = vennGroup.append('g')
                .attr('transform', `translate(0, 30)`);

            // 簡易的な2円ベン図を描画（d3-eulerの代替実装）
            this.renderSimpleVenn(diagramArea, vennData.sets, width, height - 30, colors);

        } catch (error) {
            ErrorHandler.handle(
                error,
                'VennChartRenderer.renderSingleVenn',
                { type: ErrorHandler.ERROR_TYPES.RENDER, severity: ErrorHandler.SEVERITY.MEDIUM }
            );
        }
    }

    /**
     * 簡易的な2円ベン図を描画（d3-euler不使用の実装）
     * @param {d3.Selection} container - コンテナ
     * @param {Array} sets - セットデータ
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Object} colors - 色設定
     */
    renderSimpleVenn(container, sets, width, height, colors) {
        // データを解析
        const aidsSizeData = sets.find(s => s.sets.length === 1 && s.sets[0] === 'エイズ');
        const tbSizeData = sets.find(s => s.sets.length === 1 && s.sets[0] === '結核');
        const overlapData = sets.find(s => s.sets.length === 2);

        const aidsSize = aidsSizeData ? aidsSizeData.size : 0;
        const tbSize = tbSizeData ? tbSizeData.size : 0;
        const overlapSize = overlapData ? overlapData.size : 0;

        // 円のサイズを計算（面積ベース）
        const maxSize = Math.max(aidsSize, tbSize);
        const baseRadius = Math.min(width, height) / 3;

        const aidsRadius = baseRadius * Math.sqrt(aidsSize / maxSize);
        const tbRadius = baseRadius * Math.sqrt(tbSize / maxSize);

        // 円の位置を計算（重なりを考慮）
        const centerY = height / 2;
        const overlapRatio = overlapSize / Math.min(aidsSize, tbSize);
        const distance = (aidsRadius + tbRadius) * (1 - overlapRatio * 0.5);

        const aidsX = width / 2 - distance / 2;
        const tbX = width / 2 + distance / 2;

        // エイズの円
        container.append('circle')
            .attr('cx', aidsX)
            .attr('cy', centerY)
            .attr('r', aidsRadius)
            .attr('fill', colors['エイズ'] || '#e74c3c')
            .attr('opacity', 0.5)
            .attr('stroke', colors['エイズ'] || '#e74c3c')
            .attr('stroke-width', 2);

        // 結核の円
        container.append('circle')
            .attr('cx', tbX)
            .attr('cy', centerY)
            .attr('r', tbRadius)
            .attr('fill', colors['結核'] || '#3498db')
            .attr('opacity', 0.5)
            .attr('stroke', colors['結核'] || '#3498db')
            .attr('stroke-width', 2);

        // ラベルを追加
        container.append('text')
            .attr('x', aidsX - aidsRadius / 2)
            .attr('y', centerY)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text('エイズ');

        container.append('text')
            .attr('x', tbX + tbRadius / 2)
            .attr('y', centerY)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text('結核');

        // 数値ラベル
        const formatNumber = (num) => {
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
            return num.toString();
        };

        container.append('text')
            .attr('x', aidsX - aidsRadius / 2)
            .attr('y', centerY + 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#666')
            .text(formatNumber(aidsSize));

        container.append('text')
            .attr('x', tbX + tbRadius / 2)
            .attr('y', centerY + 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#666')
            .text(formatNumber(tbSize));

        if (overlapSize > 0) {
            container.append('text')
                .attr('x', width / 2)
                .attr('y', centerY)
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333')
                .text(formatNumber(overlapSize));
        }
    }

    /**
     * リサイズ処理
     */
    resize() {
        if (this.currentChart && this.config) {
            this.renderVennGrid(this.config);
        }
    }
}
