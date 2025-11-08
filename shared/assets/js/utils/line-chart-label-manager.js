/**
 * LineChartLabelManager - 折れ線グラフのラベル配置と最適化を専門的に扱うクラス
 * インラインラベル、引き出し線、ラベル衝突回避などの機能を統合管理
 */
class LineChartLabelManager {
    constructor() {
        // 設定可能なデフォルト値
        this.defaultConfig = {
            fontSize: '12px',
            fontFamily: 'var(--font-family-serif), "Shippori Mincho", serif',
            offsetX: 15,
            offsetY: 0,
            minDistance: 20,
            useLabeler: true,
            enableLeaderLines: true,
            leaderLineLength: 30,
            maxLabelWidth: null, // 動的に設定
            responsiveThreshold: 600,
            verticalSpacing: 25,
            allowExtendedPlacement: true,
            maxExtensionWidth: 200,
            labelPadding: 6
        };
    }

    /**
     * インライン（線末）ラベルを追加
     * @param {d3.Selection} g - グラフのメインg要素
     * @param {Array} series - 系列データ
     * @param {Function} colorScale - 色スケール
     * @param {Object} context - コンテキスト（スケール、サイズ等）
     */
    addInlineLabels(g, series, colorScale, context) {
        if (!series || series.length <= 1) return;

        const { xScale, yScale, width, height, isYearData, xField, yField, isDualLayout = false } = context;

        // デュアルレイアウト（二個並び）用の設定
        if (isDualLayout) {
            this.addInlineLabelsDualLayout(g, series, colorScale, context);
            return;
        }

        // インライン設定のデフォルト値（D3-Labelerに最適化）
        const inlineConfig = {
            fontSize: '12px',
            fontFamily: 'var(--font-family-serif), "Shippori Mincho", serif',
            offsetX: 15, // 適度なオフセット
            offsetY: 0, // D3-Labelerが垂直位置を制御するため0に
            minDistance: 20, // D3-Labelerの重複検出で十分
            useLabeler: true,
            enableLeaderLines: true,
            leaderLineLength: 30, // 適度な長さ
            maxLabelWidth: width * 0.3, // 最大ラベル幅
            responsiveThreshold: 600, // この幅以下では従来の凡例にフォールバック
            verticalSpacing: 25, // 垂直方向の最小間隔（前処理用）
            allowExtendedPlacement: true, // チャート外への配置を許可
            maxExtensionWidth: 200, // チャート右端からの最大拡張幅を増加
            labelPadding: 6 // ラベル周りの余白
        };

        // 小画面の場合はフォールバック（外部の凡例メソッドを使用するため、ここではreturn）
        if (window.innerWidth < inlineConfig.responsiveThreshold) {
            return;
        }

        // 各系列の最後のデータポイントを取得
        const endPoints = series.map(seriesData => {
            const lastPoint = seriesData.values[seriesData.values.length - 1];
            if (!lastPoint) return null;

            const x = isYearData ? xScale(+lastPoint[xField]) : xScale(new Date(lastPoint[xField]));
            const y = yScale(+lastPoint[yField]);

            return {
                name: seriesData.name,
                x: x,
                y: y,
                color: colorScale(seriesData.name),
                originalX: x,
                originalY: y
            };
        }).filter(point => point !== null);

        if (endPoints.length === 0) {
            console.warn('LineChartLabelManager: No valid end points found for inline labels');
            return;
        }

        // ラベルの初期位置を計算
        const labels = endPoints.map(point => {
            const labelText = window.TextMeasurement
                ? window.TextMeasurement.truncateText(point.name, inlineConfig.maxLabelWidth, {
                    fontSize: inlineConfig.fontSize,
                    fontFamily: inlineConfig.fontFamily
                })
                : point.name;

            const labelWidth = window.TextMeasurement
                ? window.TextMeasurement.measureTextWidth(labelText, {
                    fontSize: inlineConfig.fontSize,
                    fontFamily: inlineConfig.fontFamily
                })
                : labelText.length * 8;

            const labelHeight = window.TextMeasurement
                ? window.TextMeasurement.measureTextHeight(labelText, {
                    fontSize: inlineConfig.fontSize,
                    fontFamily: inlineConfig.fontFamily
                })
                : 14;

            // より積極的な初期位置設定で重複を事前に避ける
            const baseX = point.x + inlineConfig.offsetX;
            const adjustedX = Math.min(baseX, width + (inlineConfig.maxExtensionWidth || 100) - labelWidth - 5);

            // D3-Labelerはy座標をラベルの下端として扱うことに注意
            return {
                x: adjustedX,
                y: point.y + labelHeight / 2, // ラベルの下端位置に調整
                width: labelWidth,
                height: labelHeight,
                text: labelText,
                color: point.color,
                anchorX: point.x,
                anchorY: point.y,
                originalName: point.name,
                centerY: point.y // 元の中心Y座標を保持
            };
        });

        // シンプルで確実な重複回避を使用
        this.applyDeterministicLabelPlacement(labels, width, height, inlineConfig);

        // ラベルグループを作成
        const labelGroup = g.append('g')
            .attr('class', 'inline-labels');

        // 引き出し線を描画（必要な場合）
        if (inlineConfig.enableLeaderLines) {
            this.addLeaderLines(labelGroup, labels);
        }

        // ラベルを描画
        this.renderInlineLabels(labelGroup, labels, inlineConfig);
    }

