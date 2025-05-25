// 地図関連のグローバル変数
let widthMap = window.innerWidth;
let heightMap = window.innerHeight;
let wmProjection = d3.geoMercator()
    .scale(widthMap / 2 / Math.PI)
    .translate([widthMap / 2, heightMap / 2]);
let path = d3.geoPath().projection(wmProjection);
let zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
        d3.select("#mapBgContainer svg g")
            .attr("transform", event.transform);
    });

// 世界地図全体表示
function showWorldMap() {
    if (!window.mapSvgContainer) {
        console.error('Map not initialized');
        return;
    }

    const widthMap = window.innerWidth;
    const heightMap = window.innerHeight;
    
    // 地図を表示状態に設定
    window.mapSvgContainer
        .style('opacity', '1')
        .transition()
        .duration(800)
        .call(window.mapZoom.transform, d3.zoomIdentity
            .translate(widthMap / 2, heightMap / 2)
            .scale(widthMap / 2 / Math.PI));
}

// 地図を非表示にする
function hideWorldMap() {
    if (!window.mapSvgContainer) {
        console.error('Map not initialized');
        return;
    }

    window.mapSvgContainer
        .transition()
        .duration(500)
        .style('opacity', '0')
        .on('end', () => {
            const mapBgContainer = document.getElementById('mapBgContainer');
            if (mapBgContainer) {
                mapBgContainer.style.display = 'none';
            }
        });
}

// 国を中心にズーム
function centerCountryOnMap(countryName) {
    if (!window.mapGeoData || !window.mapSvgContainer) {
        console.error('Map not initialized');
        return;
    }

    const country = window.mapGeoData.find(c => c.properties.name === countryName);
    if (!country) {
        console.warn('Country not found:', countryName);
        return;
    }

    const bounds = window.mapPath.bounds(country);
    const widthMap = window.innerWidth;
    const heightMap = window.innerHeight;
    const scale = 0.8 / Math.max((bounds[1][0] - bounds[0][0]) / widthMap, (bounds[1][1] - bounds[0][1]) / heightMap);
    const translate = [
        widthMap / 2 - scale * (bounds[0][0] + bounds[1][0]) / 2,
        heightMap / 2 - scale * (bounds[0][1] + bounds[1][1]) / 2
    ];

    window.mapSvgContainer
        .transition()
        .duration(800)
        .call(window.mapZoom.transform, d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale));
}
