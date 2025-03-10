import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        open: true
    },
    plugins: [react()],
    root: './client',
    build: {
        outDir: '../dist', // Build to a dist folder in the root
        emptyOutDir: true
    },

    esbuild: {
        loader: 'jsx',
        include: [/.*\.(jsx|tsx)?$/,],
        exclude: [],
        },
        optimizeDeps: {
            esbuildOptions: {
                loader: {
                    '.js': 'jsx',
                },
            },
        },
    });