/**
 * Content Script for Amazon product pages
 * Extracts product data and sends to background for analysis
 */

// CSSをインポート（ビルド時に処理される）
// contentScript用のCSSをインポートして、ビルド時にCSSファイルを生成させる
import "./styles/globals.css";

// React/ReactDOMを静的インポート（動的インポートはChrome拡張で使えないため）
// 注意: 条件付きインポートはできないため、常にインポートされるが、使用時まで評価されない
import { createRoot } from "react-dom/client";
import React from "react";
import { ScoreExtensionUI } from "./components/score-extension/score-extension-ui";

// 注入確認: 最初に必ずログを出す
console.log("[FITPEAK] ========================================");
console.log("[FITPEAK] contentScript injected:", location.href);
console.log("[FITPEAK] User Agent:", navigator.userAgent);
console.log("[FITPEAK] Timestamp:", new Date().toISOString());
console.log("[FITPEAK] ========================================");
(window as any).__FITPEAK_INJECTED__ = true;

// UI表示状態を管理
let isUIVisible = false;
let reactRootHost: HTMLElement | null = null;
let badgeElement: HTMLElement | null = null;

// バッジのテキストを更新する関数（ロゴ表示のため、テキスト更新は不要）
function updateBadgeText() {
  if (!badgeElement) return;
  const host = document.getElementById("fitpeak-score-root-host");
  const isVisible = host && window.getComputedStyle(host).display !== "none";
  // ロゴのみ表示するため、テキストは更新しない
  badgeElement.setAttribute("title", isVisible ? "クリックしてUIを非表示" : "クリックしてUIを表示");
}

// 可視化バッジを表示（右下に固定、クリック可能）
function showInjectionBadge() {
  // 既に存在する場合は削除
  const existing = document.getElementById("fitpeak-injection-badge");
  if (existing) {
    existing.remove();
  }

  const badge = document.createElement("div");
  badge.id = "fitpeak-injection-badge";
  badgeElement = badge; // グローバル変数に保存
  
  // AZNORYロゴ画像を作成
  const logoImg = document.createElement("img");
  logoImg.src = chrome.runtime.getURL("images/aznory-logo.png");
  logoImg.alt = "AZNORY";
  logoImg.style.cssText = `
    width: 32px !important;
    height: 32px !important;
    display: block !important;
    object-fit: contain !important;
  `;
  logoImg.onerror = () => {
    // ロゴが読み込めない場合は非表示
    logoImg.style.display = "none";
  };
  
  badge.appendChild(logoImg);
  badge.style.cssText = `
    position: fixed !important;
    bottom: 10px !important;
    right: 10px !important;
    background: rgba(16, 185, 129, 0.9) !important;
    color: white !important;
    padding: 8px !important;
    border-radius: 8px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
    pointer-events: auto !important;
    cursor: pointer !important;
    user-select: none !important;
    transition: background-color 0.2s, transform 0.1s !important;
    border: 2px solid rgba(255,255,255,0.2) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `;
  
  // クリック可能であることを視覚的に示す
  badge.setAttribute("title", "クリックしてUIを表示/非表示");
  badge.setAttribute("role", "button");
  badge.setAttribute("tabindex", "0");
  
  // 定期的にバッジのテキストを更新（UIの状態を反映）
  setInterval(updateBadgeText, 1000);
  
  // ホバー効果
  badge.addEventListener("mouseenter", () => {
    badge.style.background = "rgba(5, 150, 105, 0.95)";
    badge.style.transform = "scale(1.05)";
  });
  badge.addEventListener("mouseleave", () => {
    badge.style.background = "rgba(16, 185, 129, 0.9)";
    badge.style.transform = "scale(1)";
  });
  
  // キーボードアクセス（Enter/Space）
  badge.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      console.log("[FITPEAK] Badge activated via keyboard");
      await toggleUIVisibility();
      setTimeout(updateBadgeText, 100);
    }
  });
  
  // クリックイベント: UIを表示/非表示
  badge.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[FITPEAK] Badge clicked, toggling UI visibility");
    console.log("[FITPEAK] Event details:", {
      target: e.target,
      currentTarget: e.currentTarget,
      button: (e as MouseEvent).button,
      clientX: (e as MouseEvent).clientX,
      clientY: (e as MouseEvent).clientY,
    });
    try {
      await toggleUIVisibility();
      setTimeout(updateBadgeText, 100); // バッジのテキストを更新（少し遅延させて状態を反映）
      console.log("[FITPEAK] toggleUIVisibility completed");
    } catch (error) {
      console.error("[FITPEAK] Error in toggleUIVisibility:", error);
    }
  });
  
  // デバッグ用: マウスイベントもログ
  badge.addEventListener("mousedown", (e) => {
    console.log("[FITPEAK] Badge mousedown");
  });
  badge.addEventListener("mouseup", (e) => {
    console.log("[FITPEAK] Badge mouseup");
  });
  
  document.documentElement.appendChild(badge);
}

// UIの表示/非表示を切り替え
async function toggleUIVisibility() {
  console.log("[FITPEAK] toggleUIVisibility called, reactRootHost:", reactRootHost);
  
  // reactRootHostを再取得（DOMが変更されている可能性があるため）
  reactRootHost = document.getElementById("fitpeak-score-root-host") as HTMLElement | null;
  
  if (!reactRootHost) {
    console.log("[FITPEAK] React root host not found, mounting UI");
    await mountScoreUI();
    // mountScoreUI完了後、reactRootHostが設定されているはず
    reactRootHost = document.getElementById("fitpeak-score-root-host") as HTMLElement | null;
    if (!reactRootHost) {
      console.error("[FITPEAK] Failed to get reactRootHost after mountScoreUI");
      return;
    }
    console.log("[FITPEAK] React root host obtained after mount:", reactRootHost);
    isUIVisible = true; // 新しくマウントした場合は表示状態にする
  } else {
    // 既存のUIがある場合は表示状態を確認
    const currentDisplay = window.getComputedStyle(reactRootHost).display;
    isUIVisible = currentDisplay !== "none";
    console.log("[FITPEAK] Current UI display state:", currentDisplay, "isUIVisible:", isUIVisible);
  }
  
  // 表示状態をトグル
  isUIVisible = !isUIVisible;
  console.log("[FITPEAK] isUIVisible set to:", isUIVisible);
  
  if (isUIVisible) {
    // UIを表示（通常のDOM要素として）
    reactRootHost!.style.display = "block";
    reactRootHost!.style.setProperty("display", "block", "important");
    console.log("[FITPEAK] UI shown, computed display:", window.getComputedStyle(reactRootHost!).display);
  } else {
    // UIを非表示
    reactRootHost!.style.display = "none";
    reactRootHost!.style.setProperty("display", "none", "important");
    console.log("[FITPEAK] UI hidden");
  }
}

// document_startで実行されるため、DOMが準備できたらバッジを表示
if (document.documentElement) {
  showInjectionBadge();
} else {
  // DOMがまだない場合は待つ
  const observer = new MutationObserver(() => {
    if (document.documentElement) {
      showInjectionBadge();
      observer.disconnect();
    }
  });
  observer.observe(document, { childList: true, subtree: true });
  
  // タイムアウト（念のため）
  setTimeout(() => {
    if (document.documentElement && !document.getElementById("fitpeak-injection-badge")) {
      showInjectionBadge();
    }
  }, 100);
}

// ASIN抽出関数（URLベースのみ）
function extractASIN(): string | null {
  const m = location.pathname.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
  return m?.[1] ?? m?.[2] ?? null;
}

// Bullets抽出関数
function extractBullets(): string[] {
  const bullets: string[] = [];
  // #feature-bullets ul li を探す
  const featureBullets = document.querySelector("#feature-bullets ul");
  if (featureBullets) {
    const items = featureBullets.querySelectorAll("li");
    items.forEach((item) => {
      const text = item.textContent?.trim();
      if (text && text.length > 0) {
        bullets.push(text);
      }
    });
  }
  return bullets;
}

// 画像の自然サイズを取得する関数（crossOrigin="anonymous"を使用）
async function getImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // CORS対応
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
    // タイムアウト（3秒）
    setTimeout(() => resolve(null), 3000);
  });
}

// 画像をcanvasに描画してImageDataを取得（CORS対応）
async function getImageData(url: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      } catch (e) {
        // CORSエラーなどでcanvasが汚染された場合
        console.warn("[FITPEAK] Failed to get image data (CORS?):", e);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      resolve(null);
    };
    
    img.src = url;
    // タイムアウト（5秒）
    setTimeout(() => resolve(null), 5000);
  });
}

