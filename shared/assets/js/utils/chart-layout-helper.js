/**
 * ChartLayoutHelper - チャートレイアウトとマージン計算のユーティリティクラス
 * データに基づいた動的マージン計算、軸ラベルの最適化などを提供
 * DataHelperの必要機能を統合（2024年6月）
 */
class ChartLayoutHelper {
    
    /**
     * 型安全な数値変換（DataHelperより統合）
     * @param {*} value - 変換する値
     * @param {number} fallback - フォールバック値
     * @returns {number} 数値
     */
    static safeNumericConversion(value, fallback = 0) {
        // null, undefined の場合
        if (value == null) {
            return fallback;
        }

        // 既に数値の場合
        if (typeof value === 'number') {
            return isNaN(value) ? fallback : value;
        }

        // 文字列の場合の変換
        if (typeof value === 'string') {
            // 空文字列
            if (value.trim() === '') {
                return fallback;
            }

            // カンマ区切りの数値を処理
            const cleanValue = value.replace(/,/g, '');
            const numValue = parseFloat(cleanValue);
            return isNaN(numValue) ? fallback : numValue;
        }

        // その他の型
        const numValue = Number(value);
        return isNaN(numValue) ? fallback : numValue;
    }

    /**
     * 年データの判定（DataHelperより統合）
     * @param {Array} data - データ配列
     * @param {string} field - フィールド名
     * @returns {boolean} 年データかどうか
     */
    static isYearData(data, field) {
        if (!Array.isArray(data) || data.length === 0) {
            return false;
        }

        // サンプルを取得して年の範囲をチェック
        const sampleSize = Math.min(data.length, 10);
        const values = data.slice(0, sampleSize)
            .map(d => this.safeNumericConversion(d[field]))
            .filter(v => !isNaN(v));

        if (values.length === 0) {
            return false;
        }

        // 年の妥当な範囲（1900-2100）をチェック
        return values.every(v => v >= 1900 && v <= 2100 && Number.isInteger(v));
    }
    /**
     * データに基づいてマージンを動的に計算する
     * @param {Array} data - チャートデータ
     * @param {Object} config - チャート設定
     * @param {Object} options - 計算オプション
     * @returns {Object} 計算されたマージン
     */
    static calculateDynamicMargins(data, config, options = {}) {
        const {
            chartType = 'line',
            hasLegend = true,
            screenWidth = window.innerWidth,
            screenHeight = window.innerHeight,
            minMargins = { top: 20, right: 15, bottom: 30, left: 40 }
        } = options;

        // 基本マージンを取得
        const baseMargins = this.getBaseMargins(chartType);

        // データ分析
        const analysis = this.analyzeData(data, config);

        // 単位情報を分析
        const unitInfo = this.analyzeUnits(data, config);

        // 各方向のマージンを計算
        const margins = {
            top: this.calculateTopMargin(baseMargins.top, analysis, config),
            right: this.calculateRightMargin(baseMargins.right, analysis, hasLegend),
            bottom: this.calculateBottomMargin(baseMargins.bottom, analysis),
            left: this.calculateLeftMargin(baseMargins.left, analysis, unitInfo)
        };

        // レスポンシブ調整
        const responsiveMargins = this.applyResponsiveAdjustments(margins, screenWidth, screenHeight);

        // 最小マージンを適用
        return {
            top: Math.max(minMargins.top, responsiveMargins.top),
            right: Math.max(minMargins.right, responsiveMargins.right),
            bottom: Math.max(minMargins.bottom, responsiveMargins.bottom),
            left: Math.max(minMargins.left, responsiveMargins.left)
        };
    }

    /**
     * チャートタイプ別の基本マージンを取得
     * @param {string} chartType - チャートタイプ
     * @returns {Object} 基本マージン
     */
    static getBaseMargins(chartType) {
        const marginConfigs = {
            line: { top: 50, right: 40, bottom: 60, left: 80 },
            bar: { top: 50, right: 30, bottom: 70, left: 90 },
            pie: { top: 30, right: 30, bottom: 30, left: 30 },
            area: { top: 50, right: 40, bottom: 60, left: 80 },
            scatter: { top: 50, right: 40, bottom: 60, left: 80 }
        };

        return marginConfigs[chartType] || marginConfigs.line;
    }

