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
    console.log("지도 초기화 완료");
    // 1. 네이버 지도 초기화 함수 내부 수정
function initMap() {
    if (typeof naver === 'undefined' || !naver.maps) {
        console.error("네이버 지도 스크립트가 로드되지 않았습니다.");
        return;
    }
    
    const mapOptions = {
        center: new naver.maps.LatLng(37.555142, 126.970447),
        zoom: 13,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER }
    };
    
    map = new naver.maps.Map('map-container', mapOptions);
    
    // --- [추가] 네이버 지도 UI 위에 버전 표시기 올리기 ---
    addVersionControl(map, "v1.1.0");
    
    console.log("지도 초기화 완료");
    
    // 2. 버전 표시 컨트롤 생성 함수
    function addVersionControl(mapInstance, versionText) {
        // 버전을 담을 HTML 엘리먼트 동적 생성
        const versionEl = document.createElement('div');
        versionEl.innerHTML = `
            <div style="
                background: rgba(255, 255, 255, 0.8);
                backdrop-filter: blur(4px);
                padding: 4px 8px;
                font-size: 11px;
                font-family: monospace;
                color: #666;
                border-radius: 4px;
                border: 1px solid rgba(0,0,0,0.1);
                margin: 10px;
                pointer-events: none; /* 클릭 방해 금지 */
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            ">
                MapPhoto ${versionText}
            </div>
        `;
    
        // 네이버 지도 UI 객체에 커스텀 컨트롤로 등록 (좌측 하단 배치)
        new naver.maps.CustomControl(versionEl, {
            position: naver.maps.Position.LEFT_BOTTOM
        }).setMap(mapInstance);
    }
}


}

// 2. 파일 업로드 창 트리거
function triggerUpload() {
    document.getElementById('file-input').click();
}

// 3. 파일 선택 시 EXIF 추출 및 최적화 처리
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
            const orientation = EXIF.getTag(this, "Orientation") || 1; // 회전값 추출 (기본값 1)
            
            let finalLat, finalLng;
            
            if (lat && lng) {
                finalLat = convertToDecimal(lat, latRef);
                finalLng = convertToDecimal(lng, lngRef);
            } else {
                // GPS 정보가 없는 사진은 현재 중심 근처 무작위 배치
                const currentCenter = map.getCenter();
                finalLat = currentCenter.lat() + (Math.random() - 0.5) * 0.01;
                finalLng = currentCenter.lng() + (Math.random() - 0.5) * 0.01;
            }

            lastPosition = new naver.maps.LatLng(finalLat, finalLng);
            
            // 이미지 크롭/압축 및 회전 정보 보정 처리
            resizeImage(originalUrl, 100, orientation, function(resizedCanvasUrl) {
                createPhotoMarker(finalLat, finalLng, resizedCanvasUrl);
                
                // [안전성 확보] 마커 생성이 완전히 끝나고 캔버스 이미지화가 완료된 시점에 가상 URL 해제
                URL.revokeObjectURL(originalUrl);
            });
        });
    });

    // 다중 업로드 시 마지막에 등록된 좌표로 중심 부드럽게 이동
    setTimeout(() => {
        if (lastPosition && map) {
            map.panTo(lastPosition); 
        }
    }, 300);
    
    document.getElementById('file-input').value = '';
}

// 4. [보완] Canvas 리사이징 + 이미지 회전 방어 함수
function resizeImage(url, targetSize, orientation, callback) {
    const img = new Image();
    img.src = url;
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 정정사각형 섬네일 크롭 계산
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
        
        // 캔버스 크기를 타겟 사이즈로 고정
        canvas.width = targetSize;
        canvas.height = targetSize;
        
        // EXIF Orientation 값에 따른 캔버스 좌표 회전 처리
        if (orientation > 4) {
            canvas.width = targetSize;
            canvas.height = targetSize;
        }
        
        ctx.save();
        
        // 회전값 적용 (iOS 기기 사진 대응)
        switch (orientation) {
            case 2: ctx.transform(-1, 0, 0, 1, targetSize, 0); break;
            case 3: ctx.transform(-1, 0, 0, -1, targetSize, targetSize); break;
            case 4: ctx.transform(1, 0, 0, -1, 0, targetSize); break;
            case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
            case 6: ctx.transform(0, 1, -1, 0, targetSize, 0); break; // 90도 회전
            case 7: ctx.transform(0, -1, -1, 0, targetSize, targetSize); break;
            case 8: ctx.transform(0, -1, 1, 0, 0, targetSize); break; // 270도 회전
            default: break;
        }
        
        // 이미지 그리기
        ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, targetSize, targetSize);
        ctx.restore();
        
        const resizedUrl = canvas.toDataURL('image/jpeg', 0.75); // 75% 화질로 가공
        callback(resizedUrl);
    };
}

// 5. GPS 도/분/초 데이터를 십진수로 변환
function convertToDecimal(gpsData, ref) {
    const degrees = gpsData[0];
    const minutes = gpsData[1];
    const seconds = gpsData[2];
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    if (ref === "S" || ref === "W") decimal = decimal * -1;
    return decimal;
}

// 6. 지도 위에 커스텀 이미지 마커 생성 (Hover 시 살짝 커지는 인터랙션 추가)
function createPhotoMarker(lat, lng, imageUrl) {
    if (!map) return;
    const position = new naver.maps.LatLng(lat, lng);
    
    // 마커가 부드럽게 튀어 올라오는 마우스 오버 효과 스타일 포함
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
