/**
 * 統一スタイリングシステム
 * 感染症固有の色変数を動的に設定
 */

class UnifiedStylingSys {
    constructor() {
        this.diseaseColors = {
            'aids': {
                primary: '#ff6b6b',
                secondary: '#ff8e8e', 
                accent: '#e85555'
            },
            'tuberculosis': {
                primary: '#4ecdc4',
                secondary: '#6fd8d1',
                accent: '#3bc2b8'
            },
            'malariae': {
                primary: '#f4a620',
                secondary: '#f6b84a',
                accent: '#e89813'
            }
        };
    }

    /**
     * 現在の感染症タイプを取得
     */
    getCurrentDiseaseType() {
        // window.DISEASE_TYPEが設定されていればそれを使用
        if (window.DISEASE_TYPE) {
            return window.DISEASE_TYPE;
        }
        
        // パスから自動検出
        const path = window.location.pathname;
        if (path.includes('01_aids')) return 'aids';
        if (path.includes('02_tuberculosis')) return 'tuberculosis';
        if (path.includes('03_malariae')) return 'malariae';
        
        // デフォルトはaids
        return 'aids';
    }

    /**
     * CSS変数を設定
     */
    applyCSSVariables(diseaseType) {
        const colors = this.diseaseColors[diseaseType];
        if (!colors) {
            // console.warn(`Unknown disease type: ${diseaseType}`);
            return;
        }

        const root = document.documentElement;
        root.style.setProperty('--disease-primary', colors.primary);
        root.style.setProperty('--disease-secondary', colors.secondary);
        root.style.setProperty('--disease-accent', colors.accent);

        // console.log(`Applied unified styling for: ${diseaseType}`, colors);
    }

    /**
     * 初期化
     */
    init() {
        const diseaseType = this.getCurrentDiseaseType();
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