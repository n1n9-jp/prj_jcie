/**
 * ImageManager - 画像管理クラス
 * スクロールに応じた画像の表示・非表示を管理
 */
class ImageManager {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.image = d3.select('#image');
        this.currentImage = null;
        this.config = null;
        
        this.init();
    }

    init() {
        // イベントリスナーを設定
        pubsub.subscribe(EVENTS.IMAGE_UPDATE, (data) => {
            this.updateImage(data);
        });

        pubsub.subscribe(EVENTS.RESIZE, () => {
            this.resize();
        });
    }

    /**
     * 画像を更新する
     * @param {Object} imageData - 画像データとオプション
     */
    updateImage(imageData) {
        const { src, alt, config, visible } = imageData;
        
        this.config = config;
        this.currentImage = { src, alt, visible };

        if (visible && src) {
            this.show();
            this.loadImage(src, alt, config);
        } else {
            this.hide();
        }
    }

    /**
     * 画像コンテナを表示
     */
    show() {
        this.container.classed('visible', true);
    }

    /**
     * 画像コンテナを非表示
     */
    hide() {
        this.container.classed('visible', false);
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
            objectFit = 'contain'
        } = config;

        // 画像の設定
        this.image
            .attr('src', src)
            .attr('alt', alt)
            .style('opacity', 0)
            .style('width', width)
            .style('height', height)
            .style('object-fit', objectFit);

        // ポジション設定
        this.setImagePosition(position);

        // フェードイン効果
        this.image
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