import { defineConfig } from 'vite';

export default defineConfig({
    //server: {
    //    port: 3000
    //},
    root: './client',
    build: {
        outDir: '../dist' // Build to a dist folder in the root
    }
});