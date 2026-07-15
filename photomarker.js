// =========================================================================
// MapPhoto [MARKER & CLUSTER MODULE] - v2.3.0
// =========================================================================

// 비동기로 수집된 사진 정보들을 분석하여 최종 마커를 생성하는 메인 엔진
function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    const visited = new Array(photoList.length).fill(false);
    let markerDelayIndex = 0; // [신규] 애니메이션 순차 지연을 위한 인덱스 카운터

    for (let i = 0; i < photoList.length; i++) {
        if (visited[i]) continue;
        
        // GPS 정보가 결여된 사진 처리
        if (!photoList[i].hasGps) {
            createPhotoMarker(photoList[i].lat, photoList[i].lng, photoList[i].url, photoList[i].originalUrl, markerDelayIndex++);
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

            // 마커 생성 시 순차 지연 인덱스(markerDelayIndex)를 함께 전달
            createPhotoMarker(targetLat, targetLng, photo.url, photo.originalUrl, markerDelayIndex++);
            bounds.extend(new naver.maps.LatLng(targetLat, targetLng));
        });
    }

    // 마커 생성이 완전히 끝나면 맵의 화면을 최적 피팅시킴
    if (validGpsCount > 0 && typeof map !== 'undefined') {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
}

// 네이버 지도 엘리먼트로 커스텀 마커 오브젝트 빌드
function createPhotoMarker(lat, lng, imageUrl, originalUrl, delayIndex) {
    if (typeof map === 'undefined' || !map) return;
    const position = new naver.maps.LatLng(lat, lng);
    
    // [신규] CSS Keyframes 애니메이션 스타일을 문서에 한 번만 주입
    injectMarkerAnimationStyles();

    // [개선] 초기에는 크기가 0이었다가, 약간의 시차(delay)를 두고 뿅 나타나 통통 튀는 효과 적용
    const animationDelay = delayIndex * 0.08; // 각 마커마다 0.08초의 시차를 둠
    
    const markerContent = `
        <div class="map-photo-marker" style="
            width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; 
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
