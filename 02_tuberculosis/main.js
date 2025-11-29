import { ScrollytellingApp } from '../shared/assets/js/core/ScrollytellingApp.js';
import '../shared/assets/css/tailwind.css';

// 感染症タイプを設定
window.DISEASE_TYPE = 'tuberculosis';

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ScrollytellingApp();
});
