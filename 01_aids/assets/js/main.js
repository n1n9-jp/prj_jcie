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
                        .style("cursor", "move");

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
                    
                    // 世界地図を表示
                    showWorldMap();
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
            console.log('Step enter:', response);
            const stepId = response.element.getAttribute('data-step');
            const figure = document.getElementById('mainFigure');
            if (figure) {
                if (stepId === "3") {
                    figure.style.display = "none";
                } else {
                    figure.style.display = "block";
                }
            }

            const modal = document.getElementById('modalCountry');
            totalEpisodes = window.mapEpisodeData.length;

            if (stepId === "3") {
                isStep3Active = true;
                lastDirection = response.direction;
                // スクロール方向で最初/最後のエピソードを表示
                if (response.direction === 'up') {
                    currentEpisodeIndex = totalEpisodes - 1;
                } else {
                    currentEpisodeIndex = 0;
                }
                showEpisodeModal(currentEpisodeIndex);
                // モーダルを表示
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.style.opacity = '1';
                }
            } else {
                isStep3Active = false;
                // step3以外ではモーダルを必ず非表示
                if (modal) {
                    modal.style.opacity = '0';
                    modal.classList.add('hidden');
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



// 世界地図全体表示
function showWorldMap() {
    const mapSvgContainer = d3.select("#mapBgContainer svg");
    const widthMap = window.innerWidth;
    const heightMap = window.innerHeight;
    
    // アニメーション付きで世界地図を表示
    mapSvgContainer.transition()
        .duration(800)
        .call(zoom.transform, d3.zoomIdentity
            .translate(widthMap / 2, heightMap / 2)
            .scale(widthMap / 2 / Math.PI));
}

// 国を中央に表示
function centerCountryOnMap(countryName) {
    const mapSvgContainer = d3.select("#mapBgContainer svg");
    const widthMap = window.innerWidth;
    const heightMap = window.innerHeight;
    
    // 対象の国を取得
    const country = window.mapGeoData.find(c => c.properties.name === countryName);
    if (!country) {
        console.error(`Country not found: ${countryName}`);
        return;
    }

    // 国の境界を取得
    const bounds = path.bounds(country);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    // ズームレベルを6に固定
    const scale = 6;
    const translate = [
        widthMap / 2 - scale * x,
        heightMap / 2 - scale * y
    ];

    // ズームと移動
    mapSvgContainer.transition()
        .duration(800)
        .call(zoom.transform, d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale));
}

// モーダル表示
function showEpisodeModal(idx) {
    const allEpisodes = window.mapEpisodeData;
    const currentEpisode = allEpisodes[idx];
    if (!currentEpisode) return;
    
    // 地図を該当する国にズーム
    centerCountryOnMap(currentEpisode.country);

    // モーダルの内容を更新
    const modalData = {
        title: currentEpisode['タイトル'],
        description: currentEpisode['説明文'],
        imageUrl: `assets/thumb/${currentEpisode['サムネ画像']}`,
        url: currentEpisode['URL']
    };
    
    // モーダルを表示
    const modal = document.getElementById('modalCountry');
    if (modal) {
        // アニメーション付きでモーダルを更新
        updateModalContent(modalData, true);
    } else {
        console.error('Modal element not found');
    }
}

// モーダルの内容を更新（アニメーション付き）
function updateModalContent(data, withAnimation = false) {
    const modal = document.getElementById('modalCountry');
    if (!modal) {
        console.warn('Modal element not found');
        return;
    }

    // アニメーションの処理
    if (withAnimation) {
        modal.style.opacity = '0';
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 50);
    } else {
        modal.classList.remove('hidden');
        modal.style.opacity = '1';
    }

    // 画像読み込みエラーの処理
    const modalImage = document.getElementById('modalImage');
    if (modalImage) {
        modalImage.src = data.imageUrl;
        if (withAnimation) {
            // エラーメッセージの処理
            const errorDiv = modal.querySelector('.modal-error');
            if (errorDiv) errorDiv.remove();
            modalImage.onerror = function() {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'modal-error text-red-500 text-sm mt-2';
                errorDiv.textContent = '画像の読み込みに失敗しました';
                const modalDescription = document.getElementById('modalDescription');
                if (modalDescription) {
                    modalDescription.parentNode.insertBefore(errorDiv, modalDescription.nextSibling);
                }
            };
        }
    }

    // その他の内容の更新
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalUrl = document.getElementById('modalUrl');
    
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalDescription) modalDescription.textContent = data.description;
    if (modalUrl) modalUrl.href = data.url;
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
var handleStepEnter = function(message, response) {
    console.log("response", response);
    var stepId = response.element.getAttribute('data-step');
    console.log('data-step:', stepId);

    // 地図の表示・非表示制御
    var mapBgContainer = document.getElementById('mapBgContainer');
    if (mapBgContainer && typeof mapBgContainer.style !== 'undefined') {
        if (stepId === "3") {
            mapBgContainer.style.display = "block";
        } else {
            mapBgContainer.style.display = "none";
        }
    } else {
        // ここで何もしない（エラー防止）
        console.warn('mapBgContainer or its style property not found');
    }

    // 地図とモーダルの表示制御
    const mapContainer = document.getElementById('mapContainer');
    const modal = document.getElementById('modalCountry');

    // mapContainerが存在する場合のみstyleを操作
    if (mapContainer) {
        if (stepId === "3") {
            mapContainer.style.display = "block";
        } else {
            mapContainer.style.display = "none";
        }
    }
    // ステップ3以外の場合、mapContainerがnullなら何もしない
    else if (stepId !== "3") {
        // 何もしない
    }

    if (stepId === "3") {
        // ステップ3の場合
        
        // 初期表示の設定
        const allEpisodes = window.mapEpisodeData;
        const currentEpisode = allEpisodes[0];
        
        if (currentEpisode) {
            const countryName = currentEpisode.country;
            const country = window.mapEpisodeOrder.find(c => c.properties.name === countryName);
            
            if (country) {
                // 地図の表示
                showCountry(country, 0);
                
                // モーダルの表示
                const modalData = {
                    title: currentEpisode['タイトル'],
                    description: currentEpisode['説明文'],
                    imageUrl: `assets/thumb/${currentEpisode['サムネ画像']}`,
                    url: currentEpisode['URL']
                };
                showModal(modalData);
            }
        }
    } else {
        // ステップ3以外の場合
        if (mapContainer) {
            mapContainer.style.display = "none";
        }
        if (modal) {
            modal.style.opacity = '0';
            modal.classList.add('hidden');
        }
    }

    // 対応する関数を実行
    if (typeof stepFunctions !== 'undefined' && stepFunctions[stepId]) {
        stepFunctions[stepId]();
    }
    step.classed("is-active", function (d, i) {
      return i === response.index;
    });
    step.classed("bg-white text-black shadow-lg", function (d, i) {
      return i === response.index;
    });
    step.classed("bg-gray-200 text-gray-500 shadow-none", function (d, i) {
      return i !== response.index;
    });
}

