const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const drawBtn = document.getElementById('drawBtn');
const fillBtn = document.getElementById('fillBtn');
const patternFillBtn = document.getElementById('patternFillBtn');
const boundaryBtn = document.getElementById('boundaryBtn');
const clearBtn = document.getElementById('clearBtn');
const colorPicker = document.getElementById('colorPicker');
const patternFile = document.getElementById('patternFile');
const status = document.getElementById('status');

// Состояния
let isDrawing = false;
let currentTool = 'draw';
let lastX = 0;
let lastY = 0;
let patternImage = null;

// Xолст
function initCanvas() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
}

function setActiveTool(tool) {
    currentTool = tool;
    
    drawBtn.classList.remove('active');
    fillBtn.classList.remove('active');
    patternFillBtn.classList.remove('active');
    boundaryBtn.classList.remove('active');
    
    if (tool === 'draw') {
        drawBtn.classList.add('active');
        status.textContent = 'Рисование: рисуйте мышью, удерживая левую кнопку';
    } else if (tool === 'fill') {
        fillBtn.classList.add('active');
        status.textContent = 'Заливка цветом: щелкните в области для заливки';
    } else if (tool === 'patternFill') {
        patternFillBtn.classList.add('active');
        status.textContent = 'Заливка рисунком: сначала загрузите изображение, затем щелкните в области для заливки';
    } else if (tool === 'boundary') {
        boundaryBtn.classList.add('active');
        status.textContent = 'Выделение границы: щелкните внутри фигуры для создания внутренней границы';
    }
}

// Цвет пикселя в RGB
function getPixelColor(x, y) {
    const imageData = ctx.getImageData(x, y, 1, 1).data;
    return `rgb(${imageData[0]}, ${imageData[1]}, ${imageData[2]})`;
}

// Сравнение 
function colorsEqual(color1, color2, tolerance = 5) {
    if (color1 === color2) return true;
    
    const rgb1 = color1.match(/\d+/g).map(Number);
    const rgb2 = color2.match(/\d+/g).map(Number);
    
    for (let i = 0; i < 3; i++) {
        if (Math.abs(rgb1[i] - rgb2[i]) > tolerance) {
            return false;
        }
    }
    return true;
}

// 1а. Рекурсивный алгоритм заливки на основе серий пикселов (линий)
function floodFillLine(x, y, targetColor, fillColor) {

    const currentColor = getPixelColor(x, y);
    
    if (colorsEqual(currentColor, fillColor) || !colorsEqual(currentColor, targetColor)) {
        return;
    }
    
    let left = x;
    while (left > 0 && colorsEqual(getPixelColor(left - 1, y), targetColor)) {
        left--;
    }
    
    let right = x;
    while (right < canvas.width - 1 && colorsEqual(getPixelColor(right + 1, y), targetColor)) {
        right++;
    }
    
    // Закрашивание горизонтальной линии от left до right
    ctx.fillStyle = fillColor;
    ctx.fillRect(left, y, right - left + 1, 1);
    
    // Строка выше
    let spanAbove = false;
    for (let i = left; i <= right; i++) {
        if (y > 0) {
            const colorAbove = getPixelColor(i, y - 1);
            if (colorsEqual(colorAbove, targetColor) && !colorsEqual(colorAbove, fillColor)) {
                if (!spanAbove) {
                    floodFillLine(i, y - 1, targetColor, fillColor);
                    spanAbove = true;
                }
            } else {
                spanAbove = false;
            }
        }
    }
    
    // Строка ниже
    let spanBelow = false;
    for (let i = left; i <= right; i++) {
        if (y < canvas.height - 1) {
            const colorBelow = getPixelColor(i, y + 1);
            if (colorsEqual(colorBelow, targetColor) && !colorsEqual(colorBelow, fillColor)) {
                if (!spanBelow) {
                    floodFillLine(i, y + 1, targetColor, fillColor);
                    spanBelow = true;
                }
            } else {
                spanBelow = false;
            }
        }
    }
}

// Границы области
function getFillAreaBoundaries(x, y, targetColor) {
    const visited = new Set();
    const boundaries = [];
    const queue = [{x, y}];
    visited.add(`${x},${y}`);
    
    const directions = [
        {dx: -1, dy: 0}, {dx: 1, dy: 0},
        {dx: 0, dy: -1}, {dx: 0, dy: 1}
    ];
    
    let minX = x, maxX = x, minY = y, maxY = y;
    
    while (queue.length > 0) {
        const point = queue.shift();
        const {x: px, y: py} = point;
        
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        
        boundaries.push(point);
        
        // Соседние пиксели
        for (const dir of directions) {
            const nx = px + dir.dx;
            const ny = py + dir.dy;
            const key = `${nx},${ny}`;
            
            if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height && 
                !visited.has(key) && colorsEqual(getPixelColor(nx, ny), targetColor)) {
                visited.add(key);
                queue.push({x: nx, y: ny});
            }
        }
    }
    
    return {
        points: boundaries,
        bounds: {minX, maxX, minY, maxY},
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
}

