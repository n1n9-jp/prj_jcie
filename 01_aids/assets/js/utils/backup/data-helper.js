/**
 * DataHelper - データ処理とバリデーションのユーティリティクラス
 * データの検証、変換、フィルタリングなどの共通処理を提供
 */
class DataHelper {
    /**
     * データの存在チェックとバリデーション
     * @param {Array} data - 検証するデータ配列
     * @param {Array} requiredFields - 必須フィールドのリスト
     * @param {Object} options - バリデーションオプション
     * @returns {Object} 検証結果 {valid: boolean, error?: string, warnings?: Array}
     */
    static validateData(data, requiredFields = [], options = {}) {
        const {
            allowEmpty = false,
            minLength = 1,
            maxLength = Infinity,
            strictTypes = false
        } = options;

        // 基本的な存在チェック
        if (!data) {
            return { valid: false, error: 'Data is null or undefined' };
        }

        if (!Array.isArray(data)) {
            return { valid: false, error: 'Data must be an array' };
        }

        if (!allowEmpty && data.length === 0) {
            return { valid: false, error: 'Data array is empty' };
        }

        if (data.length < minLength) {
            return { valid: false, error: `Data array must have at least ${minLength} items` };
        }

        if (data.length > maxLength) {
            return { valid: false, error: `Data array must have at most ${maxLength} items` };
        }

        const warnings = [];

        // 必須フィールドの検証
        if (requiredFields.length > 0) {
            for (const field of requiredFields) {
                const missingCount = data.filter(item => 
                    !item || !item.hasOwnProperty(field) || 
                    (strictTypes && item[field] === null) ||
                    (strictTypes && item[field] === undefined)
                ).length;

                if (missingCount > 0) {
                    if (missingCount === data.length) {
                        return { valid: false, error: `All items missing required field: ${field}` };
                    } else {
                        warnings.push(`${missingCount} items missing field: ${field}`);
                    }
                }
            }
        }

        return { 
            valid: true, 
            warnings: warnings.length > 0 ? warnings : undefined 
        };
    }

    /**
     * 型安全な数値変換
     * @param {*} value - 変換する値
     * @param {number} fallback - 変換失敗時のフォールバック値
     * @param {Object} options - 変換オプション
     * @returns {number} 変換された数値
     */
    static safeNumericConversion(value, fallback = 0, options = {}) {
        const {
            allowInfinity = false,
            min = -Infinity,
            max = Infinity,
            precision = null
        } = options;

        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        let num;
        if (typeof value === 'number') {
            num = value;
        } else if (typeof value === 'string') {
            // カンマを除去して数値変換
            const cleanValue = value.replace(/,/g, '');
            num = +cleanValue;
        } else {
            num = +value;
        }

        // NaNチェック
        if (isNaN(num)) {
            return fallback;
        }

        // 無限大チェック
        if (!allowInfinity && !isFinite(num)) {
            return fallback;
        }

        // 範囲チェック
        if (num < min || num > max) {
            return fallback;
        }

        // 精度調整
        if (precision !== null && isFinite(num)) {
            num = parseFloat(num.toFixed(precision));
        }

        return num;
    }

    /**
     * データフィルタリング
     * @param {Array} data - フィルタリングするデータ
     * @param {Object} filters - フィルタ条件
     * @param {Object} options - フィルタリングオプション
     * @returns {Array} フィルタリングされたデータ
     */
    static applyFilters(data, filters, options = {}) {
        if (!data || !Array.isArray(data) || !filters || Object.keys(filters).length === 0) {
            return data || [];
        }

        const {
            mode = 'and', // 'and' または 'or'
            caseSensitive = false,
            exactMatch = true
        } = options;

        return data.filter(item => {
            const filterResults = Object.entries(filters).map(([key, filterValue]) => {
                if (!item.hasOwnProperty(key)) {
                    return false;
                }

                const itemValue = item[key];

                // 配列の場合（値が配列内に含まれるかチェック）
                if (Array.isArray(filterValue)) {
                    return filterValue.some(fv => this.compareValues(itemValue, fv, { caseSensitive, exactMatch }));
                }

                // 範囲フィルタの場合
                if (filterValue && typeof filterValue === 'object' && filterValue.type === 'range') {
                    const numValue = this.safeNumericConversion(itemValue);
                    const [min, max] = filterValue.range || [0, 0];
                    return numValue >= min && numValue <= max;
                }

                // 正規表現フィルタの場合
                if (filterValue instanceof RegExp) {
                    return filterValue.test(String(itemValue));
                }

                // 関数フィルタの場合
                if (typeof filterValue === 'function') {
                    return filterValue(itemValue, item);
                }

                // 通常の値比較
                return this.compareValues(itemValue, filterValue, { caseSensitive, exactMatch });
            });

            // AND/OR モードに応じて結果を統合
            return mode === 'and' ? 
                filterResults.every(result => result) : 
                filterResults.some(result => result);
        });
    }

