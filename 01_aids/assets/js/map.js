// 世界地図全体表示
function showWorldMap() {
    const mapSvgContainer = d3.select("#mapBgContainer svg");
    if (!mapSvgContainer.empty()) {
        const widthMap = window.innerWidth;
        const heightMap = window.innerHeight;
        
        // 地図を表示状態に設定
        mapSvgContainer.style('opacity', '1');
        
        // アニメーション付きで世界地図を表示
        mapSvgContainer.transition()
            .duration(800)
            .call(zoom.transform, d3.zoomIdentity
                .translate(widthMap / 2, heightMap / 2)
                .scale(widthMap / 2 / Math.PI));
    }
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
        country: currentEpisode.country,
        title: currentEpisode['タイトル'],
        description: currentEpisode['説明文'],
        imageUrl: `assets/thumb/${currentEpisode['サムネ画像']}`,
        url: currentEpisode['URL']
    };
    
    // モーダルを表示（アニメーション付き）
    updateModal(modalData, true);
}


// 国表示
function focusCountry(country, index) {
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