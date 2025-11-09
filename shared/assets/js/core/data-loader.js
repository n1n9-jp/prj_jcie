/**
 * DataLoader - アプリケーションデータの読み込みと整理
 * 設定ファイル、CSVデータ、地図データを読み込んで統合
 */
class DataLoader {
    /**
     * すべてのデータを読み込み
     * @returns {Promise<Object>} {config, data}
     */
    static async loadAll() {
        try {
            // 新しい設定システムを使用して設定を読み込む
            await window.ConfigLoader.loadAll();

            // ロガーを初期化（ConfigLoader後に実行）
            if (window.Logger) {
                window.Logger.init();
            }

            const config = window.ConfigLoader.getLegacyCompatibleConfig();

            // デバッグ情報を出力
            const env = window.ConfigLoader.getEnvironment();

            // content-map.jsonを読み込む（感染症対応パス）
            const citiesDataPath = window.ConfigLoader.resolveDataPath('content-map.json');
            const citiesData = await d3.json(citiesDataPath);

            // 設定から必要なデータファイルを抽出
            const dataFiles = new Set();
            config.steps.forEach(step => {
                if (step.chart?.dataFile) {
                    dataFiles.add(step.chart.dataFile);
                }
                // Dual chart の場合
                if (step.chart?.charts) {
                    step.chart.charts.forEach(chartConfig => {
                        if (chartConfig.dataFile) {
                            dataFiles.add(chartConfig.dataFile);
                        }
                    });
                }
                // Grid chart の場合
                if (step.chart?.config?.dataFile) {
                    dataFiles.add(step.chart.config.dataFile);
                }
            });

            // 動的にデータファイルを読み込む（感染症対応パス）
            const dataPromises = [
                ...Array.from(dataFiles).map(file => d3.csv(window.ConfigLoader.resolveDataPath(file))),
                d3.json(window.ConfigLoader.resolveDataPath('countries-110m.json'))
            ];

            const dataResults = await Promise.all(dataPromises);
            const mapData = dataResults.pop(); // 最後は地図データ

            // ファイル名でデータをマッピング（元のファイル名をキーとして使用）
            const csvData = {};
            Array.from(dataFiles).forEach((file, index) => {
                csvData[file] = dataResults[index];
            });

            const data = {
                csv: csvData,
                map: mapData,
                cities: citiesData
            };

            return { config, data };

        } catch (error) {
            console.error('Data loading failed:', error);
            throw error;
        }
    }
}

// グローバルスコープで利用可能にする
window.DataLoader = DataLoader;
