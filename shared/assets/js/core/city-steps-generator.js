/**
 * CityStepsGenerator - 都市ステップの生成と管理
 * 動的にDOM要素を生成し、configに都市ステップを追加
 */
class CityStepsGenerator {
    /**
     * 都市ステップを生成
     * @param {Object} citiesData - 都市データ
     * @param {Object} config - アプリケーション設定（更新される）
     * @param {Function} getCountryNameJapanese - 国名変換関数
     */
    static generateSteps(citiesData, config, getCountryNameJapanese) {
        const container = document.getElementById('city-steps-container');
        if (!container) {
            console.error('City steps container not found');
            return;
        }

        // StepMapperを使用して都市ステップの開始番号を決定
        let startStep = 11; // デフォルト値

        if (window.StepMapper) {
            const cityRange = window.StepMapper.getCityStepsRange();
            if (cityRange && cityRange.start !== undefined) {
                startStep = cityRange.start;
            }
        }

        // フォールバック：感染症別の都市ステップ開始番号
        if (startStep === 11) { // デフォルト値のままの場合のみフォールバック適用
            const diseaseType = window.DISEASE_TYPE || this._detectDiseaseFromURL();
            const cityStepStart = {
                'aids': 11,        // AIDS: step11から開始
                'tuberculosis': 11, // 結核: step11から開始
                'malariae': 23     // マラリア: step23から開始
            };
            startStep = cityStepStart[diseaseType] || 11;
        }

        // 都市データから動的にHTMLを生成（全感染症対応）
        citiesData.cities.forEach((city, index) => {
            const stepIndex = startStep + index;
            const cityIndex = index;
            const stepDiv = document.createElement('div');
            if (!stepDiv) {
                console.error('Failed to create step element');
                return;
            }
            stepDiv.className = 'step';
            stepDiv.setAttribute('data-step', `city-episodes-${cityIndex}`);

            // 都市ステップの設定をconfigに追加
            const cityStepConfig = {
                id: `city-episodes-${cityIndex}`,
                text: {
                    content: city.data.title,
                    visible: true,
                    position: {
                        width: "30%",
                        horizontal: "left",
                        vertical: "center"
                    }
                },
                chart: {
                    visible: false
                },
                map: {
                    visible: true,
                    mode: "single-city",
                    cityId: city.id,
                    center: city.coordinates ? city.coordinates : [city.longitude, city.latitude],
                    zoom: 6,
                    citiesFile: "config/content-map.json",
                    useRegionColors: true,
                    lightenNonVisited: true,
                    widthPercent: 100,
                    heightPercent: 100
                },
                image: {
                    visible: false
                }
            };

            // configに都市ステップを追加
            if (config && config.steps) {
                // 既存の同じstepがあるかチェック（論理名ベース）
                const cityStepLogicalName = `city-episodes-${cityIndex}`;
                const existingStepIndex = config.steps.findIndex(step => step.id === cityStepLogicalName);
                if (existingStepIndex !== -1) {
                    // 既存設定がある場合は、content.jsonの設定を優先してマージ
                    const existingConfig = config.steps[existingStepIndex];

                    // テキスト設定のマージ（content.jsonの位置設定を保持）
                    if (existingConfig.text && existingConfig.text.position) {
                        cityStepConfig.text.position = {
                            ...cityStepConfig.text.position,
                            ...existingConfig.text.position
                        };
                    }

                    // マップ設定のマージ
                    if (existingConfig.map) {
                        cityStepConfig.map = {
                            ...cityStepConfig.map,
                            ...existingConfig.map
                        };
                    }

                    config.steps[existingStepIndex] = cityStepConfig;
                } else {
                    config.steps.push(cityStepConfig);
                }
            }

            try {
                const countryNameJa = getCountryNameJapanese(city.country);
                stepDiv.innerHTML = `
                <div class="w-full min-h-screen flex items-center justify-center">
                    <div class="max-w-lg p-8 bg-white bg-opacity-90 rounded-lg shadow-lg mx-auto">
                        ${city.data.thumbnail ? `
                        <div class="mb-6">
                            <img src="data/thumb/${city.data.thumbnail}"
                                 alt="${city.data.title}"
                                 class="w-full h-48 object-cover rounded-lg shadow-md">
                        </div>
                        ` : ''}
                        <h2 class="text-2xl font-bold mb-4">${city.data.title}</h2>
                        <p class="text-gray-700 leading-relaxed">
                            ${city.data.description}
                        </p>
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <p class="text-sm text-gray-600">
                                <span class="font-semibold">${countryNameJa}</span>
                                (${city.country})
                            </p>
                        </div>
                        ${city.data.url ? `
                        <div class="mt-4">
                            <a href="${city.data.url}" target="_blank" rel="noopener noreferrer"
                               class="text-blue-600 hover:text-blue-800 text-sm underline">
                                詳しく知る→
                            </a>
                        </div>
                        ` : ''}
                    </div>
                </div>
                `;

                container.appendChild(stepDiv);
            } catch (error) {
                console.error('Failed to set innerHTML for city step:', error);
                console.error('City data:', city);
            }
        });
    }

    /**
     * URLから感染症タイプを検出
     * @private
     * @returns {string} 感染症タイプ
     */
    static _detectDiseaseFromURL() {
        const path = window.location.pathname;
        if (path.includes('01_aids')) return 'aids';
        if (path.includes('02_tuberculosis')) return 'tuberculosis';
        if (path.includes('03_malariae')) return 'malariae';
        return 'aids'; // デフォルト
    }
}

// グローバルスコープで利用可能にする
window.CityStepsGenerator = CityStepsGenerator;
