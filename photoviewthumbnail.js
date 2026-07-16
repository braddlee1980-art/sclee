// =========================================================================
// MapPhoto [CORE & ENGINE LOGIC MODULE] - v2.6.5 (크로스 브라우저 완전 판)
// =========================================================================
const APP_VERSION = "v2.6.5"; 
let map;
let markers = [];

const GATSBY_ISLAND_LAT = 33.020000; 
const GATSBY_ISLAND_LNG = 126.550000;

// [긴급 수정] 네이버 지도 스크립트가 완전히 로드되었을 때 실행되는 표준 이벤트 바인딩
if (typeof naver !== 'undefined' && naver.maps && naver.maps.onJSContentLoaded) {
    naver.maps.onJSContentLoaded(initMap);
} else {
    // 일반적인 브라우저 로딩 폴백
    if (document.readyState === 'complete') {
        setTimeout(initMap, 100);
    } else {
        window.addEventListener('load', initMap);
    }
}

function initMap() {
    // 중복 실행 및 네이버 객체 부재 철저 방어
    if (window.map || map) return; 
    if (typeof naver === 'undefined' || !naver.maps || !naver.maps.Map) {
        console.error("네이버 지도 로드 실패: naver.maps.Map 인스턴스가 존재하지 않습니다.");
        return;
    }

    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) {
        console.error("지도를 그릴 'map-container' 엘리먼트가 HTML에 존재하지 않습니다.");
        return;
    }

    const mapOptions = {
        center: new naver.maps.LatLng(33.200000, 126.550000),
        zoom: 9,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER }
    };
    
    try {
        // 지도 객체 생성 및 전역 바인딩
        map = new naver.maps.Map(mapContainer, mapOptions);
        window.map = map; 
        
        addVersionControl(map, APP_VERSION);
        drawGatsbyIsland(map);
        
        console.log(`[성공] 지도 초기화 완료 (버전: ${APP_VERSION})`);

        // 아이패드 렌더링 깨짐 방지용 리프레시
        setTimeout(() => { if (map) map.refresh(); }, 150);

        // 사진 파일 리스트 로드 시작
        if (typeof IMAGE_FILES !== 'undefined' && Array.isArray(IMAGE_FILES)) {
            loadLocalImages();
        } else {
            console.warn("images-list.js 파일이 없거나 IMAGE_FILES 배열이 선언되지 않았습니다.");
        }
    } catch (e) {
        console.error("지도 인스턴스 초기화 중 치명적 예외 발생:", e);
    }
}

function drawGatsbyIsland(mapInstance) {
    new naver.maps.Circle({
        map: mapInstance,
        center: new naver.maps.LatLng(GATSBY_ISLAND_LAT, GATSBY_ISLAND_LNG),
        radius: 15000, 
        fillColor: '#00a8ff',
        fillOpacity: 0.15,
        strokeColor: '#0082c8',
        strokeOpacity: 0.5,
        strokeWeight: 2,
        strokeStyle: 'dash'
    });

    if (!document.getElementById('gatsby-island-animation')) {
        const style = document.createElement('style');
        style.id = 'gatsby-island-animation';
        style.innerHTML = `
            @keyframes gatsbyPulse {
                0% { box-shadow: 0 0 0 0 rgba(0, 168, 255, 0.7); transform: scale(1); }
                70% { box-shadow: 0 0 0 15px rgba(0, 168, 255, 0); transform: scale(1.05); }
                100% { box-shadow: 0 0 0 0 rgba(0, 168, 255, 0); transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    const islandLabelContent = `
        <div style="
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: rgba(24, 28, 36, 0.85); color: #fff; padding: 6px 14px; 
            border-radius: 20px; border: 2px solid #00a8ff; font-family: 'Montserrat', sans-serif;
            font-size: 12px; font-weight: bold; letter-spacing: 1px; white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: gatsbyPulse 2s infinite ease-in-out;
        ">
            🏝️ Gatsby Island
        </div>
    `;

    new naver.maps.Marker({
        position: new naver.maps.LatLng(GATSBY_ISLAND_LAT, GATSBY_ISLAND_LNG),
        map: mapInstance,
        icon: {
            content: islandLabelContent,
            anchor: new naver.maps.Point(55, 15)
        }
    });
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
    const bounds = new naver.maps.LatLngBounds();
    let processedCount = 0;
    let validGpsCount = 0;
    const photoDataList = [];

    IMAGE_FILES.forEach((fileName) => {
        const relativePath = `img/${fileName}`;
        fetch(relativePath)
            .then(response => {
                if (!response.ok) throw new Error(`로드 실패`);
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
                        finalLat = GATSBY_ISLAND_LAT + (Math.random() - 0.5) * 0.08;
                        finalLng = GATSBY_ISLAND_LNG + (Math.random() - 0.5) * 0.08;
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
                            if (typeof processAndRenderMarkers === 'function') {
                                processAndRenderMarkers(photoDataList, bounds, validGpsCount);
                            }
                        }
                    });
                });
            })
            .catch(error => {
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
