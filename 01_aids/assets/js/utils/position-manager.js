/**
 * PositionManager - コンテンツの位置管理ユーティリティクラス
 * チャート、地図、画像の表示位置を動的に制御
 */
class PositionManager {
    /**
     * コンテナにポジション設定を適用
     * @param {HTMLElement} container - 対象コンテナ
     * @param {Object} positionConfig - 位置設定
     * @param {Object} options - 追加オプション
     */
    static applyPosition(container, positionConfig = {}, options = {}) {
        if (!container) {
            console.warn('PositionManager: Container not found');
            return;
        }

        const {
            horizontal = 'center',
            vertical = 'center',
            width = null,
            height = null,
            padding = null,
            margin = null,
            maxWidth = null,
            maxHeight = null,
            zIndex = null
        } = positionConfig;

        const {
            responsive = true,
            animationDuration = '0.5s',
            debugMode = false
        } = options;

        if (debugMode) {
            console.log('PositionManager: Applying position config:', positionConfig);
            console.log('PositionManager: Container before:', {
                id: container.id,
                classes: Array.from(container.classList),
                justifyContent: window.getComputedStyle(container).justifyContent
            });
        }

        // 基本クラスをリセット
        this.resetContainerClasses(container);

        // 基本ポジショニングクラスを適用
        const horizontalClass = this.getHorizontalClass(horizontal);
        const verticalClass = this.getVerticalClass(vertical);
        
        container.classList.add('positioned-content');
        container.classList.add(horizontalClass);
        container.classList.add(verticalClass);
        
        if (debugMode) {
            console.log('PositionManager: Added classes:', {
                horizontal: horizontalClass,
                vertical: verticalClass,
                allClasses: Array.from(container.classList)
            });
        }

        // レスポンシブクラスを追加
        if (responsive) {
            container.classList.add('responsive-content');
        }

        // インラインスタイルを適用
        this.applyInlineStyles(container, {
            width,
            height,
            padding,
            margin,
            maxWidth,
            maxHeight,
            zIndex,
            animationDuration
        });

        // レスポンシブ調整
        if (responsive) {
            this.applyResponsiveAdjustments(container, positionConfig);
        }

        if (debugMode) {
            console.log('PositionManager: Container after:', {
                id: container.id,
                classes: Array.from(container.classList),
                justifyContent: window.getComputedStyle(container).justifyContent,
                alignItems: window.getComputedStyle(container).alignItems
            });
        }
    }

    /**
     * コンテナのクラスをリセット
     * @param {HTMLElement} container - 対象コンテナ
     */
    static resetContainerClasses(container) {
        const positionClasses = [
            'positioned-content', 'responsive-content',
            'content-left', 'content-center', 'content-right',
            'content-top', 'content-middle', 'content-bottom',
            'content-small-screen',
            // Tailwindクラスも削除
            'justify-start', 'justify-center', 'justify-end',
            'items-start', 'items-center', 'items-end'
        ];
        
        container.classList.remove(...positionClasses);
    }

    /**
     * 水平位置に対応するCSSクラスを取得
     * @param {string} horizontal - 水平位置 ('left', 'center', 'right')
     * @returns {string} CSSクラス名
     */
    static getHorizontalClass(horizontal) {
        switch (horizontal.toLowerCase()) {
            case 'left':
                return 'content-left';
            case 'right':
                return 'content-right';
            case 'center':
            default:
                return 'content-center';
        }
    }

    /**
     * 垂直位置に対応するCSSクラスを取得
     * @param {string} vertical - 垂直位置 ('top', 'center', 'bottom')
     * @returns {string} CSSクラス名
     */
    static getVerticalClass(vertical) {
        switch (vertical.toLowerCase()) {
            case 'top':
                return 'content-top';
            case 'bottom':
                return 'content-bottom';
            case 'center':
            case 'middle':
            default:
                return 'content-middle';
        }
    }

