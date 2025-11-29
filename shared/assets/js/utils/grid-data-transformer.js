import { ErrorHandler } from './error-handler.js';
import { colorScheme } from './color-scheme.js';
import { AppDefaults } from '../config/defaults.js';
import { LayoutConfig } from '../config/layout-config.js';

/**
 * GridDataTransformer - グリッドチャート用データ変換を専門的に扱うクラス
 * 複数のデータ形式をグリッドレイアウト用に自動変換・最適化
 */
export class GridDataTransformer {
    constructor() {
        // デフォルト設定
        this.defaultConfig = {
            maxColumns: 10,
            maxRows: 5
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
            console.error('GridDataTransformer: Error transforming data:', error);
            if (ErrorHandler) {
                ErrorHandler.handle(error, 'GridDataTransformer.transformToGridData', {
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
            // ColorSchemeから色を取得
            // let colorScheme = window.colorScheme; // Removed global usage

            const treatmentColor = colorScheme ?
                colorScheme.getRegionColor(region) :
                AppDefaults?.colors?.accent?.info || '#3b82f6';
            const untreatedColor = AppDefaults?.colors?.background?.light || '#e5e7eb';

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
        // let colorScheme = window.colorScheme; // Removed global usage

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
                        AppDefaults?.colors?.accent?.info || '#3b82f6';

                    // フィールドごとに色の調子を変える
                    const color = fieldIndex === 0 ? baseColor :
                        (colorScheme ? colorScheme.getDarkerColor(baseColor) : baseColor);

                    result.push({
                        region: label,
                        ageGroup: field, // 「感染者の割合」または「死亡者の割合」
                        percentage: value,
                        pieData: [
                            { label: '対象地域', value: value, color: color },
                            { label: 'その他地域', value: Math.max(0, 100 - value), color: AppDefaults?.colors?.background?.light || '#e5e7eb' }
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
                    AppDefaults?.colors?.accent?.info || '#3b82f6';

                result.push({
                    region: label,
                    ageGroup: config.title || '分布',
                    percentage: value,
                    pieData: [
                        { label: label, value: value, color: color },
                        { label: 'その他', value: Math.max(0, 100 - value), color: AppDefaults?.colors?.background?.light || '#e5e7eb' }
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
        if (LayoutConfig && typeof LayoutConfig.calculateOptimalGrid === 'function') {
            // コンテナ情報が必要な場合は、呼び出し元で設定を渡す
            return LayoutConfig.calculateOptimalGrid(itemCount, {
                maxColumns: config.maxColumns || 10,
                maxRows: config.maxRows || 5,
                aspectRatio: config.chartWidth / config.chartHeight || 1,
                containerAspectRatio: config.containerAspectRatio || 1
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
}