// 国表示
function showCountry(country, index) {
    const mapSvgContainer = d3.select("#mapContainer svg");
    const widthMap = window.innerWidth;
    const heightMap = window.innerHeight;
    
    // 地図を中央に移動
    const bounds = path.bounds(country);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    // ズームレベルを6に固定
    const scale = 0;
    const translate = [
        widthMap / 2 - scale * x,
        heightMap / 2 - scale * y
    ];
    
    mapSvgContainer.transition()
        .duration(800)
        .call(zoom.transform, d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale));
}

// モーダル表示
function showModal(data) {
    const modal = document.getElementById('modalCountry');
    if (!modal) {
        console.warn('Modal element not found');
        return;
    }
    
    updateModalContent(data);
    
    // アニメーション付きで表示
    modal.style.opacity = '0';
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 50);
}

// モーダル内容の更新
function updateModalContent(data) {
    const modal = document.getElementById('modalCountry');
    if (!modal) {
        console.warn('Modal element not found');
        return;
    }

    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalImage = document.getElementById('modalImage');
    const modalUrl = document.getElementById('modalUrl');
    
    // 内容を更新
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalDescription) modalDescription.textContent = data.description;
    if (modalImage) modalImage.src = data.imageUrl;
    if (modalUrl) modalUrl.href = data.url;
}

// モーダルを閉じる
function hideModal() {
    const modal = document.getElementById('modalCountry');
    if (!modal) {
        console.warn('Modal element not found');
        return;
    }
    
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

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

// PubSubイベントの購読
PubSub.subscribe('init:chart', initChart);
PubSub.subscribe('init:map', initMap);
PubSub.subscribe('init:scroll', initScroll);
PubSub.subscribe('handle:resize', handleResize);
PubSub.subscribe('handle:step-enter', handleStepEnter);

// 初期化
PubSub.publish('init:chart');
