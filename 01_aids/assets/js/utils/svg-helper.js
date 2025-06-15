/**
 * SVGHelper - SVG操作に関する共通ユーティリティクラス
 * D3.jsを使用したSVG要素の初期化、サイズ計算、共通操作を提供
 */
class SVGHelper {
    /**
     * SVG要素を初期化する
     * @param {d3.Selection} container - D3で選択されたコンテナ要素
     * @param {number} width - SVGの幅
     * @param {number} height - SVGの高さ
     * @param {Object} options - オプション設定
     * @returns {d3.Selection} 作成されたSVG要素
     */
    static initSVG(container, width, height, options = {}) {
        const {
            preserveAspectRatio = 'xMidYMid meet',
            className = '',
            clearContainer = true
        } = options;

        // コンテナをクリア
        if (clearContainer) {
            container.selectAll('*').remove();
        }

        // SVG要素を作成
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', preserveAspectRatio)
            .style('width', '100%')
            .style('height', '100%')
            .style('max-width', '100%')
            .style('display', 'block');

        if (className) {
            svg.classed(className, true);
        }

        return svg;
    }

    /**
     * レスポンシブなサイズを計算する
     * @param {d3.Selection|HTMLElement} container - コンテナ要素
     * @param {Object} config - 設定オブジェクト
     * @returns {Object} 計算された幅と高さ
     */
    static getResponsiveSize(container, config = {}) {
        const {
            defaultWidth = 800,
            defaultHeight = 600,
            scale = 0.8,
            minWidth = 300,
            minHeight = 200,
            maxWidth = 1200,
            maxHeight = 800,
            aspectRatio = null
        } = config;

        // コンテナのサイズを取得
        let containerElement;
        if (container.node) {
            containerElement = container.node();
        } else if (container instanceof HTMLElement) {
            containerElement = container;
        } else {
            console.error('Invalid container provided to getResponsiveSize');
            return { width: defaultWidth, height: defaultHeight };
        }

        const rect = containerElement.getBoundingClientRect();
        let width = rect.width * scale || defaultWidth;
        let height = rect.height * scale || defaultHeight;

        // アスペクト比を維持
        if (aspectRatio) {
            if (width / height > aspectRatio) {
                width = height * aspectRatio;
            } else {
                height = width / aspectRatio;
            }
        }

        // 最小・最大値の制約を適用
        width = Math.max(minWidth, Math.min(maxWidth, width));
        height = Math.max(minHeight, Math.min(maxHeight, height));

        return { width, height };
    }

    /**
     * マージンを考慮した内部サイズを計算する
     * @param {number} width - 全体の幅
     * @param {number} height - 全体の高さ
     * @param {Object} margin - マージン設定
     * @returns {Object} 内部の幅と高さ
     */
    static getInnerSize(width, height, margin = {}) {
        const defaultMargin = { top: 20, right: 20, bottom: 40, left: 40 };
        const finalMargin = { ...defaultMargin, ...margin };

        return {
            width: width - finalMargin.left - finalMargin.right,
            height: height - finalMargin.top - finalMargin.bottom,
            margin: finalMargin
        };
    }

    /**
     * SVGグループ要素を作成する（マージン付き）
     * @param {d3.Selection} svg - SVG要素
     * @param {Object} margin - マージン設定
     * @param {string} className - クラス名
     * @returns {d3.Selection} 作成されたグループ要素
     */
    static createGroup(svg, margin = {}, className = '') {
        const defaultMargin = { top: 20, right: 20, bottom: 40, left: 40 };
        const finalMargin = { ...defaultMargin, ...margin };

        const g = svg.append('g')
            .attr('transform', `translate(${finalMargin.left},${finalMargin.top})`);

        if (className) {
            g.classed(className, true);
        }

        return g;
    }

