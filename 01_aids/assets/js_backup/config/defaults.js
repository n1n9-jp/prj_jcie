/**
 * デフォルト設定ファイル
 * アプリケーション全体で使用される共通の設定値を定義
 */

window.AppDefaults = {
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
            light: '#f5f5f5',
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
    },

    // ユーティリティ関数
    utils: {
        /**
         * レスポンシブブレークポイントをチェック
         * @param {string} breakpoint - 'mobile', 'tablet', 'desktop'
         * @returns {boolean}
         */
        isBreakpoint: function(breakpoint) {
            const width = window.innerWidth;
            switch(breakpoint) {
                case 'mobile':
                    return width < this.breakpoints.mobile;
                case 'tablet':
                    return width >= this.breakpoints.mobile && width < this.breakpoints.tablet;
                case 'desktop':
                    return width >= this.breakpoints.tablet;
                default:
                    return false;
            }
        }.bind(window.AppDefaults),

        /**
         * レスポンシブサイズを取得
         * @returns {Object} {width, height}
         */
        getResponsiveSize: function() {
            if (this.utils.isBreakpoint('mobile')) {
                return this.chartSize.small;
            }
            return this.chartSize.default;
        }.bind(window.AppDefaults),

        /**
         * レスポンシブマージンを取得
         * @param {string} type - 'default', 'compact', 'minimal', 'none'
         * @returns {Object} {top, right, bottom, left}
         */
        getResponsiveMargin: function(type = 'default') {
            const marginType = this.utils.isBreakpoint('mobile') ? 'compact' : type;
            return this.chartMargin[marginType] || this.chartMargin.default;
        }.bind(window.AppDefaults)
    }
};

// 設定値を変更不可にする（Freeze）
Object.freeze(window.AppDefaults.animation);
Object.freeze(window.AppDefaults.breakpoints);
Object.freeze(window.AppDefaults.chartSize);
Object.freeze(window.AppDefaults.chartMargin);
Object.freeze(window.AppDefaults.colors);
Object.freeze(window.AppDefaults.strokeWidth);
Object.freeze(window.AppDefaults.errorModal);