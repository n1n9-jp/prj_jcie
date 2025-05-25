/* ------------------------------
  initialize
------------------------------ */

// グローバル変数
let step3ScrollDirection = 'down';
let isStep3Active = false;
let totalEpisodes = 0;
let currentEpisodeIndex = 0;
let lastDirection = 'down';
const chartManager = new ChartManager();

var main = d3.select("main");	// コンテンツ全体
var scrolly = main.select("#scrolly"); //スクロール対象全体
var article = scrolly.select("article"); //テキストのブロック全体
var step = article.selectAll(".step"); //テキストのブロック一つづつ
var figure = scrolly.select("figure"); //スクロールで変換するコンテンツ

// initialize the scrollama
var scroller = scrollama();

// データの読み込み
async function loadChartData() {
    const newInfections = await d3.csv('data/trend_new_infections.csv');
    const newDeaths = await d3.csv('data/trend_new_deaths.csv');
    const hivPositive = await d3.csv('data/HIV陽性者の割合.csv');
    const maternalFetal = await d3.csv('data/trend_maternal_fetal_infection.csv');

    return {
        newInfections,
        newDeaths,
        hivPositive,
        maternalFetal
    };
}



/* ------------------------------
  functions
------------------------------ */

var initEventHandler = function() {
    console.log("initEventHandler");

    // イベントリスナーの設定
    document.addEventListener('DOMContentLoaded', function() {
        const modal = document.getElementById('modalCountry');
        const closeModalBtn = document.getElementById('closeModal');
        
        if (modal && closeModalBtn) {
            closeModalBtn.addEventListener('click', hideModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    hideModal();
                }
            });
        }
    });

    PubSub.publish('init:chart');
}



var initChart = function() {
    console.log("initChart");
    PubSub.publish('init:map');
}



// 地図の初期化
var initMap = function() {
    console.log("initMap");
    let mapInitialized = false;

    // データ読み込み
    d3.json("data/episode.json")
        .then(episodeData => {
            d3.json("data/countries-110m.json")
                .then(data => {
                    const countries = topojson.feature(data, data.objects.countries);
                    
                    // SVGの作成（mapBgContainerに描画）
                    const mapSvgContainer = d3.select("#mapBgContainer")
                        .append("svg")
                        .attr("width", widthMap)
                        .attr("height", heightMap)
                        .call(zoom)
                        .style("cursor", "move")
                        .style("opacity", "0"); // 初期状態で非表示

                    // 地図の描画
                    const g = mapSvgContainer.append("g");
                    g.selectAll("path")
                        .data(countries.features)
                        .enter()
                        .append("path")
                        .attr("d", path)
                        .attr("class", "country")
                        .attr("data-country", d => d.properties.name)
                        .style("fill", "#ccc")
                        .style("stroke", "#fff")
                        .style("stroke-width", 0.5);

                    // グローバル変数として保存
                    window.mapSvg = g;
                    window.mapGeoData = countries.features;
                    window.mapProjection = wmProjection;
                    window.mapPath = path;
                    window.mapZoom = zoom;
                    window.mapSvgContainer = mapSvgContainer;

                    // エピソードデータの保存
                    window.mapEpisodeData = episodeData;
                    window.mapEpisodeOrder = episodeData.map(episode => {
                        return countries.features.find(country => 
                            country.properties.name === episode.country
                        );
                    }).filter(Boolean);
                    
                    // 初期化完了を通知
                    mapInitialized = true;
                    PubSub.publish('init:scroll');
                })
                .catch(error => {
                    console.error("Error loading countries data:", error);
                    throw error;
                });
        })
        .catch(error => {
            console.error("Error loading episode data:", error);
            throw error;
        });

    // 地図の初期化が完了するまでスクロールを無効化
    return new Promise((resolve) => {
        const checkMapInit = setInterval(() => {
            if (mapInitialized) {
                clearInterval(checkMapInit);
                resolve();
            }
        }, 100);
    });
}

// スクロールの初期化
var initScroll = function() {
    console.log("initScroll");

    scroller
        .setup({
            step: "#scrolly article .step",
            offset: 0.5,
            debug: false,
            progress: true
        })
        .onStepEnter(handleStepEnter)
        .onStepProgress(function(response) {
            if (!isStep3Active) return;
            
            let progress = response.progress;
            const total = window.mapEpisodeData.length;

            // 下から上の場合はprogressを反転
            if (step3ScrollDirection === 'up') {
                progress = 1 - progress;
            }

            // 進行度に基づいてエピソードインデックスを計算
            let idx = Math.floor(progress * total);
            idx = Math.max(0, Math.min(idx, total - 1));

            // 現在のエピソードインデックスと異なる場合のみ更新
            if (idx !== currentEpisodeIndex) {
                currentEpisodeIndex = idx;
                
                // エピソードデータの取得（スクロール方向に応じて）
                let episodeData;
                if (step3ScrollDirection === 'up') {
                    // 下から上へのスクロール時は、後ろから順に表示
                    episodeData = window.mapEpisodeData[total - 1 - idx];
                } else {
                    // 上から下へのスクロール時は、前から順に表示
                    episodeData = window.mapEpisodeData[idx];
                }

                if (episodeData) {
                    // 地図を該当する国にズーム
                    centerCountryOnMap(episodeData.country);

                    // モーダルの内容を更新
                    const modalData = {
                        title: `${episodeData.country}　${episodeData['タイトル']}`,
                        description: episodeData['説明文'],
                        imageUrl: `assets/thumb/${episodeData['サムネ画像']}`,
                        url: episodeData['URL']
                    };
                    
                    // モーダルを表示
                    showModal(modalData);
                }
            }
        });

    PubSub.publish('handle:resize');
}

