/**
 * EventHandlers - スクロールイベントハンドリング
 * scrollamaのイベント処理を統合管理
 */
class EventHandlers {
    /**
     * ステップ進入時のイベント処理
     * @param {Object} response - scrollamaのレスポンス
     * @param {Object} context - メインアプリケーションのコンテキスト（config, getChartData等）
     */
    static handleStepEnter(response, context) {
        const { index, direction } = response;
        const stepLogicalName = response.element.getAttribute('data-step');
        const stepConfig = context.config?.steps?.find(step => step.id === stepLogicalName);

        if (!stepConfig) {
            return;
        }

        // チャート更新
        if (stepConfig.chart) {
            this._updateChart(stepConfig, direction, context);
        }

        // 地図更新
        if (stepConfig.map) {
            pubsub.publish(EVENTS.MAP_UPDATE, stepConfig.map);
        }

        // 画像更新
        if (stepConfig.image) {
            pubsub.publish(EVENTS.IMAGE_UPDATE, stepConfig.image);
        }

        // ステップ進入イベント
        pubsub.publish(EVENTS.STEP_ENTER, { index, direction, stepConfig });
    }

    /**
     * ステップ退出時のイベント処理
     * @param {Object} response - scrollamaのレスポンス
     */
    static handleStepExit(response) {
        const { index, direction } = response;
        pubsub.publish(EVENTS.STEP_EXIT, { index, direction });
    }

    /**
     * ステップ進行度変化時のイベント処理
     * @param {Object} response - scrollamaのレスポンス
     * @param {Object} context - メインアプリケーションのコンテキスト
     */
    static handleStepProgress(response, context) {
        const { index, progress, direction } = response;
        const stepLogicalName = response.element.getAttribute('data-step');
        const stepConfig = context.config?.steps?.find(step => step.id === stepLogicalName);

        if (!stepConfig) {
            return;
        }

        // 都市タイムラインモードの場合のみ進行度イベントを発行
        if (stepConfig.map?.mode === "cities-timeline") {
            pubsub.publish(EVENTS.MAP_PROGRESS, {
                progress: progress,
                direction: direction,
                config: stepConfig.map
            });
        }
    }

    /**
     * チャート更新処理（内部メソッド）
     * @private
     * @param {Object} stepConfig - ステップ設定
     * @param {string} direction - スクロール方向
     * @param {Object} context - メインアプリケーションのコンテキスト
     */
    static _updateChart(stepConfig, direction, context) {
        if (stepConfig.chart.visible === false) {
            pubsub.publish(EVENTS.CHART_UPDATE, { visible: false });
            return;
        }

        let updateMode = stepConfig.chart.updateMode || 'replace';

        // 逆方向スクロールでトランジション対応を判定
        if (direction === 'up') {
            const allSteps = document.querySelectorAll('.step[data-step]');
            const currentStepIndex = Array.from(allSteps).findIndex(step =>
                step.getAttribute('data-step') === stepConfig.id
            );

            if (currentStepIndex >= 0 && currentStepIndex < allSteps.length - 1) {
                const nextStepElement = allSteps[currentStepIndex + 1];
                const nextStepLogicalName = nextStepElement.getAttribute('data-step');
                const nextStepConfig = context.config?.steps?.find(step => step.id === nextStepLogicalName);

                if (nextStepConfig?.chart?.dataFile === stepConfig.chart.dataFile &&
                    nextStepConfig?.chart?.updateMode === 'transition') {
                    updateMode = 'transition';
                }
            }
        }

        // レイアウト別のチャートデータ生成
        const layout = stepConfig.chart.layout || 'single';
        let chartData;

        if (layout === 'dual' || layout === 'triple') {
            const chartsWithData = stepConfig.chart.charts.map((chartConfig) => ({
                ...chartConfig,
                data: context.getChartData(chartConfig.type, chartConfig.dataFile)
            }));

            chartData = {
                ...stepConfig.chart,
                ...stepConfig.chart.config,
                charts: chartsWithData,
                updateMode: updateMode,
                direction: direction,
                layout: layout
            };
        } else if (layout === 'grid') {
            chartData = {
                ...stepConfig.chart,
                ...stepConfig.chart.config,
                type: 'grid',
                data: context.getChartData('pie', stepConfig.chart.config.dataFile),
                updateMode: updateMode,
                direction: direction
            };
        } else {
            chartData = {
                ...stepConfig.chart,
                ...stepConfig.chart.config,
                data: context.getChartData(stepConfig.chart.type, stepConfig.chart.dataFile),
                updateMode: updateMode,
                direction: direction
            };
        }

        pubsub.publish(EVENTS.CHART_UPDATE, chartData);
    }
}

// グローバルスコープで利用可能にする
window.EventHandlers = EventHandlers;
