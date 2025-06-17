/**
 * AnimationConfig - アニメーション設定の共通管理クラス
 * D3.jsのトランジション設定を一元管理
 */
class AnimationConfig {
    // アニメーション速度の定数
    static SPEED = {
        INSTANT: 0,
        FAST: 300,
        NORMAL: 500,
        SLOW: 1000,
        VERY_SLOW: 2000
    };

    // イージング関数の定数
    static EASING = {
        LINEAR: d3.easeLinear,
        QUAD_IN: d3.easeQuadIn,
        QUAD_OUT: d3.easeQuadOut,
        QUAD_IN_OUT: d3.easeQuadInOut,
        CUBIC_IN: d3.easeCubicIn,
        CUBIC_OUT: d3.easeCubicOut,
        CUBIC_IN_OUT: d3.easeCubicInOut,
        ELASTIC: d3.easeElastic,
        BOUNCE: d3.easeBounce,
        BACK: d3.easeBack
    };

    // プリセット設定
    static PRESETS = {
        // 高速でスムーズな遷移（UI要素など）
        FAST_SMOOTH: {
            duration: AnimationConfig.SPEED.FAST,
            easing: AnimationConfig.EASING.QUAD_OUT
        },
        // 通常の遷移（チャート更新など）
        DEFAULT: {
            duration: AnimationConfig.SPEED.NORMAL,
            easing: AnimationConfig.EASING.QUAD_IN_OUT
        },
        // ゆっくりとした遷移（地図ズームなど）
        SLOW_SMOOTH: {
            duration: AnimationConfig.SPEED.SLOW,
            easing: AnimationConfig.EASING.CUBIC_IN_OUT
        },
        // エンターアニメーション
        ENTER: {
            duration: AnimationConfig.SPEED.NORMAL,
            easing: AnimationConfig.EASING.CUBIC_OUT
        },
        // エグジットアニメーション
        EXIT: {
            duration: AnimationConfig.SPEED.FAST,
            easing: AnimationConfig.EASING.CUBIC_IN
        },
        // バウンス効果
        BOUNCE: {
            duration: AnimationConfig.SPEED.SLOW,
            easing: AnimationConfig.EASING.BOUNCE
        },
        // 弾性効果
        ELASTIC: {
            duration: AnimationConfig.SPEED.SLOW,
            easing: AnimationConfig.EASING.ELASTIC
        }
    };

