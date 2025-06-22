/**
 * CityFocusManager - 都市フォーカス機能の管理クラス
 * 単一都市モードと都市タイムライン機能を管理
 */
class CityFocusManager {
    constructor() {
        this.citiesTimelineData = null;
        this.currentCity = null;
        this.visibleCities = [];
        this.timelineMode = false;
        this.singleCityMode = false;
    }

    /**
     * 都市タイムラインデータを読み込み
     * @param {string} citiesFile - 都市データファイルのパス
     * @returns {Promise} データ読み込みのPromise
     */
    async loadCitiesData(citiesFile) {
        if (this.citiesTimelineData) {
            return this.citiesTimelineData;
        }

        return ErrorHandler.wrapAsync(async () => {
            console.log('CityFocusManager: Loading cities data from:', citiesFile);
            this.citiesTimelineData = await d3.json(citiesFile);
            console.log('CityFocusManager: Cities data loaded:', this.citiesTimelineData);
            return this.citiesTimelineData;
        }, 'CityFocusManager.loadCitiesData', {
            type: ErrorHandler.ERROR_TYPES.DATA_LOAD,
            severity: ErrorHandler.SEVERITY.MEDIUM,
            fallbackAction: () => {
                this.citiesTimelineData = { cities: [] };
            }
        });
    }

    /**
     * 都市タイムラインモードを初期化
     * @param {string} citiesFile - 都市データファイルのパス
     * @param {Function} projection - 地図プロジェクション関数
     * @param {d3.Selection} svg - SVG要素
     */
    async initializeTimelineMode(citiesFile, projection, svg) {
        try {
            await this.loadCitiesData(citiesFile);
            
            this.timelineMode = true;
            this.singleCityMode = false;
            this.visibleCities = [];
            this.currentCity = null;
            
            console.log('CityFocusManager: Timeline mode initialized');
            
        } catch (error) {
            ErrorHandler.handle(error, 'CityFocusManager.initializeTimelineMode', {
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.MEDIUM
            });
        }
    }

    /**
     * 単一都市モードを初期化
     * @param {string} citiesFile - 都市データファイルのパス
     * @param {string} cityId - 表示する都市のID
     * @returns {Promise<Object|null>} 見つかった都市データ
     */
    async initializeSingleCityMode(citiesFile, cityId) {
        try {
            await this.loadCitiesData(citiesFile);
            
            const targetCity = this.citiesTimelineData.cities.find(city => city.id === cityId);
            
            if (!targetCity) {
                console.error('CityFocusManager: City not found:', cityId);
                return null;
            }
            
            this.timelineMode = false;
            this.singleCityMode = true;
            this.visibleCities = [];
            this.currentCity = targetCity;
            
            console.log('CityFocusManager: Single city mode initialized for:', targetCity.name);
            return targetCity;
            
        } catch (error) {
            ErrorHandler.handle(error, 'CityFocusManager.initializeSingleCityMode', {
                type: ErrorHandler.ERROR_TYPES.RENDER,
                severity: ErrorHandler.SEVERITY.MEDIUM
            });
            return null;
        }
    }

    /**
     * タイムライン進行度に基づいて表示都市を計算
     * @param {number} progress - 進行度（0-1）
     * @param {string} direction - スクロール方向（'up' or 'down'）
     * @returns {Array} 表示する都市の配列
     */
    calculateVisibleCities(progress, direction = 'down') {
        if (!this.timelineMode || !this.citiesTimelineData) {
            return [];
        }
        
        // より緩やかな都市表示のために進行度を調整
        const adjustedProgress = Math.pow(progress, 0.7);
        
        // 進行度から表示する都市数を計算
        const totalCities = this.citiesTimelineData.cities.length;
        let targetCityCount = Math.floor(adjustedProgress * totalCities);
        
        // 進行度が0.1以下の場合は都市を表示しない（遅延スタート）
        if (progress < 0.1) {
            targetCityCount = 0;
        }
        
        // 最低0都市、最大全都市
        targetCityCount = Math.max(0, Math.min(targetCityCount, totalCities));
        
        // 都市を順序通りに並べ替え
        const sortedCities = [...this.citiesTimelineData.cities]
            .sort((a, b) => a.order - b.order);
        
        // 順スクロールと逆スクロールで順序を変える
        const orderedCities = direction === 'up' 
            ? [...sortedCities].reverse()
            : sortedCities;
            
        return orderedCities.slice(0, targetCityCount);
    }

