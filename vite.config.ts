
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // 加载环境变量，Vite 会自动将以 VITE_ 开头的环境变量暴露给客户端
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // base 设为 './' 确保在 GitHub Pages 的子目录下资源引用正确
    base: './',
    build: {
      outDir: 'dist',
    },
    server: {
      port: 3000
    }
  };
});
