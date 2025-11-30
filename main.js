import './shared/assets/css/main.css';

import { navigationManager } from './shared/assets/js/managers/navigation-manager.js';

import { WorldMapAnimation } from './shared/assets/js/visuals/world-map-animation.js';

// 感染症タイプを設定
window.DISEASE_TYPE = 'top';

// アプリケーション初期化
const initApp = () => {
    navigationManager.init();

    // 世界地図アニメーションの初期化
    const mapAnimation = new WorldMapAnimation('#hero-map', '#country-name-display');
    mapAnimation.init();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