// 背景白判定（右端中央ピクセルの色をチェック）
async function checkBackgroundWhite(url: string): Promise<boolean | null> {
  const imageData = await getImageData(url);
  if (!imageData) {
    return null; // CORSエラーなどで取得できない
  }
  
  const width = imageData.width;
  const height = imageData.height;
  const x = width - 1; // 右端
  const y = Math.floor(height / 2); // 中央
  
  const index = (y * width + x) * 4;
  const r = imageData.data[index];
  const g = imageData.data[index + 1];
  const b = imageData.data[index + 2];
  
  // RGBが(245,245,245)以上なら白として扱う
  return r >= 245 && g >= 245 && b >= 245;
}

// 占有率判定（白以外のピクセル比率を計算）
async function calculateFillRatio(url: string): Promise<number | null> {
  const imageData = await getImageData(url);
  if (!imageData) {
    return null; // CORSエラーなどで取得できない
  }
  
  const width = imageData.width;
  const height = imageData.height;
  const step = 5; // 5px刻みでサンプリング（計算コスト削減）
  
  let totalPixels = 0;
  let nonWhitePixels = 0;
  
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      totalPixels++;
      const index = (y * width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      
      // RGBが(245,245,245)未満なら白以外
      if (r < 245 || g < 245 || b < 245) {
        nonWhitePixels++;
      }
    }
  }
  
  return totalPixels > 0 ? nonWhitePixels / totalPixels : null;
}

// data-a-dynamic-imageから最大面積のURLとサイズを取得
function getLargestImageFromDynamicImage(dynamicImageAttr: string): { url: string; width: number; height: number } | null {
  try {
    const imageMap = JSON.parse(dynamicImageAttr);
    let largestUrl: string | null = null;
    let largestArea = 0;
    let largestDimensions: { width: number; height: number } | null = null;
    
    // {url: [w, h]} の形式で、面積(w*h)が最大のものを探す
    for (const [url, sizes] of Object.entries(imageMap)) {
      if (Array.isArray(sizes) && sizes.length >= 2) {
        const width = sizes[0] as number;
        const height = sizes[1] as number;
        const area = width * height;
        if (area > largestArea) {
          largestArea = area;
          largestUrl = url as string;
          largestDimensions = { width, height };
        }
      }
    }
    
    if (largestUrl && largestDimensions && typeof largestUrl === 'string') {
      // 高解像度URLに変換
      const highResUrl = largestUrl.replace(/_[A-Z0-9_]+\.jpg/, "_AC_SL1500_.jpg");
      return {
        url: highResUrl,
        width: largestDimensions.width,
        height: largestDimensions.height
      };
    }
  } catch (e) {
    console.warn("[FITPEAK] Failed to parse data-a-dynamic-image:", e);
  }
  return null;
}

// 単一のimg要素から最大面積のURLとサイズを取得
function getLargestImageFromImgElement(imgEl: HTMLElement): { url: string; width: number; height: number } | null {
  const dynamicImageAttr = imgEl.getAttribute("data-a-dynamic-image");
  if (dynamicImageAttr) {
    return getLargestImageFromDynamicImage(dynamicImageAttr);
  }
  return null;
}

// 画像をロードしてHTMLImageElementを返す（canvas解析用）
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
    // タイムアウト（5秒）
    setTimeout(() => resolve(null), 5000);
  });
}

