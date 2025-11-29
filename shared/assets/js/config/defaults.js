/**
 * デフォルト設定ファイル
 * アプリケーション全体で使用される共通の設定値を定義
 */

export const AppDefaults = {
    // アニメーション設定
    animation: {
        // 基本的なトランジション時間
        defaultDuration: 300,
        // チャートのトランジション時間
        chartTransitionDuration: 1000,
        // 短いトランジション時間
        shortDuration: 500,
        // イージング関数
        defaultEasing: 'easeInOut'
    },

    // レスポンシブブレークポイント
    breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1440
    },

    // チャートのデフォルトサイズ
    chartSize: {
        default: {
            width: 800,
            height: 600
        },
        small: {
            width: 600,
            height: 400
        }
    },

    // チャートのマージン設定
    chartMargin: {
        default: {
            top: 40,
            right: 20,
            bottom: 40,
            left: 50
        },
        compact: {
            top: 20,
            right: 20,
            bottom: 40,
            left: 40
        },
        minimal: {
            top: 20,
            right: 20,
            bottom: 40,
            left: 50
        },
        none: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    },

    // カラー設定
    colors: {
        // テキストカラー
        text: {
            primary: '#333',
            secondary: '#666',
            light: '#999',
            white: '#fff'
        },
        // 背景カラー
        background: {
            white: '#fff',
            light: '#DDDDDD',
            dark: '#333',
            overlay: 'rgba(255, 255, 255, 0.9)',
            shadow: 'rgba(0, 0, 0, 0.1)',
            darkOverlay: 'rgba(0, 0, 0, 0.8)'
        },
        // ボーダーカラー
        border: {
            light: '#ccc',
            medium: '#999',
            dark: '#333'
        },
        // アクセントカラー
        accent: {
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6'
        }
    },

    // ストローク幅設定
    strokeWidth: {
        thin: 0.5,
        normal: 1,
        medium: 1.5,
        thick: 2,
        none: 0
    },

    // エラーモーダルのスタイル設定
    errorModal: {
        maxWidth: '600px',
        imageMaxWidth: '400px',
        imageMaxHeight: '400px'
    }
};

// 設定値を変更不可にする（Freeze）
Object.freeze(AppDefaults.animation);
Object.freeze(AppDefaults.breakpoints);
Object.freeze(AppDefaults.chartSize);
Object.freeze(AppDefaults.chartMargin);
Object.freeze(AppDefaults.colors);
Object.freeze(AppDefaults.strokeWidth);
Object.freeze(AppDefaults.errorModal);