    /**
     * デュアルレイアウト（二個並び）専用のインラインラベル配置
     * @param {d3.Selection} g - グラフのメインg要素
     * @param {Array} series - 系列データ
     * @param {Function} colorScale - 色スケール
     * @param {Object} context - コンテキスト（スケール、サイズ等）
     */
    addInlineLabelsDualLayout(g, series, colorScale, context) {
        const { xScale, yScale, width, height, isYearData, xField, yField } = context;

        // デュアルレイアウト専用設定
        const dualConfig = {
            fontSize: '11px', // 若干小さくして見やすく
            fontFamily: 'var(--font-family-serif), "Shippori Mincho", serif',
            offsetX: 8, // 小さめのオフセット
            offsetY: 0,
            minDistance: 15, // 最小距離を短く
            enableLeaderLines: false, // 引き出し線は無効化
            maxLabelWidth: width * 0.4, // 最大ラベル幅を広げる
            verticalSpacing: 18, // 垂直間隔を狭く
            maxExtensionWidth: 50, // 拡張幅を小さく
            labelPadding: 4, // パディングを調整
            layoutStrategy: 'compact' // コンパクト配置
        };

        // 各系列の最後のデータポイントを取得
        const endPoints = series.map(seriesData => {
            const lastPoint = seriesData.values[seriesData.values.length - 1];
            if (!lastPoint) return null;

            const x = isYearData ? xScale(+lastPoint[xField]) : xScale(new Date(lastPoint[xField]));
            const y = yScale(+lastPoint[yField]);

            return {
                name: seriesData.name,
                x: x,
                y: y,
                color: colorScale(seriesData.name),
                originalX: x,
                originalY: y
            };
        }).filter(point => point !== null);

        if (endPoints.length === 0) {
            console.warn('LineChartLabelManager: No valid end points found for dual layout inline labels');
            return;
        }

        // ラベルの初期位置を計算
        const labels = endPoints.map(point => {
            const labelText = window.TextMeasurement
                ? window.TextMeasurement.truncateText(point.name, dualConfig.maxLabelWidth, {
                    fontSize: dualConfig.fontSize,
                    fontFamily: dualConfig.fontFamily
                })
                : point.name;

            const labelWidth = window.TextMeasurement
                ? window.TextMeasurement.measureTextWidth(labelText, {
                    fontSize: dualConfig.fontSize,
                    fontFamily: dualConfig.fontFamily
                })
                : labelText.length * 7; // 小さめのフォントサイズに合わせて調整

            const labelHeight = window.TextMeasurement
                ? window.TextMeasurement.measureTextHeight(labelText, {
                    fontSize: dualConfig.fontSize,
                    fontFamily: dualConfig.fontFamily
                })
                : 12;

            // デュアルレイアウト用のX座標計算（より近くに配置）
            const baseX = point.x + dualConfig.offsetX;
            const adjustedX = Math.min(baseX, width + dualConfig.maxExtensionWidth - labelWidth - 3);

            return {
                x: adjustedX,
                y: point.y, // デュアルレイアウトでは中心位置に配置
                width: labelWidth,
                height: labelHeight,
                text: labelText,
                color: point.color,
                anchorX: point.x,
                anchorY: point.y,
                originalName: point.name,
                centerY: point.y
            };
        });

        // デュアルレイアウト専用の配置アルゴリズム
        this.applyDualLayoutPlacement(labels, width, height, dualConfig);

        // ラベルグループを作成
        const labelGroup = g.append('g')
            .attr('class', 'inline-labels dual-layout');

        // デュアルレイアウト用のラベル描画
        this.renderDualLayoutLabels(labelGroup, labels, dualConfig);
    }

