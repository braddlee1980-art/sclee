// =========================================================================
// MapPhoto [MARKER & CLUSTER MODULE] - v2.5.4
// =========================================================================

// 비동기로 수집된 사진 정보들을 분석하여 대표 마커와 카운트를 생성하는 엔진 (안전성 강화 버전)
function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    // 1. 전달된 사진 리스트 유효성 선행 검증
    if (!photoList || !Array.isArray(photoList) || photoList.length === 0) {
        console.warn("처리할 사진 데이터 리스트가 비어있습니다.");
        return;
    }

    const visited = new Array(photoList.length).fill(false);
    let markerDelayIndex = 0;
    
    // 안전한 화면 맞춤을 위한 전용 바운드 객체 생성
    const accurateBounds = new naver.maps.LatLngBounds();
    let actualAddedGpsCount = 0;

    for (let i = 0; i < photoList.length; i++) {
        // 혹시 모를 깨진 데이터 방어 코드
        if (!photoList[i]) continue;
        if (visited[i]) continue;
        
        // GPS 정보가 결여된 사진 처리
        if (!photoList[i].hasGps || isNaN(photoList[i].lat) || isNaN(photoList[i].lng)) {
            // 위경도가 올바른 숫자인지 최종 검증 후 마커 생성
            const safeLat = !isNaN(photoList[i].lat) ? photoList[i].lat : 37.555142;
            const safeLng = !isNaN(photoList[i].lng) ? photoList[i].lng : 126.970447;
            createPhotoMarker(safeLat, safeLng, photoList[i].url, photoList[i].originalUrl, markerDelayIndex++, 0);
            visited[i] = true;
            continue;
        }

        const cluster = [photoList[i]];
        visited[i] = true;

        // 7km(7000m) 이내 뭉침 연산 시 발생할 수 있는 에러 철저 방어
        for (let j = i + 1; j < photoList.length; j++) {
            if (!photoList[j]) continue;
            if (visited[j]) continue;
            if (!photoList[j].hasGps || isNaN(photoList[j].lat) || isNaN(photoList[j].lng)) continue;

            // 날짜 정보 안전 처리 (날짜 정보가 비어있을 경우 대비)
            const dateI = photoList[i].date || "NO_DATE";
            const dateJ = photoList[j].date || "NO_DATE";

            if (dateI === dateJ) {
                try {
                    const distance = getDistance(photoList[i].lat, photoList[i].lng, photoList[j].lat, photoList[j].lng);
                    // 거리 연산 결과가 유효한 숫자인지 더블 체크
                    if (!isNaN(distance) && distance <= 7000) {
                        cluster.push(photoList[j]);
                        visited[j] = true;
                    }
                } catch (err) {
                    console.error("거리 계산 도중 예외 발생:", err);
                }
            }
        }

        // 뭉친 그룹의 첫 번째 사진을 대표 사진으로 지정
        const representativePhoto = cluster[0];
        if (!representativePhoto) continue;

        const extraCount = cluster.length - 1;

        // 최종 안전성 검증이 완료된 대표 마커 생성
        createPhotoMarker(
            representativePhoto.lat, 
            representativePhoto.lng, 
            representativePhoto.url, 
            representativePhoto.originalUrl, 
            markerDelayIndex++, 
            extraCount
        );

        if (representativePhoto.hasGps && !isNaN(representativePhoto.lat) && !isNaN(representativePhoto.lng)) {
            accurateBounds.extend(new naver.maps.LatLng(representativePhoto.lat, representativePhoto.lng));
            actualAddedGpsCount++;
        }
    }

    // 맵 화면 최적 피팅 실행
    const currentMap = window.map || (typeof map !== 'undefined' ? map : null);
    if (actualAddedGpsCount > 0 && currentMap) {
        setTimeout(() => {
            try {
                currentMap.fitBounds(accurateBounds, { top: 80, right: 80, bottom: 80, left: 80 });
            } catch (boundsError) {
                console.error("화면 맞춤 실행 중 에러 발생:", boundsError);
            }
        }, 250);
    }
}

// 네이버 지도 엘리먼트로 커스텀 마커 오브젝트 빌드
function createPhotoMarker(lat, lng, imageUrl, originalUrl, delayIndex, extraCount) {
    const currentMap = window.map || (typeof map !== 'undefined' ? map : null);
    if (!currentMap) return;
    
    // 위/경도 데이터에 NaN이 들어오는 것을 완벽히 배제
    if (isNaN(lat) || isNaN(lng)) return;

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
    
    try {
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
            }
        });

        if (typeof markers !== 'undefined' && Array.isArray(markers)) {
            markers.push(marker);
        }
    } catch (markerError) {
        console.error("네이버 지도 마커 인스턴스 생성 에러:", markerError);
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