    /**
     * データを分析してレイアウトに影響する要素を特定
     * @param {Array} data - チャートデータ
     * @param {Object} config - チャート設定
     * @returns {Object} 分析結果
     */
    static analyzeData(data, config) {
        if (!data || data.length === 0) {
            return {
                maxValue: 0,
                minValue: 0,
                maxDigits: 1,
                hasNegativeValues: false,
                hasDecimalValues: false,
                xRange: 0,
                seriesNames: [],
                maxSeriesNameLength: 0,
                title: '',
                titleLength: 0
            };
        }

        const { xField = 'year', yField = 'value', seriesField = 'series' } = config;
        
        // Y軸の値を収集
        const yValues = data.map(d => this.safeNumericConversion(d[yField])).filter(v => !isNaN(v));
        const maxValue = Math.max(...yValues, 0);
        const minValue = Math.min(...yValues, 0);

        // X軸の値を収集
        const xValues = data.map(d => this.safeNumericConversion(d[xField])).filter(v => !isNaN(v));
        const xRange = xValues.length > 0 ? Math.max(...xValues) - Math.min(...xValues) : 0;

        // 系列名を収集
        const seriesNames = [...new Set(data.map(d => d[seriesField]).filter(Boolean))];
        const maxSeriesNameLength = Math.max(...seriesNames.map(name => (name || '').length), 0);

        // 数値の特性を分析
        const maxDigits = Math.max(
            Math.abs(maxValue).toString().replace('.', '').length,
            Math.abs(minValue).toString().replace('.', '').length,
            1
        );

        const hasNegativeValues = minValue < 0;
        const hasDecimalValues = yValues.some(v => v % 1 !== 0);

        return {
            maxValue,
            minValue,
            maxDigits,
            hasNegativeValues,
            hasDecimalValues,
            xRange,
            seriesNames,
            maxSeriesNameLength,
            title: config.title || '',
            titleLength: (config.title || '').length
        };
    }

    /**
     * 上マージンを計算（タイトル用）
     * @param {number} baseTop - 基本上マージン
     * @param {Object} analysis - データ分析結果
     * @param {Object} config - チャート設定
     * @returns {number} 計算された上マージン
     */
    static calculateTopMargin(baseTop, analysis, config) {
        let margin = baseTop;

        // タイトルの長さに基づく調整
        if (analysis.titleLength > 30) {
            margin += 20; // 長いタイトルの場合
        } else if (analysis.titleLength > 15) {
            margin += 10; // 中程度のタイトルの場合
        }

        // サブタイトルがある場合
        if (config.subtitle) {
            margin += 25;
        }

        return margin;
    }

    /**
     * 右マージンを計算（凡例用）
     * @param {number} baseRight - 基本右マージン
     * @param {Object} analysis - データ分析結果
     * @param {boolean} hasLegend - 凡例の有無
     * @returns {number} 計算された右マージン
     */
    static calculateRightMargin(baseRight, analysis, hasLegend) {
        if (!hasLegend || analysis.seriesNames.length <= 1) {
            return baseRight;
        }

        // 系列名の長さに基づく計算
        const maxLength = analysis.maxSeriesNameLength;
        const estimatedWidth = maxLength * 8 + 40; // 文字幅8px + アイコン・余白40px

        return Math.max(baseRight, estimatedWidth);
    }

    /**
     * 下マージンを計算（X軸ラベル用）
     * @param {number} baseBottom - 基本下マージン
     * @param {Object} analysis - データ分析結果
     * @returns {number} 計算された下マージン
     */
    static calculateBottomMargin(baseBottom, analysis) {
        let margin = baseBottom;

        // X軸の範囲に基づく調整
        if (analysis.xRange > 30) {
            margin += 30; // 非常に長期間
        } else if (analysis.xRange > 20) {
            margin += 20; // 長期間
        } else if (analysis.xRange > 10) {
            margin += 10; // 中期間
        }

        return margin;
    }