    /**
     * トランジションを適用する
     * @param {d3.Selection} selection - D3選択要素
     * @param {string|Object} preset - プリセット名またはカスタム設定
     * @param {Function} onEnd - アニメーション終了時のコールバック
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static apply(selection, preset = 'DEFAULT', onEnd = null) {
        let config;
        
        if (typeof preset === 'string') {
            config = AnimationConfig.PRESETS[preset] || AnimationConfig.PRESETS.DEFAULT;
        } else {
            config = {
                duration: preset.duration || AnimationConfig.SPEED.NORMAL,
                easing: preset.easing || AnimationConfig.EASING.QUAD_IN_OUT
            };
        }

        const transition = selection
            .transition()
            .duration(config.duration)
            .ease(config.easing);

        if (onEnd) {
            transition.on('end', onEnd);
        }

        return transition;
    }

    /**
     * 複数の要素に順次アニメーションを適用する
     * @param {d3.Selection} selection - D3選択要素
     * @param {string|Object} preset - プリセット名またはカスタム設定
     * @param {number} delay - 各要素間の遅延（ミリ秒）
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static stagger(selection, preset = 'DEFAULT', delay = 50) {
        const config = typeof preset === 'string' 
            ? AnimationConfig.PRESETS[preset] || AnimationConfig.PRESETS.DEFAULT
            : preset;

        return selection
            .transition()
            .duration(config.duration)
            .ease(config.easing)
            .delay((d, i) => i * delay);
    }

    /**
     * フェードイン効果を適用する
     * @param {d3.Selection} selection - D3選択要素
     * @param {number} duration - アニメーション時間
     * @param {number} initialOpacity - 初期の不透明度
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static fadeIn(selection, duration = AnimationConfig.SPEED.NORMAL, initialOpacity = 0) {
        return selection
            .style('opacity', initialOpacity)
            .transition()
            .duration(duration)
            .style('opacity', 1);
    }

    /**
     * フェードアウト効果を適用する
     * @param {d3.Selection} selection - D3選択要素
     * @param {number} duration - アニメーション時間
     * @param {Function} onComplete - 完了時のコールバック
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static fadeOut(selection, duration = AnimationConfig.SPEED.NORMAL, onComplete = null) {
        const transition = selection
            .transition()
            .duration(duration)
            .style('opacity', 0);

        if (onComplete) {
            transition.on('end', onComplete);
        }

        return transition;
    }

    /**
     * スケール効果を適用する
     * @param {d3.Selection} selection - D3選択要素
     * @param {number} fromScale - 開始スケール
     * @param {number} toScale - 終了スケール
     * @param {string|Object} preset - プリセット名またはカスタム設定
     * @returns {d3.Transition} トランジションオブジェクト
     */
    static scale(selection, fromScale = 0, toScale = 1, preset = 'ENTER') {
        const config = typeof preset === 'string' 
            ? AnimationConfig.PRESETS[preset] || AnimationConfig.PRESETS.DEFAULT
            : preset;

        return selection
            .attr('transform', `scale(${fromScale})`)
            .transition()
            .duration(config.duration)
            .ease(config.easing)
            .attr('transform', `scale(${toScale})`);
    }

    /**
     * カスタムtween関数を作成する
     * @param {Function} interpolator - 補間関数
     * @param {number} duration - アニメーション時間
     * @param {Function} easing - イージング関数
     * @returns {Function} tween関数
     */
    static createTween(interpolator, duration = AnimationConfig.SPEED.NORMAL, easing = AnimationConfig.EASING.QUAD_IN_OUT) {
        return function() {
            const i = interpolator.apply(this, arguments);
            return function(t) {
                return i(easing(t));
            };
        };
    }

    /**
     * 連続したトランジションを作成する
     * @param {d3.Selection} selection - D3選択要素
     * @param {Array} steps - トランジションステップの配列
     * @returns {Promise} 全てのトランジションが完了した時にresolveするPromise
     */
    static sequence(selection, steps) {
        return steps.reduce((promise, step, index) => {
            return promise.then(() => {
                return new Promise((resolve) => {
                    const transition = AnimationConfig.apply(selection, step.preset || 'DEFAULT');
                    
                    // ステップの変更を適用
                    Object.entries(step.attrs || {}).forEach(([key, value]) => {
                        transition.attr(key, value);
                    });
                    
                    Object.entries(step.styles || {}).forEach(([key, value]) => {
                        transition.style(key, value);
                    });
                    
                    transition.on('end', () => {
                        if (step.onComplete) step.onComplete();
                        resolve();
                    });
                });
            });
        }, Promise.resolve());
    }

    /**
     * アニメーションを無効化するかどうかをチェック
     * @returns {boolean} アニメーションを無効化する場合はtrue
     */
    static shouldDisableAnimation() {
        // prefers-reduced-motionメディアクエリをチェック
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * デバイスやユーザー設定に基づいて適切なアニメーション速度を取得
     * @param {number} baseSpeed - 基本速度
     * @returns {number} 調整された速度
     */
    static getAdaptiveSpeed(baseSpeed) {
        if (AnimationConfig.shouldDisableAnimation()) {
            return 0;
        }
        
        // モバイルデバイスでは少し速く
        if (window.innerWidth < (window.AppDefaults?.breakpoints?.mobile || 768)) {
            return baseSpeed * 0.8;
        }
        
        return baseSpeed;
    }
}

// グローバルスコープで利用可能にする（ES6モジュール移行前の暫定措置）
window.AnimationConfig = AnimationConfig;