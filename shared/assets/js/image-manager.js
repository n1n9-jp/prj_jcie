/**
 * ImageManager - 画像管理クラス
 * スクロールに応じた画像の表示・非表示を管理
 * BaseManagerを継承し、共通機能を活用
 */
class ImageManager extends BaseManager {
    constructor(containerId) {
        super(containerId);
        this.imageContainer = d3.select('#image-container');
        this.imageElement = d3.select('#image');
        this.currentImage = null;
        
        // Initialize after properties are set
        this.init();
    }

    /**
     * 初期化処理（BaseManagerを拡張）
     */
    init() {
        super.init();
        
        console.log('🖼️ ImageManager: Initializing and subscribing to IMAGE_UPDATE events');
        
        // イベントリスナーを設定
        pubsub.subscribe(EVENTS.IMAGE_UPDATE, (data) => {
            console.log('🖼️ ImageManager: Received IMAGE_UPDATE event');
            this.updateImage(data);
        });
    }

    /**
     * 画像を更新する
     * @param {Object} imageData - 画像データとオプション
     */
    updateImage(imageData) {
        console.log('🖼️ ImageManager.updateImage called with:', imageData);
        
        const { src, alt, config, visible, position } = imageData;
        
        this.config = config;
        this.currentImage = { src, alt, visible, position };

        if (visible && src) {
            console.log(`🖼️ ImageManager: Showing image ${src}`);
            this.show();
            this.loadImage(src, alt, config);
            
            // BaseManagerの統一position処理を適用
            if (position) {
                this.applyPositionSettings(position);
            }
        } else {
            console.log('🖼️ ImageManager: Hiding image (visible:', visible, 'src:', src, ')');
            this.hide();
        }
    }

    /**
     * 画像コンテナを表示（BaseManagerの統一メソッドを使用）
     */
    show() {
        // BaseManagerの統一showメソッドを呼び出す
        super.show();
    }

    /**
     * 画像コンテナを非表示（BaseManagerの統一メソッドを使用）
     */
    hide(options = {}) {
        // BaseManagerの統一hideメソッドを呼び出す
        super.hide(options);
        
        // 画像特有のクリーンアップ処理
        if (this.imageElement) {
            this.imageElement.attr('src', '').style('opacity', 0);
        }
        
        // step0の背景画像もクリア
        const step0BgContainer = d3.select('#step0-bg-container');
        if (!step0BgContainer.empty()) {
            step0BgContainer.selectAll('img')
                .transition()
                .duration(300)
                .style('opacity', 0)
                .remove();
        }
    }

    /**
     * 画像を読み込み・表示
     * @param {string} src - 画像パス
     * @param {string} alt - alt属性
     * @param {Object} config - 表示設定
     */
    loadImage(src, alt, config = {}) {
        const {
            width = 'auto',
            height = 'auto',
            position = 'center',
            opacity = 1,
            objectFit = 'contain',
            specialMode = null
        } = config;

        // openingステップの特別処理（論理名システム対応）
        if (specialMode === 'opening-background' || specialMode === 'step0-background') {
            const step0BgContainer = d3.select('#step0-bg-container');
            if (!step0BgContainer.empty()) {
                // 既存の画像を削除
                step0BgContainer.selectAll('img').remove();
                
                // 新しい画像を作成
                const bgImage = step0BgContainer.append('img')
                    .attr('src', src)
                    .attr('alt', alt)
                    .style('position', 'absolute')
                    .style('top', '0')
                    .style('left', '0')
                    .style('width', '100%')
                    .style('height', '100%')
                    .style('object-fit', 'cover')
                    .style('opacity', 0);
                
                // フェードイン
                bgImage.transition()
                    .duration(500)
                    .style('opacity', opacity);
                
                // 通常のimage-containerは非表示
                this.container.classed('visible', false);
                return;
            }
        }

        // 通常の画像処理 - 既存のimg要素を更新
        const imageElement = this.imageElement
            .attr('src', src)
            .attr('alt', alt)
            .style('opacity', 0)
            .style('width', width)
            .style('height', height)
            .style('object-fit', objectFit)
            .style('display', 'block');

        // ポジション設定
        this.setImagePosition(position);

        // フェードイン効果
        imageElement
            .transition()
            .duration(500)
            .style('opacity', opacity);
    }

    /**
     * 画像の位置を設定
     * @param {string} position - 位置指定 (center, left, right, top, bottom)
     */
    setImagePosition(position) {
        // コンテナのクラスをリセット
        this.container
            .classed('justify-center', false)
            .classed('justify-start', false)
            .classed('justify-end', false)
            .classed('items-center', false)
            .classed('items-start', false)
            .classed('items-end', false);

        switch (position) {
            case 'left':
                this.container.classed('justify-start items-center', true);
                break;
            case 'right':
                this.container.classed('justify-end items-center', true);
                break;
            case 'top':
                this.container.classed('justify-center items-start', true);
                break;
            case 'bottom':
                this.container.classed('justify-center items-end', true);
                break;
            case 'center':
            default:
                this.container.classed('justify-center items-center', true);
                break;
        }
    }

    /**
     * リサイズ処理
     */
    resize() {
        if (this.currentImage && this.currentImage.visible && this.config) {
            this.loadImage(this.currentImage.src, this.currentImage.alt, this.config);
        }
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.ImageManager = ImageManager;