    /**
     * 値の比較
     * @param {*} value1 - 比較値1
     * @param {*} value2 - 比較値2
     * @param {Object} options - 比較オプション
     * @returns {boolean} 比較結果
     */
    static compareValues(value1, value2, options = {}) {
        const { caseSensitive = false, exactMatch = true } = options;

        // null/undefined チェック
        if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
            return value1 === value2;
        }

        // 文字列の場合
        if (typeof value1 === 'string' && typeof value2 === 'string') {
            const str1 = caseSensitive ? value1 : value1.toLowerCase();
            const str2 = caseSensitive ? value2 : value2.toLowerCase();
            
            return exactMatch ? str1 === str2 : str1.includes(str2);
        }

        // 数値の場合
        if (typeof value1 === 'number' && typeof value2 === 'number') {
            return Math.abs(value1 - value2) < Number.EPSILON;
        }

        // その他の場合
        return value1 === value2;
    }

    /**
     * 日付データの判定
     * @param {Array} data - 判定するデータ
     * @param {string} field - 日付フィールド名
     * @param {Object} options - 判定オプション
     * @returns {boolean} 日付データかどうか
     */
    static isYearData(data, field, options = {}) {
        const {
            minYear = 1900,
            maxYear = 2100,
            threshold = 0.8 // 閾値（80%以上が年データなら年データと判定）
        } = options;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return false;
        }

        const validYearCount = data.filter(d => {
            if (!d || !d.hasOwnProperty(field)) {
                return false;
            }

            const value = this.safeNumericConversion(d[field]);
            return !isNaN(value) && value >= minYear && value <= maxYear && value % 1 === 0;
        }).length;

        return (validYearCount / data.length) >= threshold;
    }

    /**
     * データの重複削除
     * @param {Array} data - 重複削除するデータ
     * @param {string|Function} keySelector - キー選択関数またはフィールド名
     * @returns {Array} 重複削除されたデータ
     */
    static removeDuplicates(data, keySelector) {
        if (!data || !Array.isArray(data)) {
            return [];
        }

        const seen = new Set();
        const getKey = typeof keySelector === 'function' ? 
            keySelector : 
            (item) => item[keySelector];

        return data.filter(item => {
            const key = getKey(item);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * データのグループ化
     * @param {Array} data - グループ化するデータ
     * @param {string|Function} keySelector - グループキー選択関数またはフィールド名
     * @returns {Object} グループ化されたデータ
     */
    static groupBy(data, keySelector) {
        if (!data || !Array.isArray(data)) {
            return {};
        }

        const getKey = typeof keySelector === 'function' ? 
            keySelector : 
            (item) => item[keySelector];

        return data.reduce((groups, item) => {
            const key = getKey(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }

    /**
     * データのソート
     * @param {Array} data - ソートするデータ
     * @param {string|Function} keySelector - ソートキー選択関数またはフィールド名
     * @param {string} order - ソート順序 ('asc' | 'desc')
     * @returns {Array} ソートされたデータ
     */
    static sortData(data, keySelector, order = 'asc') {
        if (!data || !Array.isArray(data)) {
            return [];
        }

        const getKey = typeof keySelector === 'function' ? 
            keySelector : 
            (item) => item[keySelector];

        const sortedData = [...data].sort((a, b) => {
            const keyA = getKey(a);
            const keyB = getKey(b);

            if (keyA < keyB) return order === 'asc' ? -1 : 1;
            if (keyA > keyB) return order === 'asc' ? 1 : -1;
            return 0;
        });

        return sortedData;
    }

    /**
     * データの統計情報を計算
     * @param {Array} data - 計算するデータ
     * @param {string} field - 計算対象フィールド
     * @returns {Object} 統計情報
     */
    static calculateStats(data, field) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return {
                count: 0,
                sum: 0,
                mean: 0,
                min: 0,
                max: 0,
                median: 0,
                stdDev: 0
            };
        }

        const values = data
            .map(item => this.safeNumericConversion(item[field]))
            .filter(value => !isNaN(value));

        if (values.length === 0) {
            return {
                count: 0,
                sum: 0,
                mean: 0,
                min: 0,
                max: 0,
                median: 0,
                stdDev: 0
            };
        }

        const sum = values.reduce((acc, val) => acc + val, 0);
        const mean = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        // 中央値
        const sortedValues = [...values].sort((a, b) => a - b);
        const median = values.length % 2 === 0 ?
            (sortedValues[values.length / 2 - 1] + sortedValues[values.length / 2]) / 2 :
            sortedValues[Math.floor(values.length / 2)];

        // 標準偏差
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        return {
            count: values.length,
            sum,
            mean,
            min,
            max,
            median,
            stdDev
        };
    }

    /**
     * データの変換（系列データへの変換）
     * @param {Array} data - 変換するデータ
     * @param {Object} config - 変換設定
     * @returns {Array} 変換されたデータ
     */
    static transformToSeries(data, config) {
        const {
            xField = 'year',
            yField = 'value',
            seriesField = 'series',
            multiSeries = true
        } = config;

        if (!multiSeries) {
            // 単一系列の場合
            return [{
                name: config.seriesName || 'データ',
                values: data.map(d => ({
                    [xField]: this.safeNumericConversion(d[xField]),
                    [yField]: this.safeNumericConversion(d[yField]),
                    original: d
                }))
            }];
        }

        // 複数系列の場合
        const grouped = this.groupBy(data, seriesField);
        
        return Object.entries(grouped).map(([seriesName, seriesData]) => ({
            name: seriesName,
            values: seriesData.map(d => ({
                [xField]: this.safeNumericConversion(d[xField]),
                [yField]: this.safeNumericConversion(d[yField]),
                original: d
            }))
        }));
    }

    /**
     * 欠損値の処理
     * @param {Array} data - 処理するデータ
     * @param {string} field - 処理対象フィールド
     * @param {string} strategy - 処理戦略 ('remove', 'zero', 'mean', 'interpolate')
     * @returns {Array} 処理されたデータ
     */
    static handleMissingValues(data, field, strategy = 'remove') {
        if (!data || !Array.isArray(data)) {
            return [];
        }

        switch (strategy) {
            case 'remove':
                return data.filter(item => 
                    item.hasOwnProperty(field) && 
                    item[field] !== null && 
                    item[field] !== undefined && 
                    item[field] !== ''
                );

            case 'zero':
                return data.map(item => ({
                    ...item,
                    [field]: item[field] || 0
                }));

            case 'mean':
                const stats = this.calculateStats(data, field);
                return data.map(item => ({
                    ...item,
                    [field]: item[field] || stats.mean
                }));

            case 'interpolate':
                // 線形補間
                const result = [...data];
                for (let i = 0; i < result.length; i++) {
                    if (!result[i][field]) {
                        const prev = this.findPreviousValidValue(result, i, field);
                        const next = this.findNextValidValue(result, i, field);
                        
                        if (prev !== null && next !== null) {
                            const ratio = (i - prev.index) / (next.index - prev.index);
                            result[i][field] = prev.value + (next.value - prev.value) * ratio;
                        } else if (prev !== null) {
                            result[i][field] = prev.value;
                        } else if (next !== null) {
                            result[i][field] = next.value;
                        }
                    }
                }
                return result;

            default:
                return data;
        }
    }

    /**
     * 前の有効な値を検索
     * @private
     */
    static findPreviousValidValue(data, index, field) {
        for (let i = index - 1; i >= 0; i--) {
            const value = this.safeNumericConversion(data[i][field]);
            if (!isNaN(value)) {
                return { index: i, value };
            }
        }
        return null;
    }

    /**
     * 次の有効な値を検索
     * @private
     */
    static findNextValidValue(data, index, field) {
        for (let i = index + 1; i < data.length; i++) {
            const value = this.safeNumericConversion(data[i][field]);
            if (!isNaN(value)) {
                return { index: i, value };
            }
        }
        return null;
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.DataHelper = DataHelper;