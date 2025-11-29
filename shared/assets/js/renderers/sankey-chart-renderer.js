import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyLeft } from '../libs/d3-sankey.js';
import { ChartRendererBase } from '../utils/chart-renderer-base.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { SVGHelper } from '../utils/svg-helper.js';
import { AppDefaults } from '../config/defaults.js';

/**
 * SankeyChartRenderer - サンキーダイアグラムの描画を専門的に扱うクラス
 * ChartRendererBaseを継承し、d3-sankeyを使用してフローを可視化
 */
export class SankeyChartRenderer extends ChartRendererBase {
    constructor(containerId) {
        super(containerId);
        this.type = 'sankey';
        this.svg = null;
        this.currentChart = null;
        this.data = null;
        this.config = null;

        this.init();
    }

    /**
     * チャートを更新する
     * @param {Object} chartData - チャートデータとオプション
     */
    updateChart(chartData) {
        const { type, data, config, visible } = chartData;

        if (type !== 'sankey') {
            return;
        }

        this.data = data;
        this.config = config;
        this.currentChart = type;

        if (visible) {
            this.show();
            this.renderSankeyChart(data, config);
        } else {
            this.hide();
        }
    }

    /**
     * サンキーダイアグラムを描画する
     * @param {Object} data - データ
     * @param {Object} config - 設定
     */
    renderSankeyChart(data, config) {
        console.log('SankeyChartRenderer: renderSankeyChart called with data:', data);
        try {
            if (!data || !data.nodes || !data.links) {
                console.error('SankeyChartRenderer: Invalid data structure', data);
                return;
            }
            const {
                width = 800,
                height = 600,
                margin = { top: 40, right: 20, bottom: 40, left: 20 },
                title = '',
                dataSource = '',
                colors = d3.schemeTableau10
            } = config;

            // コンテナをクリア
            this.clearContainer();

            // SVGを初期化
            this.svg = this.container.append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('viewBox', [0, 0, width, height])
                .style('max-width', '100%')
                .style('height', 'auto');

            // タイトルを追加
            if (title) {
                this.svg.append('text')
                    .attr('class', 'chart-title')
                    .attr('x', width / 2)
                    .attr('y', margin.top / 2)
                    .attr('text-anchor', 'middle')
                    .attr('fill', AppDefaults?.colors?.text?.primary || '#333')
                    .style('font-family', 'var(--font-family-serif)')
                    .style('font-size', 'var(--font-size-large)')
                    .style('font-weight', 'var(--font-weight-bold)')
                    .text(title);
            }

            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            const g = this.svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // カラー設定
            const colorScale = d3.scaleOrdinal(colors);

            // サンキー生成器
            const sankeyGenerator = sankey()
                .nodeWidth(18)
                .nodePadding(16)
                .nodeAlign(sankeyLeft)
                .extent([[0, 0], [innerWidth, innerHeight]]);

            // データのディープコピー（d3-sankeyはデータを変更するため）
            const sankeyData = sankeyGenerator({
                nodes: data.nodes.map(d => ({ ...d })),
                links: data.links.map(d => ({ ...d }))
            });

            // リンク描画
            const links = g.append("g")
                .attr("fill", "none")
                .attr("stroke-opacity", 0.45)
                .selectAll("g")
                .data(sankeyData.links)
                .join("g")
                .style("mix-blend-mode", "multiply");

            links.append("path")
                .attr("d", sankeyLinkHorizontal())
                .attr("stroke", d => colorScale(d.source.name))
                .attr("stroke-width", d => Math.max(1, d.width))
                .style("transition", "stroke-opacity 160ms ease, stroke 160ms ease")
                .on("mouseover", function () {
                    d3.select(this).attr("stroke-opacity", 0.9);
                })
                .on("mouseout", function () {
                    d3.select(this).attr("stroke-opacity", 0.45);
                });

            links.append("title")
                .text(d => `${d.source.name} → ${d.target.name}\n${d.value.toLocaleString()}`);

            // ノード描画
            const nodes = g.append("g")
                .selectAll("g")
                .data(sankeyData.nodes)
                .join("g")
                .attr("transform", d => `translate(${d.x0},${d.y0})`);

            // ノードの矩形
            nodes.append("rect")
                .attr("height", d => d.y1 - d.y0)
                .attr("width", sankeyGenerator.nodeWidth())
                .attr("fill", d => colorScale(d.name))
                .attr("stroke", "#1c2c36")
                .append("title")
                .text(d => `${d.name}\n${d.value.toLocaleString()}`);

            // ノードのラベル
            nodes.append("text")
                .attr("x", d => d.x0 < innerWidth / 2 ? sankeyGenerator.nodeWidth() + 6 : -6)
                .attr("y", d => (d.y1 - d.y0) / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", d => d.x0 < innerWidth / 2 ? "start" : "end")
                .text(d => d.name)
                .style("font-size", "12px")
                .style("fill", AppDefaults?.colors?.text?.primary || '#333')
                .style("pointer-events", "none");

            // ドラッグ機能（オプション）
            // 必要であれば実装を追加

            // データソースを表示
            if (dataSource) {
                this.addDataSource(this.svg, dataSource, width, height);
            }

        } catch (error) {
            ErrorHandler.handle(
                error,
                'SankeyChartRenderer.renderSankeyChart',
                { type: ErrorHandler.ERROR_TYPES.RENDER, severity: ErrorHandler.SEVERITY.HIGH }
            );
        }
    }
}
