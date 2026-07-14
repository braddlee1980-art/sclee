// =========================================================================
// 전역 설정 및 변수
// =========================================================================
const APP_VERSION = "v1.7.0"; // 마커 전체 영역 피팅 기능 추가
let map;
let markers = [];

window.onload = function() {
    initMap();
};

function initMap() {
    if (typeof naver === 'undefined' || !naver.maps) {
        console.error("네이버 지도 스크립트가 로드되지 않았습니다.");
        return;
    }
    
    // 최초 기본 화면 (사진 로드 전 보여줄 기본 위치)
    const mapOptions = {
        center: new naver.maps.LatLng(37.555142, 126.970447),
        zoom: 11,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER }
    };
    
    map = new naver.maps.Map('map-container', mapOptions);
    addVersionControl(map, APP_VERSION);
    
    console.log(`지도 초기화 완료 (버전: ${APP_VERSION})`);

    if (typeof IMAGE_FILES !== 'undefined') {
        loadLocalImages();
    } else {
        console.warn("images-list.js를 찾을 수 없습니다.");
    }
}

function addVersionControl(mapInstance, versionText) {
    const versionEl = document.createElement('div');
    versionEl.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(4px); padding: 5px 9px; font-size: 11px; font-family: monospace; font-weight: 500; color: #555; border-radius: 6px; border: 1px solid rgba(0,0,0,0.1); margin: 12px; pointer-events: none; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
            MapPhoto ${versionText}
        </div>
    `;
    new naver.maps.CustomControl(versionEl, { position: naver.maps.Position.LEFT_BOTTOM }).setMap(mapInstance);
}

// [핵심 개편] 모든 비동기 사진 로드가 끝나는 것을 추적하여 화면을 이동시킵니다.
function loadLocalImages() {
    if (IMAGE_FILES.length === 0) return;

    // 네이버 지도에서 제공하는 "좌표들을 포함하는 사각형 사각영역(Bounds)" 객체 생성
    const bounds = new naver.maps.LatLngBounds();
    let processedCount = 0;
    let validGpsCount = 0;

    IMAGE_FILES.forEach((fileName) => {
        const relativePath = `img/${fileName}`;

        fetch(relativePath)
            .then(response => {
                if (!response.ok) throw new Error(`파일 로드 실패: ${relativePath}`);
                return response.blob();
            })
            .then(blob => {
                EXIF.getData(blob, function() {
                    const lat = EXIF.getTag(this, "GPSLatitude");
                    const lng = EXIF.getTag(this, "GPSLongitude");
                    const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
                    const lngRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";
                    const orientation = EXIF.getTag(this, "Orientation") || 1;
                    
                    let finalLat, finalLng;
                    
                    if (lat && lng) {
                        finalLat = convertToDecimal(lat, latRef);
                        finalLng = convertToDecimal(lng, lngRef);
                        
                        // GPS 정보가 올바르게 있는 좌표만 영역에 확장 포함시킴
                        const point = new naver.maps.LatLng(finalLat, finalLng);
                        bounds.extend(point);
                        validGpsCount++;
                    } else {
                        // GPS가 없는 사진은 마커들을 다 모은 뒤 중심 주변에 뿌리기 위해 임시값 지정
                        finalLat = 37.555142 + (Math.random() - 0.5) * 0.02;
                        finalLng = 126.970447 + (Math.random() - 0.5) * 0.02;
                    }

                    resizeImage(relativePath, 100, orientation, function(resizedCanvasUrl) {
                        createPhotoMarker(finalLat, finalLng, resizedCanvasUrl);
                        
                        // 비동기 카운트 체크: 마지막 사진 처리가 끝났는지 확인
                        processedCount++;
                        if (processedCount === IMAGE_FILES.length) {
                            fitMapToMarkers(bounds, validGpsCount);
                        }
                    });
                });
            })
            .catch(error => {
                console.error("이미지 로딩 에러:", error);
                processedCount++;
                if (processedCount === IMAGE_FILES.length) {
                    fitMapToMarkers(bounds, validGpsCount);
                }
            });
    });
}

// [신규] 모든 마커가 화면에 꽉 차게 들어오도록 포커싱하는 함수
function fitMapToMarkers(bounds, validGpsCount) {
    if (!map) return;

    if (validGpsCount > 0) {
        // 모든 사진 좌표 정보가 포함된 영역으로 지도를 움직이고 줌 레벨을 맞춤
        map.panToBounds(bounds);
        
        // 너무 타이트하게 확대되는 것을 방지하기 위해 줌 아웃 여유 유도 (옵션)
        setTimeout(() => {
            map.setZoom(map.getZoom() - 1, true);
        }, 400);
        
        console.log(`🎯 총 ${validGpsCount}개의 위치 정보를 기반으로 화면 정렬 완료!`);
    } else {
        console.log("⚠️ 위치 정보(GPS)가 포함된 사진이 없어 기본 화면을 유지합니다.");
    }
}

function resizeImage(imgUrl, targetSize, orientation, callback) {
    const img = new Image();
    img.src = imgUrl;
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let srcX = 0; let srcY = 0; let srcWidth = img.width; let srcHeight = img.height;
        if (img.width > img.height) { srcX = (img.width - img.height) / 2; srcWidth = img.height; } 
        else { srcY = (img.height - img.width) / 2; srcHeight = img.width; }
        canvas.width = targetSize; canvas.height = targetSize;
        ctx.save();
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

function convertToDecimal(gpsData, ref) {
    const degrees = gpsData[0]; const minutes = gpsData[1]; const seconds = gpsData[2];
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    if (ref === "S" || ref === "W") decimal = decimal * -1;
    return decimal;
}

function createPhotoMarker(lat, lng, imageUrl) {
    if (!map) return;
    const position = new naver.maps.LatLng(lat, lng);
    const markerContent = `
        <div class="map-photo-marker" style="
            width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; 
            box-shadow: 0 3px 10px rgba(0,0,0,0.3); overflow: hidden; background: #e0e0e0;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer;
        " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;">
        </div>
    `;
    const marker = new naver.maps.Marker({
        position: position,
        map: map,
        icon: { content: markerContent, anchor: new naver.maps.Point(27.5, 27.5) }
    });
    markers.push(marker);
}

function triggerUpload() {}
function handleFiles() {}
