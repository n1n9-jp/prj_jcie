/**
 * ChartTransitions - 統一されたチャート用トランジション管理クラス
 * 全てのチャートレンダラーで共通のトランジションロジックを提供
 * AnimationConfigの機能を統合（2024年6月）
 */
class ChartTransitions {
    
    /**
     * 外部設定からアニメーション速度を取得（AnimationConfigより統合）
     * @param {string} name - 速度名
     * @returns {number} ミリ秒
     */
    static getSpeed(name) {
        // ConfigLoaderが利用可能で設定が読み込まれている場合
        if (window.ConfigLoader && window.ConfigLoader.loaded) {
            const config = window.ConfigLoader.mergedConfig;
            if (config?.animation?.durations) {
                const speedName = name.toLowerCase();
                return config.animation.durations[speedName] || this.CONFIG.DURATION[name];
            }
        }
        return this.CONFIG.DURATION[name] || this.CONFIG.DURATION.NORMAL;
    }

    /**
     * 外部設定からイージング関数を取得（AnimationConfigより統合）
     * @param {string} name - イージング名
     * @returns {Function} D3イージング関数
     */
    static getEasing(name) {
        // ConfigLoaderが利用可能で設定が読み込まれている場合
        if (window.ConfigLoader && window.ConfigLoader.loaded) {
            const config = window.ConfigLoader.mergedConfig;
            if (config?.animation?.easings) {
                const easingName = name.toLowerCase();
                const easingValue = config.animation.easings[easingName];
                if (easingValue && typeof easingValue === 'string') {
                    // CSS文字列をD3イージング関数に変換
                    return this._cssEasingToD3(easingValue);
                }
            }
        }
        return this.CONFIG.EASING[name] || this.CONFIG.EASING.QUAD_OUT;
    }

    /**
     * CSS文字列をD3イージング関数に変換
     * @param {string} cssEasing - CSS文字列
     * @returns {Function} D3イージング関数
     */
    static _cssEasingToD3(cssEasing) {
        const easingMap = {
            'linear': d3.easeLinear,
            'ease': d3.easeCubic,
            'ease-in': d3.easeCubicIn,
            'ease-out': d3.easeCubicOut,
            'ease-in-out': d3.easeCubicInOut
        };
        return easingMap[cssEasing] || d3.easeCubicOut;
    }

    /**
     * 共通のトランジション設定を定義
     */
    static CONFIG = {
        // デフォルトのトランジション時間
        DURATION: {
            INSTANT: 0,
            FAST: 300,
            NORMAL: 600,
            SLOW: 1000,
            VERY_SLOW: 1500
        },
        
        // よく使われるイージング関数
        EASING: {
            QUAD_IN: d3.easeQuadIn,
            QUAD_OUT: d3.easeQuadOut,
            QUAD_IN_OUT: d3.easeQuadInOut,
            CUBIC_IN: d3.easeCubicIn,
            CUBIC_OUT: d3.easeCubicOut,
            CUBIC_IN_OUT: d3.easeCubicInOut,
            BACK_IN: d3.easeBackIn,
            BACK_OUT: d3.easeBackOut,
            ELASTIC: d3.easeElastic,
            BOUNCE: d3.easeBounce
        },
        
        // チャート種別ごとのデフォルト設定
        CHART_DEFAULTS: {
            line: {
                enter: { duration: 600, easing: d3.easeQuadOut },
                update: { duration: 1000, easing: d3.easeQuadInOut },
                exit: { duration: 500, easing: d3.easeBackIn }
            },
            bar: {
                enter: { duration: 600, easing: d3.easeQuadOut },
                update: { duration: 1000, easing: d3.easeQuadInOut },
                exit: { duration: 500, easing: d3.easeBackIn }
            },
            pie: {
                enter: { duration: 600, easing: d3.easeQuadOut },
                update: { duration: 1000, easing: d3.easeQuadInOut },
                exit: { duration: 500, easing: d3.easeBackIn }
            },
            grid: {
                enter: { duration: 500, easing: d3.easeQuadOut },
                update: { duration: 800, easing: d3.easeQuadInOut },
                exit: { duration: 400, easing: d3.easeBackIn }
            }
        }
    };