    /**
     * 都市マーカーを作成/更新
     * @param {d3.Selection} mapGroup - 地図グループ要素
     * @param {Array} cities - 都市データ配列
     * @param {Function} projection - プロジェクション関数
     * @param {Object} options - 作成オプション
     */
    createCityMarkers(mapGroup, cities, projection, options = {}) {
        const {
            markerClass = 'map-city',
            markerType = 'default',
            withLabels = true,
            labelClass = 'city-label',
            animated = true
        } = options;

        if (!cities || cities.length === 0) return;

        // 都市マーカーを作成
        const markers = mapGroup.selectAll(`.${markerClass}`)
            .data(cities, d => d.id || d.name)
            .enter()
            .append('circle')
            .attr('class', markerClass)
            .attr('cx', d => {
                const coords = MapProjectionHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[0];
            })
            .attr('cy', d => {
                const coords = MapProjectionHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[1];
            })
            .attr('r', 0);

        // スタイルを適用
        const styleOptions = { markerType };
        MapStylingHelper.applyCityMarkerStyles(markers, styleOptions);

        // アニメーション
        if (animated) {
            markers.transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .delay((d, i) => markerType === 'timeline' ? i * 50 : 200)
                .attr('r', d => {
                    const style = MapStylingHelper.getCityMarkerStyle(d, styleOptions);
                    return style.radius;
                });
        } else {
            markers.attr('r', d => {
                const style = MapStylingHelper.getCityMarkerStyle(d, styleOptions);
                return style.radius;
            });
        }

        // ラベルを作成
        if (withLabels) {
            this.createCityLabels(mapGroup, cities, projection, {
                labelClass,
                markerType,
                animated
            });
        }
    }

    /**
     * 都市ラベルを作成
     * @param {d3.Selection} mapGroup - 地図グループ要素
     * @param {Array} cities - 都市データ配列
     * @param {Function} projection - プロジェクション関数
     * @param {Object} options - 作成オプション
     */
    createCityLabels(mapGroup, cities, projection, options = {}) {
        const {
            labelClass = 'city-label',
            markerType = 'default',
            animated = true
        } = options;

        const labels = mapGroup.selectAll(`.${labelClass}`)
            .data(cities, d => d.id || d.name)
            .enter()
            .append('text')
            .attr('class', labelClass)
            .attr('x', d => {
                const coords = MapProjectionHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[0];
            })
            .attr('y', d => {
                const coords = MapProjectionHelper.safeProjection(projection, [d.longitude, d.latitude]);
                const offset = d.style?.size ? d.style.size + 5 : 15;
                return coords[1] - offset;
            })
            .text(d => d.name)
            .style('opacity', 0);

        // スタイルを適用
        const styleOptions = { labelType: markerType };
        MapStylingHelper.applyCityLabelStyles(labels, styleOptions);

        // アニメーション
        if (animated) {
            labels.transition()
                .duration(window.AppDefaults?.animation?.shortDuration || 500)
                .delay((d, i) => markerType === 'timeline' ? i * 50 + 200 : 400)
                .style('opacity', 1);
        } else {
            labels.style('opacity', 1);
        }
    }

    /**
     * タイムライン都市を更新（データバインディング使用）
     * @param {d3.Selection} mapGroup - 地図グループ要素
     * @param {Array} targetCities - 表示する都市配列
     * @param {Function} projection - プロジェクション関数
     */
    updateTimelineCities(mapGroup, targetCities, projection) {
        if (!mapGroup || !projection) return;
        
        // データバインディング
        const cityMarkers = mapGroup.selectAll('.timeline-city')
            .data(targetCities, d => d.id);
        
        // 新しい都市を追加
        const enteringCities = cityMarkers.enter()
            .append('circle')
            .attr('class', 'timeline-city')
            .attr('cx', d => {
                const coords = MapProjectionHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[0];
            })
            .attr('cy', d => {
                const coords = MapProjectionHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[1];
            })
            .attr('r', 0)
            .style('opacity', 0);
        
        // スタイルを適用
        MapStylingHelper.applyCityMarkerStyles(enteringCities, { markerType: 'timeline' });
        
        // 都市の表示アニメーション
        AnimationConfig.apply(enteringCities, 'ENTER')
            .attr('r', d => d.style?.size || 6)
            .style('opacity', 1);
        
        // 都市ラベルを追加
        const cityLabels = mapGroup.selectAll('.timeline-label')
            .data(targetCities, d => d.id);
        
        const enteringLabels = cityLabels.enter()
            .append('text')
            .attr('class', 'timeline-label')
            .attr('x', d => {
                const coords = MapProjectionHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[0];
            })
            .attr('y', d => {
                const coords = MapProjectionHelper.safeProjection(projection, [d.longitude, d.latitude]);
                return coords[1] - (d.style?.size || 6) - 5;
            })
            .style('opacity', 0)
            .text(d => d.name);
        
        // ラベルスタイルを適用
        MapStylingHelper.applyCityLabelStyles(enteringLabels, { labelType: 'timeline' });
        
        AnimationConfig.apply(enteringLabels, 'ENTER')
            .delay(200)
            .style('opacity', 1);
        
        // 都市の削除アニメーション
        AnimationConfig.apply(cityMarkers.exit(), 'EXIT')
            .attr('r', 0)
            .style('opacity', 0)
            .remove();
        
        AnimationConfig.apply(cityLabels.exit(), 'EXIT')
            .style('opacity', 0)
            .remove();
        
        this.visibleCities = targetCities;
    }

