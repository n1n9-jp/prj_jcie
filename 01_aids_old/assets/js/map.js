// 地図関連の定数
const MAP_CONFIG = {
    TRANSITION_DURATION: {
        SHOW: 800,
        HIDE: 500,
        ZOOM: 800
    },
    ZOOM: {
        MIN_SCALE: 1,
        MAX_SCALE: 8,
        COUNTRY_SCALE_FACTOR: 0.8
    }
};

// 地図関連のグローバル変数
let widthMap = window.innerWidth;
let heightMap = window.innerHeight;
let wmProjection = d3.geoMercator()
    .scale(widthMap / 2 / Math.PI)
    .translate([widthMap / 2, heightMap / 2]);
let path = d3.geoPath().projection(wmProjection);
let zoom = d3.zoom()
    .scaleExtent([MAP_CONFIG.ZOOM.MIN_SCALE, MAP_CONFIG.ZOOM.MAX_SCALE])
    .on("zoom", (event) => {
        d3.select("#mapBgContainer svg g")
            .attr("transform", event.transform);
    });

/**
 * 地図の初期化状態を確認
 * @returns {boolean} 初期化されている場合はtrue
 */
function isMapInitialized() {
    if (!window.mapSvgContainer) {
        console.error('Map not initialized: mapSvgContainer is not defined');
        return false;
    }
    return true;
}

/**
 * 現在のウィンドウサイズを取得
 * @returns {Object} width と height を含むオブジェクト
 */
function getMapDimensions() {
    return {
        width: window.innerWidth,
        height: window.innerHeight
    };
}

/**
 * 地図を表示する
 */
function showWorldMap() {
    if (!isMapInitialized()) {
        return;
    }

    const { width, height } = getMapDimensions();
    const initialScale = width / 2 / Math.PI;
    
    // 地図を表示状態に設定
    window.mapSvgContainer
        .style('opacity', '1')
        .transition()
        .duration(MAP_CONFIG.TRANSITION_DURATION.SHOW)
        .call(window.mapZoom.transform, d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(initialScale));
}

/**
 * 地図を非表示にする
 */
function hideWorldMap() {
    if (!isMapInitialized()) {
        return;
    }

    window.mapSvgContainer
        .transition()
        .duration(MAP_CONFIG.TRANSITION_DURATION.HIDE)
        .style('opacity', '0')
        .on('end', () => {
            const mapBgContainer = document.getElementById('mapBgContainer');
            if (mapBgContainer) {
                mapBgContainer.style.display = 'none';
            }
        });
}

/**
 * 指定された国を中心にズームする
 * @param {string} countryName - ズーム対象の国名
 */
function centerCountryOnMap(countryName) {
    if (!isMapInitialized()) {
        return;
    }

    if (!window.mapGeoData) {
        console.error('Map not initialized: mapGeoData is not defined');
        return;
    }

    const country = window.mapGeoData.find(c => c.properties.name === countryName);
    if (!country) {
        console.warn(`Country not found: ${countryName}`);
        return;
    }

    const bounds = window.mapPath.bounds(country);
    const { width, height } = getMapDimensions();
    
    // ズームスケールの計算
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const scale = MAP_CONFIG.ZOOM.COUNTRY_SCALE_FACTOR / Math.max(dx / width, dy / height);
    
    // 中心位置の計算
    const centerX = (bounds[0][0] + bounds[1][0]) / 2;
    const centerY = (bounds[0][1] + bounds[1][1]) / 2;
    const translate = [
        width / 2 - scale * centerX,
        height / 2 - scale * centerY
    ];

    window.mapSvgContainer
        .transition()
        .duration(MAP_CONFIG.TRANSITION_DURATION.ZOOM)
        .call(window.mapZoom.transform, d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale));
}