    /**
     * 左マージンを計算（Y軸ラベル用）
     * @param {number} baseLeft - 基本左マージン
     * @param {Object} analysis - データ分析結果
     * @returns {number} 計算された左マージン
     */
    static calculateLeftMargin(baseLeft, analysis, unitInfo = null) {
        let margin = baseLeft;

        // 数値の桁数に基づく計算
        const { maxValue, minValue, hasNegativeValues } = analysis;
        
        // 最大値の桁数を計算
        const maxAbsValue = Math.max(Math.abs(maxValue), Math.abs(minValue));
        
        // 実際のY軸フォーマッターと同じ形式を使用
        let formattedMax;
        if (unitInfo && unitInfo.yAxis) {
            formattedMax = this.formatAxisWithUnits(maxAbsValue, unitInfo.yAxis);
        } else {
            formattedMax = this.formatAxisNumber(maxAbsValue);
        }
        
        // より保守的な文字幅計算（日本語も考慮）
        const estimatedWidth = formattedMax.length * 10; // 文字幅10px（日本語対応）

        // 負の値がある場合はマイナス記号分を追加
        const negativeAdjustment = hasNegativeValues ? 15 : 0;

        // Y軸ラベル（単位）の幅も考慮
        const axisLabelWidth = 40;

        // より安全なマージン計算
        const calculatedMargin = estimatedWidth + negativeAdjustment + axisLabelWidth;
        
        return Math.max(margin, calculatedMargin);
    }

    /**
     * レスポンシブ調整を適用
     * @param {Object} margins - 基本マージン
     * @param {number} screenWidth - 画面幅
     * @param {number} screenHeight - 画面高さ
     * @returns {Object} 調整されたマージン
     */
    static applyResponsiveAdjustments(margins, screenWidth, screenHeight) {
        // 小画面での調整
        if (screenWidth < 600) {
            return {
                top: Math.max(30, margins.top * 0.8),
                right: Math.max(20, margins.right * 0.7),
                bottom: Math.max(40, margins.bottom * 0.9),
                left: Math.max(40, margins.left * 0.8)
            };
        }

        // 中画面での調整
        if (screenWidth < 900) {
            return {
                top: Math.max(35, margins.top * 0.9),
                right: Math.max(25, margins.right * 0.85),
                bottom: Math.max(45, margins.bottom * 0.95),
                left: Math.max(50, margins.left * 0.9)
            };
        }

        // 大画面ではそのまま
        return margins;
    }

    /**
     * 軸の数値をフォーマットする
     * @param {number} value - 数値
     * @param {Object} options - フォーマットオプション
     * @returns {string} フォーマットされた文字列
     */
    static formatAxisNumber(value, options = {}) {
        const {
            useShortFormat = true,
            decimalPlaces = 1,
            locale = 'ja-JP'
        } = options;

        if (value === 0) return '0';

        // 短縮形式を使用する場合
        if (useShortFormat) {
            if (Math.abs(value) >= 1e9) {
                return (value / 1e9).toFixed(decimalPlaces) + 'B';
            }
            if (Math.abs(value) >= 1e6) {
                return (value / 1e6).toFixed(decimalPlaces) + 'M';
            }
            if (Math.abs(value) >= 1e3) {
                return (value / 1e3).toFixed(decimalPlaces) + 'K';
            }
        }

        // 通常のフォーマット
        if (value % 1 === 0) {
            // 整数の場合
            return value.toLocaleString(locale);
        } else {
            // 小数の場合
            return value.toLocaleString(locale, {
                minimumFractionDigits: 0,
                maximumFractionDigits: decimalPlaces
            });
        }
    }

