import './shared/assets/css/tailwind.css';
import { navigationManager } from './shared/assets/js/managers/navigation-manager.js';

// 感染症タイプを設定
window.DISEASE_TYPE = 'top';

// ナビゲーションの初期化（もし自動でされていない場合）
// navigation-manager.js内で自動初期化されているが、念のため
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        navigationManager.init();
    });
} else {
    navigationManager.init();
}
