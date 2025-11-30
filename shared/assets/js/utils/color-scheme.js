import { configLoader } from './config-loader.js';

/**
 * ColorScheme - コンテンツ全体で統一された色設定
 * 地域名に対して一貫した色を提供
 * 外部設定ファイル(theme.config.json)からの色設定を利用
 */
export class ColorScheme {
    constructor() {
        // 外部設定が利用可能かチェック
        this.configAvailable = false;
        this.checkConfigAvailability();

        // 設定チェックの定期実行（設定が後から読み込まれる場合に対応）
        if (!this.configAvailable) {
            setTimeout(() => this.checkConfigAvailability(), 1000);
            setTimeout(() => this.checkConfigAvailability(), 3000);
            setTimeout(() => this.checkConfigAvailability(), 5000);
        }
        // D3のschemePairedを使用（12色のペアリング）
        this.pairedColors = [
            '#a6cee3', '#1f78b4', '#b2df8a', '#33a02c',
            '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00',
            '#cab2d6', '#6a3d9a', '#ffff99', '#b15928'
        ];

        // 別名（ファイル間の表記揺れ）を標準名にマッピング
        this.regionAliases = {
            // 古いapp-constants.jsの表記 -> 新しい標準名
            'サハラ以南アフリカ': '東部・南部アフリカ',
            '東・南部アフリカ': '東部・南部アフリカ',
            '東部および南部アフリカ': '東部・南部アフリカ',
            '西部および中央アフリカ': '西部・中部アフリカ',
            '東欧・中央アジア': '東ヨーロッパ・中央アジア',
            'ラテンアメリカ・カリブ海地域': '中南米（ラテンアメリカ）',
            'ラテンアメリカ': '中南米（ラテンアメリカ）',

            // その他のエイリアス
            'アジア太平洋': 'アジア・太平洋地域',
            '西欧・中欧・北アメリカ': '西・中央ヨーロッパおよび北米',
            'カリブ海沿岸': 'カリブ海地域',

            // 同一表記確認（設定で確実性を保つ）
            'カリブ海地域': 'カリブ海地域',
            '全世界': '世界'
        };
    }

    /**
     * 外部設定の利用可能性をチェック
     */
    checkConfigAvailability() {
        if (configLoader && configLoader.loaded) {
            this.configAvailable = true;

            // テーマ設定が正しく読み込まれているかテスト
            const testColor = configLoader.getColor('regions.アジア・太平洋地域');
            if (!testColor) {
                console.warn('ColorScheme: Theme colors not loaded properly from theme.config.json');
            }
        }
    }

    /**
     * 外部設定から色を取得（フォールバック付き）
     * @param {string} colorPath - 色のパス（例: 'regions.アジア・太平洋地域'）
     * @param {string} fallback - フォールバック色
     * @returns {string} 色コード
     */
    getConfigColor(colorPath, fallback) {
        if (this.configAvailable) {
            const color = configLoader.getColor(colorPath);
            if (color) {
                return color;
            }
        }
        // 設定がまだロードされていない場合は再チェック
        if (!this.configAvailable && configLoader && configLoader.loaded) {
            this.configAvailable = true;
            const color = configLoader.getColor(colorPath);
            if (color) {
                return color;
            }
        }
        return fallback;
    }

    /**
     * 地域名に対応する色を取得
     * @param {string} regionName - 地域名
     * @returns {string} 色コード
     */
    getColorForRegion(regionName) {
        if (!regionName || regionName.trim() === '') {
            // 空の地域名の場合は警告を出さずにデフォルト色を返す（ダミーデータ対応）
            return this.getFallbackColor('Unknown');
        }

        // まず標準名を取得（エイリアス解決）
        const standardName = this.getStandardRegionName(regionName);

        // 外部設定から色を取得（theme.config.json）
        // パスは 'regions.地域名' となる
        const color = this.getConfigColor(`regions.${standardName}`, null);
        if (color) {
            return color;
        }

        // 未知の地域の場合はフォールバック色を使用
        // 設定読み込み前の場合もここに来る可能性があるが、ハッシュベースなので一貫性は保たれる
        if (this.configAvailable) {
            console.warn(`ColorScheme: Unknown region: ${regionName} (standard: ${standardName}). Using fallback color.`);
        }
        const fallbackColor = this.getFallbackColor(regionName);
        return fallbackColor;
    }

    /**
     * 地域名を標準名に変換
     * @param {string} regionName - 地域名
     * @returns {string} 標準地域名
     */
    getStandardRegionName(regionName) {
        return this.regionAliases[regionName] || regionName;
    }