    /**
     * デュアルレイアウト専用の配置アルゴリズム
     * @param {Array} labels - ラベル配列
     * @param {number} width - グラフ幅
     * @param {number} height - グラフ高さ
     * @param {Object} config - デュアルレイアウト設定
     */
    applyDualLayoutPlacement(labels, width, height, config) {

        // Y座標でソート
        const sortedLabels = [...labels].sort((a, b) => a.anchorY - b.anchorY);

        // 全体的に上にオフセット（折れ線との重複を避けるため）
        const upwardOffset = -60; // 上に60px移動

        // 縦方向の重複を回避（シンプルで確実な方法）
        for (let i = 0; i < sortedLabels.length; i++) {
            const currentLabel = sortedLabels[i];

            if (i === 0) {
                // 最初のラベルは上方向オフセットを適用
                currentLabel.y = currentLabel.anchorY + upwardOffset;
            } else {
                const previousLabel = sortedLabels[i - 1];
                const requiredSpacing = config.verticalSpacing;

                // 前のラベルからの最小間隔を確保
                const minY = previousLabel.y + requiredSpacing;
                const preferredY = currentLabel.anchorY + upwardOffset;

                currentLabel.y = Math.max(minY, preferredY);
            }

            // チャート範囲内に収まるように調整
            currentLabel.y = Math.max(0, Math.min(currentLabel.y, height - 10));
        }

        // X座標は固定位置に配置（階段状にしない）
        const targetX = width + config.offsetX;
        labels.forEach(label => {
            label.x = Math.min(targetX, width + config.maxExtensionWidth - label.width - 5);
        });

    }

    /**
     * デュアルレイアウト用のラベル描画
     * @param {d3.Selection} labelGroup - ラベルグループ
     * @param {Array} labels - ラベル配列
     * @param {Object} config - デュアルレイアウト設定
     */
    renderDualLayoutLabels(labelGroup, labels, config) {
        const labelTexts = labelGroup.selectAll('.inline-label')
            .data(labels)
            .enter()
            .append('text')
            .attr('class', 'inline-label dual-layout-label')
            .attr('x', d => d.x)
            .attr('y', d => d.y)
            .attr('dy', '0.35em')
            .attr('font-size', config.fontSize)
            .attr('font-family', config.fontFamily)
            .attr('fill', d => d.color)
            .attr('text-anchor', 'start')
            .style('user-select', 'none')
            .style('pointer-events', 'none')
            .text(d => d.text);

        // 背景（オプション：視認性向上のため）
        const backgrounds = labelGroup.selectAll('.label-background')
            .data(labels)
            .enter()
            .insert('rect', '.inline-label')
            .attr('class', 'label-background dual-layout-bg')
            .attr('x', d => d.x - config.labelPadding)
            .attr('y', d => d.y - d.height / 2 - config.labelPadding)
            .attr('width', d => d.width + config.labelPadding * 2)
            .attr('height', d => d.height + config.labelPadding * 2)
            .attr('fill', 'rgba(255, 255, 255, 0.8)')
            .attr('stroke', 'rgba(0, 0, 0, 0.1)')
            .attr('stroke-width', 0.5)
            .attr('rx', 2)
            .style('pointer-events', 'none');
    }

