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

// 3. 파일 선택 시 EXIF 추출 및 최적화 처리
function handleFiles(files) {
    if (files.length === 0) return;
    
    Array.from(files).forEach((file) => {
        // 원본 파일의 가상 URL 생성 (EXIF 분석 및 이미지 로드용)
        const originalUrl = URL.createObjectURL(file);
        
        EXIF.getData(file, function() {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lng = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
            const lngRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";
            
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
            
            // [최적화 핵심] 원본 이미지를 100px 크기의 섬네일로 압축하여 마커 생성
            resizeImage(originalUrl, 100, function(resizedCanvasUrl) {
                createPhotoMarker(finalLat, finalLng, resizedCanvasUrl);
                
                // 마커 생성이 끝나면 메모리 확보를 위해 원본 가상 URL 해제
                URL.revokeObjectURL(originalUrl);
            });
        });
    });
    
    document.getElementById('file-input').value = '';
}

// 4. [신규] Canvas를 이용한 이미지 리사이징(압축) 함수
function resizeImage(url, targetSize, callback) {
    const img = new Image();
    img.src = url;
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 정정사각형 섬네일을 만들기 위해 원본 크기에서 비율 계산 (Center Crop 효과)
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
        
        // 캔버스 크기를 타겟 사이즈(100px)로 고정
        canvas.width = targetSize;
        canvas.height = targetSize;
        
        // 캔버스에 이미지 그리기 (원본의 중심부를 크롭하여 100x100으로 리사이즈)
        ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, targetSize, targetSize);
        
        // 캔버스 내용을 압축된 가벼운 데이터 URL(Base64)로 변환하여 콜백 반환
        const resizedUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% 화질 압축
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

// 6. 지도 위에 커스텀 이미지 마커 생성
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
