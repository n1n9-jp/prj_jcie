/* ------------------------------
  initialize
------------------------------ */

// using d3 for convenience
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

function handleResize() { //ウィンドウサイズ変更

    var stepH = Math.floor(window.innerHeight * 0.75);
    step.style("height", stepH + "px");

    var figureHeight = window.innerHeight / 2;
    var figureMarginTop = (window.innerHeight - figureHeight) / 2;

    figure
      .style("height", figureHeight + "px")
      .style("top", figureMarginTop + "px");

    scroller.resize();
}



function handleStepEnter(response) { // イベントハンドラ
    console.log("response", response);
    // response = { element, direction, index }

    // add color to current step only
    step.classed("is-active", function (d, i) {
      return i === response.index;
    });

    // update graphic based on step
    figure.select("p").text(response.index + 1);
}



function init() {

    handleResize();

    scroller
      .setup({
        step: "#scrolly article .step",
        offset: 0.33,
        debug: false
      })
      .onStepEnter(handleStepEnter);
    /*
    実行条件：
        #scrolly article .step セレクタにマッチする要素（各ステップ）が
        ビューポートの33%（offset: 0.33）の位置に入った時

    実行される処理：
        現在のステップに is-active クラスを追加
        図の内容を更新（ステップ番号を表示）
    */
}



init();