import * as d3 from 'd3';
import { LineChartUtilities } from '../renderers/line-chart-utilities.js';
import { ChartTransitions } from '../utils/chart-transitions.js';
import { ChartFormatterHelper } from '../utils/chart-formatter-helper.js';
import { ChartLayoutManager } from '../utils/chart-layout-manager.js';
import { ChartLayoutHelper } from '../utils/chart-layout-helper.js';
import { AppDefaults } from '../config/defaults.js';

/**
 * LineChartAnimations - 折れ線グラフのアニメーション処理
 * トランジション、段階的アニメーション、軸更新などを専門的に処理
 */
export class LineChartAnimations {
    /**
     * トランジションでチャートを更新
     * @param {LineChartRenderer} renderer - LineChartRendererインスタンス
     * @param {Array} data - 新規データ
     * @param {Object} config - 設定
     * @param {string} direction - スクロール方向（up/down）
     */
    static updateChartWithTransition(renderer, data, config, direction = 'down') {
        if (!renderer.svg || renderer.currentChart !== 'line') {
            console.warn('Cannot update chart with transition: no existing line chart');
            return;
        }

        renderer.data = data;
        renderer.config = config;

        // 新しいデータを系列別に変換
        const newSeries = LineChartUtilities.transformToSeries(data, config);
        const allNewValues = newSeries.flatMap(s => s.values);

        const { width, height } = renderer.getResponsiveSize(config);

        // マージンを計算（ChartRendererBase のヘルパーメソッドを使用）
        const margin = renderer.getChartMargin(data, config, {
            chartType: 'line',
            hasLegend: config.showLegend !== false && config.multiSeries
        });

        // インラインラベル使用時は右マージンを拡大
        if (config.legendType === 'inline' && config.multiSeries) {
            margin.right = Math.max(margin.right, 240);
        }
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const { xField = 'year', yField = 'value' } = config;
        const isYearData = allNewValues.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);

        // X軸のドメインを決定
        let xDomain;
        if (config.yearRange && config.yearRange.length === 2) {
            xDomain = config.yearRange;
        } else if (isYearData) {
            xDomain = d3.extent(allNewValues, d => +d[xField]);
        } else {
            xDomain = d3.extent(allNewValues, d => new Date(d[xField]));
        }

        // 新しいスケールを計算
        const newXScale = isYearData
            ? d3.scaleLinear()
                .domain(xDomain)
                .range([0, innerWidth])
            : d3.scaleTime()
                .domain(xDomain)
                .range([0, innerWidth]);

        // Y軸のドメインを決定
        let yDomain;
        if (config.yRange && config.yRange.length === 2) {
            yDomain = config.yRange;
        } else {
            yDomain = d3.extent(allNewValues, d => +d[yField]);
        }

        let newYScale;
        if (config.yAxis && config.yAxis.type === 'log') {
            const yMin = yDomain[0] > 0 ? yDomain[0] : 1;
            newYScale = d3.scaleLog()
                .domain([yMin, yDomain[1]])
                .range([innerHeight, 0]);
        } else {
            newYScale = d3.scaleLinear()
                .domain(yDomain)
                .range([innerHeight, 0]);
        }

        // yRangeが明示的に設定されていない場合のみnice()を適用
        if (!(renderer.config && renderer.config.yRange && renderer.config.yRange.length === 2)) {
            newYScale.nice();
        }

        const g = renderer.svg.select('g');

        // 軸定義
        const newXAxis = isYearData
            ? d3.axisBottom(newXScale).tickFormat(d3.format("d"))
            : d3.axisBottom(newXScale);
        const newYAxis = d3.axisLeft(newYScale)
            .tickFormat(d => ChartFormatterHelper.formatYAxisValue(d, config.yAxisFormat));

        if (config.yAxis && config.yAxis.ticks) {
            newYAxis.ticks(config.yAxis.ticks);
        }

        // 軸をトランジションで更新
        const transitionDuration = config.transitionDuration || 1000;
        renderer.updateChartAxes(g, newXAxis, newYAxis, {
            chartType: 'line',
            duration: transitionDuration
        });