// リサイズイベントのハンドラー
var handleResize = function() {
    console.log("handleResize");

    // ウィンドウの高さ（window.innerHeight）の半分をfigure要素の高さとして設定
    var figureHeight = window.innerHeight / 2;
    var figureMarginTop = (window.innerHeight - figureHeight) / 2;
    figure
      .style("height", figureHeight + "px")
      .style("top", figureMarginTop + "px");

    scroller.resize();
}

// ステップエンターイベントのハンドラー
const handleStepEnter = async (response) => {
    if (!response || !response.element) {
        console.warn('handleStepEnter: responseまたはelementがundefinedです', response);
        return;
    }

    const stepId = response.element.getAttribute('data-step');
    const figure = document.getElementById('mainFigure');
    const mapBgContainer = document.getElementById('mapBgContainer');
    const mapContainer = document.getElementById('mapContainer');
    
    if (!window.mapEpisodeData) {
        console.error('Episode data not loaded');
        return;
    }
    
    totalEpisodes = window.mapEpisodeData.length;
    lastDirection = response.direction;

    // チャートの表示処理
    if (stepId.startsWith('2')) {
        try {
            const data = await loadChartData();
            switch(stepId) {
                case '2a':
                    await chartManager.drawLineChart(data.newInfections, '新規HIV感染者数の推移');
                    break;
                case '2b':
                    await chartManager.drawLineChart(data.newDeaths, 'エイズ関連死亡者数の推移');
                    break;
                case '2c':
                    await chartManager.drawPieCharts(data.hivPositive);
                    break;
                case '2d':
                    await chartManager.drawLineChart(data.maternalFetal, '母子感染の推移');
                    break;
            }
        } catch (error) {
            console.error('Error drawing chart:', error);
        }
    } else if (stepId === '1' || stepId === '3') {
        // data-step=1または3の場合はチャートをクリア
        if (chartManager.currentChart) {
            chartManager.svg.selectAll('*')
                .transition()
                .duration(500)
                .style('opacity', 0)
                .remove();
            chartManager.currentChart = null;
        }
    }

    if (stepId === "3") {
        isStep3Active = true;
        step3ScrollDirection = response.direction;

        // メインフィギュアの非表示
        if (figure) {
            figure.style.display = "none";
        }

        // 地図の表示
        if (mapBgContainer) {
            mapBgContainer.style.display = "block";
            showWorldMap();
        }
        if (mapContainer) {
            mapContainer.style.display = "block";
        }

        // エピソードの表示（スクロール方向に応じて）
        if (response.direction === 'up') {
            // 下から上へのスクロール時は、最後のエピソードから開始
            currentEpisodeIndex = totalEpisodes - 1;
        } else {
            // 上から下へのスクロール時は、最初のエピソードから開始
            currentEpisodeIndex = 0;
        }

        // エピソードの表示
        let episodeData;
        if (response.direction === 'up') {
            // 下から上へのスクロール時は、後ろから順に表示
            episodeData = window.mapEpisodeData[totalEpisodes - 1 - currentEpisodeIndex];
        } else {
            // 上から下へのスクロール時は、前から順に表示
            episodeData = window.mapEpisodeData[currentEpisodeIndex];
        }

        if (episodeData) {
            // 地図を該当する国にズーム
            centerCountryOnMap(episodeData.country);

            // モーダルの内容を更新
            const modalData = {
                title: `${episodeData.country}　${episodeData['タイトル']}`,
                description: episodeData['説明文'],
                imageUrl: `assets/thumb/${episodeData['サムネ画像']}`,
                url: episodeData['URL']
            };
            
            // モーダルを表示
            showModal(modalData);
        }
    } else {
        isStep3Active = false;

        // モーダルの非表示
        hideModal();

        // 地図の非表示
        hideWorldMap();
        if (mapContainer) {
            mapContainer.style.display = "none";
        }

        // メインフィギュアの表示
        if (figure) {
            figure.style.display = "block";
        }
    }
}

// PubSubイベントの購読
PubSub.subscribe('init:event', initEventHandler);
PubSub.subscribe('init:chart', initChart);
PubSub.subscribe('init:map', initMap);
PubSub.subscribe('init:scroll', initScroll);
PubSub.subscribe('handle:resize', handleResize);

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    await chartManager.initializeCharts();
    initEventHandler();
});
