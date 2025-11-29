import { ScrollytellingApp } from '../shared/assets/js/core/ScrollytellingApp.js';
import '../shared/assets/css/main.css';


// 感染症タイプを設定
window.DISEASE_TYPE = 'aids';

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ScrollytellingApp();
});
