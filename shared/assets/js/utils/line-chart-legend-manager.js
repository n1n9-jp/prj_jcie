/**
 * LineChartLegendManager - 折れ線グラフの凡例管理を専門的に扱うクラス
 * 伝統的な凡例とコンパクト凡例の両方に対応
 */
class LineChartLegendManager {
    constructor() {
        // デフォルト設定
        this.defaultConfig = {
            position: 'right',
            orientation: 'vertical',
            itemWidth: 120,
            itemHeight: 20,
            totalWidth: 120
        };
    }

    /**
     * レジェンドを追加
     */
    addLegend(svg, series, colorScale, width, height) {
        if (!series || series.length <= 1) return;

        // ChartLayoutManagerを使用して最適な凡例レイアウトを計算
        let legendLayout;
        if (window.ChartLayoutManager) {
            const seriesNames = series.map(s => s.name);
            legendLayout = ChartLayoutManager.calculateLegendLayout(seriesNames, width, height);
        } else {
            // フォールバック：従来の固定レイアウト
            legendLayout = {
                show: true,
                position: 'right',
                orientation: 'vertical',
                itemWidth: 120,
                itemHeight: 20,
                totalWidth: 120
            };
        }

        // bottomポジションが問題を起こしている場合は強制的にrightに変更
        if (legendLayout.position === 'bottom') {
            legendLayout.position = 'right';
            legendLayout.orientation = 'vertical';
        }

        if (!legendLayout.show) return;

        // 凡例コンテナを作成
        const legend = svg.append('g')
            .attr('class', 'chart-legend');

        // 凡例位置を計算
        let legendX, legendY;
        if (legendLayout.position === 'bottom') {
            legendX = width / 2 - (legendLayout.itemWidth * series.length) / 2;
            // チャートエリア内の下部に配置（コンテナの外に出ないように）
            legendY = height - (legendLayout.itemHeight * series.length) - 10;
        } else {
            // 右側配置（デフォルト）
            legendX = Math.max(20, width - (legendLayout.totalWidth || legendLayout.itemWidth));
            legendY = 20;
        }


        legend.attr('transform', `translate(${legendX}, ${legendY})`);

        // 凡例アイテムを作成
        const legendItems = legend.selectAll('.legend-item')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'legend-item');

        // アイテムの配置
        if (legendLayout.orientation === 'horizontal') {
            legendItems.attr('transform', (d, i) => `translate(${i * legendLayout.itemWidth}, 0)`);
        } else {
            legendItems.attr('transform', (d, i) => `translate(0, ${i * legendLayout.itemHeight})`);
        }

        // 凡例アイコン（円）
        legendItems.append('circle')
            .attr('cx', 6)
            .attr('cy', 6)
            .attr('r', 5)
            .attr('fill', d => colorScale(d.name));

        // 凡例テキスト
        const legendTexts = legendItems.append('text')
            .attr('x', 16)
            .attr('y', 6)
            .attr('dy', '0.35em')
            .attr('font-size', '12px')
            .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333');

        // テキスト省略処理
        legendTexts.each(function(d) {
            const textElement = d3.select(this);
            const text = d.name;
            const maxWidth = legendLayout.itemWidth - 25; // アイコン分を除く

            // まず完全なテキストを設定
            textElement.text(text);

            // テキスト幅を安全に測定
            let textWidth;
            try {
                textWidth = this.getBBox().width;
            } catch (e) {
                // getBBoxが失敗した場合のフォールバック
                textWidth = text.length * 7;
            }

            if (textWidth > maxWidth) {
                // テキストを省略
                let shortenedText = text;
                if (text.length > 10) {
                    shortenedText = text.substring(0, 8) + '...';
                }
                textElement.text(shortenedText);

                // ツールチップで完全なテキストを表示
                textElement.append('title').text(text);
            }
        });
    }

    /**
     * コンパクトなレジェンドを追加
     */
    addCompactLegend(g, series, colorScale, width, height) {
        if (!series || series.length <= 1) return;

        // ChartLayoutManagerを使用して最適な凡例レイアウトを計算（コンパクト版）
        let legendLayout;
        if (window.ChartLayoutManager) {
            const seriesNames = series.map(s => s.name);
            legendLayout = ChartLayoutManager.calculateLegendLayout(seriesNames, width, height);
            // コンパクト版の調整：もう少し余裕を持たせる
            legendLayout.itemHeight = 16;
            legendLayout.itemWidth = Math.min(legendLayout.itemWidth, width * 0.4); // 0.3から0.4に拡大
        } else {
            // フォールバック：従来の固定レイアウト（幅を広げる）
            legendLayout = {
                show: true,
                position: 'right',
                orientation: 'vertical',
                itemWidth: 140, // 100から140に拡大
                itemHeight: 16,
                totalWidth: 140 // 100から140に拡大
            };
        }

        if (!legendLayout.show) return;

        // 凡例位置を計算（コンパクト版はより保守的に）
        const legendX = Math.max(10, width - legendLayout.totalWidth - 10);
        const legendY = 10;

        const legend = g.append('g')
            .attr('class', 'chart-legend compact-legend')
            .attr('transform', `translate(${legendX}, ${legendY})`);

        const legendItems = legend.selectAll('.legend-item')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * legendLayout.itemHeight})`);

        // コンパクトな凡例アイコン（小さな円）
        legendItems.append('circle')
            .attr('cx', 4)
            .attr('cy', 4)
            .attr('r', 3)
            .attr('fill', d => colorScale(d.name));

        // コンパクトな凡例テキスト
        const legendTexts = legendItems.append('text')
            .attr('x', 12)
            .attr('y', 4)
            .attr('dy', '0.35em')
            .attr('font-size', '10px')
            .attr('fill', window.AppDefaults?.colors?.text?.primary || '#333');

        // 改善されたテキスト省略処理
        legendTexts.each(function(d) {
            const textElement = d3.select(this);
            const text = d.name;
            const maxWidth = legendLayout.itemWidth - 16; // アイコン分を除く

            // まず完全なテキストを設定
            textElement.text(text);

            // テキスト幅を安全に測定
            let textWidth;
            try {
                textWidth = this.getBBox().width;
            } catch (e) {
                // getBBoxが失敗した場合のフォールバック（文字数ベース）
                textWidth = text.length * 6;
            }

            if (textWidth > maxWidth) {
                // 地域名の適切な省略戦略
                let shortenedText = text;

                // 地域名の場合は意味のある省略を行う
                if (text.includes('・')) {
                    // 「東部・南部アフリカ」→「東・南部アフリカ」のような省略
                    shortenedText = text.replace(/部・/g, '・');
                } else if (text.includes('（') && text.includes('）')) {
                    // 括弧内の詳細を除去 「中南米（ラテンアメリカ）」→「中南米」
                    shortenedText = text.replace(/（[^）]*）/g, '');
                }

                // まだ長い場合は文字数で調整
                if (shortenedText.length > 8) {
                    shortenedText = shortenedText.substring(0, 7) + '...';
                }

                textElement.text(shortenedText);

                // ツールチップで完全なテキストを表示
                textElement.append('title').text(text);
            }
        });
    }
}

// グローバルスコープで利用可能にする
window.LineChartLegendManager = LineChartLegendManager;
