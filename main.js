const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d');

const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');

const resultCanvas = document.getElementById('resultCanvas');
const resultCtx = resultCanvas.getContext('2d');

const indexCanvas = document.getElementById('indexCanvas');
const indexCtx = indexCanvas.getContext('2d');
indexCtx.font = "12px monospace";
indexCtx.align = "right";



const MAX_SIZE = 400;

main();

function main() {
    let dummy = []
    for (let i = 0; i < 15; i++) {
        dummy.push([0, 0, 0]);
    }
    showPallet(dummy);

    setupCropper();

    document.getElementById("run").addEventListener("click", genMyDesign);
};

function setupCropper() {
    const fileInput = document.getElementById('fileInput');
    let cropper = null;

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        const fileReader = new FileReader();

        fileReader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let scale = MAX_SIZE / Math.max(img.width, img.height);
                let scaledWidth = img.width * scale;
                let scaledHeight = img.height * scale;
                cropCanvas.width = scaledWidth;
                cropCanvas.height = scaledHeight;
                cropCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, scaledWidth, scaledHeight);
                if (cropper != null) {
                    cropper.destroy();
                }
                cropper = new Cropper(cropCanvas, {
                    aspectRatio: 1,
                    viewMode: 1,
                    movable: false,
                    scalable: false,
                    zoomable: true,
                    data: { width: scaledWidth, height: scaledWidth },
                    crop: (e) => {
                        tempCanvas.width = e.detail.width / scale;
                        tempCanvas.height = e.detail.height / scale;
                        // resultCtx.drawImage(img, e.detail.x / scale, e.detail.y / scale, e.detail.width / scale, e.detail.height / scale, 0, 0, resultCanvas.width, resultCanvas.height);
                        tempCtx.drawImage(img, e.detail.x / scale, e.detail.y / scale, e.detail.width / scale, e.detail.height / scale, 0, 0, tempCanvas.width, tempCanvas.height);
                    }
                });
            };
            img.src = e.target.result;
        };
        fileReader.readAsDataURL(file);
    });
}

function pixelate(img, size) {
    let dst = new cv.Mat();
    cv.resize(img, dst, new cv.Size(size, size), 0, 0, interpolation = cv.INTER_AREA);
    img.delete()
    return dst;
}

function clustering(img, k) {
    indexCtx.clearRect(0, 0, indexCanvas.width, indexCanvas.height);

    // create float 32 matrix
    let sample = new cv.Mat(img.rows * img.cols, 3, cv.CV_32F);
    for (let y = 0; y < img.rows; y++) {
        for (let x = 0; x < img.cols; x++) {
            for (let z = 0; z < 3; z++) {
                sample.floatPtr(y + x * img.rows)[z] = img.ucharPtr(y, x)[z];
            }
        }
    }

    let labels = new cv.Mat();
    let centers = new cv.Mat();
    let attempts = 20;

    let criteria = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, 1000, 0.001);

    cv.kmeans(sample, k, labels, criteria, attempts, cv.KMEANS_PP_CENTERS, centers);

    let centerArray = [];
    let pallet = [];
    for (let index = 0; index < k; index++) {
        let [rr, rg, rb] = [centers.floatAt(index, 0), centers.floatAt(index, 1), centers.floatAt(index, 2)];
        let [h, s, v] = rgb2hsv(rr, rg, rb);
        h = Math.round(h / 12);
        s = Math.round(s / 6.66);
        v = Math.round(v / 6.66);
        pallet.push([h, s, v]);
        centerArray.push(hsv2rgb(h * 12, s * 6.66, v * 6.66));
    }

    let relate = showPallet(pallet);

    console.log(pallet);

    let newImage = new cv.Mat(img.size(), img.type());
    for (let y = 0; y < img.rows; y++) {
        for (let x = 0; x < img.cols; x++) {
            var cluster_idx = labels.intAt(y + x * img.rows, 0);
            let displayIndex = relate[cluster_idx];

            v = pallet[cluster_idx][2];
            indexCtx.fillStyle = `hsl(0, 0%, ${v * 6.66 > 60 ? 0 : 100}%)`;
            indexCtx.fillText(displayIndex, (x) * 13 + 1, (y + 1) * 13 - 1);

            let [r, g, b] = centerArray[cluster_idx];

            let redChan = new Uint8Array(1);
            let greenChan = new Uint8Array(1);
            let blueChan = new Uint8Array(1);
            let alphaChan = new Uint8Array(1);

            redChan[0] = r;
            greenChan[0] = g;
            blueChan[0] = b;
            alphaChan[0] = 255;

            newImage.ucharPtr(y, x)[0] = redChan;
            newImage.ucharPtr(y, x)[1] = greenChan;
            newImage.ucharPtr(y, x)[2] = blueChan;
            newImage.ucharPtr(y, x)[3] = alphaChan;
        }
    }

    labels.delete();
    centers.delete();
    return newImage
}

