// モーダル表示
function showModal(data) {
    console.log('Showing modal with data:', data);

    const modal = document.getElementById('modalCountry');
    if (!modal) {
        console.warn('Modal element not found');
        return;
    }
    
    // 既存のモーダルを非表示にする
    modal.style.opacity = '0';
    
    // モーダルの内容を更新
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalImage = document.getElementById('modalImage');
    const modalUrl = document.getElementById('modalUrl');

    if (modalTitle) {
        modalTitle.textContent = data.title || '';
    }
    
    if (modalDescription) {
        modalDescription.textContent = data.description || '';
    }
    
    if (modalImage && data.imageUrl) {
        modalImage.src = data.imageUrl;
        modalImage.onerror = function() {
            console.error('Error loading image:', data.imageUrl);
            this.src = 'assets/thumb/default.jpg';
        };
    }

    if (modalUrl && data.url) {
        modalUrl.href = data.url;
        modalUrl.style.display = 'block';
    } else if (modalUrl) {
        modalUrl.style.display = 'none';
    }

    // モーダルを表示
    modal.style.display = 'block';
    
    // アニメーション付きで表示
    requestAnimationFrame(() => {
        modal.style.transition = 'opacity 0.3s ease';
        modal.style.opacity = '1';
    });
}

// エピソードモーダルの表示
function showEpisodeModal(index) {
    console.log('Showing episode modal for index:', index);

    if (!window.mapEpisodeData || !window.mapEpisodeData[index]) {
        console.warn('Episode data not found for index:', index);
        return;
    }

    const episodeData = window.mapEpisodeData[index];
    console.log('Episode data:', episodeData);

    // モーダルの内容を更新
    const modalData = {
        title: `${episodeData.country}　${episodeData['タイトル']}`,
        description: episodeData['説明文'],
        imageUrl: `assets/thumb/${episodeData['サムネ画像']}`,
        url: episodeData['URL']
    };
    
    // モーダルを表示する前に、既存のモーダルを非表示にする
    const modal = document.getElementById('modalCountry');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            showModal(modalData);
        }, 100);
    }

    // 対応する国をハイライト
    const country = window.mapEpisodeOrder[index];
    if (country) {
        // すべての国をデフォルトの色に戻す
        window.mapSvg.selectAll('.country')
            .transition()
            .duration(300)
            .style('fill', '#ccc')
            .style('stroke', '#fff');
        
        // 選択された国をハイライト
        window.mapSvg.selectAll('.country')
            .filter(d => d.properties.name === country.properties.name)
            .transition()
            .duration(300)
            .style('fill', '#ff0000')
            .style('stroke', '#ff0000');
    }
}

// モーダルの内容を更新
function updateModal(data, withAnimation = false) {
    const modal = document.getElementById('modalCountry');
    if (!modal) {
        console.warn('Modal element not found');
        return;
    }

    // アニメーションの処理
    if (withAnimation) {
        modal.style.opacity = '0';
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
        });
    } else {
        modal.classList.remove('hidden');
        modal.style.opacity = '1';
    }

    // 画像読み込みエラーの処理
    const modalImage = document.getElementById('modalImage');
    if (modalImage) {
        modalImage.src = `assets/thumb/${data['サムネ画像']}`;
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
    
    if (modalTitle) modalTitle.textContent = `${data.country}　${data['タイトル']}`;
    if (modalDescription) modalDescription.textContent = data['説明文'];
    if (modalUrl) modalUrl.href = data['URL'];
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
        modal.style.display = 'none';
    }, 300);
}