    /**
     * データに基づいて単位情報を分析・推測する
     * @param {Array} data - チャートデータ
     * @param {Object} config - チャート設定
     * @returns {Object} 単位情報
     */
    static analyzeUnits(data, config) {
        const { xField = 'year', yField = 'value' } = config;
        
        // 設定で明示的に単位が指定されている場合はそれを使用
        if (config.units) {
            return config.units;
        }

        // データから単位を推測
        const yValues = data.map(d => this.safeNumericConversion(d[yField])).filter(v => !isNaN(v));
        const xValues = data.map(d => this.safeNumericConversion(d[xField])).filter(v => !isNaN(v));
        
        const maxY = Math.max(...yValues, 0);
        const minY = Math.min(...yValues, 0);
        const maxX = Math.max(...xValues, 0);
        const minX = Math.min(...xValues, 0);

        // X軸の単位判定（年度データの場合）
        const isYearData = this.isYearData(data, xField);
        const xAxisUnit = {
            label: isYearData ? '年' : '数値',
            suffix: '',
            format: isYearData ? 'year' : 'number'
        };

        // Y軸の単位判定
        let yAxisUnit = {
            label: '',
            suffix: '',
            format: 'number',
            scale: 'auto'
        };

        // データファイル名から単位を推測
        const dataFile = config.dataFile || '';
        
        if (dataFile.includes('資金') || dataFile.includes('fund')) {
            // 資金データ
            if (maxY >= 1e9) {
                yAxisUnit = {
                    label: '資金額（億米ドル）',
                    suffix: '',
                    format: 'currency',
                    scale: 'billion',
                    unit: 'USD'
                };
            } else if (maxY >= 1e6) {
                yAxisUnit = {
                    label: '資金額（百万米ドル）',
                    suffix: '',
                    format: 'currency',
                    scale: 'million',
                    unit: 'USD'
                };
            }
        } else if (dataFile.includes('母子感染') || dataFile.includes('treatment') || 
                   dataFile.includes('therapy') || dataFile.includes('割合') ||
                   dataFile.includes('ratio') || (maxY <= 100 && minY >= 0)) {
            // パーセンテージデータ
            yAxisUnit = {
                label: '割合（%）',
                suffix: '%',
                format: 'percent',
                scale: 'none'
            };
        } else if (dataFile.includes('infections') || dataFile.includes('deaths') || 
                   dataFile.includes('感染') || dataFile.includes('死') ||
                   dataFile.includes('PrEP') || dataFile.includes('new_') ||
                   dataFile.includes('trend_') || dataFile.includes('normalized')) {
            // 人数データ
            if (maxY >= 1e6) {
                yAxisUnit = {
                    label: '人数（百万人）',
                    suffix: '',
                    format: 'people',
                    scale: 'million',
                    unit: 'people'
                };
            } else if (maxY >= 1e3) {
                yAxisUnit = {
                    label: '人数（千人）',
                    suffix: '',
                    format: 'people',
                    scale: 'thousand',
                    unit: 'people'
                };
            } else {
                yAxisUnit = {
                    label: '人数',
                    suffix: '人',
                    format: 'people',
                    scale: 'none',
                    unit: 'people'
                };
            }
        } else {
            // デフォルトの場合、値の範囲に基づいて単位を推測
            if (maxY >= 1e9) {
                yAxisUnit = {
                    label: '数値（十億）',
                    suffix: '',
                    format: 'number',
                    scale: 'billion',
                    unit: 'number'
                };
            } else if (maxY >= 1e6) {
                yAxisUnit = {
                    label: '数値（百万）',
                    suffix: '',
                    format: 'number',
                    scale: 'million',
                    unit: 'number'
                };
            } else if (maxY >= 1e3) {
                yAxisUnit = {
                    label: '数値（千）',
                    suffix: '',
                    format: 'number',
                    scale: 'thousand',
                    unit: 'number'
                };
            } else {
                yAxisUnit = {
                    label: '数値',
                    suffix: '',
                    format: 'number',
                    scale: 'none',
                    unit: 'number'
                };
            }
        }

        const result = {
            xAxis: xAxisUnit,
            yAxis: yAxisUnit
        };
        
        // デバッグ用ログ
        
        return result;
    }

    /**
     * 単位情報を含めて軸の数値をフォーマットする
     * @param {number} value - 数値
     * @param {Object} unitConfig - 単位設定
     * @param {Object} options - フォーマットオプション
     * @returns {string} フォーマットされた文字列
     */
    static formatAxisWithUnits(value, unitConfig = {}, options = {}) {
        const { format, scale, suffix, unit } = unitConfig;
        const { locale = 'ja-JP', decimalPlaces = 1 } = options;

        if (value === 0) return '0';

        let formattedValue = value;

        // スケール変換
        switch(scale) {
            case 'billion':
                formattedValue = value / 1e9;
                break;
            case 'million':
                formattedValue = value / 1e6;
                break;
            case 'thousand':
                formattedValue = value / 1e3;
                break;
            case 'none':
            case 'auto':
            default:
                formattedValue = value;
                break;
        }

        // フォーマットタイプに応じた処理
        let formatted;
        switch(format) {
            case 'percent':
                formatted = Math.round(formattedValue * 10) / 10; // 小数点1桁で四捨五入
                return `${formatted}%`;
                
            case 'currency':
                if (formattedValue >= 1) {
                    formatted = Math.round(formattedValue * 10) / 10;
                } else {
                    formatted = Math.round(formattedValue * 100) / 100;
                }
                return formatted.toLocaleString(locale);
                
            case 'people':
                formatted = Math.round(formattedValue * 10) / 10;
                return formatted.toLocaleString(locale);
                
            case 'year':
                return Math.round(formattedValue).toString();
                
            case 'number':
            default:
                if (formattedValue >= 1) {
                    formatted = Math.round(formattedValue * 10) / 10;
                } else {
                    formatted = Math.round(formattedValue * 100) / 100;
                }
                formatted = formatted.toLocaleString(locale);
                break;
        }

        // サフィックス追加
        return suffix ? `${formatted}${suffix}` : formatted;
    }

