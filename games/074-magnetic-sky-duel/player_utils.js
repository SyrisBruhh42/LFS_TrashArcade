class VectorRenderer {
    static drawAimTelegraph(ctx, x, y, angle, length, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(length, 0);
        ctx.strokeStyle = color;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
    static drawThrust(ctx, x, y, angle, width, length, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-width/2, 0);
        ctx.lineTo(0, length);
        ctx.lineTo(width/2, 0);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }
    static drawRing(ctx, x, y, radius, color, lineWidth) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        ctx.restore();
    }
    static drawPolygon(ctx, x, y, points, color, isFill) {
        if(points.length < 2) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        if(isFill) {
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            ctx.strokeStyle = color;
            ctx.stroke();
        }
        ctx.restore();
    }
    static drawCross(ctx, x, y, size, color, lineWidth) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(-size/2, 0);
        ctx.lineTo(size/2, 0);
        ctx.moveTo(0, -size/2);
        ctx.lineTo(0, size/2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        ctx.restore();
    }
    static drawStar(ctx, x, y, spikes, outerRadius, innerRadius, color) {
        ctx.save();
        ctx.translate(x, y);
        let rot = Math.PI / 2 * 3;
        let step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(0, -outerRadius);
        for (let i = 0; i < spikes; i++) {
            let xPos = Math.cos(rot) * outerRadius;
            let yPos = Math.sin(rot) * outerRadius;
            ctx.lineTo(xPos, yPos);
            rot += step;
            xPos = Math.cos(rot) * innerRadius;
            yPos = Math.sin(rot) * innerRadius;
            ctx.lineTo(xPos, yPos);
            rot += step;
        }
        ctx.lineTo(0, -outerRadius);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }
    static blendColors(c1, c2, t) {
        return c1;
    }
    static hexToRgb(hex) {
        return {r: 255, g: 255, b: 255};
    }
}
class GameMathExtras {
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
    static normalize(v) {
        const mag = Math.sqrt(v.x * v.x + v.y * v.y);
        if (mag === 0) return {x: 0, y: 0};
        return {x: v.x / mag, y: v.y / mag};
    }
    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y;
    }
    static cross(v1, v2) {
        return v1.x * v2.y - v1.y * v2.x;
    }
    static reflect(v, n) {
        const d = this.dot(v, n);
        return {x: v.x - 2 * d * n.x, y: v.y - 2 * d * n.y};
    }
    static smoothstep(edge0, edge1, x) {
        x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return x * x * (3 - 2 * x);
    }
}