        // 新しいライン生成器
        const newLine = d3.line()
            .x(d => isYearData ? newXScale(+d[xField]) : newXScale(new Date(d[xField])))
            .y(d => newYScale(+d[yField]))
            .curve(d3.curveMonotoneX);

        // 色スケール
        const colorScale = LineChartUtilities.createColorScale(newSeries, config);

        // ChartTransitionsを使用してEnter/Update/Exitパターンを適用
        const seriesUpdateResult = ChartTransitions.applyEnterUpdateExit(
            g.selectAll('.series-group'),
            newSeries,
            d => d.name,
            {
                onEnter: (enterSelection) => {
                    const enterGroups = enterSelection
                        .append('g')
                        .attr('class', 'series-group');

                    enterGroups.append('path')
                        .attr('class', 'chart-line')
                        .attr('stroke', d => colorScale(d.name))
                        .attr('stroke-width', AppDefaults?.strokeWidth?.thick || 2)
                        .attr('fill', 'none')
                        .attr('d', d => newLine(d.values))
                        .style('opacity', 0);
                },
                onExit: (exitSelection) => {
                    exitSelection
                        .style('opacity', 0)
                        .remove();
                }
            },
            {
                chartType: 'line',
                exit: { duration: transitionDuration / 2 }
            }
        );

        const allSeriesGroups = seriesUpdateResult.all;