// メイン画像の情報を取得（安定化版）
async function extractMainImage(): Promise<{ url: string; width: number; height: number; bgIsWhite?: boolean; fillRatio?: number } | null> {
  // DOMが完全に読み込まれるまで待機（最大5秒）
  let retryCount = 0;
  const maxRetries = 50; // 100ms * 50 = 5秒
  
  // (A) メイン画像候補セレクタを複数用意して順に探す（より包括的に）
  const mainImageSelectors = [
    "img#landingImage",
    "#landingImage",
    "#imgTagWrapperId img",
    "#imgBlkFront",
    "#main-image-container img",
    "#imageBlock_feature_div img",
    "#imageBlock img",
    "#leftCol img",
    "#centerCol img",
    "img[data-a-dynamic-image]",
    "[data-a-dynamic-image] img",
    "#product-image img",
    ".a-dynamic-image img"
  ];
  
  let mainImageEl: HTMLImageElement | null = null;
  
  // DOMが準備できるまで待機
  while (!mainImageEl && retryCount < maxRetries) {
    for (const selector of mainImageSelectors) {
      try {
        const el = document.querySelector(selector) as HTMLImageElement;
        if (el) {
          // img要素か、img要素を含む要素かを確認
          let imgEl: HTMLImageElement | null = null;
          if (el.tagName === "IMG") {
            imgEl = el;
          } else {
            // 親要素の場合は、その中の最初のimg要素を探す
            imgEl = el.querySelector("img") as HTMLImageElement;
          }
          
          if (imgEl && (imgEl.src || imgEl.currentSrc || imgEl.hasAttribute("data-a-dynamic-image") || imgEl.complete)) {
            mainImageEl = imgEl;
            console.log("[FITPEAK] Main image element found via selector:", selector, "after", retryCount, "retries");
            break;
          }
        }
      } catch (e) {
        // セレクタエラーは無視して次へ
        console.warn("[FITPEAK] Selector error for", selector, e);
      }
    }
    
    if (!mainImageEl) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retryCount++;
    }
  }
  
  if (!mainImageEl) {
    console.warn("[FITPEAK] Main image element not found after", retryCount, "retries");
    // 最後の試み：ページ内のすべてのimg要素から最大のものを探す
    const allImages = document.querySelectorAll("img[data-a-dynamic-image]");
    if (allImages.length > 0) {
      mainImageEl = allImages[0] as HTMLImageElement;
      console.log("[FITPEAK] Fallback: Using first img with data-a-dynamic-image");
    }
  }
  
  if (!mainImageEl) {
    console.warn("[FITPEAK] Main image element not found at all");
    return null;
  }

  let mainImageData: { url: string; width: number; height: number } | null = null;
  let loadedImage: HTMLImageElement | null = null;
  
  // (A) data-a-dynamic-imageから最大面積のURLとサイズを取得（最優先）
  if (mainImageEl.hasAttribute("data-a-dynamic-image")) {
    try {
      mainImageData = getLargestImageFromImgElement(mainImageEl);
      if (mainImageData) {
        console.log("[FITPEAK] Main image dimensions from data-a-dynamic-image:", mainImageData.width, "x", mainImageData.height);
      }
    } catch (e) {
      console.warn("[FITPEAK] Failed to parse data-a-dynamic-image:", e);
      // JSON.parseが失敗してもmainを捨てない（フォールバックへ進む）
    }
  }
  
  // 親要素や近傍要素からdata-a-dynamic-imageを探す（フォールバック）
  if (!mainImageData) {
    const parentWithDynamic = mainImageEl.closest("[data-a-dynamic-image]");
    if (parentWithDynamic) {
      try {
        mainImageData = getLargestImageFromImgElement(parentWithDynamic as HTMLElement);
        if (mainImageData) {
          console.log("[FITPEAK] Main image dimensions from parent data-a-dynamic-image:", mainImageData.width, "x", mainImageData.height);
        }
      } catch (e) {
        console.warn("[FITPEAK] Failed to parse data-a-dynamic-image from parent:", e);
      }
    }
  }
  
  // (B) フォールバック：Image()でnaturalWidth/Heightを取得
  if (!mainImageData) {
    const fallbackUrl = mainImageEl.currentSrc || mainImageEl.src;
    if (fallbackUrl && typeof fallbackUrl === 'string') {
      const highResUrl = fallbackUrl.replace(/_[A-Z0-9_]+\.jpg/, "_AC_SL1500_.jpg");
      console.log("[FITPEAK] Loading image for dimensions (fallback):", highResUrl);
      loadedImage = await loadImage(highResUrl);
      if (loadedImage && loadedImage.naturalWidth && loadedImage.naturalHeight) {
        mainImageData = {
          url: highResUrl,
          width: loadedImage.naturalWidth,
          height: loadedImage.naturalHeight
        };
        console.log("[FITPEAK] Main image dimensions from Image() (fallback):", mainImageData.width, "x", mainImageData.height);
      } else {
        console.warn("[FITPEAK] Failed to load image for dimensions (fallback)");
      }
    } else {
      console.warn("[FITPEAK] Fallback URL is not a valid string:", fallbackUrl);
    }
  } else {
    // data-a-dynamic-imageから取得できた場合も、canvas解析用に画像をロード
    if (mainImageData.url && typeof mainImageData.url === 'string') {
      console.log("[FITPEAK] Loading image for canvas analysis:", mainImageData.url);
      loadedImage = await loadImage(mainImageData.url);
    } else {
      console.warn("[FITPEAK] Main image URL is not a valid string:", mainImageData.url);
    }
  }
  
  // サイズ情報が取得できなかった場合はnullを返す
  if (!mainImageData || !mainImageData.width || !mainImageData.height) {
    console.warn("[FITPEAK] Main image dimensions not available");
    return null;
  }
  
  console.log("[FITPEAK] Main image dimensions confirmed:", mainImageData.width, "x", mainImageData.height);
  
  // (C) BgWhite / FillRatio（canvas解析）- 成功した時だけ判定
  let bgIsWhite: boolean | undefined = undefined;
  let fillRatio: number | undefined = undefined;
  
  if (loadedImage) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = loadedImage.naturalWidth;
      canvas.height = loadedImage.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(loadedImage, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 背景白判定：四隅チェック（堅牢な判定ロジック）
        const width = imageData.width;
        const height = imageData.height;
        
        // 四隅のエリアサイズ（画像の1%程度のサイズ、最低10px、最大20px）
        const cornerSize = Math.min(20, Math.max(10, Math.floor(Math.min(width, height) * 0.01)));
        
        // 許容値（Tolerance）：RGBすべてが245以上、またはグレースケール変換後の輝度が250以上
        const rgbThreshold = 245;
        const luminanceThreshold = 250;
        
        // 四隅の座標を定義
        const corners = [
          { x: 0, y: 0, name: "左上" }, // 左上
          { x: width - cornerSize, y: 0, name: "右上" }, // 右上
          { x: 0, y: height - cornerSize, name: "左下" }, // 左下
          { x: width - cornerSize, y: height - cornerSize, name: "右下" } // 右下
        ];
        
        let whiteCorners = 0;
        
        // 各四隅のエリアをチェック
        for (const corner of corners) {
          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          let pixelCount = 0;
          
          // エリア内の全ピクセルをサンプリング
          for (let y = corner.y; y < Math.min(corner.y + cornerSize, height); y++) {
            for (let x = corner.x; x < Math.min(corner.x + cornerSize, width); x++) {
              const index = (y * width + x) * 4;
              const r = imageData.data[index];
              const g = imageData.data[index + 1];
              const b = imageData.data[index + 2];
              
              totalR += r;
              totalG += g;
              totalB += b;
              pixelCount++;
            }
          }
          
          if (pixelCount > 0) {
            // エリアの平均RGB値を計算
            const avgR = totalR / pixelCount;
            const avgG = totalG / pixelCount;
            const avgB = totalB / pixelCount;
            
            // グレースケール変換後の輝度を計算（ITU-R BT.601標準）
            const luminance = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
            
            // 判定：RGBすべてが閾値以上、または輝度が閾値以上なら「白」とみなす
            const isWhite = (avgR >= rgbThreshold && avgG >= rgbThreshold && avgB >= rgbThreshold) || 
                           (luminance >= luminanceThreshold);
            
            if (isWhite) {
              whiteCorners++;
              console.log(`[FITPEAK] ${corner.name}角: 白 (RGB平均: ${avgR.toFixed(1)}, ${avgG.toFixed(1)}, ${avgB.toFixed(1)}, 輝度: ${luminance.toFixed(1)})`);
            } else {
              console.log(`[FITPEAK] ${corner.name}角: 非白 (RGB平均: ${avgR.toFixed(1)}, ${avgG.toFixed(1)}, ${avgB.toFixed(1)}, 輝度: ${luminance.toFixed(1)})`);
            }
          }
        }
        
        // 四隅のうち3箇所以上が白なら背景は白色と判定（影などを考慮）
        bgIsWhite = whiteCorners >= 3;
        console.log("[FITPEAK] Background white check:", bgIsWhite, `(whiteCorners: ${whiteCorners}/4, cornerSize: ${cornerSize}px)`);
        
        // 占有率：白以外ピクセル比率をステップサンプリングで計算
        const step = 5; // 5px刻みでサンプリング
        let totalPixels = 0;
        let nonWhitePixels = 0;
        
        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            totalPixels++;
            const index = (y * width + x) * 4;
            const r = imageData.data[index];
            const g = imageData.data[index + 1];
            const b = imageData.data[index + 2];
            
            // RGBが(245,245,245)未満なら白以外
            if (r < 245 || g < 245 || b < 245) {
              nonWhitePixels++;
            }
          }
        }
        
        fillRatio = totalPixels > 0 ? nonWhitePixels / totalPixels : undefined;
        console.log("[FITPEAK] Fill ratio:", fillRatio, "(nonWhitePixels:", nonWhitePixels, "/", totalPixels, ")");
      } else {
        console.warn("[FITPEAK] Failed to get canvas context");
      }
    } catch (e) {
      // canvas解析が失敗（CORSエラー等）でもmainImageDimensionsは維持
      console.warn("[FITPEAK] Failed to analyze image with canvas:", e);
      // bgIsWhiteとfillRatioはundefinedのまま（missing扱い）
    }
  } else {
    console.warn("[FITPEAK] Image not loaded for canvas analysis");
  }
  
  return {
    url: mainImageData.url,
    width: mainImageData.width,
    height: mainImageData.height,
    ...(bgIsWhite !== undefined && { bgIsWhite }),
    ...(fillRatio !== undefined && { fillRatio })
  } as { url: string; width: number; height: number; bgIsWhite?: boolean; fillRatio?: number };
}

// Amazon画像URLかどうかを判定（sprite等を除外）
function isAmazonImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  // Amazonの画像URLパターン（sprite等を除外）
  const amazonImagePatterns = [
    /images-amazon\.com/,
    /images\.amazon\./,
    /\.amazon\./,
    /_AC_/,
    /\.jpg/,
    /\.png/
  ];
  // sprite等の除外パターン
  const excludePatterns = [
    /sprite/,
    /icon/,
    /\.gif$/,
    /placeholder/
  ];
  
  // 除外パターンに一致する場合はfalse
  for (const pattern of excludePatterns) {
    if (pattern.test(url)) return false;
  }
  
  // Amazon画像パターンに一致する場合はtrue
  for (const pattern of amazonImagePatterns) {
    if (pattern.test(url)) return true;
  }
  
  return false;
}

