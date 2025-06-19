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
        }
        // D3のschemePairedを使用（12色のペアリング）
        this.pairedColors = [
            '#a6cee3', '#1f78b4', '#b2df8a', '#33a02c',
            '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00',
            '#cab2d6', '#6a3d9a', '#ffff99', '#b15928'
        ];
        
        // 地域名と色のマッピング（頻度順に配色）
        this.regionColorMap = {
            // 最頻出地域（明確で区別しやすい色）
            'アジア・太平洋地域': '#1f78b4',           // 青
            '東部・南部アフリカ': '#33a02c',           // 緑
            '西部・中部アフリカ': '#e31a1c',           // 赤
            
            // 頻出地域
            '中東・北アフリカ': '#ff7f00',             // オレンジ
            '東ヨーロッパ・中央アジア': '#6a3d9a',       // 紫
            '中南米（ラテンアメリカ）': '#fb9a99',        // 薄いピンク
            '西・中央ヨーロッパおよび北米': '#a6cee3',    // 薄い青
            'カリブ海地域': '#fdbf6f',                // 薄いオレンジ
            
            // 特別なカテゴリ（無彩色）
            '世界': '#808080',                        // グレー（合計値）
            '全世界': '#808080',                      // グレー（合計値の別表記）
            
            // 資金源（別の色系統）
            'Global Fund': '#2e8b57',                // シーグリーン
            'United States Bilateral': '#4682b4',   // スチールブルー
            'Other International': '#9370db',       // ミディアムパープル
            'Domestic Public Private': '#cd853f',   // ペルー
            
            // その他のカテゴリ
            '母子感染': '#ff69b4',                    // ホットピンク（特別なカテゴリ）
            'その他地域': '#d3d3d3'                   // ライトグレー
        };
        
        // 別名（ファイル間の表記揺れ）を標準名にマッピング
        this.regionAliases = {
            // エイリアス: 標準名
            '東・南部アフリカ': '東部・南部アフリカ',
            '東部および南部アフリカ': '東部・南部アフリカ',
            '西部および中央アフリカ': '西部・中部アフリカ',
            'アジア太平洋': 'アジア・太平洋地域',
            'ラテンアメリカ': '中南米（ラテンアメリカ）',
            '東欧・中央アジア': '東ヨーロッパ・中央アジア',
            '西欧・中欧・北アメリカ': '西・中央ヨーロッパおよび北米',
            'カリブ海沿岸': 'カリブ海地域',
            'カリブ海地域': 'カリブ海地域', // CSVファイルの表記
            '全世界': '世界'
        };
    }

    /**
     * 外部設定の利用可能性をチェック
     */
    checkConfigAvailability() {
        if (window.ConfigLoader && window.ConfigLoader.loaded) {
            this.configAvailable = true;
            console.log('ColorScheme: External config available');
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
            return window.ConfigLoader.getColor(colorPath) || fallback;
        }
        return fallback;
    }
    
    /**
     * 地域名に対応する色を取得
     * @param {string} regionName - 地域名
     * @returns {string} 色コード
     */
    getColorForRegion(regionName) {
        // まず標準名を取得（エイリアス解決）
        const standardName = this.getStandardRegionName(regionName);
        
        // 外部設定から色を取得を試行
        let color = this.getConfigColor(`regions.${standardName}`, null);
        
        // 外部設定になければマップから取得
        if (!color) {
            color = this.regionColorMap[standardName];
        }
        
        if (color) {
            return color;
        }
        
        // 未知の地域の場合はフォールバック色を使用
        console.warn(`Unknown region: ${regionName} (standard: ${standardName}). Using fallback color.`);
        return this.getFallbackColor(regionName);
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
            console.warn('No valid series names found in data, using fallback color');
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
        return this.getColorsForRegions(uniqueSeries);
    }
    
    /**
     * 地域名に対応する色を取得（単一エントリポイント）
     * @param {string} regionName - 地域名
     * @returns {string} 色コード
     */
    getRegionColor(regionName) {
        return this.getColorForRegion(regionName);
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
        console.log('=== ColorScheme Mappings ===');
        console.log('Standard Region Colors:');
        Object.entries(this.regionColorMap).forEach(([region, color]) => {
            console.log(`  ${region}: ${color}`);
        });
        
        console.log('\nRegion Aliases:');
        Object.entries(this.regionAliases).forEach(([alias, standard]) => {
            console.log(`  ${alias} → ${standard}`);
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
    getType: (regionName) => window.ColorScheme.getRegionType(regionName)
};