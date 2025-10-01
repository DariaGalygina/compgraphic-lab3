function Triangle() 
{
    const ctx = document.getElementById('myCanvas').getContext('2d');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    const points = ['x1','y1','x2','y2','x3','y3'].map(id => parseInt(document.getElementById(id).value));
    
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    ctx.lineTo(points[2], points[3]);
    ctx.lineTo(points[4], points[5]);
    ctx.closePath();
    ctx.stroke();
    
    document.getElementById('colorInputs').style.display = 'block';
}

function DrawGradient() {
    const ctx = document.getElementById('myCanvas').getContext('2d');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    const getVal = (id, fn = parseInt) => fn(document.getElementById(id).value);
    
    GradientTriangle(
        ctx,
        ...['x1','y1','x2','y2','x3','y3'].map(id => getVal(id)),
        ...['color1','color2','color3'].map(id => getVal(id, hex_to_rgb))
    );
}

const hex_to_rgb = hex =>
{
    const n = parseInt(hex.substring(1), 16);
    return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
};


function GradientTriangle(ctx, x1, y1, x2, y2, x3, y3, color1, color2, color3)
{
    const vertices = [{x:x1,y:y1,color:color1}, {x:x2,y:y2,color:color2}, {x:x3,y:y3,color:color3}].sort((a, b) => a.y - b.y);
    
    for (let y = vertices[0].y; y <= vertices[2].y; y++) {
        const points = [];
        
        [[0,1], [1,2], [0,2]].forEach(([i,j]) => {
            const v1 = vertices[i], v2 = vertices[j];
            if (v1.y !== v2.y && y >= Math.min(v1.y, v2.y) && y <= Math.max(v1.y, v2.y)) {
                const t = (y - v1.y) / (v2.y - v1.y);
                points.push({
                    x: v1.x + t * (v2.x - v1.x),
                    color: Color(v1.color, v2.color, t)
                });
            }
        });
        
        if (points.length >= 2) {
            points.sort((a, b) => a.x - b.x);
            const [left, right] = [points[0], points[points.length - 1]];
            
            for (let x = Math.floor(left.x); x <= Math.ceil(right.x); x++) {
                if (x >= left.x && x <= right.x) {
                    const t = (right.x - left.x) ? (x - left.x) / (right.x - left.x) : 0;
                    const color = Color(left.color, right.color, t);
                    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
}

const Color = (c1, c2, t) => 
({
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t)
});

