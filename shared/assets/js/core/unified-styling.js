/**
 * 統一スタイリングシステム
 * 感染症固有の色変数を動的に設定
 * DiseaseDetectorとDISEASE_CONFIGを使用
 */

class UnifiedStylingSys {
    constructor() {
        // 色情報はDISEASE_CONFIGから取得（重複排除）
    }

    /**
     * CSS変数を設定
     */
    applyCSSVariables(diseaseType) {
        // DISEASE_CONFIGから色情報を取得
        const diseaseConfig = window.DISEASE_CONFIG?.[diseaseType];
        if (!diseaseConfig || !diseaseConfig.color) {
            console.warn(`Unknown disease type or color config: ${diseaseType}`);
            return;
        }

        const colors = diseaseConfig.color;
        const root = document.documentElement;
        root.style.setProperty('--disease-primary', colors.primary);
        root.style.setProperty('--disease-secondary', colors.secondary);
        root.style.setProperty('--disease-accent', colors.accent);
    }

    /**
     * 初期化
     */
    init() {
        // DiseaseDetectorから感染症タイプを取得
        const diseaseType = window.DiseaseDetector?.getDiseaseType() || 'aids';
        this.applyCSSVariables(diseaseType);

        // DOMContentLoadedイベントでも実行（念のため）
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.applyCSSVariables(diseaseType);
            });
        }
    }
}

// 自動初期化
const unifiedStyling = new UnifiedStylingSys();
unifiedStyling.init();

// グローバルエクスポート
window.UnifiedStylingSys = UnifiedStylingSys;
window.unifiedStyling = unifiedStyling;