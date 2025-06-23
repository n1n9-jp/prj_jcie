/**
 * Disease Configuration - 感染症別設定管理
 * 各感染症の固有設定とテーマを定義
 */
const DISEASE_CONFIG = {
    'aids': {
        id: 'aids',
        name: 'HIV/エイズとの闘い',
        nameEn: 'Fighting HIV/AIDS',
        subtitle: '～データで見る希望と課題～',
        color: {
            primary: '#ff6b6b',
            secondary: '#ff8e8e',
            accent: '#e85555'
        },
        navigation: {
            current: 'エイズ',
            others: [
                { name: '結核', path: '../02_tuberculosis/' },
                { name: 'マラリア', path: '../03_malariae/' }
            ]
        },
        paths: {
            base: '',  // 01_aids/からの相対パス
            config: 'config/',
            data: 'data/',
            assets: 'assets/',
            images: 'assets/images/'
        }
    },
    'tuberculosis': {
        id: 'tuberculosis',
        name: '結核との闘い',
        nameEn: 'Fighting Tuberculosis',
        subtitle: '～データで見る希望と課題～',
        color: {
            primary: '#4ecdc4',
            secondary: '#6fd4cc',
            accent: '#3bb8b0'
        },
        navigation: {
            current: '結核',
            others: [
                { name: 'エイズ', path: '../01_aids/' },
                { name: 'マラリア', path: '../03_malariae/' }
            ]
        },
        paths: {
            base: '',  // 02_tuberculosis/からの相対パス
            config: 'config/',
            data: 'data/',
            assets: 'assets/',
            images: 'assets/images/'
        }
    },
    'malariae': {
        id: 'malariae',
        name: 'マラリアとの闘い',
        nameEn: 'Fighting Malaria',
        subtitle: '～データで見る希望と課題～',
        color: {
            primary: '#45b7d1',
            secondary: '#67c4d7',
            accent: '#2a9bbf'
        },
        navigation: {
            current: 'マラリア',
            others: [
                { name: 'エイズ', path: '../01_aids/' },
                { name: '結核', path: '../02_tuberculosis/' }
            ]
        },
        paths: {
            base: '',  // 03_malariae/からの相対パス
            config: 'config/',
            data: 'data/',
            assets: 'assets/',
            images: 'assets/images/'
        }
    }
};

/**
 * DiseaseDetector - 現在の感染症タイプを検出・管理
 */
class DiseaseDetector {
    constructor() {
        this.currentDisease = null;
        this.config = null;
        this.basePath = '';
        this._detectDisease();
    }

    /**
     * 感染症タイプを検出
     * @private
     */
    _detectDisease() {
        // 1. window.DISEASE_TYPE が明示的に設定されている場合
        if (window.DISEASE_TYPE && DISEASE_CONFIG[window.DISEASE_TYPE]) {
            this.currentDisease = window.DISEASE_TYPE;
            this.config = DISEASE_CONFIG[window.DISEASE_TYPE];
            this.basePath = this.config.paths.base;
            return;
        }

        // 2. URLパスから感染症を検出
        const path = window.location.pathname;
        if (path.includes('/01_aids/')) {
            this.currentDisease = 'aids';
        } else if (path.includes('/02_tuberculosis/')) {
            this.currentDisease = 'tuberculosis';
        } else if (path.includes('/03_malariae/')) {
            this.currentDisease = 'malariae';
        } else {
            // デフォルトはエイズ
            this.currentDisease = 'aids';
        }

        this.config = DISEASE_CONFIG[this.currentDisease];
        this.basePath = this.config.paths.base;
    }

    /**
     * 現在の感染症タイプを取得
     * @returns {string} 感染症ID
     */
    getDiseaseType() {
        return this.currentDisease;
    }

    /**
     * 現在の感染症設定を取得
     * @returns {Object} 感染症設定
     */
    getDiseaseConfig() {
        return this.config;
    }

    /**
     * パスを感染症ベースに解決
     * @param {string} relativePath - 相対パス
     * @param {string} pathType - パスタイプ (config, data, assets, images)
     * @returns {string} 解決されたパス
     */
    resolvePath(relativePath, pathType = 'base') {
        const basePath = this.config.paths[pathType] || this.config.paths.base;
        return basePath + relativePath;
    }

    /**
     * 設定ファイルパスを解決
     * @param {string} configFile - 設定ファイル名
     * @returns {string} 解決されたパス
     */
    resolveConfigPath(configFile) {
        return this.resolvePath(configFile, 'config');
    }

    /**
     * データファイルパスを解決
     * @param {string} dataFile - データファイル名
     * @returns {string} 解決されたパス
     */
    resolveDataPath(dataFile) {
        return this.resolvePath(dataFile, 'data');
    }

    /**
     * アセットパスを解決
     * @param {string} assetFile - アセットファイル名
     * @param {string} subType - サブタイプ (images等)
     * @returns {string} 解決されたパス
     */
    resolveAssetPath(assetFile, subType = '') {
        if (subType && this.config.paths[subType]) {
            return this.resolvePath(assetFile, subType);
        }
        return this.resolvePath(assetFile, 'assets');
    }

    /**
     * 感染症カラーを取得
     * @param {string} type - カラータイプ (primary, secondary, accent)
     * @returns {string} カラーコード
     */
    getDiseaseColor(type = 'primary') {
        return this.config.color[type] || this.config.color.primary;
    }

    /**
     * ナビゲーション情報を取得
     * @returns {Object} ナビゲーション設定
     */
    getNavigationConfig() {
        return this.config.navigation;
    }

    /**
     * 感染症名を取得
     * @param {boolean} english - 英語名を取得するか
     * @returns {string} 感染症名
     */
    getDiseaseName(english = false) {
        return english ? this.config.nameEn : this.config.name;
    }

    /**
     * ページタイトルを生成
     * @returns {string} ページタイトル
     */
    generatePageTitle() {
        return `JCIEスペシャルコンテンツ「${this.config.name} ${this.config.subtitle}」`;
    }
}

// グローバルインスタンスを作成
window.DiseaseDetector = new DiseaseDetector();
window.DISEASE_CONFIG = DISEASE_CONFIG;

// デバッグ用
if (window.DiseaseDetector.getDiseaseConfig().debug?.enabled) {
    console.log('Disease Detection:', {
        type: window.DiseaseDetector.getDiseaseType(),
        config: window.DiseaseDetector.getDiseaseConfig()
    });
}