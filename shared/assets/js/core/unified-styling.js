import { diseaseDetector } from '../config/disease-detector.js';

/**
 * 統一スタイリングシステム
 * 感染症固有の色変数を動的に設定
 * DiseaseDetectorとDISEASE_CONFIGを使用
 */

export class UnifiedStylingSys {
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
        const applyTheme = () => {
            const diseaseType =
                diseaseDetector?.getDiseaseType?.() ||
                window.DISEASE_TYPE ||
                'aids';
            this.applyCSSVariables(diseaseType);
        };

        const tryApply = () => {
            if (window.DISEASE_CONFIG && diseaseDetector) {
                applyTheme();
                return true;
            }
            return false;
        };

        if (!tryApply()) {
            const onReady = () => {
                tryApply();
            };
            document.addEventListener('DOMContentLoaded', onReady, { once: true });
            window.addEventListener('load', onReady, { once: true });
        }
    }
}

// 自動初期化
export const unifiedStyling = new UnifiedStylingSys();
unifiedStyling.init();
