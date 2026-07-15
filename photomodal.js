// =========================================================================
// MapPhoto [MODAL UI MODULE] - v2.2.0
// =========================================================================

// 모달 레이어 팝업 HTML/CSS 동적 생성 및 초기화
function initPhotoModal() {
    if (document.getElementById('map-photo-modal')) return;

    const modalHtml = `
        <div id="map-photo-modal" style="
            display: none; position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px); z-index: 10000;
            justify-content: center; align-items: center;
            opacity: 0; transition: opacity 0.3s ease; cursor: zoom-out;
        ">
            <span style="
                position: absolute; top: 20px; right: 30px; color: #fff;
                font-size: 40px; font-weight: bold; cursor: pointer;
                user-select: none; transition: transform 0.2s ease;
            " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="closePhotoModal()">&times;</span>
            
            <img id="modal-image-content" style="
                max-width: 90%; max-height: 85%; object-fit: contain;
                border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.15);
                cursor: default;
            " onclick="event.stopPropagation();" src="" alt="확대 이미지" />
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 배경 클릭 시 닫히도록 바인딩
    const modal = document.getElementById('map-photo-modal');
    modal.addEventListener('click', closePhotoModal);
}

// 모달 열기 함수 (외부 마커 로직에서 호출됨)
function openPhotoModal(imgUrl) {
    const modal = document.getElementById('map-photo-modal');
    const modalImg = document.getElementById('modal-image-content');
    
    if (!modal || !modalImg) return;

    modalImg.src = imgUrl;
    modal.style.display = 'flex';
    
    setTimeout(() => {
        modal.style.opacity = '1';
        modalImg.style.transform = 'scale(1)';
    }, 10);
}

// 모달 닫기 함수
function closePhotoModal() {
    const modal = document.getElementById('map-photo-modal');
    const modalImg = document.getElementById('modal-image-content');
    
    if (!modal || !modalImg) return;

    modal.style.opacity = '0';
    modalImg.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
        modal.style.display = 'none';
        modalImg.src = '';
    }, 300);
}
