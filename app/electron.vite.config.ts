import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { cpSync, existsSync, rmSync } from 'node:fs';

/** 把内置 skill 目录拷到 dist/main/builtin，供运行时 resolveBundledSkillRoots 解析 */
const copyBuiltinSkillsPlugin = () => ({
  name: 'copy-builtin-skills',
  closeBundle() {
    const source = resolve(__dirname, 'src/main/skills/builtin');
    if (!existsSync(source)) return;
    const target = resolve(__dirname, 'dist/main/builtin');
    rmSync(target, { recursive: true, force: true });
    cpSync(source, target, { recursive: true });
  },
});

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyBuiltinSkillsPlugin()],
    build: {
      outDir: 'dist/main',
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
      dedupe: ['react', 'react-dom'],
    },
    build: {
      outDir: 'dist/renderer',
    },
  },
});
