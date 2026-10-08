import { defineConfig, type Plugin } from 'vite';
import { basename, resolve } from 'path';
import { rmSync, writeFileSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';

const themeRoot = import.meta.dirname;
const themeDir = basename(themeRoot);
const devServer = 'http://localhost:5173';
const hotFile = resolve(themeRoot, 'hot');

const cleanupKey = Symbol.for('{{THEME_SLUG}}.wp-hot-file.cleanup');

// Handlers de limpieza una sola vez por proceso: Vite recarga la config (y vuelve a
// ejecutar configureServer) al editarla, sin reiniciar el proceso.
function registerCleanup(cleanup: () => void) {
    const registry = globalThis as Record<symbol, boolean>;
    if (registry[cleanupKey]) return;
    registry[cleanupKey] = true;

    process.on('exit', cleanup);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
        process.on(signal, () => {
            cleanup();
            process.exit();
        });
    }
}

// Crea `hot` mientras corre `pnpm dev`; PHP lo usa para detectar modo desarrollo.
function wpHotFile(): Plugin {
    const cleanup = () => rmSync(hotFile, { force: true });

    return {
        name: 'wp-hot-file',
        apply: 'serve',
        configureServer(server) {
            server.httpServer?.once('listening', () => writeFileSync(hotFile, devServer));
            registerCleanup(cleanup);
        },
    };
}

export default defineConfig(({ command }) => ({
    plugins: [tailwindcss(), wpHotFile()],
    base: command === 'build' ? `/wp-content/themes/${themeDir}/dist/` : '/',
    server: {
        origin: devServer,
        cors: true,
        strictPort: true,
        port: 5173,
        hmr: {
            host: 'localhost',
        },
    },
    build: {
        manifest: 'manifest.json',
        outDir: 'dist',
        rolldownOptions: {
            input: {
                styles: resolve(themeRoot, 'src/css/input.css'),
                main: resolve(themeRoot, 'src/js/main.js'),
            },
        },
    },
}));
