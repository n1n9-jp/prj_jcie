import { ScrollytellingApp } from '../shared/assets/js/core/ScrollytellingApp.js';

// 感染症タイプを設定
window.DISEASE_TYPE = 'malariae';

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ScrollytellingApp();
});