// Циклическое повторение маленького изображения
function fillWithPatternTiling(bounds, patternImg) {
    const patternWidth = patternImg.width;
    const patternHeight = patternImg.height;
    
    const startX = bounds.minX;
    const startY = bounds.minY;
   
    for (let y = startY; y <= bounds.maxY; y += patternHeight) {
        for (let x = startX; x <= bounds.maxX; x += patternWidth) {
            // Рисуем изображение в исходном размере
            ctx.drawImage(patternImg, x, y, patternWidth, patternHeight);
        }
    }
}

// Вставка большого изображения с обрезкой
function fillWithPatternClipping(bounds, patternImg) {
    const patternWidth = patternImg.width;
    const patternHeight = patternImg.height;
    
    const offsetX = Math.max(0, Math.floor((patternWidth - (bounds.maxX - bounds.minX + 1)) / 2));
    const offsetY = Math.max(0, Math.floor((patternHeight - (bounds.maxY - bounds.minY + 1)) / 2));
    
    ctx.drawImage(
        patternImg,
        offsetX, // source x
        offsetY, // source y
        Math.min(patternWidth - offsetX, bounds.maxX - bounds.minX + 1), // source width
        Math.min(patternHeight - offsetY, bounds.maxY - bounds.minY + 1), // source height
        bounds.minX, // destination x
        bounds.minY, // destination y
        bounds.maxX - bounds.minX + 1, // destination width
        bounds.maxY - bounds.minY + 1 // destination height
    );
}

// 1б. Заливка рисунком
function floodFillPattern(x, y, targetColor, patternImg) {
    if (!patternImg) {
        status.textContent = 'Сначала загрузите изображение!';
        return;
    }

    const currentColor = getPixelColor(x, y);
    
    if (!colorsEqual(currentColor, targetColor)) {
        status.textContent = 'Точка не подходит для заливки';
        return;
    }

    const areaInfo = getFillAreaBoundaries(x, y, targetColor);
    
    if (areaInfo.points.length === 0) {
        status.textContent = 'Область для заливки не найдена';
        return;
    }

    const { bounds, width, height } = areaInfo;
    const patternWidth = patternImg.width;
    const patternHeight = patternImg.height;

    status.textContent = `Область: ${width}x${height}, Изображение: ${patternWidth}x${patternHeight}`;

    ctx.save();

    // Маска для области заливки
    ctx.beginPath();
    
    const rows = {};
    areaInfo.points.forEach(point => {
        if (!rows[point.y]) rows[point.y] = [];
        rows[point.y].push(point.x);
    });

    Object.keys(rows).forEach(y => {
        const xCoords = rows[y].sort((a, b) => a - b);
        let startX = xCoords[0];
        let endX = xCoords[0];
        
        for (let i = 1; i < xCoords.length; i++) {
            if (xCoords[i] === endX + 1) {
                endX = xCoords[i];
            } else {
                ctx.rect(startX, parseInt(y), endX - startX + 1, 1);
                startX = xCoords[i];
                endX = xCoords[i];
            }
        }
        ctx.rect(startX, parseInt(y), endX - startX + 1, 1);
    });
    
    ctx.clip();

    if (patternWidth <= width && patternHeight <= height) {
        // Маленькое изображение - циклическое повторение
        fillWithPatternTiling(bounds, patternImg);
    } else {
        // Большое изображение - вставка с обрезкой
        fillWithPatternClipping(bounds, patternImg);
    }

    ctx.restore();
    
    status.textContent = 'Заливка изображением завершена';
}

