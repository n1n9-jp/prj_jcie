// モーダル表示
function showModal(data) {
    const modal = document.getElementById('modalCountry');
    if (!modal) {
        console.warn('Modal element not found');
        return;
    }
    
    // モーダルの内容を更新
    updateBasicModalContent(data);
    
    // アニメーション付きで表示
    modal.style.opacity = '0';
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
}

// モーダル内容の更新
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
    
    if (modalTitle) modalTitle.textContent = `${data.country}　${data.title}`;
    if (modalDescription) modalDescription.textContent = data.description;
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