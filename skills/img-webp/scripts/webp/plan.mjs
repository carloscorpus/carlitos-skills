// Reglas de tamaño y de nombres. Funciones puras: no leen ni escriben archivos.

// Ancho máximo por defecto. 2000 px cubre pantallas de alta densidad para una caja de hasta 1000 px.
export const ANCHO_MAX = 2000;
export const CALIDAD = 80;

// Cada imagen conserva sus medidas. Solo si el ancho que se ve supera `anchoMax` se reduce a `anchoMax`,
// con la misma proporción. Nunca se amplía. Devuelve { reducir, ancho, alto } (medidas de salida).
export function planificarTamano({ ancho, alto }, anchoMax = ANCHO_MAX) {
    if (!ancho || !alto) return { reducir: false, ancho, alto };
    if (ancho <= anchoMax) return { reducir: false, ancho, alto };
    return { reducir: true, ancho: anchoMax, alto: Math.max(1, Math.round((alto * anchoMax) / ancho)) };
}

// "assets/img/hero.JPG" -> "assets/img/hero.webp" (misma carpeta y mismo nombre).
export const nombreWebp = (ruta) => ruta.replace(/\.(png|jpe?g)$/i, '.webp');

// Ruta con barras normales, para comparar y mostrar igual en Windows y en Linux.
export const posix = (ruta) => ruta.replaceAll('\\', '/');

// "12.3 MB", "850 KB".
export function legible(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}