// Выделение границы - обход по контуру фигуры
function traceBoundary(startX, startY) {
    const visited = new Set();
    const boundaryPoints = [];
    const targetColor = getPixelColor(startX, startY);
    
    if (!colorsEqual(targetColor, 'rgb(255,255,255)')) {
        // Ищем белую точку в окрестности
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = startX + dx;
                const ny = startY + dy;
                if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
                    if (colorsEqual(getPixelColor(nx, ny), 'rgb(255,255,255)')) {
                        startX = nx;
                        startY = ny;
                        break;
                    }
                }
            }
        }
    }
    
    const directions = [
        { dx: 1, dy: 0 },   // вправо
        { dx: 0, dy: 1 },   // вниз
        { dx: -1, dy: 0 },  // влево
        { dx: 0, dy: -1 }   // вверх
    ];
    
    let x = startX;
    let y = startY;
    let dirIndex = 0; // Двигаемся вправо
    
    // Первая граничная точка
    while (true) {
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
            return [];
        }
        
        const currentColor = getPixelColor(x, y);
        
        // Если нет белой точки - это граница
        if (!colorsEqual(currentColor, 'rgb(255,255,255)')) {
            break;
        }
        
        x += directions[dirIndex].dx;
        y += directions[dirIndex].dy;
    }
    
    // Начальная точка границы
    const startBoundaryX = x;
    const startBoundaryY = y;
    boundaryPoints.push({ x, y });
    visited.add(`${x},${y}`);
    
    let steps = 0;
    const maxSteps = canvas.width * canvas.height;
    
    while (steps < maxSteps) {
        steps++;
        
        // Все направления для поиска следующей граничной точки
        let foundNext = false;
        
        for (let i = 0; i < directions.length; i++) {
            const newDirIndex = (dirIndex + i) % directions.length;
            const dir = directions[newDirIndex];
            const nextX = x + dir.dx;
            const nextY = y + dir.dy;
            const key = `${nextX},${nextY}`;
            
            if (nextX >= 0 && nextX < canvas.width && nextY >= 0 && nextY < canvas.height) {
                const nextColor = getPixelColor(nextX, nextY);
                
                // Если это граничная точка и мы ее еще не посещали
                if (!colorsEqual(nextColor, 'rgb(255,255,255)') && !visited.has(key)) {
                    boundaryPoints.push({ x: nextX, y: nextY });
                    visited.add(key);
                    x = nextX;
                    y = nextY;
                    dirIndex = (newDirIndex + 3) % directions.length; // Поворот налево
                    foundNext = true;
                    break;
                }
            }
        }
        
        // Если не нашли следующую точку или вернулись к началу
        if (!foundNext || 
            (x === startBoundaryX && y === startBoundaryY && boundaryPoints.length > 1)) {
            break;
        }
    }
    
    return boundaryPoints;
}

// Отрисовка выделенной границы
function drawBoundary(boundaryPoints) {
    if (boundaryPoints.length === 0) {
        status.textContent = 'Не удалось найти границу';
        return;
    }
    
    ctx.beginPath();
    ctx.moveTo(boundaryPoints[0].x, boundaryPoints[0].y);
    
    for (let i = 1; i < boundaryPoints.length; i++) {
        ctx.lineTo(boundaryPoints[i].x, boundaryPoints[i].y);
    }
    
    // Замыкание контура
    ctx.closePath();
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    status.textContent = `Граница выделена. Точек: ${boundaryPoints.length}`;
    
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = 2;
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    if (currentTool === 'draw') {
        isDrawing = true;
        [lastX, lastY] = [x, y];
    } else if (currentTool === 'fill') {
        const targetColor = getPixelColor(x, y);
        floodFillLine(x, y, targetColor, colorPicker.value);
    } else if (currentTool === 'patternFill') {
        if (patternImage) {
            const targetColor = getPixelColor(x, y);
            floodFillPattern(x, y, targetColor, patternImage);
        } else {
            status.textContent = 'Сначала загрузите изображение для заливки!';
        }
    } else if (currentTool === 'boundary') {
        const boundaryPoints = traceBoundary(x, y);
        drawBoundary(boundaryPoints);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || currentTool !== 'draw') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    [lastX, lastY] = [x, y];
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

canvas.addEventListener('mouseout', () => {
    isDrawing = false;
});

// Обработчики кнопок
drawBtn.addEventListener('click', () => setActiveTool('draw'));
fillBtn.addEventListener('click', () => setActiveTool('fill'));
patternFillBtn.addEventListener('click', () => setActiveTool('patternFill'));
boundaryBtn.addEventListener('click', () => setActiveTool('boundary'));

clearBtn.addEventListener('click', () => {
    initCanvas();
    status.textContent = 'Холст очищен';
});

// Обработчик загрузки изображения для заливки
patternFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            patternImage = new Image();
            patternImage.onload = () => {
                status.textContent = `Изображение загружено (${patternImage.width}x${patternImage.height})`;
            };
            patternImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Обработчик изменения цвета
colorPicker.addEventListener('change', () => {
    ctx.strokeStyle = colorPicker.value;
});

// Инициализация при загрузке страницы
window.addEventListener('load', () => {
    initCanvas();
    setActiveTool('draw');
});