    /**
     * インラインスタイルを適用
     * @param {HTMLElement} container - 対象コンテナ
     * @param {Object} styleConfig - スタイル設定
     */
    static applyInlineStyles(container, styleConfig) {
        const {
            width,
            height,
            padding,
            margin,
            maxWidth,
            maxHeight,
            zIndex,
            animationDuration
        } = styleConfig;

        // トランジション設定
        if (animationDuration) {
            container.style.transition = `all ${animationDuration} ease-in-out`;
        }

        // サイズ設定
        if (width) container.style.width = this.normalizeSize(width);
        if (height) container.style.height = this.normalizeSize(height);
        if (maxWidth) container.style.maxWidth = this.normalizeSize(maxWidth);
        if (maxHeight) container.style.maxHeight = this.normalizeSize(maxHeight);

        // スペーシング設定
        if (padding) container.style.padding = this.normalizeSpacing(padding);
        if (margin) container.style.margin = this.normalizeSpacing(margin);

        // z-index設定
        if (zIndex !== null) container.style.zIndex = zIndex;

        // ボックスサイジング設定
        container.style.boxSizing = 'border-box';

        // 画像コンテナの場合は、内部の画像要素も制御
        if (container.id === 'image-container') {
            const imgElement = container.querySelector('#image');
            if (imgElement) {
                if (width) imgElement.style.width = this.normalizeSize(width);
                if (height) imgElement.style.height = this.normalizeSize(height);
                // object-fit設定を保持
                if (!imgElement.style.objectFit) {
                    imgElement.style.objectFit = 'cover';
                }
            }
        }
    }

    /**
     * サイズ値を正規化（px、%、vh、vwなどの単位を適切に処理）
     * @param {string|number} value - サイズ値
     * @returns {string} 正規化されたサイズ値
     */
    static normalizeSize(value) {
        if (typeof value === 'number') {
            return `${value}px`;
        }
        if (typeof value === 'string') {
            // 既に単位が含まれている場合はそのまま返す
            if (value.match(/(%|px|em|rem|vh|vw|vmin|vmax)$/)) {
                return value;
            }
            // 数値のみの場合はpxを追加
            if (!isNaN(parseFloat(value))) {
                return `${value}px`;
            }
        }
        return value;
    }

    /**
     * スペーシング値を正規化
     * @param {string|number} value - スペーシング値
     * @returns {string} 正規化されたスペーシング値
     */
    static normalizeSpacing(value) {
        return this.normalizeSize(value);
    }

    /**
     * レスポンシブ調整を適用
     * @param {HTMLElement} container - 対象コンテナ
     * @param {Object} positionConfig - 位置設定
     */
    static applyResponsiveAdjustments(container, positionConfig) {
        const checkScreenSize = () => {
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            // 小画面の閾値
            const smallScreenThreshold = 768;
            const verySmallScreenThreshold = 480;

            if (screenWidth <= verySmallScreenThreshold) {
                // 非常に小さい画面: 強制的に中央配置・フルサイズ
                this.applySmallScreenLayout(container, 'very-small');
            } else if (screenWidth <= smallScreenThreshold) {
                // 小画面: 中央配置だが一部カスタマイズを保持
                this.applySmallScreenLayout(container, 'small');
            } else {
                // 通常画面: 設定通りに配置
                container.classList.remove('content-small-screen');
            }
        };

        // 初回実行
        checkScreenSize();

        // リサイズ時の再調整
        window.addEventListener('resize', checkScreenSize);
    }

    /**
     * 小画面用レイアウトを適用
     * @param {HTMLElement} container - 対象コンテナ
     * @param {string} screenSize - 画面サイズ ('small', 'very-small')
     */
    static applySmallScreenLayout(container, screenSize) {
        container.classList.add('content-small-screen');

        if (screenSize === 'very-small') {
            // 非常に小さい画面: 完全にオーバーライド
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.padding = '1rem';
        } else {
            // 小画面: 部分的にオーバーライド
            if (container.style.width && container.style.width.includes('%')) {
                const currentWidth = parseFloat(container.style.width);
                if (currentWidth < 80) {
                    container.style.width = '90%';
                }
            }
        }
    }

