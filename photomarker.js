// =========================================================================
// MapPhoto [MARKER & CLUSTER MODULE] - v2.6.9 (이벤트 위임 적용)
// =========================================================================

function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    if (typeof markers !== 'undefined' && markers.length > 0) {
        console.log("마커가 이미 캐싱되어 있어 재렌더링을 스킵합니다.");
        return;
    }

    if (!photoList || !Array.isArray(photoList) || photoList.length === 0) {
        return;
    }

    const visited = new Array(photoList.length).fill(false);
    let markerDelayIndex = 0;
    
    const accurateBounds = new naver.maps.LatLngBounds();
    const GATSBY_ISLAND_LAT = 33.020000;
    const GATSBY_ISLAND_LNG = 126.550000;
    
    const hasAnyGpsMissingPhoto = photoList.some(photo => !photo.hasGps || isNaN(photo.lat) || isNaN(photo.lng));
    if (hasAnyGpsMissingPhoto) {
        accurateBounds.extend(new naver.maps.LatLng(GATSBY_ISLAND_LAT, GATSBY_ISLAND_LNG));
    }

    let actualAddedGpsCount = hasAnyGpsMissingPhoto ? 1 : 0;

    for (let i = 0; i < photoList.length; i++) {
        if (!photoList[i]) continue;
        if (visited[i]) continue;
        
        if (!photoList[i].hasGps || isNaN(photoList[i].lat) || isNaN(photoList[i].lng)) {
            const safeLat = !isNaN(photoList[i].lat) ? photoList[i].lat : GATSBY_ISLAND_LAT;
            const safeLng = !isNaN(photoList[i].lng) ? photoList[i].lng : GATSBY_ISLAND_LNG;
            
            createPhotoMarker(safeLat, safeLng, photoList[i].url, photoList[i].originalUrl, markerDelayIndex++, 0);
            visited[i] = true;
            continue;
        }

        const cluster = [photoList[i]];
        visited[i] = true;

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
            accurateBounds.extend(new naver.maps.LatLng(representativePhoto.lat, representativePhoto.lng));
            actualAddedGpsCount++;
        }
    }

    const currentMap = window.map || (typeof map !== 'undefined' ? map : null);
    if (actualAddedGpsCount > 0 && currentMap) {
        setTimeout(() => {
            try {
                currentMap.fitBounds(accurateBounds, { 
                    top: 120, 
                    right: 100, 
                    bottom: 120, 
                    left: 100 
                });
            } catch (boundsError) {
                console.error("화면 맞춤 실행 에러:", boundsError);
            }
        }, 300);
    }
}

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

        // [구조 조정] 직접 모달을 열지 않고, 전역 중재 핸들러에 이벤트 알림만 보냄
        naver.maps.Event.addListener(marker, 'click', function() {
            if (typeof window.handleMarkerClick === 'function') {
                window.handleMarkerClick(originalUrl, position);
            } else {
                console.warn("중재 이벤트 핸들러(window.handleMarkerClick)가 정의되지 않았습니다.");
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