    /**
     * アニメーション付きでインラインラベルを追加
     * @param {d3.Selection} g - グラフのメインg要素
     * @param {Array} series - 系列データ
     * @param {Function} colorScale - 色スケール
     * @param {Object} context - コンテキスト（スケール、サイズ等）
     */
    addInlineLabelsWithAnimation(g, series, colorScale, context) {
        // まず通常のインラインラベル追加処理を実行
        this.addInlineLabels(g, series, colorScale, context);

        // アニメーションを適用
        const labelGroup = g.select('.inline-labels');
        if (labelGroup.empty()) return;

        // ラベルテキストのエントリーアニメーション
        labelGroup.selectAll('.inline-label')
            .style('opacity', 0)
            .style('transform', 'translateX(-15px)')
            .transition()
            .duration(600)
            .delay((d, i) => i * 150) // 各ラベルを順次表示
            .ease(d3.easeBackOut.overshoot(1.2))
            .style('opacity', 1)
            .style('transform', 'translateX(0px)');

        // 背景の段階的表示
        labelGroup.selectAll('rect')
            .style('opacity', 0)
            .transition()
            .duration(400)
            .delay((d, i) => i * 150 + 200) // テキストより少し遅れて表示
            .ease(d3.easeQuadOut)
            .style('opacity', 0.9);

        // 引き出し線の段階的表示
        labelGroup.selectAll('.leader-line')
            .style('opacity', 0)
            .style('stroke-dasharray', '0,100')
            .transition()
            .duration(800)
            .delay((d, i) => i * 150 + 300)
            .ease(d3.easeQuadInOut)
            .style('opacity', 0.7)
            .style('stroke-dasharray', '2,2');

    }

    /**
     * D3-Labelerを使用してラベル位置を最適化
     * @param {Array} labels - ラベル配列
     * @param {number} width - グラフ幅
     * @param {number} height - グラフ高さ
     * @param {Object} config - インライン設定
     */
    optimizeLabelPositions(labels, width, height, config) {
        try {
            // D3-Labelerの存在確認
            if (!window.d3 || !window.d3.labeler) {
                console.error('LineChartLabelManager: D3-Labeler is not loaded!');
                this.applySimpleCollisionAvoidance(labels, config);
                return;
            }

            // アンカーポイント（線の終点）
            const anchors = labels.map(label => ({
                x: label.anchorX,
                y: label.anchorY,
                r: 5 // 適度な半径
            }));

            // ラベルの初期配置を改善：重複を事前に避ける
            this.preProcessLabelPositions(labels, config);

            // デバッグ：初期位置を記録
            const beforePositions = labels.map(label => ({
                text: label.text,
                x: label.x,
                y: label.y
            }));
            beforePositions.forEach((pos, i) => {
            });

            // D3-Labelerを実行（座標系を正しく設定）
            const labeler = d3.labeler()
                .label(labels)
                .anchor(anchors)
                .width(width + 150) // チャート幅を右に拡張
                .height(height + 50) // 高さも少し拡張
                .start(1000); // イテレーション数


            // デバッグ：最適化後の位置を確認
            labels.forEach((label, i) => {
                const before = beforePositions[i];
                const moved = Math.abs(label.x - before.x) > 1 || Math.abs(label.y - before.y) > 1;
            });

            // 後処理：チャート範囲外に出たラベルを調整
            this.postProcessLabelPositions(labels, width, height, config);

        } catch (error) {
            console.error('LineChartLabelManager: D3-Labeler optimization failed:', error);
            console.error(error.stack);
            // フォールバックとして簡易重複回避を実行
            this.applySimpleCollisionAvoidance(labels, config);
        }
    }