// サブ画像のURLを抽出（安定化版：必ず配列を返す）
async function extractSubImages(): Promise<Array<{ url: string; width?: number; height?: number }>> {
  const subImageUrls = new Set<string>();
  
  // メイン画像のURLを取得（除外用）
  const mainImageEl = document.querySelector("#landingImage, #imgBlkFront") as HTMLImageElement;
  let mainImageUrl: string | null = null;
  if (mainImageEl) {
    const mainImageData = getLargestImageFromImgElement(mainImageEl);
    if (mainImageData) {
      mainImageUrl = mainImageData.url;
    }
  }
  
  // A) ギャラリーのメインimgからdata-a-dynamic-imageを取得（最優先）
  const mainImageSelectors = [
    "img#landingImage",
    "#imgTagWrapperId img",
    "img[data-a-dynamic-image]",
    "#landingImage",
    "#imgBlkFront"
  ];
  
  for (const selector of mainImageSelectors) {
    const imgEl = document.querySelector(selector) as HTMLImageElement;
    if (imgEl && imgEl.hasAttribute("data-a-dynamic-image")) {
      const dynamicImageAttr = imgEl.getAttribute("data-a-dynamic-image");
      if (dynamicImageAttr) {
        try {
          const imageMap = JSON.parse(dynamicImageAttr);
          for (const url of Object.keys(imageMap)) {
            if (url && typeof url === 'string') {
              const highResUrl = url.replace(/_[A-Z0-9_]+\.jpg/, "_AC_SL1500_.jpg");
              if (isAmazonImageUrl(highResUrl) && highResUrl !== mainImageUrl) {
                subImageUrls.add(highResUrl);
              }
            }
          }
        } catch (e) {
          console.warn("[FITPEAK] Failed to parse data-a-dynamic-image from main image:", e);
        }
      }
    }
  }
  
  // B) サムネ一覧からも拾う（フォールバック/補強）
  const thumbnailSelectors = [
    "#altImages img",
    "#altImages ul li img",
    "#imageBlock_feature_div ul li img",
    ".a-carousel-card img"
  ];
  
  for (const selector of thumbnailSelectors) {
    const thumbnailImages = document.querySelectorAll(selector);
    for (const imgEl of Array.from(thumbnailImages)) {
      const img = imgEl as HTMLImageElement;
      
      // data-a-dynamic-imageから取得
      if (img.hasAttribute("data-a-dynamic-image")) {
        const dynamicImageAttr = img.getAttribute("data-a-dynamic-image");
        if (dynamicImageAttr) {
          try {
            const imageMap = JSON.parse(dynamicImageAttr);
            for (const url of Object.keys(imageMap)) {
              if (url && typeof url === 'string') {
                const highResUrl = url.replace(/_[A-Z0-9_]+\.jpg/, "_AC_SL1500_.jpg");
                if (isAmazonImageUrl(highResUrl) && highResUrl !== mainImageUrl) {
                  subImageUrls.add(highResUrl);
                }
              }
            }
          } catch (e) {
            console.warn("[FITPEAK] Failed to parse data-a-dynamic-image from thumbnail:", e);
          }
        }
      }
      
      // img.src/currentSrcから取得（フォールバック）
      const fallbackUrl = img.currentSrc || img.src;
      if (fallbackUrl && typeof fallbackUrl === 'string' && isAmazonImageUrl(fallbackUrl)) {
        const highResUrl = fallbackUrl.replace(/_[A-Z0-9_]+\.jpg/, "_AC_SL1500_.jpg");
        if (highResUrl !== mainImageUrl) {
          subImageUrls.add(highResUrl);
        }
      }
    }
  }
  
  // C) setから配列subsを作る（必ず配列を返す）
  const subs: Array<{ url: string; width?: number; height?: number }> = [];
  const urlArray = Array.from(subImageUrls).slice(0, 12); // 上限12枚
  
  // dimensionsは後から取得（非同期で並列処理）
  const dimensionPromises = urlArray.map(async (url) => {
    let dimensions: { width: number; height: number } | null = null;
    
    // data-a-dynamic-imageから取得を試みる
    const allDynamicImages = document.querySelectorAll("[data-a-dynamic-image]");
    for (const el of Array.from(allDynamicImages)) {
      const dynamicImageAttr = el.getAttribute("data-a-dynamic-image");
      if (dynamicImageAttr) {
        try {
          const imageMap = JSON.parse(dynamicImageAttr);
          const sizes = imageMap[url];
          if (sizes && Array.isArray(sizes) && sizes.length >= 2) {
            dimensions = { width: sizes[0] as number, height: sizes[1] as number };
            break;
          }
        } catch (e) {
          // パースエラーは無視
        }
      }
    }
    
    // data-a-dynamic-imageから取得できなかった場合はImage()で取得
    if (!dimensions) {
      dimensions = await getImageDimensions(url);
    }
    
    return { url, ...(dimensions && { width: dimensions.width, height: dimensions.height }) };
  });
  
  const subsWithDimensions = await Promise.all(dimensionPromises);
  subs.push(...subsWithDimensions);
  
  // デバッグログ（常に出力）
  console.log("[FITPEAK][SUBS]", subs.length, subs.slice(0, 3).map(s => s.url));
  
  // 必ず配列を返す（空配列でもOK）
  return subs;
}

// サブ画像に動画が追加されているか判定
function extractSubImageHasVideo(): boolean {
  // 動画サムネ/再生ボタン要素の存在を判定
  const videoSelectors = [
    "[data-video-id]",
    ".video-thumbnail",
    ".video-play-button",
    "[aria-label*='video' i]",
    "[aria-label*='動画' i]",
    "[aria-label*='Video' i]",
    ".a-button-play",
    ".a-button-video",
    "[data-action='video']",
    ".a-carousel-card video",
    "#altImages [data-video-id]",
    "#altImages .video-thumbnail",
    "#altImages .a-button-play",
    "#altImages video", // video要素を直接検索
    "#imageBlock_feature_div video",
    "#imageBlock video",
    ".imageBlock video",
    "#altImages .a-carousel-card video",
    "#altImages li video", // サブ画像リスト内のvideo要素
    "#altImages ul li video",
    "[data-video-id] video", // data-video-id属性を持つ要素内のvideo要素
    ".iv-video-thumbnail", // Amazonの動画サムネイルクラス
    ".iv-video-play-button", // Amazonの動画再生ボタンクラス
    "[data-action='iv-video']", // Amazonの動画アクション
    "#iv-video-thumbnail",
    "#iv-video-play-button"
  ];
  
  for (const selector of videoSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log("[FITPEAK] Video found via selector:", selector);
      return true;
    }
  }
  
  // より広範囲な検索：altImagesコンテナ内のすべての要素を確認
  const altImagesContainer = document.querySelector("#altImages, #imageBlock_feature_div, #imageBlock, .imageBlock");
  if (altImagesContainer) {
    // video要素を直接検索
    const videoElements = altImagesContainer.querySelectorAll("video");
    if (videoElements.length > 0) {
      console.log("[FITPEAK] Video elements found in altImages container:", videoElements.length);
      return true;
    }
    
    // 動画関連の属性を持つ要素を検索
    const videoAttrElements = altImagesContainer.querySelectorAll("[data-video-id], [data-action*='video' i], [aria-label*='video' i], [aria-label*='動画' i]");
    if (videoAttrElements.length > 0) {
      console.log("[FITPEAK] Video attribute elements found:", videoAttrElements.length);
      return true;
    }
    
    // テキスト検索（"動画"、"Video"など）
    const galleryText = altImagesContainer.textContent || "";
    const videoKeywords = ["動画", "Video", "video", "再生", "Play", "プレイ"];
    for (const keyword of videoKeywords) {
      if (galleryText.includes(keyword)) {
        // キーワード周辺の要素を確認
        const walker = document.createTreeWalker(
          altImagesContainer,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node.textContent && node.textContent.includes(keyword)) {
            const parent = node.parentElement;
            if (parent && (
              parent.tagName === "BUTTON" || 
              parent.tagName === "VIDEO" ||
              parent.getAttribute("role") === "button" ||
              parent.classList.contains("video") ||
              parent.classList.contains("play") ||
              parent.querySelector("video") !== null
            )) {
              console.log("[FITPEAK] Video found via text search with video-related parent:", keyword);
              return true;
            }
          }
        }
      }
    }
  }
  
  // 追加検索：ページ全体でvideo要素を検索（altImagesコンテナ外も含む）
  // ただし、商品画像エリアに限定
  const productImageArea = document.querySelector("#imageBlock_feature_div, #imageBlock, #leftCol, #centerCol");
  if (productImageArea) {
    const videoInProductArea = productImageArea.querySelectorAll("video");
    if (videoInProductArea.length > 0) {
      console.log("[FITPEAK] Video found in product image area:", videoInProductArea.length);
      return true;
    }
  }
  
  console.log("[FITPEAK] No video detected in sub images");
  return false;
}

// 画像URL抽出関数（メイン＋サブ）- 後方互換性のため残す
function extractImageUrls(): string[] {
  const imageUrls: string[] = [];
  
  // メイン画像（#landingImage または #imgBlkFront）
  const mainImage = document.querySelector("#landingImage, #imgBlkFront") as HTMLImageElement;
  if (mainImage?.src && typeof mainImage.src === 'string') {
    const highResUrl = mainImage.src.replace(/_[A-Z0-9_]+\.jpg/, "_AC_SL1500_.jpg");
    imageUrls.push(highResUrl);
  }
  
  // data-a-dynamic-image属性から画像URLを抽出
  const dynamicImageElements = document.querySelectorAll("[data-a-dynamic-image]");
  dynamicImageElements.forEach((el) => {
    const dynamicImageAttr = el.getAttribute("data-a-dynamic-image");
    if (dynamicImageAttr) {
      try {
        const imageMap = JSON.parse(dynamicImageAttr);
        Object.keys(imageMap).forEach((url) => {
          if (url && typeof url === 'string') {
            const highResUrl = url.replace(/_[A-Z0-9_]+\.jpg/, "_AC_SL1500_.jpg");
            if (!imageUrls.includes(highResUrl)) {
              imageUrls.push(highResUrl);
            }
          }
        });
      } catch (e) {
        console.warn("[FITPEAK] Failed to parse data-a-dynamic-image:", e);
      }
    }
  });
  
  // サムネイル画像（#altImages ul li img）
  const altImages = document.querySelectorAll("#altImages ul li img");
  altImages.forEach((img) => {
    const imgEl = img as HTMLImageElement;
    if (imgEl.src && typeof imgEl.src === 'string') {
      const highResUrl = imgEl.src.replace(/_[A-Z0-9_]+\.jpg/, "_AC_SL1500_.jpg");
      if (!imageUrls.includes(highResUrl)) {
        imageUrls.push(highResUrl);
      }
    }
  });
  
  return imageUrls;
}