    /**
     * 複数の地域名に対して色配列を生成
     * @param {Array<string>} regionNames - 地域名の配列
     * @returns {Array<string>} 色配列
     */
    getColorsForRegions(regionNames) {
        return regionNames.map(name => this.getColorForRegion(name));
    }

    /**
     * 未知の地域のフォールバック色を生成
     * @param {string} regionName - 地域名
     * @returns {string} 色コード
     */
    getFallbackColor(regionName) {
        // 「残り」「その他」「余り」などの場合は専用色を返す
        const remainderTerms = ['残り', 'その他', '余り', 'remainder', 'other', 'rest'];
        const normalizedName = regionName.toLowerCase().trim();

        if (remainderTerms.some(term => normalizedName.includes(term.toLowerCase()))) {
            return '#DDDDDD'; // 残り部分専用色
        }

        // 文字列ハッシュベースで一貫した色を生成
        let hash = 0;
        for (let i = 0; i < regionName.length; i++) {
            const char = regionName.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit整数に変換
        }

        // pairedColorsからハッシュベースで色を選択
        const index = Math.abs(hash) % this.pairedColors.length;
        return this.pairedColors[index];
    }

    /**
     * 地域タイプ（地理的地域、資金源など）を判定
     * @param {string} regionName - 地域名
     * @returns {string} 地域タイプ
     */
    getRegionType(regionName) {
        const standardName = this.getStandardRegionName(regionName);

        if (['Global Fund', 'United States Bilateral', 'Other International', 'Domestic Public Private'].includes(standardName)) {
            return 'funding';
        }

        if (['世界', '全世界'].includes(standardName)) {
            return 'total';
        }

        if (['母子感染'].includes(standardName)) {
            return 'category';
        }

        return 'geographic';
    }

    /**
     * チャート設定用の色配列を生成
     * データの系列名に基づいて適切な色配列を返す
     * @param {Array} data - チャートデータ
     * @param {Object} config - チャート設定
     * @returns {Array<string>} 色配列
     */
    generateColorsForChart(data, config) {

        // 系列フィールドを取得
        const seriesField = config.seriesField || 'series';

        // 単一系列の場合の処理
        if (config.multiSeries === false || config.seriesName) {
            const seriesName = config.seriesName || 'Data';
            return this.getColorsForRegions([seriesName]);
        }

        // データから一意の系列名を抽出
        const uniqueSeries = [...new Set(data.map(d => d[seriesField]))].filter(name => name !== undefined && name !== null);

        // データが空または系列名が取得できない場合のフォールバック
        if (uniqueSeries.length === 0) {
            console.warn('ColorScheme: No valid series names found in data, using fallback color');
            return [this.getFallbackColor('Unknown')];
        }

        // 系列順序を安定化（アルファベット順）
        uniqueSeries.sort((a, b) => {
            // 「世界」は常に最初
            if (this.getStandardRegionName(a) === '世界') return -1;
            if (this.getStandardRegionName(b) === '世界') return 1;

            // その他は標準名でソート
            const standardA = this.getStandardRegionName(a);
            const standardB = this.getStandardRegionName(b);
            return standardA.localeCompare(standardB, 'ja');
        });


        // 地域名に基づいて統一色配列を生成
        const colors = this.getColorsForRegions(uniqueSeries);
        return colors;
    }

    /**
     * 地域名に対応する色を取得（単一エントリポイント）
     * @param {string} regionName - 地域名
     * @returns {string} 色コード
     */
    getRegionColor(regionName) {
        const result = this.getColorForRegion(regionName);
        return result;
    }

    /**
     * 色を明るくする
     * @param {string} color - 元の色コード
     * @param {number} factor - 明度係数（0.1-0.9、デフォルト0.3）
     * @returns {string} 明るくした色コード
     */
    getLighterColor(color, factor = 0.3) {
        // HEXカラーをRGBに変換
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // 明度を上げる
        const lighterR = Math.min(255, Math.round(r + (255 - r) * factor));
        const lighterG = Math.min(255, Math.round(g + (255 - g) * factor));
        const lighterB = Math.min(255, Math.round(b + (255 - b) * factor));

        // HEXに変換して返す
        return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
    }

    /**
     * デバッグ用：全ての地域と色のマッピングを表示
     */
    logColorMappings() {
        if (this.configAvailable) {
            // configLoaderから全設定を取得するメソッドがあればそれを使うが、
            // 現状は個別に取得する形なので、既知のエイリアスなどを使ってテスト出力する
            console.log('ColorScheme: Loaded from theme.config.json');
        } else {
            console.warn('ColorScheme: Config not loaded yet');
        }
    }
}

// グローバルインスタンスを作成
export const colorScheme = new ColorScheme();