    /**
     * ラベル位置の前処理：事前に重複しやすい配置を避ける
     * @param {Array} labels - ラベル配列
     * @param {Object} config - インライン設定
     */
    preProcessLabelPositions(labels, config) {
        // Y座標でソート（D3-Labelerのy座標は下端なので調整）
        const sortedLabels = [...labels].sort((a, b) => (a.y - a.height) - (b.y - b.height));

        // 初期配置を少し散らして、D3-Labelerの作業を助ける
        sortedLabels.forEach((label, index) => {
            // 軽微なランダム化で初期位置を微調整（D3-Labelerが最適化しやすくする）
            label.x += (Math.random() - 0.5) * 10;
            label.y += (Math.random() - 0.5) * 5;

            // 中心座標を更新
            label.centerY = label.y - label.height / 2;
        });
    }

    /**
     * ラベル位置の後処理：チャート範囲外のラベルを調整
     * @param {Array} labels - ラベル配列
     * @param {number} width - グラフ幅
     * @param {number} height - グラフ高さ
     * @param {Object} config - インライン設定
     */
    postProcessLabelPositions(labels, width, height, config) {
        labels.forEach(label => {
            // X座標の調整：拡張配置を考慮
            const maxExtension = config.allowExtendedPlacement
                ? (config.maxExtensionWidth || 120)
                : 50; // デフォルトの小さな拡張
            const maxX = width + maxExtension - label.width - 5;

            if (label.x > maxX) {
                label.x = maxX;
            }

            // 最小X位置の制限（チャート内の最低位置）
            const minX = Math.max(width * 0.7, width - 50); // チャート幅の70%位置または右端から50px
            if (label.x < minX) {
                label.x = minX;
            }

            // Y座標の調整：ラベルがチャートの上下端を超えないように
            const minY = label.height / 2 + 5;
            const maxY = height - label.height / 2 - 5;

            if (label.y < minY) {
                label.y = minY;
            } else if (label.y > maxY) {
                label.y = maxY;
            }
        });
    }

    /**
     * 確実で理解しやすい重複回避アルゴリズム
     * @param {Array} labels - ラベル配列
     * @param {number} width - チャート幅
     * @param {number} height - チャート高さ
     * @param {Object} config - インライン設定
     */
    applyDeterministicLabelPlacement(labels, width, height, config) {

        // アンカーY座標でソート（上から下へ）
        const sortedLabels = [...labels].sort((a, b) => a.anchorY - b.anchorY);

        // ラベル間の最小間隔
        const minSpacing = 20;
        const labelCount = sortedLabels.length;

        // 必要な総高さ
        const totalLabelHeight = sortedLabels.reduce((sum, label) => sum + label.height, 0);
        const totalSpacing = (labelCount - 1) * minSpacing;
        const requiredHeight = totalLabelHeight + totalSpacing;

        // チャート中央を基準にラベルを配置
        this.distributeLabelsCentered(sortedLabels, height, requiredHeight, minSpacing);

        // X座標を調整（より右寄りで統一された配置）
        this.adjustXPositionsImproved(sortedLabels, width, config);

        sortedLabels.forEach((label, i) => {
        });
    }

    /**
     * ラベルをチャート中央基準で配置
     */
    distributeLabelsCentered(labels, chartHeight, requiredHeight, minSpacing) {
        // チャート中央を基準点として計算
        const chartCenter = chartHeight / 2;

        // ラベル全体の高さの半分を中央から上下に配置
        const startY = chartCenter - requiredHeight / 2;

        // 上端・下端の制限
        const minY = Math.max(20, startY);
        const maxY = chartHeight - 20;
        const availableHeight = maxY - minY;

        // 実際の配置開始位置を調整
        let actualStartY = minY;
        if (requiredHeight <= availableHeight) {
            // 十分なスペースがある場合は中央寄せ
            actualStartY = chartCenter - requiredHeight / 2;
            actualStartY = Math.max(minY, actualStartY);
        }

        // ラベルを順次配置
        let currentY = actualStartY;
        labels.forEach((label, index) => {
            label.y = currentY + label.height / 2; // ラベル中心位置
            currentY += label.height + minSpacing;
        });

    }