    /**
     * 単一都市マーカーを表示
     * @param {d3.Selection} mapGroup - 地図グループ要素
     * @param {Object} city - 都市データ
     * @param {Function} projection - プロジェクション関数
     */
    showSingleCityMarker(mapGroup, city, projection) {
        const coords = MapProjectionHelper.safeProjection(projection, [city.longitude, city.latitude]);
        
        if (!coords) {
            console.error('Failed to project city coordinates:', city);
            return;
        }
        
        // 都市マーカーを追加
        const marker = mapGroup.append('circle')
            .attr('class', 'single-city-marker')
            .attr('cx', coords[0])
            .attr('cy', coords[1])
            .attr('r', 0)
            .style('opacity', 0);
        
        // スタイルを適用
        MapStylingHelper.applyCityMarkerStyles(marker, { markerType: 'single' });
        
        // アニメーション
        AnimationConfig.apply(marker, 'BOUNCE')
            .attr('r', city.style?.size ? city.style.size * 1.5 : 9)
            .style('opacity', 1);
        
        // 都市ラベルを追加
        const label = mapGroup.append('text')
            .attr('class', 'single-city-label')
            .attr('x', coords[0])
            .attr('y', coords[1] - (city.style?.size ? city.style.size * 1.5 : 9) - 8)
            .style('opacity', 0)
            .text(city.name);
        
        MapStylingHelper.applyCityLabelStyles(label, { labelType: 'single' });
        
        AnimationConfig.apply(label, 'ENTER')
            .delay(400)
            .style('opacity', 1);
        
        // 地理的情報をHTMLに動的表示
        this.updateGeographicInfo(city);
    }

    /**
     * 地理的情報をHTMLに動的表示
     * @param {Object} city - 都市データ
     */
    updateGeographicInfo(city) {
        const stepId = city.order + 2; // step3から開始（order 1 = step3）
        const geoInfoContainer = document.getElementById(`geographic-info-${stepId}`);
        
        if (!geoInfoContainer) {
            console.log('Geographic info container not found for step:', stepId);
            return;
        }
        
        // 地理的情報を非表示にする
        geoInfoContainer.style.display = 'none';
    }

    /**
     * 現在訪問中の国名を取得
     * @param {string} cityId - 都市ID
     * @returns {string|null} 訪問国名
     */
    getCurrentVisitedCountry(cityId = null) {
        if (!this.citiesTimelineData) return null;
        
        const targetCityId = cityId || (this.currentCity && this.currentCity.id);
        if (!targetCityId) return null;
        
        const city = this.citiesTimelineData.cities.find(c => c.id === targetCityId);
        return city ? city.country : null;
    }

    /**
     * すべての都市マーカーとラベルを削除
     * @param {d3.Selection} mapGroup - 地図グループ要素
     * @param {boolean} animated - アニメーション使用するかどうか
     */
    clearAllCityElements(mapGroup, animated = true) {
        const elements = mapGroup.selectAll('.map-city, .city-label, .timeline-city, .timeline-label, .single-city-marker, .single-city-label, .single-city-info');
        
        if (animated) {
            AnimationConfig.fadeOut(elements, window.AppDefaults?.animation?.defaultDuration || 300)
                .on('end', () => elements.remove());
        } else {
            elements.remove();
        }
    }

    /**
     * 現在の状態を取得
     * @returns {Object} 現在の状態
     */
    getCurrentState() {
        return {
            timelineMode: this.timelineMode,
            singleCityMode: this.singleCityMode,
            currentCity: this.currentCity,
            visibleCities: this.visibleCities,
            citiesCount: this.citiesTimelineData ? this.citiesTimelineData.cities.length : 0
        };
    }

    /**
     * 状態をリセット
     */
    reset() {
        this.timelineMode = false;
        this.singleCityMode = false;
        this.currentCity = null;
        this.visibleCities = [];
        // データはキャッシュとして保持
    }
}

// グローバルスコープで利用可能にする
window.CityFocusManager = CityFocusManager;