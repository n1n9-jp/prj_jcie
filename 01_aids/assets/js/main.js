/* ------------------------------
  initialize
------------------------------ */

var main = d3.select("main");	// コンテンツ全体
var scrolly = main.select("#scrolly"); //スクロール対象全体
var article = scrolly.select("article"); //テキストのブロック全体
var step = article.selectAll(".step"); //テキストのブロック一つづつ
var figure = scrolly.select("figure"); //スクロールで変換するコンテンツ

// 地図関連のグローバル変数
var widthMap = window.innerWidth;
var heightMap = window.innerHeight;
var wmProjection = d3.geoMercator()
    .scale(widthMap / 2 / Math.PI)
    .translate([widthMap / 2, heightMap / 2]);
var path = d3.geoPath().projection(wmProjection);

// 地図のズーム機能の設定
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", () => {
        d3.select("#mapBgContainer svg g")
            .attr("transform", d3.event.transform);
    });

// initialize the scrollama
var scroller = scrollama();




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
    d3.json("assets/data/episode.json")
        .then(episodeData => {
            d3.json("assets/data/countries-110m.json")
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

    let isStep3Active = false;
    let totalEpisodes = 0;
    let currentEpisodeIndex = 0;
    let lastDirection = 'down';

    scroller
        .setup({
            step: "#scrolly article .step",
            offset: 0.5,
            debug: false,
            progress: true
        })
        .onStepEnter(function(response) {
            const stepId = response.element.getAttribute('data-step');
            const figure = document.getElementById('mainFigure');
            const modal = document.getElementById('modalCountry');
            const mapBgContainer = document.getElementById('mapBgContainer');
            const mapContainer = document.getElementById('mapContainer');
            
            totalEpisodes = window.mapEpisodeData.length;

            if (stepId === "3") {
                isStep3Active = true;
                lastDirection = response.direction;

                // 地図の表示
                if (mapBgContainer) {
                    mapBgContainer.style.display = "block";
                    showWorldMap();
                }
                if (mapContainer) {
                    mapContainer.style.display = "block";
                }

                // エピソードの表示
                if (response.direction === 'up') {
                    currentEpisodeIndex = totalEpisodes - 1;
                } else {
                    currentEpisodeIndex = 0;
                }
                showEpisodeModal(currentEpisodeIndex);

                // モーダルの表示
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.style.opacity = '1';
                }

                // メインフィギュアの非表示
                if (figure) {
                    figure.style.display = "none";
                }
            } else {
                isStep3Active = false;

                // 地図の非表示
                if (mapBgContainer) {
                    mapBgContainer.style.display = "none";
                }
                if (mapContainer) {
                    mapContainer.style.display = "none";
                }

                // モーダルの非表示
                if (modal) {
                    modal.style.opacity = '0';
                    modal.classList.add('hidden');
                }

                // メインフィギュアの表示
                if (figure) {
                    figure.style.display = "block";
                }
            }

            PubSub.publishSync('handle:step-enter', response);
        })
        .onStepProgress(function(response) {
            if (!isStep3Active) return;
            const modal = document.getElementById('modalCountry');
            const progress = response.progress;
            const direction = response.direction;
            const total = window.mapEpisodeData.length;

            // directionがundefinedになる場合があるので、lastDirectionを利用
            let dir = direction || lastDirection;

            // indexを計算
            let idx = Math.floor(progress * total);
            if (idx >= total) idx = total - 1;
            if (idx < 0) idx = 0;

            // スクロール方向で順序を切り替え
            if (dir === 'up') {
                idx = total - 1 - idx;
            }

            // step3に入った直後(progress=0)は、onStepEnterで強制的にindexをセットしているので、ここでのshowEpisodeModalは不要
            if (progress === 0 && ((dir === 'down' && currentEpisodeIndex === 0) || (dir === 'up' && currentEpisodeIndex === total - 1))) {
                // 何もしない
            } else if (idx !== currentEpisodeIndex) {
                currentEpisodeIndex = idx;
                showEpisodeModal(currentEpisodeIndex);
            }

            // step3内で常にモーダルを表示
            if (modal && modal.classList.contains('hidden')) {
                modal.classList.remove('hidden');
                modal.style.opacity = '1';
            }
        });

    PubSub.publish('handle:resize');
}





// リサイズイベントのハンドラー
var handleResize = function() {
    console.log("handleResize");

    // ウィンドウの高さ（window.innerHeight）の75%をstep要素の高さとして設定
    var stepH = Math.floor(window.innerHeight * 1.0);
    step.style("height", stepH + "px");

    // ウィンドウの高さ（window.innerHeight）の半分をfigure要素の高さとして設定
    var figureHeight = window.innerHeight / 2;
    var figureMarginTop = (window.innerHeight - figureHeight) / 2;
    figure
      .style("height", figureHeight + "px")
      .style("top", figureMarginTop + "px");

    scroller.resize();
}



// ステップエンターイベントのハンドラー
const handleStepEnter = (response) => {
    const { element, direction } = response;
    const stepId = element.getAttribute('data-step');
    const isStep3 = stepId === "3";

    // 地図の表示制御
    if (isStep3) {
        // 地図を表示
        showWorldMap();
        
        // エピソードの表示
        const episodes = window.mapEpisodeOrder;
        if (episodes && episodes.length > 0) {
            const episodeIndex = direction === 'down' ? 0 : episodes.length - 1;
            const episode = episodes[episodeIndex];
            const episodeData = window.mapEpisodeData[episodeIndex];
            
            if (episode && episodeData) {
                showEpisodeModal(episode, episodeData);
            }
        }
    } else {
        // 地図を非表示
        const mapSvgContainer = d3.select("#mapBgContainer svg");
        if (!mapSvgContainer.empty()) {
            mapSvgContainer.style("opacity", "0");
        }
    }
}



// PubSubイベントの購読
PubSub.subscribe('init:event', initEventHandler);
PubSub.subscribe('init:chart', initChart);
PubSub.subscribe('init:map', initMap);
PubSub.subscribe('init:scroll', initScroll);
PubSub.subscribe('handle:resize', handleResize);
PubSub.subscribe('handle:step-enter', handleStepEnter);

// 初期化
PubSub.publish('init:event');
