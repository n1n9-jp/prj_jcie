/**
 * アプリケーション共通定数
 * 重複コードの統合とメンテナンス性向上のため
 */

/**
 * 国名マッピング - 英語→日本語
 */
const COUNTRY_MAPPING = {
    'Nigeria': 'ナイジェリア',
    'Malawi': 'マラウイ',
    'Kenya': 'ケニア',
    'Belize': 'ベリーズ',
    'United States of America': 'アメリカ',
    'Philippines': 'フィリピン'
};

/**
 * 国名の英語→日本語変換
 * @param {string} countryEn - 英語の国名
 * @returns {string} 日本語の国名
 */
function getCountryNameJapanese(countryEn) {
    return COUNTRY_MAPPING[countryEn] || countryEn;
}

/**
 * アプリケーション共通色彩定義
 */
const APP_COLORS = {
    // プライマリカラーパレット
    PRIMARY_PALETTE: [
        '#2563eb', // ブルー
        '#dc2626', // レッド
        '#059669', // グリーン
        '#d97706', // オレンジ
        '#7c3aed', // パープル
        '#0891b2', // シアン
        '#be185d', // ピンク
        '#65a30d'  // ライム
    ],
    
    // テキスト色
    TEXT: {
        PRIMARY: '#333',
        SECONDARY: '#666',
        LIGHT: '#888',
        WHITE: '#fff'
    },
    
    // アクセント色
    ACCENT: {
        SUCCESS: '#10b981',
        INFO: '#3b82f6',
        WARNING: '#f59e0b',
        ERROR: '#ef4444'
    },
    
    // 背景色
    BACKGROUND: {
        LIGHT: '#e5e7eb',
        WHITE: '#fff',
        GRAY: '#f3f4f6'
    },
    
    // 地域別色（統一カラースキーム）
    REGIONS: {
        'サハラ以南アフリカ': '#e74c3c',
        '東部・南部アフリカ': '#f39c12',
        '西部・中部アフリカ': '#e67e22',
        'アジア・太平洋地域': '#3498db',
        '西・中央ヨーロッパおよび北米': '#9b59b6',
        '東欧・中央アジア': '#2ecc71',
        'ラテンアメリカ・カリブ海地域': '#f1c40f',
        '中東・北アフリカ': '#e91e63'
    },
    
    // アノテーション・装飾用
    ANNOTATIONS: {
        LINE: '#999',
        POINT: '#ff6b6b',
        STROKE: '#fff',
        BORDER: '#ccc'
    }
};

/**
 * アニメーション設定
 */
const ANIMATION_CONFIG = {
    DURATION: {
        INSTANT: 0,
        FAST: 150,
        SHORT: 300,
        DEFAULT: 500,
        LONG: 800,
        SLOW: 1200
    },
    
    EASING: {
        LINEAR: 'linear',
        EASE: 'ease',
        EASE_IN: 'ease-in',
        EASE_OUT: 'ease-out',
        EASE_IN_OUT: 'ease-in-out'
    }
};

/**
 * レスポンシブ設定
 */
const RESPONSIVE_CONFIG = {
    BREAKPOINTS: {
        MOBILE: 768,
        TABLET: 1024,
        DESKTOP: 1200
    },
    
    MARGIN_RATIOS: {
        MOBILE: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 },
        TABLET: { top: 0.08, bottom: 0.08, left: 0.08, right: 0.08 },
        DESKTOP: { top: 0.05, bottom: 0.08, left: 0.06, right: 0.04 }
    },
    
    MIN_SIZES: {
        CHART_WIDTH: 300,
        CHART_HEIGHT: 200,
        FONT_SIZE: 10
    },
    
    MAX_SIZES: {
        CHART_WIDTH: 1200,
        CHART_HEIGHT: 800,
        FONT_SIZE: 24
    }
};

/**
 * フォント設定
 */
const FONT_CONFIG = {
    FAMILIES: {
        PRIMARY: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
        SERIF: '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "HG Mincho E", "MS Mincho", serif'
    },
    
    SIZES: {
        XS: '10px',
        SM: '12px',
        BASE: '14px',
        LG: '16px',
        XL: '18px',
        XXL: '20px'
    },
    
    WEIGHTS: {
        NORMAL: 'normal',
        MEDIUM: '500',
        BOLD: 'bold'
    }
};

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
if (typeof window !== 'undefined') {
    window.AppConstants = {
        COUNTRY_MAPPING,
        getCountryNameJapanese,
        APP_COLORS,
        ANIMATION_CONFIG,
        RESPONSIVE_CONFIG,
        FONT_CONFIG
    };
}