function genMyDesign() {
    let mat = cv.imread(tempCanvas);
    mat = pixelate(mat, 32);
    mat = clustering(mat, 15);

    let miniImage = new cv.Mat();
    cv.resize(mat, miniImage, new cv.Size(100, 100), 0, 0, interpolation = cv.INTER_NEAREST);
    cv.imshow('minimapCanvas', miniImage);
    miniImage.delete();

    let resultImage = new cv.Mat();
    cv.resize(mat, resultImage, new cv.Size(416, 416), 0, 0, interpolation = cv.INTER_NEAREST);
    cv.imshow('resultCanvas', resultImage);
    resultImage.delete();

    mat.delete();
}

function rgb2hsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var diff = max - min;

    var h = 0;

    switch (min) {
        case max:
            h = 0;
            break;

        case r:
            h = (60 * ((b - g) / diff)) + 180;
            break;

        case g:
            h = (60 * ((r - b) / diff)) + 300;
            break;

        case b:
            h = (60 * ((g - r) / diff)) + 60;
            break;
    }

    var s = max == 0 ? 0 : diff / max * 100;
    var v = max * 100;

    return [h, s, v];
}

function hsv2rgb(h, s, v) {
    h /= 60
    s /= 100
    v /= 100
    if (s == 0) return [v * 255, v * 255, v * 255];

    var rgb;
    var i = parseInt(h);

    var f = h - i;
    var v1 = v * (1 - s);
    var v2 = v * (1 - s * f);
    var v3 = v * (1 - s * (1 - f));

    switch (i) {
        case 0:
        case 6:
            rgb = [v, v3, v1];
            break;

        case 1:
            rgb = [v2, v, v1];
            break;

        case 2:
            rgb = [v1, v, v3];
            break;

        case 3:
            rgb = [v1, v2, v];
            break;

        case 4:
            rgb = [v3, v1, v];
            break;

        case 5:
            rgb = [v, v1, v2];
            break;
    }

    return [rgb[0] * 255, rgb[1] * 255, rgb[2] * 255];
}

function hsv2hsl(hsvH, hsvS, hsvV) {
    const hslL = (200 - hsvS) * hsvV / 100;
    const [hslS, hslV] = [
        hslL === 0 || hslL === 200 ? 0 : hsvS * hsvV / 100 / (hslL <= 100 ? hslL : 200 - hslL) * 100,
        hslL * 5 / 10
    ];
    return [hsvH, hslS, hslV];
}

function showPallet(pallet) {
    let _pallet = JSON.parse(JSON.stringify(pallet))
    for (let index = 0; index < _pallet.length; index++) {
        _pallet[index].push(index);
    }

    _pallet.sort((a, b) => {
        if (a[0] > b[0]) return 1;
        if (a[0] < b[0]) return -1;
        if (a[1] > b[1]) return 1;
        if (a[1] < b[1]) return -1;
        if (a[2] > b[2]) return 1;
        if (a[2] < b[2]) return -1;
        return 0;
    })

    let relate = [];
    for (let index = 0; index < _pallet.length; index++) {
        relate[index] = _pallet.findIndex(x => x[3] === index) + 1;
    }

    const resultTbody = document.getElementById('result-tbody');
    resultTbody.innerHTML = '';

    for (let index = 0; index < _pallet.length; index++) {
        const [h, s, v] = _pallet[index];
        const [nh, ns, nl] = hsv2hsl(h * 12, s * 6.66, v * 6.66);
        resultTbody.innerHTML += `<tr><td>${index + 1}</td><td class="result-color" id="result-${index}"></td><td>${h}</td><td>${s}</td><td>${v}</td></tr>`;
        document.getElementById(`result-${index}`).style.backgroundColor = `hsl(${nh}, ${Math.round(ns)}%, ${Math.round(nl)}%)`;
    }

    return relate;
}