    /**
     * 複数コンテンツの同時表示時のレイアウト調整
     * @param {Array} containers - コンテナの配列
     * @param {Object} layoutConfig - レイアウト設定
     */
    static adjustMultiContentLayout(containers, layoutConfig = {}) {
        const {
            spacing = '1rem',
            distribution = 'equal', // 'equal', 'weighted'
            stackOnSmallScreen = true
        } = layoutConfig;

        containers.forEach((container, index) => {
            if (!container.element) return;

            // 複数コンテンツ用の基本スタイル
            container.element.style.position = 'absolute';
            container.element.style.top = '0';
            container.element.style.bottom = '0';

            // 分割レイアウトの計算
            if (distribution === 'equal') {
                const widthPercentage = 100 / containers.length;
                const leftPosition = widthPercentage * index;

                container.element.style.left = `${leftPosition}%`;
                container.element.style.width = `${widthPercentage}%`;
            }

            // 小画面での積み重ねレイアウト
            if (stackOnSmallScreen) {
                const mediaQuery = window.matchMedia('(max-width: 768px)');
                const handleSmallScreen = (e) => {
                    if (e.matches) {
                        container.element.style.position = 'relative';
                        container.element.style.left = 'auto';
                        container.element.style.width = '100%';
                        container.element.style.marginBottom = spacing;
                    } else {
                        // 元のレイアウトに戻す
                        this.applyPosition(container.element, container.config);
                    }
                };

                mediaQuery.addListener(handleSmallScreen);
                handleSmallScreen(mediaQuery);
            }
        });
    }

    /**
     * 位置設定のバリデーション
     * @param {Object} positionConfig - 位置設定
     * @returns {Object} バリデーション結果
     */
    static validatePositionConfig(positionConfig) {
        const errors = [];
        const warnings = [];

        if (!positionConfig || typeof positionConfig !== 'object') {
            errors.push('Position config must be an object');
            return { valid: false, errors, warnings };
        }

        // 水平位置のバリデーション
        const validHorizontal = ['left', 'center', 'right'];
        if (positionConfig.horizontal && !validHorizontal.includes(positionConfig.horizontal)) {
            warnings.push(`Invalid horizontal position: ${positionConfig.horizontal}. Using 'center' as default.`);
        }

        // 垂直位置のバリデーション
        const validVertical = ['top', 'center', 'middle', 'bottom'];
        if (positionConfig.vertical && !validVertical.includes(positionConfig.vertical)) {
            warnings.push(`Invalid vertical position: ${positionConfig.vertical}. Using 'center' as default.`);
        }

        // サイズ値のバリデーション
        ['width', 'height', 'maxWidth', 'maxHeight'].forEach(prop => {
            if (positionConfig[prop] && typeof positionConfig[prop] !== 'string' && typeof positionConfig[prop] !== 'number') {
                warnings.push(`Invalid ${prop} value: ${positionConfig[prop]}. Should be string or number.`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * デフォルト位置設定を取得
     * @param {string} contentType - コンテンツタイプ ('chart', 'map', 'image')
     * @returns {Object} デフォルト位置設定
     */
    static getDefaultPositionConfig(contentType) {
        const defaults = {
            chart: {
                horizontal: 'center',
                vertical: 'center',
                width: '100%',
                height: '100%',
                padding: '2rem'
            },
            map: {
                horizontal: 'center',
                vertical: 'center',
                width: '100%',
                height: '100%'
            },
            image: {
                horizontal: 'center',
                vertical: 'center',
                width: '100%',
                height: '100%'
            }
        };

        return defaults[contentType] || defaults.chart;
    }

    /**
     * 位置設定をマージ（デフォルト + ユーザー設定）
     * @param {Object} userConfig - ユーザー位置設定
     * @param {string} contentType - コンテンツタイプ
     * @returns {Object} マージされた位置設定
     */
    static mergePositionConfig(userConfig, contentType) {
        const defaultConfig = this.getDefaultPositionConfig(contentType);
        return { ...defaultConfig, ...userConfig };
    }

    /**
     * デバッグ情報を表示
     * @param {HTMLElement} container - 対象コンテナ
     * @param {Object} positionConfig - 位置設定
     */
    static debugPosition(container, positionConfig) {
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(container);

        console.group('PositionManager Debug Info');
        console.log('Container:', container);
        console.log('Position Config:', positionConfig);
        console.log('Computed Styles:', {
            position: computedStyle.position,
            left: computedStyle.left,
            top: computedStyle.top,
            width: computedStyle.width,
            height: computedStyle.height,
            transform: computedStyle.transform
        });
        console.log('Bounding Rect:', rect);
        console.log('Classes:', Array.from(container.classList));
        console.groupEnd();
    }
}

// グローバルスコープで利用可能にする
window.PositionManager = PositionManager;