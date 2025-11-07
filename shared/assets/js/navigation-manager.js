/**
 * ナビゲーション管理システム
 * 統一されたナビゲーションを動的に生成
 */

class NavigationManager {
    constructor() {
        this.diseases = [
            {
                type: 'aids',
                name: 'エイズ',
                path: '../01_aids/',
                folder: '01_aids'
            },
            {
                type: 'tuberculosis', 
                name: '結核',
                path: '../02_tuberculosis/',
                folder: '02_tuberculosis'
            },
            {
                type: 'malariae',
                name: 'マラリア', 
                path: '../03_malariae/',
                folder: '03_malariae'
            }
        ];
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
     * ナビゲーションHTMLを生成
     */
    generateNavigationHTML() {
        const currentType = this.getCurrentDiseaseType();
        let html = '';

        this.diseases.forEach(disease => {
            if (disease.type === currentType) {
                // 現在のページ - span要素で表示
                html += `                <li><span class="nav-current">${disease.name}</span></li>\n`;
            } else {
                // 他のページ - aリンクで表示
                html += `                <li><a href="${disease.path}" class="nav-link">${disease.name}</a></li>\n`;
            }
        });

        return html;
    }

    /**
     * ナビゲーションをDOMに挿入
     */
    renderNavigation() {
        const navUl = document.querySelector('#site-header .site-nav ul');
        if (!navUl) {
            // console.error('Navigation container not found');
            return;
        }

        const html = this.generateNavigationHTML();
        navUl.innerHTML = html;

        // console.log(`Navigation rendered for: ${this.getCurrentDiseaseType()}`);
    }

    /**
     * 初期化
     */
    init() {
        // DOMが読み込まれてからナビゲーションを生成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.renderNavigation();
            });
        } else {
            this.renderNavigation();
        }
    }
}

// 自動初期化
const navigationManager = new NavigationManager();
navigationManager.init();

// グローバルエクスポート
window.NavigationManager = NavigationManager;
window.navigationManager = navigationManager;