// Capturas "lisas": una imagen de un solo color (falla de pintado en el admin, o un elemento web que
// todavía estaba invisible por su animación). Sin dependencias: el PNG se decodifica con node:zlib; el
// JPG se revisa en el navegador al capturar (DOMINANTE_EN_NAVEGADOR) y queda marcado en mapa.json.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// Lisa = casi no hay colores distintos. Una captura con algo de texto ya tiene decenas (el suavizado de
// las letras), aunque el fondo ocupe el 99 %: por eso no se mide cuánto ocupa el color dominante.
export const MAX_COLORES_LISA = 4;

// Clave de color con 4 bits por canal: absorbe el ruido de compresión.
const clave = (r, g, b) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);

// { dominante (0–1), colores } de una muestra de la imagen. null si no es un PNG que se entienda.
export function dominantePng(path) {
    const buf = readFileSync(path);
    if (buf.readUInt32BE(0) !== 0x89504e47) return null;
    let w = 0, h = 0, depth = 0, color = 0;
    const idat = [];
    for (let i = 8; i < buf.length;) {
        const len = buf.readUInt32BE(i);
        const type = buf.toString('latin1', i + 4, i + 8);
        const data = buf.subarray(i + 8, i + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; color = data[9]; if (data[12]) return null; }
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        i += 12 + len;
    }
    const bpp = { 2: 3, 6: 4, 0: 1, 4: 2 }[color];
    if (depth !== 8 || !bpp || !w || !h) return null;
    const raw = inflateSync(Buffer.concat(idat));
    const stride = w * bpp;
    let prev = Buffer.alloc(stride);
    const cur = Buffer.alloc(stride);
    const cuenta = new Map();
    let total = 0;
    const paso = Math.max(1, Math.floor(w / 400));
    const filaPaso = Math.max(1, Math.floor(h / 400));
    for (let y = 0; y < h; y++) {
        const off = y * (stride + 1);
        const filter = raw[off];
        for (let x = 0; x < stride; x++) {
            const v = raw[off + 1 + x];
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev[x];
            const c = x >= bpp ? prev[x - bpp] : 0;
            let p;
            if (filter === 0) p = 0;
            else if (filter === 1) p = a;
            else if (filter === 2) p = b;
            else if (filter === 3) p = (a + b) >> 1;
            else {
                const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
                p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            cur[x] = (v + p) & 0xff;
        }
        if (y % filaPaso === 0) {
            for (let x = 0; x < w; x += paso) {
                const i = x * bpp;
                const alfa = bpp === 4 || bpp === 2 ? cur[i + bpp - 1] >> 4 : 15;
                const k = (bpp >= 3 ? clave(cur[i], cur[i + 1], cur[i + 2]) : clave(cur[i], cur[i], cur[i])) * 16 + alfa;
                cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
                total += 1;
            }
        }
        cur.copy(prev);
    }
    return total ? { dominante: Math.max(...cuenta.values()) / total, colores: cuenta.size } : null;
}

// true si la captura es de un solo color. Solo PNG (los JPG se revisan al capturar).
export function esLisa(path) {
    if (!/\.png$/i.test(path)) return false;
    try {
        const d = dominantePng(path);
        return d !== null && d.colores <= MAX_COLORES_LISA;
    } catch {
        return false;
    }
}

// Para page.evaluate(): recibe la imagen en base64 y devuelve cuántos colores distintos tiene (muestra).
export const DOMINANTE_EN_NAVEGADOR = async ({ b64, mime }) => {
    const img = new Image();
    img.src = `data:${mime};base64,${b64}`;
    await img.decode();
    const w = Math.min(400, img.naturalWidth), h = Math.min(400, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const cuenta = new Map();
    for (let i = 0; i < d.length; i += 4) {
        const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
        cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    }
    return cuenta.size;
};