    /**
     * 軸ラベルを統一的に追加する（カスタムラベル優先、デフォルト単位ラベルフォールバック）
     * @param {d3.Selection} g - グループ要素
     * @param {Object} data - チャートデータ
     * @param {Object} config - チャート設定
     * @param {number} width - チャート幅
     * @param {number} height - チャート高さ
     * @param {Object} options - オプション
     */
    static addAxisLabels(g, data, config, width, height, options = {}) {
        const {
            xAxisLabelOffset = 35,
            yAxisLabelOffset = -40,
            labelFontSize = '12px',
            labelColor = '#666'
        } = options;

        // 既存の軸ラベルを削除
        g.selectAll('.axis-label').remove();

        // X軸ラベルの決定（カスタム優先、デフォルト単位フォールバック）
        let xAxisLabel = null;
        if (config.xAxisLabel) {
            xAxisLabel = config.xAxisLabel;
        } else {
            // デフォルト単位ラベルを生成
            const unitInfo = this.analyzeUnits(data, config);
            if (unitInfo.xAxis && unitInfo.xAxis.label) {
                xAxisLabel = unitInfo.xAxis.label;
            }
        }

        // Y軸ラベルの決定（カスタム優先、デフォルト単位フォールバック）
        let yAxisLabel = null;
        if (config.yAxisLabel) {
            yAxisLabel = config.yAxisLabel;
        } else {
            // デフォルト単位ラベルを生成
            const unitInfo = this.analyzeUnits(data, config);
            if (unitInfo.yAxis && unitInfo.yAxis.label) {
                yAxisLabel = unitInfo.yAxis.label;
            }
        }

        // X軸ラベルを追加
        if (xAxisLabel) {
            g.append('text')
                .attr('class', 'axis-label x-axis-label')
                .attr('x', width / 2)
                .attr('y', height + xAxisLabelOffset)
                .attr('text-anchor', 'middle')
                .attr('font-size', labelFontSize)
                .attr('fill', labelColor)
                .text(xAxisLabel);
        }

        // Y軸ラベルを追加
        if (yAxisLabel) {
            g.append('text')
                .attr('class', 'axis-label y-axis-label')
                .attr('transform', 'rotate(-90)')
                .attr('x', -height / 2)
                .attr('y', yAxisLabelOffset)
                .attr('text-anchor', 'middle')
                .attr('font-size', labelFontSize)
                .attr('fill', labelColor)
                .text(yAxisLabel);
        }
    }

    /**
     * 多言語対応の単位定義を取得
     * @param {string} locale - ロケール
     * @returns {Object} 単位定義
     */
    static getUnitDefinitions(locale = 'ja') {
        const definitions = {
            ja: {
                people: '人',
                thousand_people: '千人',
                million_people: '百万人',
                percent: '%',
                year: '年',
                usd: '米ドル',
                million_usd: '百万米ドル',
                billion_usd: '億米ドル',
                ratio: '割合',
                count: '数',
                amount: '額'
            },
            en: {
                people: 'people',
                thousand_people: 'K people',
                million_people: 'M people',
                percent: '%',
                year: 'year',
                usd: 'USD',
                million_usd: 'M USD',
                billion_usd: 'B USD',
                ratio: 'ratio',
                count: 'count',
                amount: 'amount'
            }
        };

        return definitions[locale] || definitions.ja;
    }

    /**
     * 軸ラベルが重複しないような間隔を計算
     * @param {Array} values - 軸の値配列
     * @param {number} availableSpace - 利用可能な空間（ピクセル）
     * @param {number} labelWidth - 1つのラベルの推定幅
     * @returns {number} ラベル間隔（値の個数単位）
     */
    static calculateOptimalLabelInterval(values, availableSpace, labelWidth = 50) {
        if (values.length === 0) return 1;

        const maxLabels = Math.floor(availableSpace / labelWidth);
        const interval = Math.ceil(values.length / maxLabels);

        return Math.max(1, interval);
    }

