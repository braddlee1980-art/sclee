// =========================================================================
// MapPhoto [CORE & ENGINE LOGIC MODULE] - v2.6.3
// =========================================================================
const APP_VERSION = "v2.6.3"; 
let map;
let markers = [];

// 가상의 섬 'Gatsby Island'의 중심 좌표 (제주도 서귀포 남쪽 바다)
const GATSBY_ISLAND_LAT = 33.020000; // 살짝 더 남쪽으로 조정하여 공간 확보
const GATSBY_ISLAND_LNG = 126.550000;

document.addEventListener('DOMContentLoaded', function() {
    if (typeof naver !== 'undefined' && naver.maps) {
        initMap();
    } else {
        window.addEventListener('load', initMap);
    }
    if (typeof initPhotoModal === 'function') initPhotoModal();
});

function initMap() {
    if (window.map || map) return; 

    if (typeof naver === 'undefined' || !naver.maps) {
        console.error("네이버 지도 스크립트가 로드되지 않았습니다.");
        return;
    }
    
    // 최초 지도의 중심을 제주도와 개츠비 섬이 함께 보이도록 설정
    const mapOptions = {
        center: new naver.maps.LatLng(33.200000, 126.550000),
        zoom: 9,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER }
    };
    
    map = new naver.maps.Map('map-container', mapOptions);
    window.map = map; 
    
    addVersionControl(map, APP_VERSION);
    
    // [신규] 사진 유무와 관계없이 지도에 Gatsby Island 영역과 반짝이는 라벨 그리기
    drawGatsbyIsland(map);
    
    console.log(`지도 코어 엔진 초기화 완료 (버전: ${APP_VERSION})`);

    if (typeof IMAGE_FILES !== 'undefined') {
        loadLocalImages();
    } else {
        console.warn("images-list.js 스크립트를 찾을
