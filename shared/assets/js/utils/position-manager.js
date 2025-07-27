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

        // Debug mode information (removed for performance)

        // 基本クラスをリセット
        this.resetContainerClasses(container);

        // 基本ポジショニングクラスを適用
        const horizontalClass = this.getHorizontalClass(horizontal);
        const verticalClass = this.getVerticalClass(vertical);
        
        container.classList.add('positioned-content');
        container.classList.add(horizontalClass);
        container.classList.add(verticalClass);
        
        // Debug information for position classes (removed for performance)

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

        // 明示的なサイズが指定されたabsolute要素の垂直位置調整
        if (container.style.height && (container.style.position === 'absolute' || container.classList.contains('absolute'))) {
            if (vertical === 'center' || vertical === 'middle') {
                container.style.top = '50%';
                container.style.transform = 'translateY(-50%)';
            } else if (vertical === 'top') {
                container.style.top = '2rem';
                container.style.transform = 'none';
            } else if (vertical === 'bottom') {
                container.style.top = 'auto';
                container.style.bottom = '2rem';
                container.style.transform = 'none';
            }
        }

        // レスポンシブ調整
        if (responsive) {
            this.applyResponsiveAdjustments(container, positionConfig);
        }

        // Debug information for final container styles and SVG elements (removed for performance)
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
            'items-start', 'items-center', 'items-end',
            'inset-0'
        ];
        
        // 重要：visibleクラスなど、位置制御以外のクラスは保持する
        // 保持すべきTailwindクラスとその他の重要なクラス
        const importantClasses = ['absolute', 'flex', 'visible'];
        const preserveClasses = Array.from(container.classList).filter(
            cls => !positionClasses.includes(cls) || importantClasses.includes(cls)
        );
        
        container.classList.remove(...positionClasses);
        
        // 保持すべきクラスが削除されていた場合は復元
        preserveClasses.forEach(cls => {
            if (!container.classList.contains(cls)) {
                container.classList.add(cls);
            }
        });
    }

    /**
     * 水平位置に対応するCSSクラスを取得
     * @param {string} horizontal - 水平位置 ('left', 'center', 'right')
     * @returns {string} CSSクラス名
     */
    static getHorizontalClass(horizontal) {
        switch (horizontal.toLowerCase()) {
            case 'left':
                return 'justify-start';
            case 'right':
                return 'justify-end';
            case 'center':
            default:
                return 'justify-center';
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
                return 'items-start';
            case 'bottom':
                return 'items-end';
            case 'center':
            case 'middle':
            default:
                return 'items-center';
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
        // 重要：#chart-containerの場合、d3.jsのtransitionと競合を避けるため
        // opacity以外のプロパティのみにtransitionを適用
        if (animationDuration) {
            if (container.id === 'chart-container' || container.id === 'map-container' || container.id === 'image-container') {
                // メインコンテナはopacityをd3.jsで管理するため、位置・サイズのみtransition
                container.style.transition = `width ${animationDuration} ease-in-out, height ${animationDuration} ease-in-out, transform ${animationDuration} ease-in-out, top ${animationDuration} ease-in-out, left ${animationDuration} ease-in-out`;
            } else {
                // その他の要素は全プロパティにtransition適用
                container.style.transition = `all ${animationDuration} ease-in-out`;
            }
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
            const smallScreenThreshold = window.AppDefaults?.breakpoints?.mobile || 768;
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
                const mediaQuery = window.matchMedia(`(max-width: ${window.AppDefaults?.breakpoints?.mobile || 768}px)`);
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
     * @param {string} contentType - コンテンツタイプ ('chart', 'map', 'image', 'text')
     * @returns {Object} デフォルト位置設定
     */
    static getDefaultPositionConfig(contentType) {
        const defaults = {
            chart: {
                horizontal: 'center',
                vertical: 'center',
                width: 'auto',
                height: 'auto',
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
            },
            text: {
                horizontal: 'center',
                vertical: 'center',
                width: 'auto',
                maxWidth: 'none',
                padding: '2rem'
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
     * テキストコンテンツのポジション設定を適用
     * @param {HTMLElement} stepElement - ステップ要素
     * @param {Object} positionConfig - 位置設定
     * @param {Object} options - 追加オプション
     */
    static applyTextPosition(stepElement, positionConfig = {}, options = {}) {
        if (!stepElement) {
            console.warn('PositionManager: Step element not found');
            return;
        }

        const {
            horizontal = 'center',
            vertical = 'center',
            width = 'auto',
            maxWidth = 'none',
            padding = '2rem',
            margin = null,
            textAlign = 'left'  // 矩形内のテキスト揃え（矩形位置とは独立）
        } = positionConfig;

        const {
            responsive = true,
            debugMode = false
        } = options;

        // Debug mode information (removed for performance)

        // ステップ要素のクラスをリセット
        this.resetTextClasses(stepElement);

        // テキストポジション用のクラスを追加
        const textAlignClass = this.getTextHorizontalClass(textAlign);
        const verticalClass = this.getTextVerticalClass(vertical);
        
        stepElement.classList.add('positioned-text');
        stepElement.classList.add(textAlignClass);
        stepElement.classList.add(verticalClass);

        // テキストコンテナ（白背景の部分）とその親要素を取得
        const textContainer = stepElement.querySelector('.max-w-lg, .text-content, div[class*="bg-white"]');
        const parentContainer = stepElement.querySelector('.w-full.min-h-screen.flex');
        
        // Debug mode text container information (removed for performance)
        
        if (textContainer && parentContainer) {
            // 親要素のFlexboxで白い矩形の位置を制御
            parentContainer.classList.remove('justify-center', 'justify-start', 'justify-end');
            textContainer.classList.remove('mx-auto', 'ml-auto', 'mr-auto', 'mr-0', 'ml-0');
            
            switch (horizontal.toLowerCase()) {
                case 'right':
                    parentContainer.classList.add('justify-end');
                    textContainer.classList.remove('mx-auto');
                    textContainer.classList.add('mr-0', 'ml-auto');
                    break;
                case 'left':
                    parentContainer.classList.add('justify-start');
                    textContainer.classList.remove('mx-auto');
                    textContainer.classList.add('ml-0', 'mr-auto');
                    break;
                default:
                    parentContainer.classList.add('justify-center');
                    textContainer.classList.add('mx-auto');
                    break;
            }
            
            // テキストコンテナのスタイルを適用
            this.applyTextContainerStyles(textContainer, {
                width,
                maxWidth,
                padding,
                margin
            });
        }

        // レスポンシブ調整
        if (responsive) {
            this.applyTextResponsiveAdjustments(stepElement, positionConfig);
        }

        // Debug information for text position applied (removed for performance)
    }

    /**
     * テキスト用の水平位置クラスを取得
     * @param {string} horizontal - 水平位置
     * @returns {string} CSSクラス名
     */
    static getTextHorizontalClass(horizontal) {
        switch (horizontal.toLowerCase()) {
            case 'left':
                return 'text-left';
            case 'right':
                return 'text-right';
            case 'center':
            default:
                return 'text-center';
        }
    }

    /**
     * テキスト用の垂直位置クラスを取得
     * @param {string} vertical - 垂直位置
     * @returns {string} CSSクラス名
     */
    static getTextVerticalClass(vertical) {
        switch (vertical.toLowerCase()) {
            case 'top':
                return 'text-top';
            case 'bottom':
                return 'text-bottom';
            case 'center':
            case 'middle':
            default:
                return 'text-middle';
        }
    }

    /**
     * テキスト要素のクラスをリセット
     * @param {HTMLElement} stepElement - ステップ要素
     */
    static resetTextClasses(stepElement) {
        const textClasses = [
            'positioned-text',
            'text-left', 'text-center', 'text-right',
            'text-top', 'text-middle', 'text-bottom',
            'text-small-screen'
        ];
        
        stepElement.classList.remove(...textClasses);
    }

    /**
     * テキストコンテナのスタイルを適用
     * @param {HTMLElement} container - テキストコンテナ
     * @param {Object} styleConfig - スタイル設定
     */
    static applyTextContainerStyles(container, styleConfig) {
        const { width, maxWidth, padding, margin } = styleConfig;

        // サイズ設定
        if (width && width !== 'auto') {
            container.style.width = this.normalizeSize(width);
        }
        if (maxWidth) {
            container.style.maxWidth = this.normalizeSize(maxWidth);
        }

        // スペーシング設定
        if (padding) {
            container.style.padding = this.normalizeSpacing(padding);
        }
        if (margin) {
            container.style.margin = this.normalizeSpacing(margin);
        }

        // テキストの可読性を確保
        container.style.minWidth = '300px';
        container.style.boxSizing = 'border-box';
    }

    /**
     * テキスト用レスポンシブ調整を適用
     * @param {HTMLElement} stepElement - ステップ要素
     * @param {Object} positionConfig - 位置設定
     */
    static applyTextResponsiveAdjustments(stepElement, positionConfig) {
        const checkScreenSize = () => {
            const screenWidth = window.innerWidth;
            const smallScreenThreshold = window.AppDefaults?.breakpoints?.mobile || 768;

            if (screenWidth <= smallScreenThreshold) {
                // 小画面では中央配置に強制変更
                this.resetTextClasses(stepElement);
                stepElement.classList.add('positioned-text', 'text-center', 'text-middle', 'text-small-screen');
            } else {
                // 通常画面では設定通りに配置
                stepElement.classList.remove('text-small-screen');
                // 必要に応じて元の設定を再適用
                if (!stepElement.classList.contains('positioned-text')) {
                    this.applyTextPosition(stepElement, positionConfig, { responsive: false });
                }
            }
        };

        // 初回実行
        checkScreenSize();

        // リサイズ時の再調整（重複登録を避けるため一度削除）
        const existingHandler = stepElement._textResizeHandler;
        if (existingHandler) {
            window.removeEventListener('resize', existingHandler);
        }

        const newHandler = checkScreenSize;
        stepElement._textResizeHandler = newHandler;
        window.addEventListener('resize', newHandler);
    }

    /**
     * デバッグ情報を表示
     * @param {HTMLElement} container - 対象コンテナ
     * @param {Object} positionConfig - 位置設定
     */
    static debugPosition(container, positionConfig) {
        if (!container) return;

        // Debug position information (removed for performance)
        // Previously contained container getBoundingClientRect and computed styles logging
    }
}

// グローバルスコープで利用可能にする
window.PositionManager = PositionManager;