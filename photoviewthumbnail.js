let map;
let markers = [];

// DOM과 네이버 지도 스크립트가 완전히 로드된 후 실행되도록 보장
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
}

// 2. 파일 업로드 창 트리거
function triggerUpload() {
    document.getElementById('file-input').click();
}

// 3. 파일 선택 시 EXIF 추출 및 마커 배치 처리
function handleFiles(files) {
    if (files.length === 0) return;
    
    Array.from(files).forEach((file) => {
        const imageUrl = URL.createObjectURL(file);
        
        EXIF.getData(file, function() {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lng = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
            const lngRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";
            
            if (lat && lng) {
                const finalLat = convertToDecimal(lat, latRef);
                const finalLng = convertToDecimal(lng, lngRef);
                createPhotoMarker(finalLat, finalLng, imageUrl);
            } else {
                console.warn(`[GPS 없음] 현재 중심 근처에 표시: ${file.name}`);
                const currentCenter = map.getCenter();
                const deltaLat = (Math.random() - 0.5) * 0.01;
                const deltaLng = (Math.random() - 0.5) * 0.01;
                createPhotoMarker(currentCenter.lat() + deltaLat, currentCenter.lng() + deltaLng, imageUrl);
            }
        });
    });
    
    document.getElementById('file-input').value = '';
}

// 4. GPS 도/분/초 데이터를 십진수로 변환
function convertToDecimal(gpsData, ref) {
    const degrees = gpsData[0];
    const minutes = gpsData[1];
    const seconds = gpsData[2];
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    if (ref === "S" || ref === "W") decimal = decimal * -1;
    return decimal;
}

// 5. 지도 위에 커스텀 이미지 마커 생성
function createPhotoMarker(lat, lng, imageUrl) {
    if (!map) return;
    const position = new naver.maps.LatLng(lat, lng);
    
    const markerContent = `
        <div style="width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; 
                    box-shadow: 0 3px 10px rgba(0,0,0,0.3); overflow: hidden; background: #e0e0e0;
                    display: flex; align-items: center; justify-content: center;">
            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
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
    map.setCenter(position);
}
