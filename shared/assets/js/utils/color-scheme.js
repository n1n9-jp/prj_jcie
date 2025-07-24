/**
 * ColorScheme - コンテンツ全体で統一された色設定
 * 地域名に対して一貫した色を提供
 * 外部設定ファイルからの色設定を利用
 */
class ColorScheme {
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
        
        // 地域名と色のマッピング（theme.config.jsonと完全一致）
        this.regionColorMap = {

            // エイズで使用されている地域名
            'アジア・太平洋地域': '#1f78b4',           // 青
            '東部・南部アフリカ': '#33a02c',           // 緑  
            '西部・中部アフリカ': '#e31a1c',           // 赤
            '中東・北アフリカ': '#ff7f00',             // オレンジ
            '東ヨーロッパ・中央アジア': '#6a3d9a',       // 紫
            '中南米（ラテンアメリカ）': '#fb9a99',        // 薄いピンク
            '西・中央ヨーロッパおよび北米': '#a6cee3',    // 薄い青
            'カリブ海地域': '#fdbf6f',                // 薄いオレンジ
            
            // 特別なカテゴリ（無彩色）
            '世界': '#808080',                        // グレー（合計値）
            '全世界': '#808080',                      // グレー（合計値の別表記）

            // マラリアで使用されている地域名
            'アフリカ': '#8b4513',          // 茶色（土の色、アフリカ大陸を想起）
            'アメリカ': '#2e8b57',          // 海緑色（南北アメリカ大陸）
            '東地中海': '#daa520',          // ゴールデンロッド（砂漠地域）
            '欧州': '#4169e1',              // ロイヤルブルー（EU旗の青）
            '東南アジア': '#ff6347',        // トマト色（熱帯地域）
            '西太平洋': '#20b2aa',          // ライトシーグリーン（太平洋）

            // 資金源（別の色系統）
            'Global Fund': '#2e8b57',                // シーグリーン
            'United States Bilateral': '#4682b4',   // スチールブルー
            'Other International': '#9370db',       // ミディアムパープル
            'Domestic Public Private': '#cd853f',   // ペルー
            
            // 結核対策予算の系列
            '国内予算': '#ff7f0e',                     // オレンジ
            '国際予算': '#2ca02c',                     // 緑
            
            // その他のカテゴリ
            '母子感染': '#ff69b4',                    // ホットピンク（特別なカテゴリ）
            'その他地域': '#d3d3d3',                   // ライトグレー
            'その他・特別地域': '#f0f0f0'               // 非常に薄いグレー（南極地域など）
        };
        
        // 別名（ファイル間の表記揺れ）を標準名にマッピング
        this.regionAliases = {
            // 古いapp-constants.jsの表記 -> 新しい標準名
            'サハラ以南アフリカ': '東部・南部アフリカ',
            '東・南部アフリカ': '東部・南部アフリカ',
            '東部および南部アフリカ': '東部・南部アフリカ',
            '西部および中央アフリカ': '西部・中部アフリカ',
            '東欧・中央アジア': '東ヨーロッパ・中央アジア',
            'ラテンアメリカ・カリブ海地域': '中南米（ラテンアメリカ）',
            
            // その他のエイリアス
            'アジア太平洋': 'アジア・太平洋地域',
            'ラテンアメリカ': '中南米（ラテンアメリカ）',
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
        if (window.ConfigLoader && window.ConfigLoader.loaded) {
            this.configAvailable = true;
            
            // テーマ設定が正しく読み込まれているかテスト
            const testColor = window.ConfigLoader.getColor('regions.アジア・太平洋地域');
            if (testColor) {
            } else {
                console.warn('ColorScheme: Theme colors not loaded properly');
            }
        } else {
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
            const color = window.ConfigLoader.getColor(colorPath);
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
        
        // まず内部マップから取得（確実に動作する）
        let color = this.regionColorMap[standardName];
        if (color) {
            return color;
        }
        
        // 外部設定から色を取得を試行（二次的）
        color = this.getConfigColor(`regions.${standardName}`, null);
        if (color) {
            return color;
        }
        
        // 未知の地域の場合はフォールバック色を使用
        console.warn(`ColorScheme: Unknown region: ${regionName} (standard: ${standardName}). Using fallback color.`);
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
        Object.entries(this.regionColorMap).forEach(([region, color]) => {
        });
        
        Object.entries(this.regionAliases).forEach(([alias, standard]) => {
        });
    }
}

// グローバルインスタンスを作成
window.ColorScheme = new ColorScheme();

// デバッグ用の関数をグローバルに追加
window.debugColorScheme = {
    getColor: (regionName) => window.ColorScheme.getColorForRegion(regionName),
    getColors: (regionNames) => window.ColorScheme.getColorsForRegions(regionNames),
    logMappings: () => window.ColorScheme.logColorMappings(),
    getType: (regionName) => window.ColorScheme.getRegionType(regionName),
    testRegions: () => {
        const testRegions = [
            'アジア・太平洋地域',
            '東部・南部アフリカ', 
            '西部・中部アフリカ',
            '中東・北アフリカ',
            '東ヨーロッパ・中央アジア',
            '中南米（ラテンアメリカ）',
            '西・中央ヨーロッパおよび北米',
            'カリブ海地域',
            '世界'
        ];
        testRegions.forEach(region => {
            const color = window.ColorScheme.getColorForRegion(region);
        });
        return testRegions.map(region => ({
            region,
            color: window.ColorScheme.getColorForRegion(region)
        }));
    }
};