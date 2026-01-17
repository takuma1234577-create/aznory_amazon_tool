import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Vite plugin to copy manifest.json and popup.html to dist root
function copyManifestPlugin() {
  return {
    name: "copy-manifest",
    async writeBundle() {
      // Ensure dist directory exists
      const distDir = resolve(__dirname, "dist");
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }

      // Copy manifest.json from src to dist
      // Chrome拡張機能には manifest.json が必須なので、ビルド後に dist にコピーします
      const manifestSrc = resolve(__dirname, "src/manifest.json");
      const manifestDest = resolve(__dirname, "dist/manifest.json");
      if (existsSync(manifestSrc)) {
        copyFileSync(manifestSrc, manifestDest);
        console.log("✓ Copied manifest.json to dist/");
      }

      // Copy popup.html from src to dist root
      // Vite のビルドでは popup.html が dist/src/ に配置される場合があるため、
      // manifest.json の action.default_popup = "popup.html" が正しく参照できるよう、
      // dist 直下にコピーします
      const popupSrc = resolve(__dirname, "src/popup.html");
      const popupDest = resolve(__dirname, "dist/popup.html");
      const popupSrcGenerated = resolve(__dirname, "dist/src/popup.html");
      
      // まず dist/src/popup.html が存在する場合はそれを使用（Viteが生成したもの）
      // なければ src/popup.html からコピー
      if (existsSync(popupSrcGenerated)) {
        copyFileSync(popupSrcGenerated, popupDest);
        console.log("✓ Copied popup.html to dist/ (from dist/src/)");
      } else if (existsSync(popupSrc)) {
        copyFileSync(popupSrc, popupDest);
        console.log("✓ Copied popup.html to dist/");
      }

      // Copy images directory to dist
      const imagesSrcDir = resolve(__dirname, "src/images");
      const imagesDestDir = resolve(__dirname, "dist/images");
      if (existsSync(imagesSrcDir)) {
        // ディレクトリが存在しない場合は作成
        if (!existsSync(imagesDestDir)) {
          mkdirSync(imagesDestDir, { recursive: true });
        }
        // 画像ファイルをコピー
        const { readdirSync } = await import("fs");
        const files = readdirSync(imagesSrcDir);
        for (const file of files) {
          if (file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".svg")) {
            const srcFile = resolve(imagesSrcDir, file);
            const destFile = resolve(imagesDestDir, file);
            copyFileSync(srcFile, destFile);
            console.log(`✓ Copied ${file} to dist/images/`);
          }
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
    copyManifestPlugin()
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true, // ビルド前に dist をクリーンアップ
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.html"),
        background: resolve(__dirname, "src/background.ts"),
        contentScript: resolve(__dirname, "src/contentScript.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        // manualChunksを無効化して、contentScriptを単一ファイルに
        manualChunks: (id) => {
          // contentScriptに関連するモジュールはすべてcontentScript.jsに含める
          if (id.includes("contentScript") || id.includes("score-extension")) {
            return null; // nullを返すと、エントリファイルに含まれる
          }
          // その他のchunk分割はデフォルト動作に任せる
          return undefined;
        },
        assetFileNames: (assetInfo) => {
          // popup.html は dist 直下に配置されるようにする
          if (assetInfo.name === "popup.html") {
            return "popup.html";
          }
          // contentScript.jsから生成されるCSSはcontentScript.cssとしてdist直下に配置
          if (assetInfo.name?.includes("contentScript") && assetInfo.name?.endsWith(".css")) {
            return "styles/style.css"; // Renamed to style.css
          }
          // popup.jsから生成されるCSSはstyles/popup.cssに配置
          if (assetInfo.name?.includes("popup") && assetInfo.name?.endsWith(".css")) {
            return "styles/popup.css";
          }
          // その他のCSSファイルはstyles/に配置
          if (assetInfo.name?.endsWith(".css")) {
            return "styles/[name][extname]";
          }
          // 画像ファイルをdist/images/に配置
          if (/\.(png|jpe?g|gif|svg|webp)$/.test(assetInfo.name || '')) {
            return `images/[name][extname]`;
          }
          return "[name].[ext]";
        }
      }
    },
    // CSSコード分割を無効化（Shadow DOMで使用するため）
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  // CSS処理の設定
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },
});
