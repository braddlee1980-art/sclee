// =========================================================================
// MapPhoto [MARKER & CLUSTER MODULE] - v2.6.7 (Gatsby Island 피팅 통합본)
// =========================================================================

// 비동기로 수집된 사진 정보들을 분석하여 대표 마커와 카운트를 생성하는 엔진 (1회성 생성 고정)
function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    // [중요 개선] 이미 마커들이 지도 상에 생성되어 있다면 다시 연산하지 않고 철수 (깜빡임 방지 핵심)
    if (typeof markers !== 'undefined' && markers.length > 0) {
        console.log("마커가 이미 캐싱되어 있어 재렌더링을 스킵합니다.");
        return;
    }

    if (!photoList || !Array.isArray(photoList) || photoList.length === 0) {
        return;
    }

    const visited = new Array(photoList.length).fill(false);
    let markerDelayIndex = 0;
    
    // [핵심] 모든 마커(GPS 보유 마커 + Gatsby Island 가상 마커)를 전부 품을 수 있는 경계 상자 객체
    const accurateBounds = new naver.maps.LatLngBounds();
    
    // [중요] 위치 정보가 없는 사진들이 모일 가상의 섬 'Gatsby Island'의 중심 좌표 정의
    const GATSBY_ISLAND_LAT = 33.020000;
    const GATSBY_ISLAND_LNG = 126.550000;
    
    // 위치 정보가 없는 사진(Gatsby Island로 갈 사진)이 최소 한 장이라도 있다면, 
    // 지도 화면 계산 영역에 Gatsby Island 좌표를 미리 강제로 집어넣습니다.
    const hasAnyGpsMissingPhoto = photoList.some(photo => !photo.hasGps || isNaN(photo.lat) || isNaN(photo.lng));
    if (hasAnyGpsMissingPhoto) {
        accurateBounds.extend(new naver.maps.LatLng(GATSBY_ISLAND_LAT, GATSBY_ISLAND_LNG));
    }

    let actualAddedGpsCount = hasAnyGpsMissingPhoto ? 1 : 0; // Gatsby Island가 포함되면 카운트 1 시작

    for (let i = 0; i < photoList.length; i++) {
        if (!photoList[i]) continue;
        if (visited[i]) continue;
        
        // GPS 정보가 결여된 사진 처리 -> Gatsby Island 영역 내부로 흩뿌림
        if (!photoList[i].hasGps || isNaN(photoList[i].lat) || isNaN(photoList[i].lng)) {
            // photoviewthumbnail.js에서 미리 계산해서 넘겨준 Gatsby Island 좌표를 사용하되, 
            // 안전장치로 혹시 누락되었을 경우 기본 섬 중심 좌표로 풀백(Fallback) 처리합니다.
            const safeLat = !isNaN(photoList[i].lat) ? photoList[i].lat : GATSBY_ISLAND_LAT;
            const safeLng = !isNaN(photoList[i].lng) ? photoList[i].lng : GATSBY_ISLAND_LNG;
            
            createPhotoMarker(safeLat, safeLng, photoList[i].url, photoList[i].originalUrl, markerDelayIndex++, 0);
            visited[i] = true;
            continue;
        }

        const cluster = [photoList[i]];
        visited[i] = true;

        // 7km(7000m) 이내 뭉침 탐지 연산
        for (let j = i + 1; j < photoList.length; j++) {
            if (!photoList[j]) continue;
            if (visited[j]) continue;
            if (!photoList[j].hasGps || isNaN(photoList[j].lat) || isNaN(photoList[j].lng)) continue;

            const dateI = photoList[i].date || "NO_DATE";
            const dateJ = photoList[j].date || "NO_DATE";

            if (dateI === dateJ) {
                try {
                    const distance = getDistance(photoList[i].lat, photoList[i].lng, photoList[j].lat, photoList[j].lng);
                    if (!isNaN(distance) && distance <= 7000) {
                        cluster.push(photoList[j]);
                        visited[j] = true;
                    }
                } catch (err) {
                    console.error("거리 계산 에러:", err);
                }
            }
        }

        const representativePhoto = cluster[0];
        if (!representativePhoto) continue;

        const extraCount = cluster.length - 1;

        createPhotoMarker(
            representativePhoto.lat, 
            representativePhoto.lng, 
            representativePhoto.url, 
            representativePhoto.originalUrl, 
            markerDelayIndex++, 
            extraCount
        );

        if (representativePhoto.hasGps && !isNaN(representativePhoto.lat) && !isNaN(representativePhoto.lng)) {
            // 실제 GPS가 있는 사진 마커들의 좌표도 경계 상자에 추가
            accurateBounds.extend(new naver.maps.LatLng(representativePhoto.lat, representativePhoto.lng));
            actualAddedGpsCount++;
        }
    }

    // [성공] 모든 실제 좌표 마커 + 개츠비 섬 좌표가 완벽하게 잡힌 경계 상자로 카메라 위치 피팅 수행
    const currentMap = window.map || (typeof map !== 'undefined' ? map : null);
    if (actualAddedGpsCount > 0 && currentMap) {
        setTimeout(() => {
            try {
                // 상하 120px, 좌우 100px의 여유로운 패딩값을 적용하여 
                // 최북단 실제 사진 마커부터 최남단 개츠비 섬 마커까지 잘림 현상 없이 한 번에 꽉 차게 띄웁니다.
                currentMap.fitBounds(accurateBounds, { 
                    top: 120, 
                    right: 100, 
                    bottom: 120, 
                    left: 100 
                });
            } catch (boundsError) {
                console.error("화면 맞춤 실행 에러:", boundsError);
            }
        }, 300); // 렌더링 안정성을 위해 300ms 지연 후 작동
    }
}

// 네이버 지도 엘리먼트로 커스텀 마커 오브젝트 빌드
function createPhotoMarker(lat, lng, imageUrl, originalUrl, delayIndex, extraCount) {
    const currentMap = window.map || (typeof map !== 'undefined' ? map : null);
    if (!currentMap) return;
    if (isNaN(lat) || isNaN(lng)) return;

    const position = new naver.maps.LatLng(lat, lng);
    injectMarkerAnimationStyles();

    const animationDelay = delayIndex * 0.08;
    
    const badgeHtml = extraCount > 0 ? `
        <div style="
            position: absolute; bottom: -2px; right: -2px; background: #ff4757; color: white;
            font-size: 11px; font-weight: bold; padding: 3px 6px; border-radius: 10px;
            border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10; line-height: 1;
        ">+${extraCount}</div>
    ` : '';
    
    const markerContent = `
        <div class="map-photo-marker" style="
            position: relative; width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; 
            box-shadow: 0 3px 10px rgba(0,0,0,0.3); background: #e0e0e0; display: flex; align-items: center; justify-content: center;
            cursor: pointer; transform: scale(0); animation: markerPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            animation-delay: ${animationDelay}s; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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
        console.error("마커 생성 에러:", markerError);
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