    /**
     * 軸のスタイルを適用する
     * @param {d3.Selection} axis - 軸要素
     * @param {Object} options - スタイルオプション
     */
    static styleAxis(axis, options = {}) {
        const {
            tickSize = 6,
            tickPadding = 3,
            domainColor = '#666',
            tickColor = '#666',
            textColor = '#666',
            fontSize = '12px',
            fontFamily = 'Arial, sans-serif'
        } = options;

        axis.selectAll('.domain')
            .style('stroke', domainColor);

        axis.selectAll('.tick line')
            .style('stroke', tickColor);

        axis.selectAll('.tick text')
            .style('fill', textColor)
            .style('font-size', fontSize)
            .style('font-family', fontFamily);
    }

    /**
     * ビューポート内での要素の位置を計算する
     * @param {number} viewportWidth - ビューポートの幅
     * @param {number} viewportHeight - ビューポートの高さ
     * @param {number} elementWidth - 要素の幅
     * @param {number} elementHeight - 要素の高さ
     * @param {string} position - 位置指定（center, left, right, top, bottom）
     * @returns {Object} x, y座標
     */
    static calculatePosition(viewportWidth, viewportHeight, elementWidth, elementHeight, position = 'center') {
        let x = 0, y = 0;

        switch (position) {
            case 'center':
                x = (viewportWidth - elementWidth) / 2;
                y = (viewportHeight - elementHeight) / 2;
                break;
            case 'left':
                x = 0;
                y = (viewportHeight - elementHeight) / 2;
                break;
            case 'right':
                x = viewportWidth - elementWidth;
                y = (viewportHeight - elementHeight) / 2;
                break;
            case 'top':
                x = (viewportWidth - elementWidth) / 2;
                y = 0;
                break;
            case 'bottom':
                x = (viewportWidth - elementWidth) / 2;
                y = viewportHeight - elementHeight;
                break;
            default:
                // centerをデフォルトとする
                x = (viewportWidth - elementWidth) / 2;
                y = (viewportHeight - elementHeight) / 2;
        }

        return { x, y };
    }

    /**
     * グリッドラインを追加する
     * @param {d3.Selection} g - グループ要素
     * @param {Function} xScale - X軸のスケール関数
     * @param {Function} yScale - Y軸のスケール関数
     * @param {number} width - グリッドの幅
     * @param {number} height - グリッドの高さ
     * @param {Object} options - グリッドオプション
     */
    static addGridLines(g, xScale, yScale, width, height, options = {}) {
        const {
            showXGrid = true,
            showYGrid = true,
            xGridColor = '#e0e0e0',
            yGridColor = '#e0e0e0',
            xGridOpacity = 0.5,
            yGridOpacity = 0.5,
            xGridDashArray = '3,3',
            yGridDashArray = '3,3'
        } = options;

        // Y軸グリッドライン
        if (showYGrid && yScale) {
            g.append('g')
                .classed('grid grid-y', true)
                .call(d3.axisLeft(yScale)
                    .tickSize(-width)
                    .tickFormat(''))
                .style('stroke', yGridColor)
                .style('stroke-opacity', yGridOpacity)
                .style('stroke-dasharray', yGridDashArray)
                .selectAll('.domain')
                .remove();
        }

        // X軸グリッドライン
        if (showXGrid && xScale) {
            g.append('g')
                .classed('grid grid-x', true)
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(xScale)
                    .tickSize(-height)
                    .tickFormat(''))
                .style('stroke', xGridColor)
                .style('stroke-opacity', xGridOpacity)
                .style('stroke-dasharray', xGridDashArray)
                .selectAll('.domain')
                .remove();
        }
    }

    /**
     * ツールチップ用のコンテナを作成する
     * @param {string} containerId - ツールチップコンテナのID
     * @returns {d3.Selection} ツールチップ要素
     */
    static createTooltip(containerId = 'tooltip') {
        // 既存のツールチップがあれば削除
        d3.select(`#${containerId}`).remove();

        return d3.select('body')
            .append('div')
            .attr('id', containerId)
            .style('position', 'absolute')
            .style('padding', '10px')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('transition', 'opacity 0.2s');
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.SVGHelper = SVGHelper;