    /**
     * X座標を改善された方法で調整（より右寄り、統一感のある配置）
     */
    adjustXPositionsImproved(labels, width, config) {
        // チャート右端からさらに右寄りの位置に配置（引き出し線と折れ線の重複を避ける）
        const baseX = width + 60; // チャート右端から60px右に移動
        const maxExtension = config.maxExtensionWidth || 200; // 拡張幅も増加

        labels.forEach((label, index) => {
            // 全て同じX位置に揃える（階段状ではなく垂直に整列）
            label.x = Math.min(baseX, width + maxExtension - label.width - 10);
        });

    }

    /**
     * ラベルを等間隔で配置（レガシー）
     */
    distributeLabelsEvenly(labels, minY, maxY, minSpacing) {
        let currentY = minY;

        labels.forEach((label, index) => {
            label.y = currentY + label.height / 2; // ラベル中心位置
            currentY += label.height + minSpacing;
        });
    }

    /**
     * ラベルを圧縮して配置（レガシー）
     */
    distributeLabelsCompressed(labels, minY, maxY) {
        const availableHeight = maxY - minY;
        const totalLabelHeight = labels.reduce((sum, label) => sum + label.height, 0);
        const spacingPerGap = Math.max(5, (availableHeight - totalLabelHeight) / (labels.length - 1));

        let currentY = minY;
        labels.forEach((label, index) => {
            label.y = currentY + label.height / 2; // ラベル中心位置
            currentY += label.height + spacingPerGap;
        });
    }

    /**
     * X座標を階段状に調整（レガシー）
     */
    adjustXPositions(labels, width, config) {
        const baseX = width * 0.85; // チャート右端から少し左
        const maxExtension = config.maxExtensionWidth || 100;
        const staggerStep = 15; // 階段の段差

        labels.forEach((label, index) => {
            // 階段状に配置（3段階のパターンを繰り返し）
            const staggerOffset = (index % 3) * staggerStep;
            label.x = Math.min(baseX + staggerOffset, width + maxExtension - label.width - 10);
        });
    }

    /**
     * 簡易的な重複回避アルゴリズム（フォールバック）
     * @param {Array} labels - ラベル配列
     * @param {Object} config - インライン設定
     */
    applySimpleCollisionAvoidance(labels, config) {

        // Y座標でソートして上から順に配置
        const sortedLabels = [...labels].sort((a, b) => a.anchorY - b.anchorY);

        for (let i = 0; i < sortedLabels.length; i++) {
            const currentLabel = sortedLabels[i];

            // 他のラベルとの重複をチェック
            for (let j = 0; j < i; j++) {
                const otherLabel = sortedLabels[j];

                if (this.isLabelsOverlapping(currentLabel, otherLabel, config.minDistance)) {
                    // 重複している場合は位置を調整
                    this.adjustLabelPosition(currentLabel, otherLabel, config);
                }
            }
        }

    }

    /**
     * 2つのラベルが重複しているかチェック
     * @param {Object} label1 - ラベル1
     * @param {Object} label2 - ラベル2
     * @param {number} minDistance - 最小距離
     * @returns {boolean} 重複しているかどうか
     */
    isLabelsOverlapping(label1, label2, minDistance) {
        // ラベルの境界ボックスを計算（パディングを含む）
        const padding = 5;
        const box1 = {
            left: label1.x - padding,
            right: label1.x + label1.width + padding,
            top: label1.y - label1.height / 2 - padding,
            bottom: label1.y + label1.height / 2 + padding
        };

        const box2 = {
            left: label2.x - padding,
            right: label2.x + label2.width + padding,
            top: label2.y - label2.height / 2 - padding,
            bottom: label2.y + label2.height / 2 + padding
        };

        // より厳格な重複チェック
        const horizontalOverlap = box1.right + minDistance > box2.left && box1.left < box2.right + minDistance;
        const verticalOverlap = box1.bottom + minDistance > box2.top && box1.top < box2.bottom + minDistance;

        return horizontalOverlap && verticalOverlap;
    }