// A+コンテンツの存在判定とモジュール数・Premium判定
function extractAplusInfo(): { hasAPlus: boolean; moduleCount?: number; isPremium?: boolean } {
  // A+セクションの一般的なセレクタ
  const aplusSelectors = [
    "#aplus_feature_div",
    "#aplus",
    "[data-aplus-module]",
    ".aplus-module",
    "#productDescription_feature_div .aplus"
  ];
  
  let aplusElement: Element | null = null;
  for (const selector of aplusSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim().length > 0) {
      aplusElement = element;
      break;
    }
  }
  
  if (!aplusElement) {
    return { hasAPlus: false };
  }
  
  // モジュール数を推定（主要なモジュール要素をカウント）
  const moduleSelectors = [
    ".aplus-module",
    "[data-aplus-module]",
    ".aplus-module-wrapper",
    ".aplus-module-content",
    "#aplus_feature_div > div",
    "#aplus > div"
  ];
  
  let moduleCount = 0;
  for (const selector of moduleSelectors) {
    const modules = aplusElement.querySelectorAll(selector);
    if (modules.length > 0) {
      moduleCount = Math.max(moduleCount, modules.length);
    }
  }
  
  // より詳細なモジュールカウント（テキストブロック、画像、比較表など）
  const detailedModules = aplusElement.querySelectorAll(
    ".aplus-module-text, .aplus-module-image, .aplus-module-comparison, " +
    ".aplus-module-video, .aplus-module-carousel, .aplus-module-standard"
  );
  if (detailedModules.length > 0) {
    moduleCount = Math.max(moduleCount, detailedModules.length);
  }
  
  // Premium A+の判定（動画、カルーセル、インタラクティブ要素の存在）
  let isPremium: boolean | undefined = undefined;
  const premiumIndicators = [
    // 動画関連
    ".aplus-module-video",
    ".aplus-video-player",
    "[data-aplus-module-type='video']",
    "[data-module-type='video']",
    "video.aplus-video",
    ".aplus-video-container",
    // カルーセル関連
    ".aplus-module-carousel",
    ".aplus-carousel",
    "[data-aplus-module-type='carousel']",
    "[data-module-type='carousel']",
    ".aplus-carousel-container",
    // インタラクティブ要素
    ".aplus-interactive",
    "[data-aplus-interactive]",
    ".aplus-module-interactive",
    // Premium専用モジュール
    ".aplus-module-13",
    ".aplus-module-14",
    "[data-module-id='13']",
    "[data-module-id='14']",
    // その他のPremium要素
    ".aplus-premium",
    "[data-aplus-premium]",
    ".aplus-enhanced",
    // 動画プレイヤーのaria-labelやテキスト
    "[aria-label*='video' i]",
    "[aria-label*='動画' i]"
  ];
  
  // セレクタで検索
  for (const selector of premiumIndicators) {
    if (aplusElement.querySelector(selector)) {
      console.log("[FITPEAK] Premium A+ indicator found:", selector);
      isPremium = true;
      break;
    }
  }
  
  // セレクタで見つからない場合、テキスト検索で確認
  if (isPremium === undefined) {
    const aplusText = aplusElement.textContent || "";
    const premiumKeywords = [
      "video",
      "動画",
      "carousel",
      "カルーセル",
      "premium",
      "プレミアム",
      "enhanced",
      "インタラクティブ"
    ];
    
    // 動画やカルーセル関連のキーワードが含まれているか確認
    for (const keyword of premiumKeywords) {
      if (aplusText.toLowerCase().includes(keyword.toLowerCase())) {
        // キーワード周辺の要素を確認（誤検出を避ける）
        const walker = document.createTreeWalker(
          aplusElement,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node.textContent && node.textContent.toLowerCase().includes(keyword.toLowerCase())) {
            const parent = node.parentElement;
            // 動画やカルーセル関連の要素かどうかを確認
            if (parent && (
              parent.tagName === "VIDEO" ||
              parent.classList.contains("video") ||
              parent.classList.contains("carousel") ||
              parent.getAttribute("data-module-type") === "video" ||
              parent.getAttribute("data-module-type") === "carousel"
            )) {
              console.log("[FITPEAK] Premium A+ indicator found via text search:", keyword);
              isPremium = true;
              break;
            }
          }
        }
        
        if (isPremium === true) {
          break;
        }
      }
    }
  }
  
  // Premium要素が見つからない場合はfalseを設定（通常のA+と判定）
  // これにより、aplusIsPremiumがundefinedではなくfalseになり、missingSignalsに追加されない
  if (isPremium === undefined) {
    isPremium = false;
    console.log("[FITPEAK] Premium A+ not detected, assuming standard A+");
  }
  
  return {
    hasAPlus: true,
    ...(moduleCount > 0 && { moduleCount }),
    isPremium // undefinedではなく必ずbooleanを返す
  };
}

// A+コンテンツの存在判定（後方互換性のため残す）
function hasAplus(): boolean {
  return extractAplusInfo().hasAPlus;
}

// レビュー情報抽出
function extractReviewInfo(): { reviewCount: number | null; rating: number | null } {
  let reviewCount: number | null = null;
  let rating: number | null = null;
  
  // レビュー件数（#acrCustomerReviewText や #acrCustomerReviewLink）
  const reviewTextEl = document.querySelector("#acrCustomerReviewText, #acrCustomerReviewLink");
  if (reviewTextEl) {
    const text = reviewTextEl.textContent || "";
    const match = text.match(/([\d,]+)/);
    if (match) {
      reviewCount = parseInt(match[1].replace(/,/g, ""), 10);
    }
  }
  
  // 評価（#acrPopover や .a-icon-alt）
  const ratingEl = document.querySelector("#acrPopover .a-icon-alt, .a-icon-alt");
  if (ratingEl) {
    const text = ratingEl.getAttribute("title") || ratingEl.textContent || "";
    const match = text.match(/([\d.]+)/);
    if (match) {
      rating = parseFloat(match[1]);
    }
  }
  
  return { reviewCount, rating };
}

// ブランドコンテンツの存在判定
function extractBrandContent(): { hasBrandStory?: boolean } {
  // 優先セレクタ
  const prioritySelectors = [
    "#aplusBrandStory_feature_div",
    "#brandstory_feature_div",
    "[data-feature-name*='brand' i]",
    "[id*='brandstory' i]",
    "#brand-story",
    ".aplus-brand-story-card",
    "#brandStory_feature_div",
    "[data-brand-story]",
    ".brand-story",
    ".brand-content",
    "#productDescription_feature_div [data-brand]"
  ];
  
  // セレクタで検索
  for (const selector of prioritySelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim().length > 0) {
      console.log("[FITPEAK] Brand content found via selector:", selector);
      return { hasBrandStory: true };
    }
  }
  
  // フォールバック: 特定コンテナ内の見出しテキストに「ブランドストーリー」「Brand Story」が含まれるかで判定
  const brandKeywords = ["ブランドストーリー", "Brand Story", "brand story", "ブランドコンテンツ", "Brand Content"];
  
  // A+コンテンツ領域内を優先的に検索
  const aplusContainers = [
    "#aplus_feature_div",
    "#aplus",
    "[data-feature-name='aplus']",
    ".aplus-module"
  ];
  
  for (const containerSelector of aplusContainers) {
    const container = document.querySelector(containerSelector);
    if (container) {
      // 見出し要素（h1, h2, h3, h4, h5, h6）を検索
      const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6, [class*='heading'], [class*='title']");
      for (const heading of Array.from(headings)) {
        const headingText = heading.textContent || "";
        for (const keyword of brandKeywords) {
          if (headingText.includes(keyword)) {
            console.log("[FITPEAK] Brand content found via heading text:", keyword, "in", containerSelector);
            return { hasBrandStory: true };
          }
        }
      }
    }
  }
  
  // 最後のフォールバック: ページ全体のテキストで検索（ただし、より限定的に）
  const bodyText = document.body.textContent || "";
  for (const keyword of brandKeywords) {
    if (bodyText.includes(keyword)) {
      // キーワード周辺のコンテキストを確認（誤検出を避ける）
      const keywordIndex = bodyText.indexOf(keyword);
      const contextStart = Math.max(0, keywordIndex - 50);
      const contextEnd = Math.min(bodyText.length, keywordIndex + keyword.length + 50);
      const context = bodyText.substring(contextStart, contextEnd);
      
      // ブランドストーリー関連の文脈かどうかを簡易判定
      if (context.match(/ブランド|brand|story|ストーリー/i)) {
        console.log("[FITPEAK] Brand content found via body text:", keyword);
        return { hasBrandStory: true };
      }
    }
  }
  
  return {}; // 見つからない場合はundefinedのまま
}

