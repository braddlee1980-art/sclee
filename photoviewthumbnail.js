// =========================================================================
// MapPhoto [CORE & ENGINE LOGIC MODULE] - v2.2.0
// =========================================================================
const APP_VERSION = "v2.2.0"; 
let map;
let markers = [];

window.onload = function() {
    initMap();
    if (typeof initPhotoModal === 'function') initPhotoModal(); // 모달 초기화 위임
};

function initMap() {
    if (typeof naver === 'undefined' || !naver.maps) {
        console.error("네이버 지도 스크립트가 로드되지 않았습니다.");
        return;
    }
    
    const mapOptions = {
        center: new naver.maps.LatLng(37.555142, 126.970447),
        zoom: 11,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER }
    };
    
    map = new naver.maps.Map('map-container', mapOptions);
    addVersionControl(map, APP_VERSION);
    
    console.log(`지도 코어 엔진 초기화 완료 (버전: ${APP_VERSION})`);

    if (typeof IMAGE_FILES !== 'undefined') {
        loadLocalImages();
    } else {
        console.warn("images-list.js 스크립트를 찾을 수 없습니다.");
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

    const bounds = new naver.maps.LatLngBounds();
    let processedCount = 0;
    let validGpsCount = 0;
    const photoDataList = [];

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
                    
                    const dateTime = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime") || "";
                    const dateStr = dateTime.substring(0, 10).replace(/:/g, "-") || "UNKNOWN_DATE";

                    let finalLat, finalLng;
                    let hasGps = false;
                    
                    if (lat && lng) {
                        finalLat = convertToDecimal(lat, latRef);
                        finalLng = convertToDecimal(lng, lngRef);
                        hasGps = true;
                        validGpsCount++;
                    } else {
                        finalLat = 37.555142 + (Math.random() - 0.5) * 0.02;
                        finalLng = 126.970447 + (Math.random() - 0.5) * 0.02;
                    }

                    resizeImage(relativePath, 100, orientation, function(resizedCanvasUrl) {
                        photoDataList.push({
                            originalUrl: relativePath,
                            lat: finalLat,
                            lng: finalLng,
                            hasGps: hasGps,
                            date: dateStr,
                            url: resizedCanvasUrl
                        });
                        
                        processedCount++;
                        if (processedCount === IMAGE_FILES.length) {
                            // 데이터 수집 완료 시 외부 모듈(photomarker.js)로 연산 이관
                            if (typeof processAndRenderMarkers === 'function') {
                                processAndRenderMarkers(photoDataList, bounds, validGpsCount);
                            }
                        }
                    });
                });
            })
            .catch(error => {
                console.error("이미지 로딩 에러:", error);
                processedCount++;
                if (processedCount === IMAGE_FILES.length) {
                    if (typeof processAndRenderMarkers === 'function') {
                        processAndRenderMarkers(photoDataList, bounds, validGpsCount);
                    }
                }
            });
    });
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

function triggerUpload() {}
function handleFiles() {}
