/**
 * Chrome Extension Background Service Worker
 * Handles API calls with logging and page snapshot management
 */

import { apiRequest, classifyError } from "./lib/apiClient";
import { getSettings } from "./storage";

// タブごとのスナップショットを保持
interface PageSnapshot {
  asin: string | null;
  url: string;
  title: string;
  bullets: string[];
  imageUrls: string[]; // 後方互換性のため
  mainImage?: { url: string; width: number; height: number; bgIsWhite?: boolean; fillRatio?: number } | null;
  subImages?: Array<{ url: string; width: number; height: number }>;
  subImageHasVideo?: boolean;
  aplus?: { hasAPlus: boolean; moduleCount?: number; isPremium?: boolean };
  brand?: { hasBrandStory?: boolean };
  hasAplus: boolean; // 後方互換性のため
  reviewCount: number | null;
  rating: number | null;
  timestamp: number;
}

const snapshots = new Map<number, PageSnapshot>();

// contentScriptからのPAGE_SNAPSHOTを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // PING_BG: デバッグ用（同期応答）
  if (message.type === "PING_BG") {
    console.log("[FITPEAK][BG] PING_BG received");
    sendResponse({ ok: true, from: "bg" });
    return false; // 同期応答
  }
  
  if (message.type === "PAGE_SNAPSHOT") {
    const tabId = sender.tab?.id;
    if (tabId) {
      const snapshot = {
        asin: message.asin || null,
        url: message.url || "",
        title: message.title || "",
        bullets: message.bullets || [],
        imageUrls: message.imageUrls || [], // 後方互換性のため
        mainImage: message.mainImage || null,
        subImages: message.subImages || [],
        subImageHasVideo: message.subImageHasVideo || false,
        aplus: message.aplus || { hasAPlus: false },
        brand: message.brand || {},
        hasAplus: message.hasAplus !== undefined ? message.hasAplus : (message.aplus?.hasAPlus || false), // 後方互換性のため
        reviewCount: message.reviewCount || null,
        rating: message.rating || null,
        timestamp: Date.now()
      };
      snapshots.set(tabId, snapshot);
      console.log(`[FITPEAK][background] Snapshot updated for tab ${tabId}:`, {
        asin: snapshot.asin,
        url: snapshot.url,
        title: snapshot.title,
        bullets: snapshot.bullets.length,
        imageUrls: snapshot.imageUrls.length,
        mainImage: snapshot.mainImage ? {
          url: snapshot.mainImage.url,
          width: snapshot.mainImage.width,
          height: snapshot.mainImage.height,
          bgIsWhite: snapshot.mainImage.bgIsWhite,
          fillRatio: snapshot.mainImage.fillRatio
        } : null,
        subImages: snapshot.subImages ? snapshot.subImages.length : 0,
        subImagesWithDimensions: snapshot.subImages ? snapshot.subImages.filter((s: any) => s.width && s.height).length : 0,
        hasAplus: snapshot.hasAplus,
        reviewCount: snapshot.reviewCount,
        rating: snapshot.rating
      });
    } else {
      console.warn("[FITPEAK][background] PAGE_SNAPSHOT received but tabId is missing");
    }
    return false;
  }
  
  // popupからのGET_SNAPSHOT要求
  if (message.type === "GET_SNAPSHOT") {
    const tabId = message.tabId;
    console.log(`[FITPEAK][background] GET_SNAPSHOT requested for tab ${tabId}`);
    const snapshot = snapshots.get(tabId);
    if (snapshot) {
      console.log(`[FITPEAK][background] Returning cached snapshot:`, snapshot);
      sendResponse({ ok: true, snapshot: { ...snapshot, injected: true } });
    } else {
      // snapshotがない場合はcontentScriptに直接問い合わせ
      console.log(`[FITPEAK][background] No cached snapshot, querying contentScript for tab ${tabId}`);
      chrome.tabs.sendMessage(tabId, { type: "GET_SNAPSHOT" })
        .then((response) => {
          console.log(`[FITPEAK][background] ContentScript response:`, response);
          if (response?.ok && response.snapshot) {
            const newSnapshot = {
              asin: response.snapshot.asin || null,
              url: response.snapshot.url || "",
              title: response.snapshot.title || "",
              bullets: response.snapshot.bullets || [],
              imageUrls: response.snapshot.imageUrls || [], // 後方互換性のため
              mainImage: response.snapshot.mainImage || null,
              subImages: response.snapshot.subImages || [],
              subImageHasVideo: response.snapshot.subImageHasVideo || false,
              aplus: response.snapshot.aplus || { hasAPlus: false },
              brand: response.snapshot.brand || {},
              hasAplus: response.snapshot.hasAplus !== undefined 
                ? response.snapshot.hasAplus 
                : (response.snapshot.aplus?.hasAPlus || false), // 後方互換性のため
              reviewCount: response.snapshot.reviewCount || null,
              rating: response.snapshot.rating || null,
              timestamp: Date.now()
            };
            snapshots.set(tabId, newSnapshot);
            sendResponse({ ok: true, snapshot: { ...response.snapshot, injected: true } });
          } else {
            console.warn(`[FITPEAK][background] Invalid contentScript response:`, response);
            sendResponse({ 
              ok: true, 
              snapshot: { 
                asin: null, 
                url: "", 
                title: "", 
                bullets: [],
                imageUrls: [], // 後方互換性のため
                mainImage: null,
                subImages: [],
                subImageHasVideo: false,
                aplus: { hasAPlus: false },
                brand: {},
                hasAplus: false, // 後方互換性のため
                reviewCount: null,
                rating: null,
                injected: false 
              } 
            });
          }
        })
        .catch((err) => {
          console.error(`[FITPEAK][background] Failed to query contentScript for tab ${tabId}:`, err);
          sendResponse({ ok: true, snapshot: { asin: null, url: "", title: "", injected: false } });
        });
      return true; // Will respond asynchronously
    }
    return false;
  }
  
  // analyze要求
  if (message.type === "analyze") {
    const dryRun = message.dryRun === true;
    handleAnalyze(message.feature, message.data, dryRun)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true; // Will respond asynchronously
  }
  
  // RUN_SCORE要求（UIから直接呼ばれる）
  if (message.type === "RUN_SCORE") {
    const dryRun = message.dryRun === true;
    const payload = message.payload || message.data || {}; // payloadまたはdataを受け取る
    
    console.log("[FITPEAK][BG] RUN_SCORE received, payload keys:", Object.keys(payload));
    console.log("[FITPEAK][BG] RUN_SCORE payload sample:", {
      asin: payload.asin,
      hasImages: !!payload.images,
      hasMain: !!payload.images?.main,
      subsCount: payload.images?.subs?.length ?? 0,
      bulletsCount: payload.bullets?.length ?? 0,
      hasRating: payload.reviews?.rating !== undefined || payload.rating !== undefined,
      hasCount: payload.reviews?.count !== undefined || payload.reviewCount !== undefined,
      hasAplus: payload.aplus?.hasAPlus !== undefined,
      hasBrand: payload.brandContent !== undefined,
    });
    
    handleAnalyze("score", payload, dryRun)
      .then((result) => {
        console.log("[FITPEAK][BG] RUN_SCORE success, result keys:", Object.keys(result || {}));
        sendResponse({ ok: true, result });
      })
      .catch((error) => {
        console.error("[FITPEAK][BG] RUN_SCORE error:", error);
        // エラーメッセージに詳細を含める
        const errorMessage = error.message || String(error);
        const errorDetails = error.details || error.stack || "";
        sendResponse({ 
          ok: false, 
          error: errorMessage,
          ...(errorDetails && { details: errorDetails })
        });
      });
    return true; // Will respond asynchronously
  }

  // RUN_SUPER要求（UIから直接呼ばれる）
  if (message.type === "RUN_SUPER") {
    const dryRun = message.dryRun === true;
    const payload = message.payload || message.data || {}; // payloadまたはdataを受け取る
    
    console.log("[FITPEAK][BG] RUN_SUPER received, payload keys:", Object.keys(payload));
    console.log("[FITPEAK][BG] RUN_SUPER payload sample:", {
      asin: payload.asin,
      hasImages: !!payload.images,
      hasMain: !!payload.images?.main,
      subsCount: payload.images?.subs?.length ?? 0,
      bulletsCount: payload.bullets?.length ?? 0,
      hasRating: payload.reviews?.rating !== undefined || payload.rating !== undefined,
      hasCount: payload.reviews?.count !== undefined || payload.reviewCount !== undefined,
      hasAplus: payload.aplus?.hasAPlus !== undefined,
      hasBrand: payload.brandContent !== undefined,
    });
    
    handleAnalyze("super", payload, dryRun)
      .then((result) => {
        console.log("[FITPEAK][BG] RUN_SUPER success, result keys:", Object.keys(result || {}));
        sendResponse({ ok: true, result });
      })
      .catch((error) => {
        console.error("[FITPEAK][BG] RUN_SUPER error:", error);
        // エラーメッセージに詳細を含める
        const errorMessage = error.message || String(error);
        const errorDetails = error.details || error.stack || "";
        sendResponse({ 
          ok: false, 
          error: errorMessage,
          ...(errorDetails && { details: errorDetails })
        });
      });
    return true; // Will respond asynchronously
  }

  // GENERATE_IMPROVEMENT_PLAN要求（UIから呼ばれる）
  if (message.type === "GENERATE_IMPROVEMENT_PLAN") {
    const runId = message.runId;
    
    if (!runId) {
      sendResponse({ ok: false, error: "runIdが必要です" });
      return false;
    }

    console.log("[FITPEAK][BG] GENERATE_IMPROVEMENT_PLAN received, runId:", runId);
    
    handleGenerateImprovementPlan(runId)
      .then((result) => {
        console.log("[FITPEAK][BG] GENERATE_IMPROVEMENT_PLAN success");
        sendResponse({ ok: true, improvement_plan: result.improvement_plan });
      })
      .catch((error) => {
        console.error("[FITPEAK][BG] GENERATE_IMPROVEMENT_PLAN error:", error);
        sendResponse({ 
          ok: false, 
          error: error.message || String(error)
        });
      });
    return true; // Will respond asynchronously
  }
  
  return false;
});