// ページスナップショットを取得してbackgroundに送信
async function sendPageSnapshot() {
  const asin = extractASIN();
  const bullets = extractBullets();
  const imageUrls = extractImageUrls(); // 後方互換性のため
  const mainImage = await extractMainImage();
  const subImages = await extractSubImages();
  const subImageHasVideo = extractSubImageHasVideo();
  const aplusInfo = extractAplusInfo();
  const brandInfo = extractBrandContent();
  const { reviewCount, rating } = extractReviewInfo();
  
  console.log("[FITPEAK] sendPageSnapshot called, ASIN:", asin, "URL:", location.href);
  console.log("[FITPEAK] Extracted data:", {
    bullets: bullets.length,
    imageUrls: imageUrls.length,
    mainImage: mainImage ? {
      found: true,
      url: mainImage.url,
      width: mainImage.width,
      height: mainImage.height,
      bgIsWhite: mainImage.bgIsWhite,
      fillRatio: mainImage.fillRatio
    } : "not found",
    subImages: subImages.length,
    subImagesWithDimensions: subImages.filter(s => s.width && s.height).length,
    subImageHasVideo,
    aplusInfo,
    brandInfo,
    reviewCount,
    rating
  });
  
  // 詳細ログ：mainImageの内容を確認
  if (mainImage) {
    console.log("[FITPEAK] MainImage details:", JSON.stringify(mainImage, null, 2));
  } else {
    console.warn("[FITPEAK] MainImage is null - this will cause mainImageDimensions missing");
  }
  
  // 詳細ログ：subImagesの内容を確認
  if (subImages.length > 0) {
    console.log("[FITPEAK] SubImages details (first 3):", subImages.slice(0, 3).map(s => ({
      url: s.url,
      width: s.width,
      height: s.height
    })));
  } else {
    console.warn("[FITPEAK] SubImages is empty - this will cause subImageDimensions missing");
  }
  
  // ASINの有無に関わらず、必ずbackgroundに送信
  chrome.runtime.sendMessage({
    type: "PAGE_SNAPSHOT",
    asin: asin || null,
    url: location.href,
    title: document.title || "",
    bullets,
    imageUrls, // 後方互換性のため
    mainImage,
    subImages,
    subImageHasVideo,
    aplus: aplusInfo,
    brand: brandInfo,
    hasAplus: aplusInfo.hasAPlus, // 後方互換性のため
    reviewCount,
    rating
  })
    .then(() => {
      if (asin) {
        console.log("[FITPEAK] PAGE_SNAPSHOT sent successfully, ASIN:", asin);
      } else {
        console.log("[FITPEAK] PAGE_SNAPSHOT sent (no ASIN)");
      }
    })
    .catch((err) => {
      console.error("[FITPEAK] Failed to send page snapshot:", err);
    });
}

// ページ読み込み時にスナップショットを送信
// document_startで実行されるため、DOMContentLoadedを待つ
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", sendPageSnapshot);
} else {
  // 既に読み込み済みの場合は即座に実行
  sendPageSnapshot();
}

// URL変更を監視（SPA対応）
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    sendPageSnapshot();
  }
}).observe(document, { subtree: true, childList: true });

// Score用signalsを収集（安全版：例外で落ちない）
async function collectScoreSignalsSafe(): Promise<{
  asin: string | null;
  url: string;
  images: {
    main?: { url?: string; width?: number; height?: number; bgIsWhite?: boolean; fillRatio?: number };
    subs?: Array<{ url: string; width?: number; height?: number }>;
    hasVideo?: boolean;
  };
  bullets?: string[];
  reviews?: { rating?: number; count?: number };
  aplus?: { hasAplus?: boolean; isPremium?: boolean; moduleCount?: number };
  brandContent?: boolean;
}> {
  // asinとurlは必ず返す（最低限）
  let asin: string | null = null;
  try {
    asin = extractASIN();
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractASIN failed:", e);
  }
  
  const url = location.href;
  
  // タイトルを抽出
  let title: string | null = null;
  try {
    // Amazon商品ページのタイトルを抽出
    const titleSelectors = [
      "#productTitle",
      "h1#productTitle",
      "#title_feature_div h1",
      "#title_feature_div span",
      "#title span",
      "h1.a-size-large",
      ".product-title",
    ];
    for (const selector of titleSelectors) {
      const titleEl = document.querySelector(selector);
      if (titleEl && titleEl.textContent) {
        title = titleEl.textContent.trim();
        console.log("[FITPEAK][SIG] Title extracted via selector:", selector, title);
        break;
      }
    }
    // フォールバック: document.titleから抽出（Amazon - 商品名 の形式）
    if (!title) {
      const docTitle = document.title || "";
      if (docTitle.includes("Amazon")) {
        const match = docTitle.match(/Amazon[^:]*:\s*(.+)/);
        if (match && match[1]) {
          title = match[1].trim();
          console.log("[FITPEAK][SIG] Title extracted from document.title:", title);
        }
      }
    }
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractTitle failed:", e);
  }
  
  // 各抽出をtry/catchで囲む
  let bullets: string[] = [];
  try {
    bullets = extractBullets();
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractBullets failed:", e);
  }
  
  let mainImage: any = null;
  try {
    mainImage = await extractMainImage();
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractMainImage failed:", e);
  }
  
  let subImages: Array<{ url: string; width?: number; height?: number }> = [];
  try {
    subImages = await extractSubImages();
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractSubImages failed:", e);
  }
  
  let subImageHasVideo = false;
  try {
    subImageHasVideo = extractSubImageHasVideo();
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractSubImageHasVideo failed:", e);
  }
  
  let aplusInfo: any = { hasAPlus: false };
  try {
    aplusInfo = extractAplusInfo();
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractAplusInfo failed:", e);
  }
  
  let brandInfo: any = {};
  try {
    brandInfo = extractBrandContent();
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractBrandContent failed:", e);
  }
  
  let reviewCount: number | null = null;
  let rating: number | null = null;
  try {
    const reviewInfo = extractReviewInfo();
    reviewCount = reviewInfo.reviewCount;
    rating = reviewInfo.rating;
  } catch (e) {
    console.warn("[FITPEAK][SIG] extractReviewInfo failed:", e);
  }
  
  const signals = {
    asin: asin || null,
    url: url,
    ...(title && { title }), // タイトルを追加
    images: {
      ...(mainImage && {
        main: {
          url: mainImage.url,
          ...(mainImage.width && { width: mainImage.width }),
          ...(mainImage.height && { height: mainImage.height }),
          ...(mainImage.bgIsWhite !== undefined && { bgIsWhite: mainImage.bgIsWhite }),
          ...(mainImage.fillRatio !== undefined && { fillRatio: mainImage.fillRatio }),
        }
      }),
      ...(subImages.length > 0 && { subs: subImages }),
      // hasVideoは必ず含める（falseでも明示的に送信）
      hasVideo: subImageHasVideo,
    },
    ...(bullets.length > 0 && { bullets }),
    reviews: {
      ...(rating !== null && rating !== undefined && { rating }),
      ...(reviewCount !== null && reviewCount !== undefined && { count: reviewCount }),
    },
    ...(aplusInfo.hasAPlus && {
      aplus: {
        hasAplus: aplusInfo.hasAPlus,
        ...(aplusInfo.isPremium !== undefined && { isPremium: aplusInfo.isPremium }),
        ...(aplusInfo.moduleCount !== undefined && { moduleCount: aplusInfo.moduleCount }),
      }
    }),
    ...(brandInfo.hasBrandStory && { brandContent: brandInfo.hasBrandStory }),
  };
  
  // デバッグログ
  console.log("[FITPEAK][SIG]", {
    title: signals.title || "not found",
    hasMain: !!signals.images.main,
    subs: signals.images.subs?.length ?? 0,
    hasVideo: signals.images.hasVideo,
    bullets: signals.bullets?.length ?? 0,
    rating: signals.reviews?.rating,
    count: signals.reviews?.count,
    aplus: signals.aplus?.hasAplus,
    modules: signals.aplus?.moduleCount,
    brand: signals.brandContent,
  });
  
  return signals;
}

