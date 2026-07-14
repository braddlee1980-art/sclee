// generate-list.js
const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'img');

// img 폴더 내의 파일 읽기
fs.readdir(imgDir, (err, files) => {
    if (err) {
        console.error("img 폴더를 읽을 수 없습니다:", err);
        return;
    }

    // 이미지 확장자만 필터링
    const imgFiles = files.filter(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );

    // photoviewthumbnail.js에서 읽을 수 있도록 파일로 저장
    const content = `// 자동 생성된 파일 목록입니다.\nconst IMAGE_FILES = ${JSON.stringify(imgFiles, null, 4)};`;
    
    fs.writeFileSync(path.join(__dirname, 'images-list.js'), content);
    console.log(`✅ 총 ${imgFiles.length}개의 이미지를 'images-list.js'에 등록했습니다!`);
});
