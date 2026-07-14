// 전역 변수 설정
const APP_VERSION = "v1.1.0";
let map;
let markers = [];

// DOM과 네이버 지도 스크립트가 완전히 로드된 후 실행 보장
window.onload = function() {
    initMap();
};

// 1. 네이버 지도 초기화
function initMap() {
    if (typeof naver === 'undefined' || !naver.maps) {
        console.error("네이버 지도 스크립트가 로드되지 않았습니다. API Key나 네트워크를 확인하세요.");
        return;
    }
    
    const mapOptions = {
        center: new naver.maps.LatLng(37.555142, 126.970447),
        zoom: 13,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER }
    };
    
    map = new naver.maps.Map('map-container', mapOptions);
    
    // [신규] 지도 위에 버전 표시 컨트롤 생성 및 배치
    addVersionControl(map, APP_VERSION);
    
    console.log(`지도 초기화 완료 (버전: ${APP_VERSION})`);
}

// 2. [신규] 네이버 지도 커스텀 컨트롤로 버전 표시기 UI 추가
function addVersionControl(mapInstance, versionText) {
    const versionEl = document.createElement('div');
    versionEl.innerHTML = `
        <div style="
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(4px);
            padding: 5px 9px;
            font-size: 11px;
            font-family: -apple-system, BlinkMacSystemFont, monospace;
            font-weight: 500;
            color: #555;
            border-radius: 6px;
            border: 1px solid rgba(0,0,0,0.1);
            margin: 12px;
            pointer-events: none; /* 지도 드래그 및 클릭 방해 금지 */
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        ">
            MapPhoto ${versionText}
        </div>
    `;

    // 네이버 지도 좌측 하단(LEFT_BOTTOM)에 UI 엘리먼트 고정
    new naver.maps.CustomControl(versionEl, {
        position: naver.maps.Position.LEFT_BOTTOM
    }).setMap(mapInstance);
}

// 3. 파일 업로드 창 트리거
function triggerUpload() {
    document.getElementById('file-input').click();
}

// 4. 파일 선택 시 EXIF 추출 및 최적화 처리
function handleFiles(files) {
    if (files.length === 0) return;
    
    let lastPosition = null;

    Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;

        const originalUrl = URL.createObjectURL(file);
        
        EXIF.getData(file, function() {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lng = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
            const lngRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";
            const orientation = EXIF.getTag(this, "Orientation") || 1;
            
            let finalLat, finalLng;
            
            if (lat && lng) {
                finalLat = convertToDecimal(lat, latRef);
                finalLng = convertToDecimal(lng, lngRef);
            } else {
                const currentCenter = map.getCenter();
                finalLat = currentCenter.lat() + (Math.random() - 0.5) * 0.01;
                finalLng = currentCenter.lng() + (Math.random() - 0.5) * 0.01;
            }

            lastPosition = new naver.maps.LatLng(finalLat, finalLng);
            
            resizeImage(originalUrl, 100, orientation, function(resizedCanvasUrl) {
                createPhotoMarker(finalLat, finalLng, resizedCanvasUrl);
                URL.revokeObjectURL(originalUrl); // 메모리 해제
            });
        });
    });

    // 업로드 완료 후 마지막 마커 위치로 부드럽게 이동
    setTimeout(() => {
        if (lastPosition && map) {
            map.panTo(lastPosition); 
        }
    }, 300);
    
    document.getElementById('file-input').value = '';
}

// 5. Canvas 리사이징 + 이미지 회전 방어 함수
function resizeImage(url, targetSize, orientation, callback) {
    const img = new Image();
    img.src = url;
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let srcX = 0;
        let srcY = 0;
        let srcWidth = img.width;
        let srcHeight = img.height;
        
        if (img.width > img.height) {
            srcX = (img.width - img.height) / 2;
            srcWidth = img.height;
        } else {
            srcY = (img.height - img.width) / 2;
            srcHeight = img.width;
        }
        
        canvas.width = targetSize;
        canvas.height = targetSize;
        
        ctx.save();
        
        // EXIF 회전값 보정 로직
        switch (orientation) {
            case 2: ctx.transform(-1, 0, 0, 1, targetSize, 0); break;
            case 3: ctx.transform(-1, 0, 0, -1, targetSize, targetSize); break;
            case 4: ctx.transform(1, 0, 0, -1, 0, targetSize); break;
            case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
            case 6: ctx.transform(0, 1, -1, 0, targetSize, 0); break;
            case 7: ctx.transform(0, -1, -1, 0, targetSize, targetSize); break;
            case 8: ctx.transform(0, -1, 1, 0, 0, targetSize); break;
            default: break;
        }
        
        ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, targetSize, targetSize);
        ctx.restore();
        
        const resizedUrl = canvas.toDataURL('image/jpeg', 0.75);
        callback(resizedUrl);
    };
}

// 6. GPS 데이터를 십진수로 변환
function convertToDecimal(gpsData, ref) {
    const degrees = gpsData[0];
    const minutes = gpsData[1];
    const seconds = gpsData[2];
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    if (ref === "S" || ref === "W") decimal = decimal * -1;
    return decimal;
}

// 7. 지도 위에 커스텀 이미지 마커 생성
function createPhotoMarker(lat, lng, imageUrl) {
    if (!map) return;
    const position = new naver.maps.LatLng(lat, lng);
    
    const markerContent = `
        <div class="map-photo-marker" style="
            width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; 
            box-shadow: 0 3px 10px rgba(0,0,0,0.3); overflow: hidden; background: #e0e0e0;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            cursor: pointer;
        " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;">
        </div>
    `;
    
    const marker = new naver.maps.Marker({
        position: position,
        map: map,
        icon: {
            content: markerContent,
            anchor: new naver.maps.Point(27.5, 27.5)
        }
    });
    
    markers.push(marker);
}
