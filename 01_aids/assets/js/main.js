/* ------------------------------
  initialize
------------------------------ */

var main = d3.select("main");	// コンテンツ全体
var scrolly = main.select("#scrolly"); //スクロール対象全体
var article = scrolly.select("article"); //テキストのブロック全体
var step = article.selectAll(".step"); //テキストのブロック一つづつ
var figure = scrolly.select("figure"); //スクロールで変換するコンテンツ

// initialize the scrollama
var scroller = scrollama();



/* ------------------------------
  functions
------------------------------ */

var initChart = function() {
  console.log("initChart");

  PubSub.publish('init:map');
}



var initMap = function() {
  console.log("initMap");

  PubSub.publish('init:scroll');
}



var initScroll = function() {
  console.log("initScroll");

  scroller
    .setup({
      step: "#scrolly article .step",
      offset: 0.5,
      debug: false
    })
    .onStepEnter(function(response) {
      // console.log('Original response:', response);
      PubSub.publishSync('handle:step-enter', response);
    });

  PubSub.publish('handle:resize');
}



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



var handleStepEnter = function(message, response) {
    console.log("response", response);
    
    // data-stepの値を取得
    var stepId = response.element.getAttribute('data-step');
    console.log('data-step:', stepId);

    // 対応する関数を実行
    if (stepFunctions[stepId]) {
        stepFunctions[stepId]();
    }

    // add color to current step only
    step.classed("is-active", function (d, i) {
      return i === response.index;
    });
    // Tailwindクラスで状態変化を制御
    step.classed("bg-white text-black shadow-lg", function (d, i) {
      return i === response.index;
    });
    step.classed("bg-gray-200 text-gray-500 shadow-none", function (d, i) {
      return i !== response.index;
    });
}



// PubSubイベントの購読
PubSub.subscribe('init:chart', initChart);
PubSub.subscribe('init:map', initMap);
PubSub.subscribe('init:scroll', initScroll);
PubSub.subscribe('handle:resize', handleResize);
PubSub.subscribe('handle:step-enter', handleStepEnter);

// 初期化
PubSub.publish('init:chart');
