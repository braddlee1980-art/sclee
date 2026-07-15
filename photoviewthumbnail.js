// =========================================================================
// 전역 설정 및 변수
// =========================================================================
const APP_VERSION = "v2.0.0"; // 클릭 시 중앙 확대 모달(Lightbox) 기능 추가
let map;
let markers = [];

window.onload = function() {
    initMap();
    createPhotoModalMarkup(); // [신규] 모달 UI 요소 동적 생성
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

// [신규] 화면 중앙에 띄울 모달창 구조와 CSS 스타일을 body 끝자락에 강제 주입합니다.
function createPhotoModalMarkup() {
    // 이미 모달이 생성되어 있다면 중복 방지
    if (document.getElementById('map-photo-modal')) return;

    const modalHtml = `
        <div id="map-photo-modal" style="
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            z-index: 10000;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
            cursor: zoom-out;
        ">
            <span style="
                position: absolute;
                top: 20px; right: 30px;
                color: #fff;
                font-size: 40px;
                font-weight: bold;
                cursor: pointer;
                user-select: none;
                transition: transform 0.2s ease;
            " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="closePhotoModal()">&times;</span>
            
            <img id="modal-image-content" style="
                max-width: 90%;
                max-height: 85%;
                object-fit: contain;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                transform: scale(0.9);
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.15);
                cursor: default;
            " onclick="event.stopPropagation();" src="" alt="확대 이미지" />
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 모달 바깥 어두운 영역 클릭 시에도 닫히도록 바인딩
    const modal = document.getElementById('map-photo-modal');
    modal.addEventListener('click', closePhotoModal);
}

// [신규] 모달 열기 함수 (원본 고화질 이미지 경로 전달)
function openPhotoModal(imgUrl) {
    const modal = document.getElementById('map-photo-modal');
    const modalImg = document.getElementById('modal-image-content');
    
    if (!modal || !modalImg) return;

    modalImg.src = imgUrl; // 클릭한 사진의 원본 경로 세팅
    modal.style.display = 'flex';
    
    // 부드러운 애니메이션 적용을 위한 리플로우 유도 및 클래스 제어 대신 inline style 활용
    setTimeout(() => {
        modal.style.opacity = '1';
        modalImg.style.transform = 'scale(1)';
    }, 10);
}

// [신규] 모달 닫기 함수
function closePhotoModal() {
    const modal = document.getElementById('map-photo-modal');
    const modalImg = document.getElementById('modal-image-content');
    
    if (!modal || !modalImg) return;

    modal.style.opacity = '0';
    modalImg.style.transform = 'scale(0.9)';
    
    // 트랜지션이 완료된 후에 화면에서 제거(숨김)
    setTimeout(() => {
        modal.style.display = 'none';
        modalImg.src = ''; // 메모리 비우기
    }, 300);
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
                            originalUrl: relativePath, // [신규] 원본 사진 경로 보존
                            lat: finalLat,
                            lng: finalLng,
                            hasGps: hasGps,
                            date: dateStr,
                            url: resizedCanvasUrl
                        });
                        
                        processedCount++;
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

function processAndRenderMarkers(photoList, bounds, validGpsCount) {
    const visited = new Array(photoList.length).fill(false);

    for (let i = 0; i < photoList.length; i++) {
        if (visited[i]) continue;
        if (!photoList[i].hasGps) {
            // [개선] 클릭 시 원본 이미지가 팝업되도록 데이터 전달
            createPhotoMarker(photoList[i].lat, photoList[i].lng, photoList[i].url, photoList[i].originalUrl);
            continue;
        }

        const cluster = [photoList[i]];
        visited[i] = true;

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

        cluster.forEach((photo, index) => {
            let targetLat = photo.lat;
            let targetLng = photo.lng;

            if (index > 0) {
                const angle = index * 2.39996; 
                const radius = 0.00035 * Math.sqrt(index);
                targetLat += radius * Math.sin(angle);
                targetLng += radius * Math.cos(angle) * 1.2;
            }

            // [개선] 마커마다 클릭 시 띄울 원본 고화질 경로(photo.originalUrl)를 함께 넘겨줍니다.
            createPhotoMarker(targetLat, targetLng, photo.url, photo.originalUrl);
            bounds.extend(new naver.maps.LatLng(targetLat, targetLng));
        });
    }

    if (validGpsCount > 0) {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
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

// [개편] 원본 이미지 주소를 주입받아 마커 클릭 이벤트를 바인딩합니다.
function createPhotoMarker(lat, lng, imageUrl, originalUrl) {
    if (!map) return;
    const position = new naver.maps.LatLng(lat, lng);
    
    // 인라인 HTML 마크업 상단에 z-index 레이어 효과 추가 및 포인터 커서 강조
    const markerContent = `
        <div class="map-photo-marker" style="
            width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; 
            box-shadow: 0 3px 10px rgba(0,0,0,0.3); overflow: hidden; background: #e0e0e0;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer;
        " onmouseover="this.style.transform='scale(1.15)';" onmouseout="this.style.transform='scale(1)'">
            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;">
        </div>
    `;
    
    const marker = new naver.maps.Marker({
        position: position,
        map: map,
        icon: { content: markerContent, anchor: new naver.maps.Point(27.5, 27.5) }
    });

    // [신규] 마커 클릭 시 모달창을 띄우는 이벤트 리스너 추가
    naver.maps.Event.addListener(marker, 'click', function() {
        openPhotoModal(originalUrl);
    });

    markers.push(marker);
}

function triggerUpload() {}
function handleFiles() {}
