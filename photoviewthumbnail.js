// =========================================================================
// 전역 설정 및 변수
// =========================================================================
const APP_VERSION = "v1.9.0"; // 근접 사진 겹침 방지(나선형 분산) 로직 추가
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

    const bounds = new naver.maps.LatLngBounds();
    let processedCount = 0;
    let validGpsCount = 0;
    
    // 비동기로 추출된 사진 데이터들을 임시로 모아둘 배열
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
                    
                    // EXIF에서 촬영 날짜 추출 (형식: "YYYY:MM:DD HH:MM:SS" -> 앞 10자리 날짜만 사용)
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
                        // 가공된 데이터를 임시 리스트에 저장
                        photoDataList.push({
                            lat: finalLat,
                            lng: finalLng,
                            hasGps: hasGps,
                            date: dateStr,
                            url: resizedCanvasUrl
                        });
                        
                        processedCount++;
                        // 모든 사진 분석이 완전히 끝났을 때 겹침 방지 연산 및 마커 생성 시작
                        if (processedCount === IMAGE_FILES.length) {
                            processAndRenderMarkers(photoDataList, bounds, validGpsCount);
                        }
                    });
                });
            })
            .catch(error => {
                console.error("이미지 로딩 에러:", error);
                processedCount++;
                if (processedCount === IMAGE_FILES.length) {
                    processAndRenderMarkers(photoDataList, bounds, validGpsCount);
                }
            });
    });
}

// [신규] 겹침 방지 처리 후 최종 마커 렌더링
function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    // 거리가 가까운 그룹끼리 묶기 위한 방문 여부 체크 배열
    const visited = new Array(photoList.length).fill(false);

    for (let i = 0; i < photoList.length; i++) {
        if (visited[i]) continue;
        if (!photoList[i].hasGps) {
            // GPS가 없는 사진은 겹침 연산에서 제외하고 바로 뿌림
            createPhotoMarker(photoList[i].lat, photoList[i].lng, photoList[i].url);
            continue;
        }

        // 같은 날짜이면서 100m 이내에 뭉쳐 있는 사진 모으기
        const cluster = [photoList[i]];
        visited[i] = true;

        for (let j = i + 1; j < photoList.length; j++) {
            if (visited[j] || !photoList[j].hasGps) continue;

            // 조건: 촬영 날짜가 같고, 대략 100m 이내 거리일 때
            if (photoList[i].date === photoList[j].date) {
                const distance = getDistance(photoList[i].lat, photoList[i].lng, photoList[j].lat, photoList[j].lng);
                if (distance <= 100) {
                    cluster.push(photoList[j]);
                    visited[j] = true;
                }
            }
        }

        // 뭉쳐 있는 사진들을 반 이상 겹치지 않게 나선형 분산 배치하여 마커 생성
        cluster.forEach((photo, index) => {
            let targetLat = photo.lat;
            let targetLng = photo.lng;

            if (index > 0) {
                // 사진 크기가 55px이므로 지도의 스케일에 따라 반 이상(약 30~35px 이상) 벌려주기 위한 오프셋 연산
                // 황금비 각도(약 137.5도)를 활용한 나선형 구조로 좌표를 미세 이동
                const angle = index * 2.39996; 
                const radius = 0.00035 * Math.sqrt(index); // 위경도 기준 반 이상 겹치지 않을 분산 반경

                targetLat += radius * Math.sin(angle);
                targetLng += radius * Math.cos(angle) * 1.2; // 경도 보정
            }

            createPhotoMarker(targetLat, targetLng, photo.url);
            
            // 전체 화면 피팅을 위해 이동된 좌표도 bounds 영역에 포함
            bounds.extend(new naver.maps.LatLng(targetLat, targetLng));
        });
    }

    // 마커가 다 그려진 후 전체 화면 맞춤 실행
    if (validGpsCount > 0) {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
}

// 두 좌표 간의 직선 거리(미터)를 계산하는 하버사인(Haversine) 함수
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // 지구 반지름 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
        " onmouseover="this.style.transform='scale(1.15) z-index: 999;'" onmouseout="this.style.transform='scale(1)'">
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