// Score用signalsを収集（後方互換性のため残す）
async function collectScoreSignals(): Promise<{
  asin: string | null;
  url: string;
  images: {
    main?: { url?: string; width?: number; height?: number; bgIsWhite?: boolean; fillRatio?: number };
    subs?: Array<{ url: string; width?: number; height?: number }>;
    hasVideo?: boolean;
  };
  bullets?: string[];
  reviews?: { rating?: number; count?: number };
  aplus?: { hasAplus?: boolean; isPremium?: boolean; moduleCount?: number };
  brandContent?: boolean;
}> {
  return collectScoreSignalsSafe();
}

// window.postMessageでUIから送信されたメッセージを受信（UIはcontentScript内で実行されているため）
window.addEventListener("message", async (event: MessageEvent) => {
  // セキュリティ: 同じオリジンからのメッセージのみ処理
  if (event.source !== window) return;
  
  if (event.data && event.data.type === "PING_CS") {
    console.log("[FITPEAK][CS] PING_CS received via window.postMessage");
    // UIに応答を返す
    window.postMessage({ type: "PING_CS_RESPONSE", ok: true, from: "cs" }, "*");
  }
  
  if (event.data && event.data.type === "GET_SCORE_SIGNALS") {
    console.log("[FITPEAK][CS] GET_SCORE_SIGNALS received via window.postMessage");
    try {
      const signals = await collectScoreSignalsSafe();
      console.log("[FITPEAK][CS] GET_SCORE_SIGNALS ok", {
        asin: signals.asin,
        subs: signals.images?.subs?.length ?? 0,
        bullets: signals.bullets?.length ?? 0,
      });
      window.postMessage({ 
        type: "GET_SCORE_SIGNALS_RESPONSE", 
        ok: true, 
        signals 
      }, "*");
    } catch (e) {
      console.error("[FITPEAK][CS] GET_SCORE_SIGNALS failed", e);
      window.postMessage({
        type: "GET_SCORE_SIGNALS_RESPONSE",
        ok: false,
        error: { message: String(e), stack: (e as any)?.stack ?? "" },
      }, "*");
    }
  }
});

// popupからの要求に応答（すべてのメッセージタイプを1つのリスナーで処理）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[FITPEAK][contentScript] Message received:", message?.type);
  
  // PING_CS: chrome.runtime.sendMessage経由でも受信可能（background経由の場合）
  if (message?.type === "PING_CS") {
    console.log("[FITPEAK][CS] PING_CS received via chrome.runtime.sendMessage");
    sendResponse({ ok: true, from: "cs" });
    return false; // 同期応答
  }
  
  // GET_SCORE_SIGNALS: Score用signalsを収集（非同期応答）
  if (message?.type === "GET_SCORE_SIGNALS") {
    console.log("[FITPEAK][CS] GET_SCORE_SIGNALS received");
    (async () => {
      try {
        const signals = await collectScoreSignalsSafe();
        console.log("[FITPEAK][CS] GET_SCORE_SIGNALS ok", {
          asin: signals.asin,
          subs: signals.images?.subs?.length ?? 0,
          bullets: signals.bullets?.length ?? 0,
        });
        sendResponse({ ok: true, signals });
      } catch (e) {
        console.error("[FITPEAK][CS] GET_SCORE_SIGNALS failed", e);
        sendResponse({
          ok: false,
          error: { message: String(e), stack: (e as any)?.stack ?? "" },
        });
      }
    })();
    return true; // ★これがないとport closedになる
  }
  
  // extractData: 同期応答
  if (message?.type === "extractData") {
    const asin = extractASIN();
    const data = {
      asin: asin || "",
      images: [],
      description: "",
      reviews: {}
    };
    sendResponse({ ok: true, data });
    return false; // 同期応答
  }
  
  // GET_SNAPSHOT: 非同期応答
  if (message?.type === "GET_SNAPSHOT") {
    (async () => {
      try {
        const asin = extractASIN();
        const bullets = extractBullets();
        const imageUrls = extractImageUrls(); // 後方互換性のため
        const mainImage = await extractMainImage();
        const subImages = await extractSubImages();
        const subImageHasVideo = extractSubImageHasVideo();
        const aplusInfo = extractAplusInfo();
        const brandInfo = extractBrandContent();
        const { reviewCount, rating } = extractReviewInfo();
        
        const snapshot = {
          asin,
          url: location.href,
          title: document.title || "",
          bullets,
          imageUrls, // 後方互換性のため
          mainImage,
          subImages,
          subImageHasVideo,
          aplus: aplusInfo,
          brand: brandInfo,
          hasAplus: aplusInfo.hasAPlus, // 後方互換性のため
          reviewCount,
          rating,
          injected: true
        };
        console.log("[FITPEAK][contentScript] Sending snapshot:", snapshot);
        sendResponse({
          ok: true,
          snapshot
        });
      } catch (error: any) {
        console.error("[FITPEAK][contentScript] GET_SNAPSHOT error:", error);
        sendResponse({ ok: false, error: { message: error.message || String(error), stack: error.stack } });
      }
    })();
    return true; // 非同期応答の可能性があるため true を返す
  }
  
  // 未対応のメッセージタイプ
  return false;
});

// ===== React UI Integration =====
console.log("[FITPEAK][UI] entry loaded");

// Amazon商品ページ（/dp/ASIN または /gp/product/ASIN）でのみUIを表示
function isAmazonProductPage(): boolean {
  const pathname = location.pathname;
  const href = location.href;
  
  // より柔軟な商品ページ判定
  // /dp/ASIN または /gp/product/ASIN を含む（後ろに/ref=などが続いてもOK）
  const isProduct = 
    /\/dp\/[A-Z0-9]{10}/i.test(pathname) || 
    /\/gp\/product\/[A-Z0-9]{10}/i.test(pathname) ||
    /\/dp\/[A-Z0-9]{10}/i.test(href) ||
    /\/gp\/product\/[A-Z0-9]{10}/i.test(href);
  
  console.log("[FITPEAK][UI] isAmazonProductPage check:", {
    pathname,
    href,
    isProduct,
    pathnameMatch: /\/dp\/[A-Z0-9]{10}/i.test(pathname) || /\/gp\/product\/[A-Z0-9]{10}/i.test(pathname),
    hrefMatch: /\/dp\/[A-Z0-9]{10}/i.test(href) || /\/gp\/product\/[A-Z0-9]{10}/i.test(href)
  });
  return isProduct;
}

// デバッグバナー機能を削除（不要になったため）
function createOrUpdateDebugBanner(message: string, isError: boolean = false) {
  // 既存のデバッグバナーを削除
  const existingBanner = document.getElementById("fitpeak-debug-banner");
  if (existingBanner) {
    existingBanner.remove();
  }
  // デバッグバナーは表示しない（削除済み）
  // 必要に応じてconsole.logでログ出力
  if (isError) {
    console.error("[FITPEAK][DEBUG]", message);
  } else {
    console.log("[FITPEAK][DEBUG]", message);
  }
}

// パンくず要素を探す（複数のセレクタでフォールバック）
function findBreadcrumbAnchor(): HTMLElement | null {
  const selectors = [
    "#wayfinding-breadcrumbs_feature_div",
    "#wayfinding-breadcrumbs_container",
    'nav[aria-label="Breadcrumb"]',
    ".a-breadcrumb",
    "#wayfinding-breadcrumbs_feature_div .a-breadcrumb",
    'div[data-feature-name*="wayfinding"]',
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element) {
      console.log(`[FITPEAK][ANCHOR] found: ${selector}`);
      return element;
    }
  }
  
  console.log("[FITPEAK][ANCHOR] breadcrumb not found, trying fallback containers");
  
  // フォールバック: 商品ページのメインコンテナを探す
  const fallbackSelectors = [
    "#dp",
    "#centerCol",
    "#main-content",
    "#productDescription_feature_div",
  ];
  
  for (const selector of fallbackSelectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element) {
      console.log(`[FITPEAK][ANCHOR] fallback found: ${selector}`);
      return element;
    }
  }
  
  console.log("[FITPEAK][ANCHOR] no anchor found, will use body");
  return null;
}

