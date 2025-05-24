/* ------------------------------
  initialize
------------------------------ */

var main = d3.select("main");	// コンテンツ全体
var scrolly = main.select("#scrolly"); //スクロール対象全体
var figure = scrolly.select("figure"); //スクロールで変換するコンテンツ
var article = scrolly.select("article"); //テキストのブロック全体
var step = article.selectAll(".step"); //テキストのブロック一つづつ

// initialize the scrollama
var scroller = scrollama();



/* ------------------------------
  functions
------------------------------ */

var initScroll = function() {
  console.log("initScroll");

  const scroller = scrollama();

  scroller
    .setup({
      step: "#scrolly article .step",
      offset: 0.5,
      debug: false
    })
    .onStepEnter(function(response) {
      console.log('Original response:', response);
      PubSub.publishSync('handle:step-enter', response);
    });

  PubSub.publish('handle:resize');
}

var handleResize = function() {
    console.log("handleResize");

    var stepH = Math.floor(window.innerHeight * 0.75);
    step.style("height", stepH + "px");

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
    var _dataStep = response.element.getAttribute('data-step');
    console.log('data-step:', _dataStep);

    // update graphic based on step
    figure.select("p").text(_dataStep);

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
PubSub.subscribe('init:scroll', initScroll);
PubSub.subscribe('handle:resize', handleResize);
PubSub.subscribe('handle:step-enter', handleStepEnter);

// 初期化
PubSub.publish('init:scroll');