// タブが閉じられたらsnapshotを削除
chrome.tabs.onRemoved.addListener((tabId) => {
  snapshots.delete(tabId);
});

async function handleAnalyze(feature: "score" | "deep" | "super", data: any, dryRun: boolean = false) {
  const settings = await getSettings();

  console.log("[FITPEAK][BG] Settings check:", {
    hasApiUrl: !!settings.apiUrl,
    hasApiKey: !!settings.apiKey,
    hasUserId: !!settings.userId,
    apiUrl: settings.apiUrl ? `${settings.apiUrl.substring(0, 20)}...` : "未設定",
    userId: settings.userId || "未設定",
  });

  if (!settings.apiUrl || !settings.apiKey || !settings.userId) {
    throw new Error("設定が不完全です。API_URL, API_KEY, userIdを設定してください。");
  }

  // dryRunの場合はクエリパラメータを追加
  const endpoint = `/api/analyze/${feature}-extension${dryRun ? "?dryRun=1" : ""}`;
  const payload = {
    userId: settings.userId,
    ...data
  };

  console.log(`[FITPEAK][BG] calling api: ${settings.apiUrl}${endpoint}`, {
    method: "POST",
    dryRun,
    hasAsin: !!data.asin,
    hasUrl: !!data.url,
    apiUrl: settings.apiUrl,
    hasApiKey: !!settings.apiKey,
    userId: settings.userId,
  });

  try {
    console.log(`[FITPEAK][BG] About to call apiRequest:`, {
      fullUrl: `${settings.apiUrl}${endpoint}`,
      apiUrl: settings.apiUrl,
      endpoint,
      method: "POST",
      hasApiKey: !!settings.apiKey,
      userId: settings.userId,
    });

    const response = await apiRequest(settings.apiUrl, {
      endpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey  // APIルートの実装に合わせてx-api-keyを使用
      },
      body: JSON.stringify(payload),
      logPrefix: `[FITPEAK][BG][analyze:${feature}]${dryRun ? "[DRY_RUN]" : ""}`
    });

    console.log(`[FITPEAK][BG] api response received:`, {
      ok: response.ok,
      status: response.status,
      hasData: !!response.data,
      error: response.error,
      message: response.message,
      runId: response.data?.runId,
      scoreTotal: response.data?.result?.scoreTotal || response.data?.score?.scoreTotal,
    });

    if (!response.ok) {
      const errorInfo = classifyError(response.status, response.error);
      
      console.log(`[FITPEAK][BG] API response not ok, errorInfo:`, errorInfo);
      
      // CORS/Networkエラーの場合、より詳細な情報を含める
      if (response.status === 0 && (response.error === "CORS_OR_NETWORK" || response.error === "NETWORK")) {
        let errorMessage = `${errorInfo.type}: ${errorInfo.message}`;
        errorMessage += `\n\n考えられる原因:`;
        errorMessage += `\n- API_URLが正しくない: ${settings.apiUrl}`;
        errorMessage += `\n- サーバーが起動していない可能性`;
        errorMessage += `\n- CORS設定が正しくない可能性`;
        errorMessage += `\n- ネットワーク接続の問題`;
        errorMessage += `\n- manifest.jsonのhost_permissionsに ${settings.apiUrl} が含まれているか確認`;
        errorMessage += `\n\n確認事項:`;
        errorMessage += `\n- API_URL: ${settings.apiUrl}${endpoint}`;
        errorMessage += `\n- サーバーが起動しているか確認してください`;
        errorMessage += `\n- ブラウザで直接 ${settings.apiUrl}${endpoint} にアクセスできるか確認`;
        console.error(`[FITPEAK][BG] Throwing network error:`, errorMessage);
        throw new Error(errorMessage);
      }
      
      // 400エラーの場合、詳細情報（missingSignals、validation errorsなど）を含める
      if (response.status === 400 && response.data) {
      const errorData = response.data as any;
      const missingSignals = errorData.missingSignals || [];
      const message = errorData.message || errorInfo.message;
      const details = errorData.details || []; // Zod validation errors
      
      let errorMessage = `${errorInfo.type}: ${message}`;
      
      if (details.length > 0) {
        // Zod validation errorsの詳細を追加
        const validationErrors = details.map((d: any) => 
          `${d.path?.join(".") || "unknown"}: ${d.message}`
        ).join(", ");
        errorMessage += `\nバリデーションエラー: ${validationErrors}`;
      }
      
      if (missingSignals.length > 0) {
        errorMessage += `\n不足しているデータ: ${missingSignals.join(", ")}`;
      }
      
      const error = new Error(errorMessage);
      (error as any).details = details;
      throw error;
    }
    
    // 403エラーの場合、より詳細な情報を含める
    if (response.status === 403 && response.data) {
      const errorData = response.data as any;
      const message = errorData.message || errorInfo.message;
      let errorMessage = `${errorInfo.type}: ${message}`;
      errorMessage += `\n\n考えられる原因:`;
      errorMessage += `\n- userIdが不正または未登録: ${settings.userId}`;
      errorMessage += `\n- Usage Guard制限に達している可能性`;
      errorMessage += `\n- API_KEYが無効または権限不足`;
      errorMessage += `\n\n設定を確認してください:`;
      errorMessage += `\n- API_URL: ${settings.apiUrl}`;
      errorMessage += `\n- userId: ${settings.userId}`;
      errorMessage += `\n- API_KEY: ${settings.apiKey ? "設定済み" : "未設定"}`;
      throw new Error(errorMessage);
    }
    
    // 500エラーの場合、サーバー側からの詳細なエラー情報を含める
    if (response.status >= 500) {
      console.error(`[FITPEAK][BG] 500 error response data:`, JSON.stringify(response.data, null, 2));
      
      const errorData = response.data as any;
      const serverMessage = errorData?.message || errorInfo.message;
      let errorMessage = `${errorInfo.type}: ${serverMessage}`;
      
      // サーバー側からの詳細情報を全て含める
      if (errorData) {
        errorMessage += `\n\nサーバー側のエラー詳細:`;
        errorMessage += `\nレスポンスデータ: ${JSON.stringify(errorData, null, 2)}`;
        
        if (errorData.stack) {
          errorMessage += `\n\nスタックトレース:\n${errorData.stack}`;
        }
        if (errorData.errorDetails) {
          errorMessage += `\nエラー詳細: ${JSON.stringify(errorData.errorDetails, null, 2)}`;
        }
        if (errorData.prismaCode || errorData.prismaMessage) {
          errorMessage += `\nPrismaエラー: ${errorData.prismaCode || ""} - ${errorData.prismaMessage || ""}`;
        }
      } else {
        errorMessage += `\n\n注意: サーバーからエラー詳細が返されていません。`;
      }
      
      errorMessage += `\n\n考えられる原因:`;
      errorMessage += `\n- サーバー側のコードエラー`;
      errorMessage += `\n- データベース接続エラー`;
      errorMessage += `\n- バリデーションエラー（入力データの形式が不正）`;
      errorMessage += `\n\n確認事項:`;
      errorMessage += `\n- サーバーのコンソールログを確認してください`;
      errorMessage += `\n- リクエストID: ${errorData?.requestId || "なし"}`;
      
      const error = new Error(errorMessage);
      (error as any).details = errorData;
      throw error;
    }
    
    throw new Error(`${errorInfo.type}: ${errorInfo.message}`);
    }

    return response.data;
  } catch (error: any) {
    console.error(`[FITPEAK][BG] apiRequest threw error:`, error);
    console.error(`[FITPEAK][BG] Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      fullError: error,
    });
    
    // apiRequestが既にエラーを返している場合は再スロー
    if (error.message && (error.message.includes("CORS") || error.message.includes("Network") || error.message.includes("接続"))) {
      const errorMessage = `接続エラー: ${settings.apiUrl}${endpoint} に接続できません。API_URLが正しいか、サーバーが起動しているか確認してください。\n\n詳細: ${error.message}`;
      console.error(`[FITPEAK][BG] Throwing connection error:`, errorMessage);
      throw new Error(errorMessage);
    }
    throw error;
  }
}

async function handleGenerateImprovementPlan(runId: string) {
  const settings = await getSettings();

  if (!settings.apiUrl || !settings.apiKey || !settings.userId) {
    throw new Error("設定が不完全です。API_URL, API_KEY, userIdを設定してください。");
  }

  const endpoint = `/api/analyze/improvement-plan`;
  const payload = {
    runId
  };

  console.log(`[FITPEAK][BG] calling improvement-plan api: ${settings.apiUrl}${endpoint}`, {
    method: "POST",
    runId
  });

  const response = await apiRequest(settings.apiUrl, {
    endpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey
    },
    body: JSON.stringify(payload),
    logPrefix: `[FITPEAK][BG][improvement-plan]`
  });

  console.log(`[FITPEAK][BG] improvement-plan api response:`, {
    ok: response.ok,
    status: response.status,
    hasImprovementPlan: !!response.data?.improvement_plan,
    error: response.error,
    message: response.data?.message,
    feature: response.data?.feature,
    resetAt: response.data?.resetAt,
    code: response.data?.code,
    planKey: response.data?.planKey,
    fullData: response.data,
  });

  if (!response.ok) {
    // 402エラー（制限超過）の場合、詳細なメッセージを返す
    if (response.status === 402 && response.data) {
      const errorData = response.data as any;
      console.error(`[FITPEAK][BG] 402 error details:`, JSON.stringify(errorData, null, 2));
      
      const message = errorData.message || "改善点分析の利用制限に達しました";
      const feature = errorData.feature || "improveMonthly";
      const resetAt = errorData.resetAt || "";
      const planKey = errorData.planKey || "不明";
      
      let errorMessage = "";
      
      // プラン別のメッセージを生成
      if (planKey === "FREE") {
        errorMessage = `改善点分析は利用できません\n\n`;
        errorMessage += `現在のプラン: ${planKey}\n`;
        errorMessage += `${message}\n\n`;
        errorMessage += `改善点分析を利用するには、以下のプランにアップグレードしてください:\n`;
        errorMessage += `• SIMPLEプラン: 月3回まで（980円/月）\n`;
        errorMessage += `• PROプラン: 月20回まで（3,980円/月）`;
      } else if (planKey === "SIMPLE") {
        errorMessage = `改善点分析の利用制限に達しました\n\n`;
        errorMessage += `現在のプラン: ${planKey}\n`;
        errorMessage += `${message}\n`;
        if (resetAt) {
          try {
            const resetDate = new Date(resetAt);
            errorMessage += `制限は ${resetDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })} にリセットされます。\n`;
          } catch (e) {
            errorMessage += `制限は ${resetAt} にリセットされます。\n`;
          }
        }
        errorMessage += `\nより多くの分析を行うには、PROプラン（月20回、3,980円/月）にアップグレードしてください。`;
      } else if (planKey === "PRO") {
        errorMessage = `改善点分析の利用制限に達しました\n\n`;
        errorMessage += `現在のプラン: ${planKey}\n`;
        errorMessage += `${message}\n`;
        if (resetAt) {
          try {
            const resetDate = new Date(resetAt);
            errorMessage += `制限は ${resetDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })} にリセットされます。`;
          } catch (e) {
            errorMessage += `制限は ${resetAt} にリセットされます。`;
          }
        }
      } else {
        // フォールバック
        errorMessage = `${message}\n\n`;
        errorMessage += `現在のプラン: ${planKey}\n`;
        errorMessage += `利用機能: 改善点分析（${feature}）\n`;
        if (resetAt) {
          try {
            const resetDate = new Date(resetAt);
            errorMessage += `制限は ${resetDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })} にリセットされます。`;
          } catch (e) {
            errorMessage += `制限は ${resetAt} にリセットされます。`;
          }
        }
      }
      
      throw new Error(errorMessage);
    }
    
    const errorInfo = classifyError(response.status, response.error);
    const errorMessage = response.data?.message || errorInfo.message;
    throw new Error(`${errorInfo.type}: ${errorMessage}`);
  }

  return response.data;
}
