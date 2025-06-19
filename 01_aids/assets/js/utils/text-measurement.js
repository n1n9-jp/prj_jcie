/**
 * TextMeasurement - テキスト幅計算とレンダリングユーティリティ
 * 日本語フォントと複数行テキストに対応
 */
class TextMeasurement {
    constructor() {
        this.measurementCache = new Map();
        this.measurementSvg = null;
        this.initMeasurementContext();
    }

    /**
     * テキスト測定用のSVGコンテキストを初期化
     */
    initMeasurementContext() {
        // 非表示のSVGエレメントを作成（測定専用）
        this.measurementSvg = d3.select('body')
            .append('svg')
            .style('position', 'absolute')
            .style('top', '-9999px')
            .style('left', '-9999px')
            .style('visibility', 'hidden')
            .attr('width', 1)
            .attr('height', 1);
    }

    /**
     * テキストの幅を測定
     * @param {string} text - 測定対象のテキスト
     * @param {Object} style - フォントスタイル設定
     * @returns {number} テキスト幅（ピクセル）
     */
    measureTextWidth(text, style = {}) {
        if (!text) return 0;

        // デフォルトスタイル
        const defaultStyle = {
            fontSize: '12px',
            fontFamily: 'var(--font-family-serif), "Shippori Mincho", serif',
            fontWeight: 'normal'
        };

        const finalStyle = { ...defaultStyle, ...style };
        const cacheKey = `${text}-${JSON.stringify(finalStyle)}`;

        // キャッシュから取得
        if (this.measurementCache.has(cacheKey)) {
            return this.measurementCache.get(cacheKey);
        }

        let width = 0;

        try {
            // SVGテキスト要素を作成して測定
            const textElement = this.measurementSvg
                .append('text')
                .style('font-size', finalStyle.fontSize)
                .style('font-family', finalStyle.fontFamily)
                .style('font-weight', finalStyle.fontWeight)
                .text(text);

            width = textElement.node().getBBox().width;
            textElement.remove();
        } catch (error) {
            console.warn('TextMeasurement: SVG measurement failed, using fallback:', error);
            width = this.fallbackMeasureTextWidth(text, finalStyle);
        }

        // キャッシュに保存
        this.measurementCache.set(cacheKey, width);
        return width;
    }

    /**
     * フォールバック：文字数ベースの幅推定
     * @param {string} text - 測定対象のテキスト
     * @param {Object} style - フォントスタイル設定
     * @returns {number} 推定テキスト幅
     */
    fallbackMeasureTextWidth(text, style) {
        const fontSize = parseFloat(style.fontSize) || 12;
        let charCount = 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const code = char.charCodeAt(0);

            // 日本語文字（ひらがな、カタカナ、漢字）は全角扱い
            if ((code >= 0x3040 && code <= 0x309F) || // ひらがな
                (code >= 0x30A0 && code <= 0x30FF) || // カタカナ
                (code >= 0x4E00 && code <= 0x9FAF) || // 漢字
                (code >= 0xFF00 && code <= 0xFFEF)) { // 全角記号
                charCount += 1.0; // 全角文字
            } else {
                charCount += 0.6; // 半角文字
            }
        }

        return charCount * fontSize * 0.8; // フォントサイズの80%を基準幅とする
    }

    /**
     * テキストの高さを測定
     * @param {string} text - 測定対象のテキスト
     * @param {Object} style - フォントスタイル設定
     * @returns {number} テキスト高さ（ピクセル）
     */
    measureTextHeight(text, style = {}) {
        if (!text) return 0;

        const defaultStyle = {
            fontSize: '12px',
            fontFamily: 'var(--font-family-serif), "Shippori Mincho", serif'
        };

        const finalStyle = { ...defaultStyle, ...style };
        const fontSize = parseFloat(finalStyle.fontSize) || 12;

        try {
            const textElement = this.measurementSvg
                .append('text')
                .style('font-size', finalStyle.fontSize)
                .style('font-family', finalStyle.fontFamily)
                .text(text || 'Ag'); // フォントの標準高さを取得

            const height = textElement.node().getBBox().height;
            textElement.remove();
            return height;
        } catch (error) {
            console.warn('TextMeasurement: Height measurement failed, using fallback');
            return fontSize * 1.2; // フォントサイズの120%をフォールバック
        }
    }

    /**
     * 長いテキストを指定幅で省略
     * @param {string} text - 元のテキスト
     * @param {number} maxWidth - 最大幅
     * @param {Object} style - フォントスタイル設定
     * @returns {string} 省略されたテキスト
     */
    truncateText(text, maxWidth, style = {}) {
        if (!text) return '';

        const fullWidth = this.measureTextWidth(text, style);
        if (fullWidth <= maxWidth) {
            return text;
        }

        // 省略記号の幅を計算
        const ellipsisWidth = this.measureTextWidth('...', style);
        const availableWidth = maxWidth - ellipsisWidth;

        if (availableWidth <= 0) {
            return '...';
        }

        // 二分探索で最適な文字数を見つける
        let left = 0;
        let right = text.length;
        let bestLength = 0;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const truncated = text.substring(0, mid);
            const width = this.measureTextWidth(truncated, style);

            if (width <= availableWidth) {
                bestLength = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return bestLength > 0 ? text.substring(0, bestLength) + '...' : '...';
    }

    /**
     * 複数行テキストに分割
     * @param {string} text - 元のテキスト
     * @param {number} maxWidth - 1行の最大幅
     * @param {Object} style - フォントスタイル設定
     * @returns {Array<string>} 行のリスト
     */
    wrapText(text, maxWidth, style = {}) {
        if (!text) return [];

        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = this.measureTextWidth(testLine, style);

            if (testWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    // 単語が長すぎる場合は強制的に分割
                    lines.push(this.truncateText(word, maxWidth, style));
                }
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    /**
     * キャッシュをクリア
     */
    clearCache() {
        this.measurementCache.clear();
    }

    /**
     * 測定用SVGをクリーンアップ
     */
    cleanup() {
        if (this.measurementSvg) {
            this.measurementSvg.remove();
            this.measurementSvg = null;
        }
        this.clearCache();
    }
}

// シングルトンインスタンスを作成
window.TextMeasurement = new TextMeasurement();

// ページ離脱時にクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.TextMeasurement) {
        window.TextMeasurement.cleanup();
    }
});