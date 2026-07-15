// =========================================================================
// MapPhoto [MARKER & CLUSTER MODULE] - v2.5.3
// =========================================================================

// 비동기로 수집된 사진 정보들을 분석하여 대표 마커와 카운트를 생성하는 엔진
function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    const visited = new Array(photoList.length).fill(false);
    let markerDelayIndex = 0;
    
    const accurateBounds = new naver.maps.LatLngBounds();
    let actualAddedGpsCount = 0;

    for (let i = 0; i < photoList.length; i++) {
        if (visited[i]) continue;
        
        // GPS 정보가 결여된 사진 처리
        if (!photoList[i].hasGps) {
            createPhotoMarker(photoList[i].lat, photoList[i].lng, photoList[i].url, photoList[i].originalUrl, markerDelayIndex++, 0);
            continue;
        }

        const cluster = [photoList[i]];
        visited[i] = true;

        // 같은 날짜이면서 '7km(7000m)' 이내에 뭉침 탐지 연산
        for (let j = i + 1; j < photoList.length; j++) {
            if (visited[j] || !photoList[j].hasGps) continue;

            if (photoList[i].date === photoList[j].date) {
                const distance = getDistance(photoList[i].lat, photoList[i].lng, photoList[j].lat, photoList[j].lng);
                if (distance <= 7000) {
                    cluster.push(photoList[j]);
                    visited[j] = true;
                }
            }
        }

        const representativePhoto = cluster[0];
        const extraCount = cluster.length - 1;

        createPhotoMarker(
            representativePhoto.lat, 
            representativePhoto.lng, 
            representativePhoto.url, 
            representativePhoto.originalUrl, 
            markerDelayIndex++, 
            extraCount
        );

        if (representativePhoto.hasGps) {
            accurateBounds.extend(new naver.maps.LatLng(representativePhoto.lat, representativePhoto.lng));
            actualAddedGpsCount++;
        }
    }

    const currentMap = window.map || map;
    if (actualAddedGpsCount > 0 && typeof currentMap !== 'undefined' && currentMap) {
        setTimeout(() => {
            currentMap.fitBounds(accurateBounds, { top: 80, right: 80, bottom: 80, left: 80 });
        }, 200);
    }
}

// 네이버 지도 엘리먼트로 커스텀 마커 오브젝트 빌드
function createPhotoMarker(lat, lng, imageUrl, originalUrl, delayIndex, extraCount) {
    // [안전장치] window.map을 우선 타겟팅하고, 실패하면 전역 map 변수 확인
    const currentMap = window.map || (typeof map !== 'undefined' ? map : null);
    if (!currentMap) {
        console.warn("지도 객체를 아직 사용할 수 없어 마커를 생성하지 못했습니다. 타이밍을 재확인합니다.");
        return;
    }
    
    const position = new naver.maps.LatLng(lat, lng);
    injectMarkerAnimationStyles();

    const animationDelay = delayIndex * 0.08;
    
    const badgeHtml = extraCount > 0 ? `
        <div style="
            position: absolute;
            bottom: -2px;
            right: -2px;
            background: #ff4757;
            color: white;
            font-size: 11px;
            font-weight: bold;
            padding: 3px 6px;
            border-radius: 10px;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10;
            line-height: 1;
        ">+${extraCount}</div>
    ` : '';
    
    const markerContent = `
        <div class="map-photo-marker" style="
            position: relative;
            width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; 
            box-shadow: 0 3px 10px rgba(0,0,0,0.3); background: #e0e0e0;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            transform: scale(0);
            animation: markerPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            animation-delay: ${animationDelay}s;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        " onmouseover="this.style.transform='scale(1.15)';" onmouseout="this.style.transform='scale(1)'">
            <img src="${imageUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; pointer-events: none;">
            ${badgeHtml}
        </div>
    `;
    
    const marker = new naver.maps.Marker({
        position: position,
        map: currentMap,
        icon: { content: markerContent, anchor: new naver.maps.Point(27.5, 27.5) }
    });

    naver.maps.Event.addListener(marker, 'click', function() {
        const targetMap = window.map || (typeof map !== 'undefined' ? map : null);
        if (targetMap) {
            targetMap.morph(position, targetMap.getZoom(), { duration: 250 });
        }

        if (typeof openPhotoModal === 'function') {
            openPhotoModal(originalUrl);
        } else {
            console.error("photomodal.js 모듈이 로드되지 않았습니다.");
        }
    });

    // 전역 마커 어레이에 등록 시도
    if (typeof markers !== 'undefined') {
        markers.push(marker);
    }
}

function injectMarkerAnimationStyles() {
    if (document.getElementById('map-marker-animation-styles')) return;
    
    const styleHtml = `
        <style id="map-marker-animation-styles">
            @keyframes markerPopIn {
                0% { transform: scale(0); opacity: 0; }
                70% { transform: scale(1.1); }
                100% { transform: scale(1); opacity: 1; }
            }
        </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styleHtml);
}

// 거리 계산 유틸리티
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}