    /**
     * ラベル位置を調整して重複を解消
     * @param {Object} currentLabel - 調整対象のラベル
     * @param {Object} otherLabel - 重複している他のラベル
     * @param {Object} config - インライン設定
     */
    adjustLabelPosition(currentLabel, otherLabel, config) {
        const dy = currentLabel.y - otherLabel.y;
        const requiredVerticalSpace = (currentLabel.height + otherLabel.height) / 2 + config.verticalSpacing;

        if (Math.abs(dy) < requiredVerticalSpace) {
            // 垂直方向に移動
            if (dy >= 0) {
                // currentLabelが下にある場合は、さらに下に移動
                currentLabel.y = otherLabel.y + requiredVerticalSpace;
            } else {
                // currentLabelが上にある場合は、さらに上に移動
                currentLabel.y = otherLabel.y - requiredVerticalSpace;
            }
        }

        // X方向の調整：引き出し線を長くして右に移動
        const dx = currentLabel.x - otherLabel.x;
        if (Math.abs(dx) < config.minDistance) {
            currentLabel.x = Math.max(currentLabel.x, otherLabel.x + config.minDistance + currentLabel.width);
        }
    }

    /**
     * 引き出し線を追加
     * @param {d3.Selection} labelGroup - ラベルグループ
     * @param {Array} labels - ラベル配列
     */
    addLeaderLines(labelGroup, labels) {
        const leaderLines = labelGroup.selectAll('.leader-line')
            .data(labels)
            .enter()
            .append('line')
            .attr('class', 'leader-line')
            .attr('x1', d => d.anchorX)
            .attr('y1', d => d.anchorY)
            .attr('x2', d => d.x)
            // 新しいアルゴリズムではyは既にラベルの中心位置
            .attr('y2', d => d.y)
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2')
            .attr('opacity', 0.7)
            .style('pointer-events', 'none');

        // 引き出し線が短い場合は非表示
        leaderLines.style('display', d => {
            const dx = d.x - d.anchorX;
            const dy = d.y - d.anchorY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 10 ? 'none' : 'block';
        });
    }

    /**
     * インラインラベルを描画
     * @param {d3.Selection} labelGroup - ラベルグループ
     * @param {Array} labels - ラベル配列
     * @param {Object} config - 設定
     */
    renderInlineLabels(labelGroup, labels, config) {
        const labelTexts = labelGroup.selectAll('.inline-label')
            .data(labels)
            .enter()
            .append('text')
            .attr('class', 'inline-label')
            .attr('x', d => d.x)
            // 新しいアルゴリズムではyは既にラベルの中心位置
            .attr('y', d => d.y)
            .attr('dy', '0.35em')
            .attr('font-size', config.fontSize)
            .attr('font-family', config.fontFamily)
            .attr('font-weight', 'bold')
            .attr('fill', d => d.color)
            .text(d => d.text)
            .style('pointer-events', 'none');

        // ラベルの背景を追加（可読性向上）
        labelTexts.each(function(d) {
            const textElement = d3.select(this);
            let bbox;

            try {
                bbox = this.getBBox();
            } catch (error) {
                // getBBoxが失敗した場合のフォールバック
                bbox = {
                    x: d.x - d.width / 2,
                    y: d.y - d.height / 2,
                    width: d.width,
                    height: d.height
                };
            }

            labelGroup.insert('rect', '.inline-label')
                .attr('x', bbox.x - 2)
                .attr('y', bbox.y - 2)
                .attr('width', bbox.width + 4)
                .attr('height', bbox.height + 4)
                .attr('fill', 'rgba(255, 255, 255, 0.9)')
                .attr('stroke', d.color)
                .attr('stroke-width', 0.5)
                .attr('rx', 2)
                .style('pointer-events', 'none');
        });

        // ツールチップを追加（省略されたテキストの場合）
        labelTexts.filter(d => d.text !== d.originalName)
            .append('title')
            .text(d => d.originalName);
    }
}

// グローバルスコープで利用可能にする
window.LineChartLabelManager = LineChartLabelManager;
