// =========================================================================
// MapPhoto [MARKER & CLUSTER MODULE] - v2.2.0
// =========================================================================

// 비동기로 수집된 사진 정보들을 분석하여 최종 마커를 생성하는 메인 엔진
function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    const visited = new Array(photoList.length).fill(false);

    for (let i = 0; i < photoList.length; i++) {
        if (visited[i]) continue;
        
        // GPS 정보가 결여된 사진 처리
        if (!photoList[i].hasGps) {
            createPhotoMarker(photoList[i].lat, photoList[i].lng, photoList[i].url, photoList[i].originalUrl);
            continue;
        }

        const cluster = [photoList[i]];
        visited[i] = true;

        // 100m 이내 같은 날짜 뭉침 탐지 연산
        for (let j = i + 1; j < photoList.length; j++) {
            if (visited[j] || !photoList[j].hasGps) continue;

            if (photoList[i].date === photoList[j].date) {
                const distance = getDistance(photoList[i].lat, photoList[i].lng, photoList[j].lat, photoList[j].lng);
                if (distance <= 100) {
                    cluster.push(photoList[j]);
                    visited[j] = true;
                }
            }
        }

        // 뭉친 사진들 반 이상 겹치지 않게 나선형 분산 적용
        cluster.forEach((photo, index) => {
            let targetLat = photo.lat;
            let targetLng = photo.lng;

            if (index > 0) {
                const angle = index * 2.39996; 
                const radius = 0.00035 * Math.sqrt(index);
                targetLat += radius * Math.sin(angle);
                targetLng += radius * Math.cos(angle) * 1.2;
            }

            createPhotoMarker(targetLat, targetLng, photo.url, photo.originalUrl);
            bounds.extend(new naver.maps.LatLng(targetLat, targetLng));
        });
    }

    // 마커 생성이 완전히 끝나면 맵의 화면을 최적 피팅시킴
    if (validGpsCount > 0 && typeof map !== 'undefined') {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
}

// 네이버 지도 엘리먼트로 커스텀 마커 오브젝트 빌드
function createPhotoMarker(lat, lng, imageUrl, originalUrl) {
    if (typeof map === 'undefined' || !map) return;
    const position = new naver.maps.LatLng(lat, lng);
    
    const markerContent = `
        <div class="map-photo-marker" style="
            width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; 
            box-shadow: 0 3px 10px rgba(0,0,0,0.3); overflow: hidden; background: #e0e0e0;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer;
        " onmouseover="this.style.transform='scale(1.15)';" onmouseout="this.style.transform='scale(1)'">
            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;">
        </div>
    `;
    
    const marker = new naver.maps.Marker({
        position: position,
        map: map,
        icon: { content: markerContent, anchor: new naver.maps.Point(27.5, 27.5) }
    });

    // 마커 클릭 시 외부 모듈(photomodal.js)의 함수 호출 연동
    naver.maps.Event.addListener(marker, 'click', function() {
        if (typeof openPhotoModal === 'function') {
            openPhotoModal(originalUrl);
        } else {
            console.error("photomodal.js 모듈이 로드되지 않았습니다.");
        }
    });

    markers.push(marker);
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
