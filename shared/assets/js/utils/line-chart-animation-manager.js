import * as d3 from 'd3';
import { AppDefaults } from '../config/defaults.js';
import { colorScheme } from './color-scheme.js';

/**
 * LineChartAnimationManager - 折れ線グラフのアニメーション処理を専門的に扱うクラス
 * プログレッシブアニメーション、色スケール管理、タイマー管理を統合
 */
export class LineChartAnimationManager {
    constructor() {
        // アニメーションタイマーを管理
        this.animationTimers = [];

        // デフォルト設定
        this.defaultConfig = {
            duration: 3000,
            stepDelay: 200
        };
    }

    /**
     * プログレッシブアニメーションを実行
     * @param {d3.Selection} seriesGroups - 系列グループ
     * @param {Array} series - 系列データ
     * @param {Function} line - D3ラインジェネレータ
     * @param {Function} xScale - X軸スケール
     * @param {Function} yScale - Y軸スケール
     * @param {string} xField - X軸フィールド名
     * @param {string} yField - Y軸フィールド名
     * @param {Function} colorScale - 色スケール
     * @param {Object} config - 設定
     */
    renderProgressiveAnimation(seriesGroups, series, line, xScale, yScale, xField, yField, colorScale, config) {

        const animationConfig = config.animation || {};
        const totalDuration = animationConfig.duration || 3000;
        const stepDelay = animationConfig.stepDelay || 200;

        // 全系列の年度データを収集してソート
        const allYears = new Set();
        series.forEach(seriesData => {
            seriesData.values.forEach(d => {
                allYears.add(+d[xField]);
            });
        });
        const sortedYears = Array.from(allYears).sort((a, b) => a - b);


        // 既存のすべてのアニメーションタイマーをクリア
        this.clearAllAnimationTimers();

        // 既存のすべてのトランジションを停止
        seriesGroups.selectAll('*').interrupt();

        // 既存のstroke-dash属性を完全にクリア
        seriesGroups.selectAll('path')
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)
            .style('stroke-dasharray', null)
            .style('stroke-dashoffset', null);

        // 既存のpath要素とpoint要素をすべて削除して、完全にリセット
        seriesGroups.selectAll('path').remove();
        seriesGroups.selectAll('circle').remove();
        seriesGroups.selectAll('.points-container').remove();

        // thisのスコープを保存
        const self = this;

        // 各系列に対して段階的アニメーションを実行
        seriesGroups.each(function (seriesData, seriesIndex) {
            const group = d3.select(this);
            const color = colorScale(seriesData.name);

            // 最終的な完全なラインパスを準備
            const fullLinePath = line(seriesData.values);

            // ラインパスを作成
            const linePath = group.append('path')
                .attr('class', 'chart-line')
                .attr('stroke', color)
                .attr('stroke-width', AppDefaults?.strokeWidth?.thick || 2)
                .attr('fill', 'none')
                .attr('d', fullLinePath); // 完全なパスを設定

            // パスの全長を取得
            const totalLength = linePath.node().getTotalLength();

            // stroke-dasharrayとstroke-dashoffsetを設定して線を非表示に
            linePath
                .attr('stroke-dasharray', totalLength + ' ' + totalLength)
                .attr('stroke-dashoffset', totalLength);

            // ポイントコンテナを準備
            const pointsContainer = group.append('g')
                .attr('class', 'points-container');

            // すべてのポイントを事前に作成（非表示状態）
            const allPoints = pointsContainer.selectAll('.chart-circle')
                .data(seriesData.values)
                .enter()
                .append('circle')
                .attr('class', 'chart-circle')
                .attr('cx', d => xScale(+d[xField]))
                .attr('cy', d => yScale(+d[yField]))
                .attr('r', 0)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1)
                .style('opacity', 0);

            // 系列全体の開始遅延
            const seriesStartDelay = seriesIndex * 300;

            // 滑らかなライン描画アニメーション
            const lineTimer = setTimeout(() => {
                linePath
                    .transition()
                    .duration(totalDuration * 0.8) // 全期間の80%で線を描画
                    .ease(d3.easeQuadInOut)
                    .attr('stroke-dashoffset', 0);
            }, seriesStartDelay);
            self.animationTimers.push(lineTimer);

            // 年度ごとに点を順次表示
            sortedYears.forEach((year, yearIndex) => {
                const pointDelay = seriesStartDelay + (yearIndex / sortedYears.length) * totalDuration * 0.8;

                const pointTimer = setTimeout(() => {
                    // 該当年度の点を表示
                    allPoints
                        .filter(function (d) { return +d[xField] === year; })
                        .transition()
                        .duration(300)
                        .ease(d3.easeBackOut.overshoot(1.2))
                        .attr('r', 3)
                        .style('opacity', 1);
                }, pointDelay);
                self.animationTimers.push(pointTimer);
            });
        });
    }

    /**
     * 地域別カラースキームを使用した色スケールを作成
     * @param {Array} series - 系列データ
     * @param {Object} config - 設定オブジェクト
     * @returns {Function} D3カラースケール
     */
    createColorScale(series, config) {
        // 単一色設定が指定されている場合（dualレイアウト対応）
        if (config.color) {
            return () => config.color;
        } else if (config.colors && config.colors.length > 0 && config.multiSeries === false) {
            // 単一系列の明示色
            return d3.scaleOrdinal(config.colors).domain(series.map(d => d.name));
        } else if (colorScheme && config.useUnifiedColors !== false) {
            // 統一カラースキーム：地域名→色の直接マッピング
            const regionColors = series.map(s => {
                const color = colorScheme.getRegionColor(s.name);
                return color;
            });
            return d3.scaleOrdinal()
                .domain(series.map(s => s.name))
                .range(regionColors);
        } else {
            // フォールバック
            const colors = config.colors || AppDefaults?.APP_COLORS?.PRIMARY_PALETTE || d3.schemeCategory10;
            return d3.scaleOrdinal(colors).domain(series.map(d => d.name));
        }
    }

    /**
     * すべてのアニメーションタイマーをクリア
     */
    clearAllAnimationTimers() {
        this.animationTimers.forEach(timer => clearTimeout(timer));
        this.animationTimers = [];
    }

    /**
     * アニメーション中かどうかを確認
     * @returns {boolean} アニメーション中の場合は true
     */
    isAnimating() {
        return this.animationTimers.length > 0;
    }

    /**
     * リソースをクリア
     */
    destroy() {
        this.clearAllAnimationTimers();
    }
}
