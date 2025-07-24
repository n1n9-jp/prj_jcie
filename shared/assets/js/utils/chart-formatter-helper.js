/**
 * チャートフォーマッターヘルパー
 * チャートの値をフォーマットするための共通ユーティリティ
 */
window.ChartFormatterHelper = class ChartFormatterHelper {
    /**
     * Y軸の値をフォーマット
     * @param {number} value - フォーマットする値
     * @param {Object} formatConfig - フォーマット設定
     * @returns {string} フォーマットされた文字列
     */
    static formatYAxisValue(value, formatConfig) {
        if (!formatConfig) {
            // デフォルトのD3フォーマット
            return d3.format('.2s')(value);
        }

        switch (formatConfig.type) {
            case 'percentage':
                return d3.format('.0%')(value);
            
            case 'thousands':
                // 日本語の単位を使用
                if (Math.abs(value) >= 1e8) {
                    return d3.format('.1f')(value / 1e8) + '億';
                } else if (Math.abs(value) >= 1e4) {
                    return d3.format('.0f')(value / 1e4) + '万';
                } else {
                    return d3.format(',')(value);
                }
            
            case 'millions':
                return d3.format('.1f')(value / 1e6) + 'M';
            
            case 'billions':
                return d3.format('.1f')(value / 1e9) + 'B';
            
            case 'japanese':
                return ChartFormatterHelper.formatJapaneseNumber(value, formatConfig);
            
            case 'raw':
                // 生の数値表示（SI接頭辞なし）
                const decimals = formatConfig.decimals || 0;
                return d3.format(`,${decimals}f`)(value);
            
            case 'custom':
                let customValue = value;
                if (formatConfig.divisor) {
                    customValue = value / formatConfig.divisor;
                }
                const format = formatConfig.format || '.0f';
                const suffix = formatConfig.suffix || '';
                return d3.format(format)(customValue) + suffix;
            
            case 'fixed':
                const precision = formatConfig.precision || 0;
                return d3.format(`.${precision}f`)(value);
            
            default:
                return d3.format('.2s')(value);
        }
    }
    
    /**
     * 日本語の単位（兆・億・万）で数値をフォーマット
     * @param {number} value - フォーマットする値
     * @param {Object} config - フォーマット設定
     * @returns {string} フォーマットされた文字列
     */
    static formatJapaneseNumber(value, config) {
        const units = config.units || {
            '兆': 1e12,
            '億': 1e8,
            '万': 1e4
        };
        
        const unitOrder = config.unitOrder || ['兆', '億', '万'];
        const precision = config.precision || 0;
        
        for (const unit of unitOrder) {
            const unitValue = units[unit];
            if (Math.abs(value) >= unitValue) {
                const formatted = (value / unitValue).toFixed(precision);
                // 小数点以下が0の場合は整数として表示
                const result = parseFloat(formatted);
                return result + unit;
            }
        }
        
        // どの単位にも該当しない場合
        return d3.format(',')(value);
    }
};