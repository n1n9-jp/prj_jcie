/**
 * TextMeasurement - テキスト計測ユーティリティ
 * Canvas APIを使用して高速にテキスト幅を計測
 */
export class TextMeasurement {
    static canvas = null;
    static context = null;

    /**
     * Canvasコンテキストを初期化
     */
    static init() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext('2d');
        }
    }

    /**
     * テキストの幅を計測
     * @param {string} text - 計測するテキスト
     * @param {Object} style - フォントスタイル設定
     * @returns {number} テキスト幅（ピクセル）
     */
    static measureTextWidth(text, style = {}) {
        this.init();

        const fontSize = style.fontSize || '12px';
        const fontFamily = style.fontFamily || 'sans-serif';
        const fontWeight = style.fontWeight || 'normal';

        this.context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return this.context.measureText(text).width;
    }

    /**
     * テキストの高さを推定
     * @param {string} text - テキスト（未使用）
     * @param {Object} style - フォントスタイル設定
     * @returns {number} テキスト高さ（ピクセル）
     */
    static measureTextHeight(text, style = {}) {
        // Canvas APIでは高さを正確に取得するのが難しいため、フォントサイズから推定
        const fontSize = style.fontSize || '12px';
        const size = parseInt(fontSize);
        return isNaN(size) ? 14 : size * 1.2; // 1.2は行間係数
    }

    /**
     * 指定された幅に収まるようにテキストを省略
     * @param {string} text - 元のテキスト
     * @param {number} maxWidth - 最大幅
     * @param {Object} style - フォントスタイル設定
     * @returns {string} 省略されたテキスト
     */
    static truncateText(text, maxWidth, style = {}) {
        if (!text || maxWidth <= 0) return text;

        const width = this.measureTextWidth(text, style);
        if (width <= maxWidth) return text;

        // 二分探索で適切な長さを探す
        let low = 0;
        let high = text.length;
        let result = text;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const truncated = text.substring(0, mid) + '...';
            const w = this.measureTextWidth(truncated, style);

            if (w <= maxWidth) {
                result = truncated;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return result;
    }
}

// グローバルスコープ互換性のため（必要に応じて）
if (typeof window !== 'undefined') {
    window.TextMeasurement = TextMeasurement;
}