// Score UIをmount（パンくずの上にDOM挿入）
async function mountScoreUI() {
  console.log("[FITPEAK][UI] mount started");
  
  try {
    // デバッグバナーを表示
    createOrUpdateDebugBanner("MOUNT STARTED", false);
    
    // 商品ページでない場合はスキップ
    if (!isAmazonProductPage()) {
      console.log("[FITPEAK][UI] Not a product page, skipping UI mount");
      createOrUpdateDebugBanner("NOT PRODUCT PAGE", true);
      return;
    }
    console.log("[FITPEAK][UI] Confirmed product page, proceeding with mount");

    // 既にマウント済みの場合はスキップ
    const existingRoot = document.getElementById("fitpeak-score-root-host");
    if (existingRoot) {
      console.log("[FITPEAK][UI] UI already mounted (existing root found)");
      createOrUpdateDebugBanner("ALREADY MOUNTED", false);
      return;
    }
    console.log("[FITPEAK][UI] No existing UI found, creating new mount");

    // document.bodyの存在確認
    if (!document.body) {
      throw new Error("document.body is not available");
    }
    console.log("[FITPEAK][UI] document.body confirmed");

    // React/ReactDOMは静的インポート済み（ファイル先頭でインポート）
    console.log("[FITPEAK][UI] React modules already loaded (static import)");

    // パンくず要素を探す
    const anchorEl = findBreadcrumbAnchor();
    
    // React mount用のホスト要素を作成（通常のDOM要素として）
    reactRootHost = document.createElement("div");
    reactRootHost.id = "fitpeak-score-root-host";
    reactRootHost.style.cssText = `
      width: 100% !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
    `;
    // 初期状態は表示
    isUIVisible = true;
    
    // UIコンテナを作成
    const uiContainer = document.createElement("div");
    uiContainer.id = "fitpeak-score-ui-container";
    uiContainer.style.cssText = `
      max-width: 100% !important;
      padding: 8px 0 !important;
      box-sizing: border-box !important;
    `;
    reactRootHost.appendChild(uiContainer);
    
    // 挿入位置を決定
    if (anchorEl) {
      // パンくずの直前（上）に挿入
      anchorEl.insertAdjacentElement("beforebegin", reactRootHost);
      console.log("[FITPEAK][MOUNT] inserted before breadcrumbs");
    } else {
      // フォールバック: bodyの先頭にprepend
      const mainContainer = document.querySelector("#dp, #centerCol") as HTMLElement | null;
      if (mainContainer) {
        mainContainer.prepend(reactRootHost);
        console.log("[FITPEAK][MOUNT] inserted at main container start");
      } else {
        document.body.prepend(reactRootHost);
        console.log("[FITPEAK][MOUNT] inserted at body start (fallback)");
      }
    }
    
    console.log("[FITPEAK][UI] React root host and UI container created and inserted");

    // Reactをmount（uiContainerにマウント）
    // 黒色テーマを適用するため、darkクラスを追加
    uiContainer.classList.add("dark");
    console.log("[FITPEAK][UI] Creating React root...");
    const root = createRoot(uiContainer);
    console.log("[FITPEAK][UI] Rendering ScoreExtensionUI...");
    root.render(React.createElement(ScoreExtensionUI));
    console.log("[FITPEAK][UI] mount ok");
    
    // 成功バナー
    createOrUpdateDebugBanner("MOUNT OK", false);
    
    // reactRootHost変数を確実に設定
    const verifyRoot = document.getElementById("fitpeak-score-root-host");
    if (verifyRoot && verifyRoot === reactRootHost) {
      console.log("[FITPEAK][UI] reactRootHost verified in DOM");
    } else {
      console.warn("[FITPEAK][UI] reactRootHost mismatch, updating...");
      reactRootHost = verifyRoot as HTMLElement | null;
    }
    
    // 確実に表示状態にする
    if (reactRootHost) {
      reactRootHost.style.setProperty("display", "block", "important");
      isUIVisible = true;
      console.log("[FITPEAK][UI] UI set to visible state");
      // バッジのテキストも更新
      setTimeout(updateBadgeText, 200);
    }
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || "";
    console.error("[FITPEAK][UI] mount error:", errorMessage);
    console.error("[FITPEAK][UI] error stack:", errorStack);
    
    // エラーバナー
    createOrUpdateDebugBanner(`MOUNT ERROR: ${errorMessage}`, true);
  }
}

// パンくず要素の出現を監視してUIを挿入（SPA/遅延対策）
function watchForBreadcrumbAndMount() {
  // 既にマウント済みの場合はスキップ
  if (document.getElementById("fitpeak-score-root-host")) {
    console.log("[FITPEAK][WATCH] UI already mounted, skipping watch");
    return;
  }
  
  // まず一度試す
  const anchorEl = findBreadcrumbAnchor();
  if (anchorEl) {
    mountScoreUI();
    return;
  }
  
  // 見つからない場合はMutationObserverで監視
  console.log("[FITPEAK][WATCH] Breadcrumb not found, watching for appearance...");
  const observer = new MutationObserver((mutations, obs) => {
    // 既にマウント済みの場合は監視を停止
    if (document.getElementById("fitpeak-score-root-host")) {
      obs.disconnect();
      console.log("[FITPEAK][WATCH] UI mounted, stopping observer");
      return;
    }
    
    // パンくず要素を探す
    const anchorEl = findBreadcrumbAnchor();
    if (anchorEl) {
      obs.disconnect();
      console.log("[FITPEAK][WATCH] Breadcrumb appeared, mounting UI");
      mountScoreUI();
    }
  });
  
  // body全体を監視
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // タイムアウト（10秒後に監視を停止）
  setTimeout(() => {
    observer.disconnect();
    if (!document.getElementById("fitpeak-score-root-host")) {
      console.warn("[FITPEAK][WATCH] Timeout: breadcrumb not found, mounting at fallback position");
      mountScoreUI();
    }
  }, 10000);
}

// DOMが準備できたらUIをmount
function initializeScoreUI() {
  console.log("[FITPEAK][UI] Initializing, readyState:", document.readyState);
  console.log("[FITPEAK][UI] document.body exists:", !!document.body);
  
  // document.bodyが存在するまで待つ
  const waitForBody = () => {
    if (document.body) {
      console.log("[FITPEAK][UI] document.body found, scheduling watchForBreadcrumbAndMount");
      // 少し遅延させて、AmazonのSPAが完全に読み込まれるのを待つ
      setTimeout(() => {
        console.log("[FITPEAK][UI] Calling watchForBreadcrumbAndMount");
        watchForBreadcrumbAndMount();
      }, 500); // 0.5秒待つ（AmazonのSPA読み込みを待つ）
    } else {
      console.log("[FITPEAK][UI] document.body not found yet, retrying...");
      setTimeout(waitForBody, 100);
    }
  };
  
  if (document.readyState === "loading") {
    console.log("[FITPEAK][UI] Waiting for DOMContentLoaded...");
    document.addEventListener("DOMContentLoaded", () => {
      console.log("[FITPEAK][UI] DOMContentLoaded fired");
      waitForBody();
    });
  } else {
    console.log("[FITPEAK][UI] DOM already loaded");
    waitForBody();
  }
}

// UI初期化を開始
console.log("[FITPEAK][UI] About to call initializeScoreUI()");
try {
  initializeScoreUI();
  console.log("[FITPEAK][UI] initializeScoreUI() called successfully");
} catch (error: any) {
  console.error("[FITPEAK][UI] Error calling initializeScoreUI():", error);
  try {
    createOrUpdateDebugBanner(`INIT ERROR: ${error?.message || error}`, true);
  } catch (e) {
    // バナー作成も失敗した場合は無視
  }
}

// URL変更を監視（SPA対応）してUIを再マウント
let lastProductUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastProductUrl && isAmazonProductPage()) {
    lastProductUrl = currentUrl;
    console.log("[FITPEAK][UI] URL changed, remounting UI");
    // 既存のUIを削除して再マウント
    const existing = document.getElementById("fitpeak-score-root-host");
    if (existing) {
      existing.remove();
      console.log("[FITPEAK][UI] Removed existing UI");
    }
    setTimeout(mountScoreUI, 500);
  }
}).observe(document, { subtree: true, childList: true });