    /**
     * 統一されたトランジションオブジェクトを作成
     * @param {string} chartType - チャートタイプ ('line', 'bar', 'pie', 'grid')
     * @param {string} phase - トランジションフェーズ ('enter', 'update', 'exit')
     * @param {Object} customConfig - カスタム設定
     * @returns {d3.Transition} D3トランジションオブジェクト
     */
    static createTransition(chartType = 'line', phase = 'update', customConfig = {}) {
        try {
            // デフォルト設定を取得
            const defaultConfig = ChartTransitions.CONFIG.CHART_DEFAULTS[chartType]?.[phase] || 
                                 ChartTransitions.CONFIG.CHART_DEFAULTS.line.update;
            
            // AppDefaultsからの設定を考慮
            const appDefaults = window.AppDefaults?.animation || {};
            
            // 設定をマージ
            const config = {
                duration: customConfig.duration || 
                         appDefaults.chartTransitionDuration || 
                         defaultConfig.duration,
                easing: customConfig.easing || defaultConfig.easing
            };
            
            // 設定ファイルからの速度調整
            config.duration = this.getSpeed(config.duration);
            
            return d3.transition()
                .duration(config.duration)
                .ease(config.easing);
                
        } catch (error) {
            console.warn('ChartTransitions: Error creating transition, using fallback:', error);
            return d3.transition()
                .duration(ChartTransitions.CONFIG.DURATION.NORMAL)
                .ease(ChartTransitions.CONFIG.EASING.QUAD_IN_OUT);
        }
    }

    /**
     * Enter/Update/Exit パターンの統一実装
     * @param {d3.Selection} selection - D3選択要素
     * @param {Array} data - データ配列
     * @param {Function} keyFunction - オブジェクト一意性のためのキー関数
     * @param {Object} callbacks - コールバック関数群
     * @param {Object} transitionConfig - トランジション設定
     * @returns {Object} enter, update, exit選択要素を含むオブジェクト
     */
    static applyEnterUpdateExit(selection, data, keyFunction, callbacks = {}, transitionConfig = {}) {
        try {
            const chartType = transitionConfig.chartType || 'line';
            
            // データバインディング
            const bound = selection.data(data, keyFunction);
            
            // ENTER: 新しい要素
            const enterSelection = bound.enter();
            if (callbacks.onEnter) {
                callbacks.onEnter(enterSelection);
            }
            
            // UPDATE: 既存要素
            const updateSelection = bound;
            
            // EXIT: 削除される要素
            const exitSelection = bound.exit();
            
            // EXIT トランジション
            if (exitSelection.size() > 0) {
                const exitTransition = ChartTransitions.createTransition(chartType, 'exit', transitionConfig.exit);
                const exitWithTransition = exitSelection.transition(exitTransition);
                
                if (callbacks.onExit) {
                    callbacks.onExit(exitWithTransition);
                } else {
                    // デフォルトの退場アニメーション
                    exitWithTransition
                        .style('opacity', 0)
                        .remove();
                }
            }
            
            // ENTER + UPDATE マージ
            const allSelection = enterSelection.merge(updateSelection);
            
            // UPDATE トランジション
            const updateTransition = ChartTransitions.createTransition(chartType, 'update', transitionConfig.update);
            const allWithTransition = allSelection.transition(updateTransition);
            
            if (callbacks.onUpdate) {
                callbacks.onUpdate(allSelection, { 
                    enter: enterSelection, 
                    update: updateSelection,
                    allWithTransition: allWithTransition
                });
            }
            
            return {
                enter: enterSelection,
                update: updateSelection,
                exit: exitSelection,
                all: allSelection,
                allWithTransition: allWithTransition
            };
            
        } catch (error) {
            console.error('ChartTransitions: Error in enter/update/exit pattern:', error);
            throw error;
        }
    }