    /**
     * 凡例の最適な位置を計算
     * @param {Array} seriesNames - 系列名配列
     * @param {number} chartWidth - チャート幅
     * @param {number} chartHeight - チャート高さ
     * @returns {Object} 凡例の位置とサイズ情報
     */
    static calculateLegendLayout(seriesNames, chartWidth, chartHeight) {
        if (!seriesNames || seriesNames.length <= 1) {
            return { show: false };
        }

        // 実際のテキスト幅を測定して、より正確な幅を計算
        const maxTextWidth = Math.max(...seriesNames.map(name => 
            this.measureTextWidth(name, '12px Arial')
        ));
        const estimatedItemWidth = maxTextWidth + 40; // 実測テキスト幅 + アイコン + 余白
        const itemHeight = 20;


        // 横置きが可能かチェック
        const totalHorizontalWidth = seriesNames.length * estimatedItemWidth;
        
        if (totalHorizontalWidth <= chartWidth * 0.8) {
            const layout = {
                show: true,
                position: 'bottom',
                orientation: 'horizontal',
                itemWidth: estimatedItemWidth,
                itemHeight: itemHeight,
                totalHeight: itemHeight + 20
            };
            return layout;
        }

        // 縦置きの場合
        const layout = {
            show: true,
            position: 'right',
            orientation: 'vertical',
            itemWidth: estimatedItemWidth,
            itemHeight: itemHeight,
            totalWidth: estimatedItemWidth + 20,
            totalHeight: seriesNames.length * itemHeight
        };
        return layout;
    }

    /**
     * チャートの内部サイズを最適化
     * @param {number} containerWidth - コンテナ幅
     * @param {number} containerHeight - コンテナ高さ
     * @param {Object} margins - マージン
     * @param {Object} legendLayout - 凡例レイアウト
     * @returns {Object} 最適化されたサイズ情報
     */
    static optimizeInnerSize(containerWidth, containerHeight, margins, legendLayout) {
        let innerWidth = containerWidth - margins.left - margins.right;
        let innerHeight = containerHeight - margins.top - margins.bottom;

        // 凡例の分を差し引く
        if (legendLayout.show) {
            if (legendLayout.position === 'right') {
                innerWidth -= legendLayout.totalWidth;
            } else if (legendLayout.position === 'bottom') {
                innerHeight -= legendLayout.totalHeight;
            }
        }

        // 最小サイズを保証
        innerWidth = Math.max(200, innerWidth);
        innerHeight = Math.max(150, innerHeight);

        return { innerWidth, innerHeight };
    }

    /**
     * テキストの実際の幅を測定
     * @param {string} text - 測定するテキスト
     * @param {string} font - フォント設定
     * @returns {number} テキスト幅（ピクセル）
     */
    static measureTextWidth(text, font = '12px Arial') {
        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
            this._context = this._canvas.getContext('2d');
        }

        this._context.font = font;
        return this._context.measureText(text).width;
    }

    /**
     * チャート全体のレイアウトを計算
     * @param {Object} config - チャート設定
     * @param {Array} data - チャートデータ
     * @param {number} containerWidth - コンテナ幅
     * @param {number} containerHeight - コンテナ高さ
     * @returns {Object} 完全なレイアウト情報
     */
    static calculateCompleteLayout(config, data, containerWidth, containerHeight) {
        // データ分析
        const analysis = this.analyzeData(data, config);

        // 動的マージン計算
        const margins = this.calculateDynamicMargins(data, config, {
            chartType: config.type || 'line',
            hasLegend: config.showLegend !== false && analysis.seriesNames.length > 1,
            screenWidth: containerWidth,
            screenHeight: containerHeight
        });

        // 凡例レイアウト計算
        const legendLayout = this.calculateLegendLayout(
            analysis.seriesNames,
            containerWidth,
            containerHeight
        );

        // 内部サイズ最適化
        const { innerWidth, innerHeight } = this.optimizeInnerSize(
            containerWidth,
            containerHeight,
            margins,
            legendLayout
        );

        return {
            margins,
            legendLayout,
            innerWidth,
            innerHeight,
            analysis,
            formatters: {
                xAxis: (value) => this.formatAxisNumber(value, { useShortFormat: false }),
                yAxis: (value) => this.formatAxisNumber(value, { useShortFormat: true })
            }
        };
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.ChartLayoutHelper = ChartLayoutHelper;