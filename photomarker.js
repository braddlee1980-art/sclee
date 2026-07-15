// =========================================================================
// MapPhoto [MARKER & CLUSTER MODULE] - v2.5.0
// =========================================================================

// 비동기로 수집된 사진 정보들을 분석하여 대표 마커와 카운트를 생성하는 엔진
function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    const visited = new Array(photoList.length).fill(false);
    let markerDelayIndex = 0;

    for (let i = 0; i < photoList.length; i++) {
        if (visited[i]) continue;
        
        // GPS 정보가 결여된 사진 처리
        if (!photoList[i].hasGps) {
            createPhotoMarker(photoList[i].lat, photoList[i].lng, photoList[i].url, photoList[i].originalUrl, markerDelayIndex++, 0);
            continue;
        }

        const cluster = [photoList[i]];
        visited[i] = true;

        // [변경] 같은 날짜이면서 '5km(5000m)' 이내에 뭉침 탐지 연산
        for (let j = i + 1; j < photoList.length; j++) {
            if (visited[j] || !photoList[j].hasGps) continue;

            if (photoList[i].date === photoList[j].date) {
                const distance = getDistance(photoList[i].lat, photoList[i].lng, photoList[j].lat, photoList[j].lng);
                if (distance <= 5000) { // 5km 기준
                    cluster.push(photoList[j]);
                    visited[j] = true;
                }
            }
        }

        // 뭉친 그룹의 첫 번째 사진을 대표 사진으로 지정
        const representativePhoto = cluster[0];
        // 나를 제외한 추가 사진 개수 계산 (예: 4장 뭉쳤으면 +3)
        const extraCount = cluster.length - 1;

        // 대표 마커 하나만 생성 (extraCount 전달)
        createPhotoMarker(
            representativePhoto.lat, 
            representativePhoto.lng, 
            representativePhoto.url, 
            representativePhoto.originalUrl, 
            markerDelayIndex++, 
            extraCount
        );

        bounds.extend(new naver.maps.LatLng(representativePhoto.lat, representativePhoto.lng));
    }

    // 마커 생성이 완전히 끝나면 맵의 화면을 최적 피팅시킴
    if (validGpsCount > 0 && typeof window.map !== 'undefined') {
        window.map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
}

// 네이버 지도 엘리먼트로 커스텀 마커 오브젝트 빌드 (+숫자 배지 추가)
function createPhotoMarker(lat, lng, imageUrl, originalUrl, delayIndex, extraCount) {
    const currentMap = window.map || map;
    if (typeof currentMap === 'undefined' || !currentMap) return;
    
    const position = new naver.maps.LatLng(lat, lng);
    injectMarkerAnimationStyles();

    const animationDelay = delayIndex * 0.08;
    
    // [신규] 2장 이상 뭉쳐있을 경우 오른쪽 하단에 붉은색/오렌지색 계열의 숫자 배지 인라인 스타일 추가
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

    // 클릭 이벤트 핸들러
    naver.maps.Event.addListener(marker, 'click', function() {
        const targetMap = window.map || map;
        if (targetMap) {
            targetMap.morph(position, targetMap.getZoom(), { duration: 250 });
        }

        if (typeof openPhotoModal === 'function') {
            openPhotoModal(originalUrl);
        } else {
            console.error("photomodal.js 모듈이 로드되지 않았습니다.");
        }
    });

    markers.push(marker);
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

// 거리 계산 유틸리티 (미터 단위를 반환)
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