    /**
     * 段階的アニメーション (Staggered Animation)
     * @param {d3.Selection} selection - D3選択要素
     * @param {Object} config - アニメーション設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static createStaggered(selection, config = {}) {
        const {
            delay = 50,
            duration = ChartTransitions.CONFIG.DURATION.NORMAL,
            easing = ChartTransitions.CONFIG.EASING.QUAD_OUT,
            maxDelay = 1000
        } = config;

        return selection
            .transition()
            .duration(duration)
            .ease(easing)
            .delay((d, i) => Math.min(i * delay, maxDelay));
    }

    /**
     * 軸の更新トランジション
     * @param {d3.Selection} axisSelection - 軸要素の選択
     * @param {Function} axisGenerator - 軸生成関数
     * @param {Object} config - 設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static updateAxis(axisSelection, axisGenerator, config = {}) {
        try {
            const transition = ChartTransitions.createTransition(
                config.chartType || 'line',
                'update',
                config
            );
            
            return axisSelection
                .transition(transition)
                .call(axisGenerator);
                
        } catch (error) {
            console.error('ChartTransitions: Error updating axis:', error);
            // フォールバック: 即座に更新
            return axisSelection.call(axisGenerator);
        }
    }

    /**
     * ライン描画の統一トランジション
     * @param {d3.Selection} pathSelection - パス要素の選択
     * @param {Function} lineGenerator - ライン生成関数
     * @param {Object} config - 設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static animateLine(pathSelection, lineGenerator, config = {}) {
        try {
            const {
                chartType = 'line',
                phase = 'update',
                data = null,
                animateEntry = true
            } = config;
            
            if (phase === 'enter' && animateEntry) {
                // 描画アニメーション: パスの長さに沿って描画
                return ChartTransitions.animatePathDraw(pathSelection, lineGenerator, data, config);
            } else {
                // 通常の更新アニメーション
                const transition = ChartTransitions.createTransition(chartType, phase, config);
                return pathSelection
                    .transition(transition)
                    .attr('d', d => {
                        if (typeof lineGenerator === 'function') {
                            return lineGenerator(d.values || d);
                        } else {
                            return lineGenerator;
                        }
                    });
            }
            
        } catch (error) {
            console.error('ChartTransitions: Error animating line:', error);
            // フォールバック: 即座に更新
            return pathSelection.attr('d', d => lineGenerator(d.values || d));
        }
    }

    /**
     * パスの描画アニメーション
     * @param {d3.Selection} pathSelection - パス要素の選択
     * @param {Function} lineGenerator - ライン生成関数
     * @param {Array} data - データ
     * @param {Object} config - 設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static animatePathDraw(pathSelection, lineGenerator, data, config = {}) {
        try {
            const transition = ChartTransitions.createTransition(
                config.chartType || 'line',
                'enter',
                config
            );
            
            pathSelection.each(function(d) {
                const path = d3.select(this);
                const pathData = d.values || d;
                const totalLength = path.node().getTotalLength();
                
                path
                    .attr('d', lineGenerator(pathData))
                    .attr('stroke-dasharray', totalLength + ' ' + totalLength)
                    .attr('stroke-dashoffset', totalLength)
                    .transition(transition)
                    .attr('stroke-dashoffset', 0)
                    .on('end', function() {
                        // アニメーション完了後、dashを除去
                        d3.select(this)
                            .attr('stroke-dasharray', null)
                            .attr('stroke-dashoffset', null);
                    });
            });
            
            return transition;
            
        } catch (error) {
            console.warn('ChartTransitions: Path drawing animation failed, using fallback:', error);
            // フォールバック: 即座に表示
            return pathSelection.attr('d', d => lineGenerator(d.values || d));
        }
    }

    /**
     * 棒グラフの統一トランジション
     * @param {d3.Selection} barSelection - 棒要素の選択
     * @param {Object} scales - スケール情報 {x, y}
     * @param {Object} config - 設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static animateBars(barSelection, scales, config = {}) {
        try {
            const {
                chartType = 'bar',
                phase = 'update',
                xField = 'category',
                yField = 'value',
                innerHeight = 0
            } = config;
            
            const transition = ChartTransitions.createTransition(chartType, phase, config);
            
            if (phase === 'enter') {
                // エントリーアニメーション: 下から伸びる
                return barSelection
                    .attr('y', innerHeight)
                    .attr('height', 0)
                    .style('opacity', 0)
                    .transition(transition)
                    .attr('y', d => scales.y(+d[yField]))
                    .attr('height', d => innerHeight - scales.y(+d[yField]))
                    .style('opacity', 1);
            } else {
                // 更新アニメーション
                return barSelection
                    .transition(transition)
                    .attr('x', d => scales.x(d[xField]))
                    .attr('y', d => scales.y(+d[yField]))
                    .attr('width', scales.x.bandwidth())
                    .attr('height', d => innerHeight - scales.y(+d[yField]));
            }
            
        } catch (error) {
            console.error('ChartTransitions: Error animating bars:', error);
            throw error;
        }
    }

    /**
     * 円グラフのアーク統一トランジション
     * @param {d3.Selection} arcSelection - アーク要素の選択
     * @param {Function} arcGenerator - アーク生成関数
     * @param {Object} config - 設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static animateArcs(arcSelection, arcGenerator, config = {}) {
        try {
            const {
                chartType = 'pie',
                phase = 'update'
            } = config;
            
            const transition = ChartTransitions.createTransition(chartType, phase, config);
            
            if (phase === 'enter') {
                // エントリーアニメーション: 角度を0から拡大
                return arcSelection
                    .style('opacity', 0)
                    .attrTween('d', function(d) {
                        const interpolate = d3.interpolate({startAngle: 0, endAngle: 0}, d);
                        this._current = d; // 現在の角度を保存
                        return function(t) {
                            return arcGenerator(interpolate(t));
                        };
                    })
                    .transition(transition)
                    .style('opacity', 1);
            } else {
                // 更新アニメーション: スムーズな角度変更
                return arcSelection
                    .transition(transition)
                    .attrTween('d', function(d) {
                        const interpolate = d3.interpolate(this._current || {startAngle: 0, endAngle: 0}, d);
                        this._current = interpolate(0);
                        return function(t) {
                            return arcGenerator(interpolate(t));
                        };
                    });
            }
            
        } catch (error) {
            console.error('ChartTransitions: Error animating arcs:', error);
            throw error;
        }
    }

    /**
     * ポイント（円）の統一トランジション
     * @param {d3.Selection} circleSelection - 円要素の選択
     * @param {Object} scales - スケール情報
     * @param {Object} config - 設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static animatePoints(circleSelection, scales, config = {}) {
        try {
            const {
                chartType = 'line',
                phase = 'update',
                xField = 'year',
                yField = 'value',
                radius = 3,
                isYearData = true
            } = config;
            
            const transition = ChartTransitions.createTransition(chartType, phase, config);
            
            if (phase === 'enter') {
                // エントリーアニメーション: 小さくフェードイン
                return circleSelection
                    .attr('r', 0)
                    .style('opacity', 0)
                    .attr('cx', d => isYearData ? scales.x(+d[xField]) : scales.x(new Date(d[xField])))
                    .attr('cy', d => scales.y(+d[yField]))
                    .transition(transition)
                    .attr('r', radius)
                    .style('opacity', 1);
            } else {
                // 更新アニメーション: 位置を滑らかに移動
                return circleSelection
                    .transition(transition)
                    .attr('cx', d => isYearData ? scales.x(+d[xField]) : scales.x(new Date(d[xField])))
                    .attr('cy', d => scales.y(+d[yField]));
            }
            
        } catch (error) {
            console.error('ChartTransitions: Error animating points:', error);
            throw error;
        }
    }

    /**
     * テキストラベルの統一トランジション
     * @param {d3.Selection} textSelection - テキスト要素の選択
     * @param {Object} config - 設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static animateText(textSelection, config = {}) {
        try {
            const {
                chartType = 'line',
                phase = 'update',
                delay = 0
            } = config;
            
            const transition = ChartTransitions.createTransition(chartType, phase, config);
            
            if (phase === 'enter') {
                // エントリーアニメーション: フェードイン
                return textSelection
                    .style('opacity', 0)
                    .transition(transition)
                    .delay(delay)
                    .style('opacity', 1);
            } else {
                // 更新アニメーション: 位置や内容の変更
                return textSelection.transition(transition);
            }
            
        } catch (error) {
            console.error('ChartTransitions: Error animating text:', error);
            return textSelection;
        }
    }

    /**
     * 統合レジェンドアニメーション
     * @param {d3.Selection} legendSelection - レジェンド要素の選択
     * @param {Object} config - 設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static animateLegend(legendSelection, config = {}) {
        try {
            const {
                chartType = 'line',
                phase = 'enter',
                staggerDelay = 100
            } = config;
            
            if (phase === 'enter') {
                // 順次フェードイン
                return ChartTransitions.createStaggered(legendSelection, {
                    delay: staggerDelay,
                    duration: ChartTransitions.CONFIG.DURATION.NORMAL,
                    easing: ChartTransitions.CONFIG.EASING.QUAD_OUT
                }).style('opacity', 1);
            } else {
                const transition = ChartTransitions.createTransition(chartType, phase, config);
                return legendSelection.transition(transition);
            }
            
        } catch (error) {
            console.error('ChartTransitions: Error animating legend:', error);
            return legendSelection;
        }
    }

    /**
     * Object Constancy 管理ヘルパー
     * @param {Array} data - データ配列
     * @param {string} keyField - 一意キーフィールド
     * @param {string} prefix - キープレフィックス（オプション）
     * @returns {Array} 一意キー付きデータ
     */
    static addObjectKeys(data, keyField, prefix = '') {
        try {
            return data.map(d => ({
                ...d,
                _uniqueKey: prefix ? `${prefix}-${d[keyField]}` : String(d[keyField])
            }));
        } catch (error) {
            console.warn('ChartTransitions: Error adding object keys:', error);
            return data;
        }
    }

    /**
     * エラーハンドリング付きトランジション実行
     * @param {Function} transitionFunction - 実行するトランジション関数
     * @param {Object} context - 実行コンテキスト
     * @param {string} operation - 操作名（ログ用）
     * @returns {*} トランジション結果またはフォールバック
     */
    static safeTransition(transitionFunction, context = {}, operation = 'transition') {
        try {
            return transitionFunction();
        } catch (error) {
            console.error(`ChartTransitions: Error in ${operation}:`, error);
            
            // ErrorHandlerが利用可能な場合は使用
            if (window.ErrorHandler) {
                window.ErrorHandler.handle(error, `ChartTransitions.${operation}`, {
                    type: window.ErrorHandler.ERROR_TYPES.ANIMATION,
                    severity: window.ErrorHandler.SEVERITY.LOW,
                    context
                });
            }
            
            // フォールバックを返す（即座に実行）
            return null;
        }
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    static getDebugInfo() {
        return {
            config: ChartTransitions.CONFIG,
            d3Version: d3.version,
            animationConfigAvailable: !!window.AnimationConfig,
            appDefaultsAvailable: !!window.AppDefaults,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        };
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.ChartTransitions = ChartTransitions;