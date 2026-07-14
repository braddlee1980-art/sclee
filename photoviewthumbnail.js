// =========================================================================
// 전역 설정 및 변수
// =========================================================================
const APP_VERSION = "v1.8.0"; // 마커 전체 화면 완벽 피팅 적용
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
    
    // 초기 기본 로딩 화면
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

function loadLocalImages() {
    if (IMAGE_FILES.length === 0) return;

    // 네이버 지도 영역(Bounds) 객체 생성
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
                        
                        // 정상 GPS 좌표 등록 및 영역(Bounds) 확장
                        const point = new naver.maps.LatLng(finalLat, finalLng);
                        bounds.extend(point);
                        validGpsCount++;
                    } else {
                        // GPS 정보가 없는 사진은 임시 좌표 지정 (영역 bounds에는 포함하지 않음)
                        finalLat = 37.555142 + (Math.random() - 0.5) * 0.02;
                        finalLng = 126.970447 + (Math.random() - 0.5) * 0.02;
                    }

                    resizeImage(relativePath, 100, orientation, function(resizedCanvasUrl) {
                        createPhotoMarker(finalLat, finalLng, resizedCanvasUrl);
                        
                        // 마지막 사진까지 처리가 완료되었는지 확인
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

// [완벽 피팅 핵심 로직]
function fitMapToMarkers(bounds, validGpsCount) {
    if (!map) return;

    if (validGpsCount > 0) {
        // 1. 가장 왼쪽 위(NorthWest)와 가장 오른쪽 아래(SouthEast) 사진이 모두 들어오도록 화면 강제 연동
        // 사방에 60px의 여백(padding)을 두어 마커가 화면 가장자리에 걸쳐서 잘리는 문제를 방지합니다.
        map.fitBounds(bounds, {
            top: 60,
            right: 60,
            bottom: 60,
            left: 60
        });
        
        console.log(`🎯 총 ${validGpsCount}개의 사진 영역에 맞춰 지도를 최적의 크기로 조정했습니다.`);
    } else {
        console.log("⚠️ GPS 정보가 포함된 사진이 없어 기본 서울 화면을 유지합니다.");
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
