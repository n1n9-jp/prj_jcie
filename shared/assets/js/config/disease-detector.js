import { DISEASE_CONFIG } from './disease-config.js';

/**
 * DiseaseDetector - 現在の感染症タイプを検出・管理
 * 感染症の検出とパス解決を担当
 */
export class DiseaseDetector {
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
        if (typeof window !== 'undefined' && window.DISEASE_TYPE && DISEASE_CONFIG[window.DISEASE_TYPE]) {
            this.currentDisease = window.DISEASE_TYPE;
            this.config = DISEASE_CONFIG[window.DISEASE_TYPE];
            this.basePath = this.config.paths.base;
            return;
        } else if (typeof window !== 'undefined' && window.DISEASE_TYPE) {
            console.warn('DiseaseDetector: window.DISEASE_TYPE is set but not found in config:', window.DISEASE_TYPE);
        }

        // 2. URLパスから感染症を検出
        if (typeof window !== 'undefined') {
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
        } else {
            this.currentDisease = 'aids';
        }

        this.config = DISEASE_CONFIG[this.currentDisease];
        this.basePath = this.config.paths.base;
    }

    /**
     * 感染症タイプを再検出（公開メソッド）
     */
    detect() {
        this._detectDisease();
        return this.currentDisease;
    }

    /**
     * 感染症タイプを明示的に設定
     * @param {string} type - 感染症ID
     */
    setDiseaseType(type) {
        if (DISEASE_CONFIG[type]) {
            this.currentDisease = type;
            this.config = DISEASE_CONFIG[type];
            this.basePath = this.config.paths.base;
            console.log(`DiseaseDetector: Explicitly set disease type to ${type}`);
        } else {
            console.error(`DiseaseDetector: Invalid disease type ${type}`);
        }
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
     * 共有設定ファイルパスを解決
     * 各感染症フォルダから ../shared/config/ 内のファイルにアクセスするためのメソッド
     * @param {string} configFile - 設定ファイル名
     * @returns {string} 解決されたパス
     */
    resolveSharedConfigPath(configFile) {
        return '../shared/config/' + configFile;
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
export const diseaseDetector = new DiseaseDetector();