        // チャート更新
        allSeriesGroups.each(function (seriesData, seriesIndex) {
            const group = d3.select(this);
            const currentSeriesData = newSeries.find(s => s.name === seriesData.name) || seriesData;

            LineChartAnimations.updateSeriesWithDiff(
                group,
                currentSeriesData,
                newXScale,
                newYScale,
                newLine,
                colorScale,
                transitionDuration,
                renderer
            );
        });
    }

    /**
     * 差分ベースでシリーズを段階的に更新
     * @param {d3.Selection} group - SVGグループ
     * @param {Object} newSeriesData - 新規系列データ
     * @param {Function} newXScale - X軸スケール
     * @param {Function} newYScale - Y軸スケール
     * @param {Function} newLine - ライン生成器
     * @param {Function} colorScale - 色スケール
     * @param {number} transitionDuration - トランジション期間
     * @param {LineChartRenderer} renderer - LineChartRendererインスタンス
     */
    static updateSeriesWithDiff(group, newSeriesData, newXScale, newYScale, newLine, colorScale, transitionDuration, renderer) {
        const lineElement = group.selectAll('.chart-line');
        const currentLineData = lineElement.datum();
        const oldValues = currentLineData ? currentLineData.values : [];
        const newValues = newSeriesData.values;

        // 差分を計算
        const xField = renderer.config?.xField || 'year';
        const oldKeys = new Set(oldValues.map(d => d[xField]));
        const newKeys = new Set(newValues.map(d => d[xField]));

        const toAdd = newValues.filter(d => !oldKeys.has(d[xField]));
        const toRemove = oldValues.filter(d => !newKeys.has(d[xField]));

        // 現在表示中のデータ
        let currentDisplayData = [...oldValues];

        // 段階的更新の間隔
        const totalChanges = toAdd.length + toRemove.length;
        const intervalTime = totalChanges > 0 ? transitionDuration / totalChanges : 0;

        let updateIndex = 0;

        // 削除処理（右端から）
        toRemove.reverse().forEach((dataPoint) => {
            const timer = setTimeout(() => {
                currentDisplayData = currentDisplayData.filter(d =>
                    d[xField] !== dataPoint[xField]
                );
                lineElement.datum({ ...newSeriesData, values: currentDisplayData });
                LineChartAnimations.updateLineAndAxes(group, currentDisplayData, newXScale, newYScale, newLine, colorScale, renderer);
            }, updateIndex * intervalTime);
            renderer.animationTimers.push(timer);
            updateIndex++;
        });

        // 追加処理（左端から右端へ）
        toAdd.forEach((dataPoint) => {
            const timer = setTimeout(() => {
                currentDisplayData.push(dataPoint);
                currentDisplayData.sort((a, b) => a[xField] - b[xField]);
                lineElement.datum({ ...newSeriesData, values: currentDisplayData });
                LineChartAnimations.updateLineAndAxes(group, currentDisplayData, newXScale, newYScale, newLine, colorScale, renderer);
            }, updateIndex * intervalTime);
            renderer.animationTimers.push(timer);
            updateIndex++;
        });

        // 最終的にデータを確実に設定
        const finalTimer = setTimeout(() => {
            lineElement.datum({ ...newSeriesData, values: newValues });
        }, transitionDuration);
        renderer.animationTimers.push(finalTimer);
    }

    /**
     * 線と軸を同期更新
     * @param {d3.Selection} group - SVGグループ
     * @param {Array} currentData - 現在のデータ
     * @param {Function} newXScale - X軸スケール
     * @param {Function} newYScale - Y軸スケール
     * @param {Function} newLine - ライン生成器
     * @param {Function} colorScale - 色スケール
     * @param {LineChartRenderer} renderer - LineChartRendererインスタンス
     */
    static updateLineAndAxes(group, currentData, newXScale, newYScale, newLine, colorScale, renderer) {
        const seriesData = group.datum();
        const xField = renderer.config?.xField || 'year';
        const yField = renderer.config?.yField || 'value';

        if (currentData.length > 0) {
            // 全系列の現在データを収集
            const g = renderer.svg.select('g');
            const allCurrentData = [];

            g.selectAll('.series-group').each(function () {
                const seriesGroup = d3.select(this);
                const lineData = seriesGroup.select('.chart-line').datum();
                if (lineData && lineData.values) {
                    allCurrentData.push(...lineData.values);
                }
            });

            // データが存在する場合のみ軸を更新
            if (allCurrentData.length > 0) {
                const xExtent = d3.extent(allCurrentData, d => +d[xField]);
                let yExtent = d3.extent(allCurrentData, d => +d[yField]);

                if (newYScale.base) {
                    yExtent[0] = yExtent[0] > 0 ? yExtent[0] : 1;
                }

                newXScale.domain(xExtent);
                newYScale.domain(yExtent);

                if (!(renderer.config && renderer.config.yRange && renderer.config.yRange.length === 2)) {
                    newYScale.nice();
                }

                // 軸を更新
                const isYearData = allCurrentData.every(d => !isNaN(d[xField]) && d[xField] > 1900 && d[xField] < 2100);
                let xAxis, yAxis;

                if (renderer.config && renderer.config.yAxisFormat) {
                    xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                    yAxis = d3.axisLeft(newYScale).tickFormat(d => ChartFormatterHelper.formatYAxisValue(d, renderer.config.yAxisFormat));

                    if (renderer.config.yAxis && renderer.config.yAxis.type === 'log') {
                        const tickValues = newYScale.ticks().filter(d => Number.isInteger(Math.log10(d)) || d === 1);
                        yAxis.tickValues(tickValues);
                    } else if (renderer.config.yAxis && renderer.config.yAxis.tickValues) {
                        yAxis.tickValues(renderer.config.yAxis.tickValues);
                    } else if (renderer.config.yAxis && renderer.config.yAxis.ticks) {
                        yAxis.ticks(renderer.config.yAxis.ticks);
                    }
                } else if (ChartLayoutManager || ChartLayoutHelper) {
                    const layoutUtil = ChartLayoutManager || ChartLayoutHelper;
                    const unitInfo = layoutUtil.analyzeUnits(allCurrentData, renderer.config || {});
                    const yFormatter = (value) => layoutUtil.formatAxisWithUnits(value, unitInfo.yAxis);
                    xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                    yAxis = d3.axisLeft(newYScale).tickFormat(yFormatter);

                    if (renderer.config && renderer.config.yAxis && renderer.config.yAxis.tickValues) {
                        yAxis.tickValues(renderer.config.yAxis.tickValues);
                    } else if (renderer.config && renderer.config.yAxis && renderer.config.yAxis.ticks) {
                        yAxis.ticks(renderer.config.yAxis.ticks);
                    }
                } else {
                    xAxis = isYearData ? d3.axisBottom(newXScale).tickFormat(d3.format("d")) : d3.axisBottom(newXScale);
                    yAxis = d3.axisLeft(newYScale);

                    if (renderer.config && renderer.config.yAxis && renderer.config.yAxis.tickValues) {
                        yAxis.tickValues(renderer.config.yAxis.tickValues);
                    } else if (renderer.config && renderer.config.yAxis && renderer.config.yAxis.ticks) {
                        yAxis.ticks(renderer.config.yAxis.ticks);
                    }
                }

                g.select('.x-axis').transition().duration(200).call(xAxis);
                g.select('.y-axis').transition().duration(200).call(yAxis);
            }
        }

        // 線を更新
        ChartTransitions.animateLine(
            group.selectAll('.chart-line'),
            () => newLine(currentData),
            {
                chartType: 'line',
                phase: 'update',
                duration: 200
            }
        ).attr('stroke', colorScale(seriesData.name));

        // 点を更新
        const dataWithKeys = ChartTransitions.addObjectKeys(currentData, xField, seriesData.name);

        const scales = { x: newXScale, y: newYScale };
        const pointConfig = {
            chartType: 'line',
            xField: xField,
            yField: yField,
            radius: 3,
            duration: 200
        };

        ChartTransitions.applyEnterUpdateExit(
            group.selectAll('.chart-circle'),
            dataWithKeys,
            d => d._uniqueKey,
            {
                onEnter: (enterSelection) => {
                    ChartTransitions.animatePoints(
                        enterSelection
                            .append('circle')
                            .attr('class', 'chart-circle')
                            .attr('fill', colorScale(seriesData.name)),
                        scales,
                        { ...pointConfig, phase: 'enter' }
                    );
                },
                onUpdate: (allSelection) => {
                    ChartTransitions.animatePoints(
                        allSelection,
                        scales,
                        { ...pointConfig, phase: 'update' }
                    );
                },
                onExit: (exitSelection) => {
                    exitSelection
                        .attr('r', 0)
                        .remove();
                }
            },
            { chartType: 'line', duration: 200 }
        );
    }

    /**
     * 段階的アニメーション描画
     * @param {d3.Selection} seriesGroups - 系列グループ
     * @param {Array} series - 系列データ
     * @param {Function} line - D3ライン生成器
     * @param {Function} xScale - X軸スケール
     * @param {Function} yScale - Y軸スケール
     * @param {string} xField - X軸フィールド名
     * @param {string} yField - Y軸フィールド名
     * @param {Function} colorScale - 色スケール
     * @param {Object} config - 設定
     * @param {LineChartRenderer} renderer - LineChartRendererインスタンス
     */
    static renderProgressiveAnimation(seriesGroups, series, line, xScale, yScale, xField, yField, colorScale, config, renderer) {
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
        LineChartAnimations.clearAllAnimationTimers(renderer);

        // 既存のすべてのトランジションを停止
        seriesGroups.selectAll('*').interrupt();

        // 既存のstroke-dash属性を完全にクリア
        seriesGroups.selectAll('path')
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)
            .style('stroke-dasharray', null)
            .style('stroke-dashoffset', null);

        // 既存の要素を削除してリセット
        seriesGroups.selectAll('path').remove();
        seriesGroups.selectAll('circle').remove();
        seriesGroups.selectAll('.points-container').remove();

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
                .attr('d', fullLinePath);

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
                    .duration(totalDuration * 0.8)
                    .ease(d3.easeQuadInOut)
                    .attr('stroke-dashoffset', 0);
            }, seriesStartDelay);
            renderer.animationTimers.push(lineTimer);

            // 年度ごとに点を順次表示
            sortedYears.forEach((year, yearIndex) => {
                const pointDelay = seriesStartDelay + (yearIndex / sortedYears.length) * totalDuration * 0.8;

                const pointTimer = setTimeout(() => {
                    allPoints
                        .filter(function (d) { return +d[xField] === year; })
                        .transition()
                        .duration(300)
                        .ease(d3.easeBackOut.overshoot(1.2))
                        .attr('r', 3)
                        .style('opacity', 1);
                }, pointDelay);
                renderer.animationTimers.push(pointTimer);
            });
        });
    }

    /**
     * すべてのアニメーションタイマーをクリア
     * @param {LineChartRenderer} renderer - LineChartRendererインスタンス
     */
    static clearAllAnimationTimers(renderer) {
        renderer.animationTimers.forEach(timer => clearTimeout(timer));
        renderer.animationTimers = [];
    }
}
