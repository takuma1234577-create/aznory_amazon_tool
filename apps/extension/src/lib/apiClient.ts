/**
 * Common API client for Chrome Extension with logging
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "off";

// Get LOG_LEVEL from chrome.storage or default to "info"
let LOG_LEVEL: LogLevel = "info";

async function getLogLevel(): Promise<LogLevel> {
  try {
    const result = await chrome.storage.local.get("LOG_LEVEL");
    return (result.LOG_LEVEL as LogLevel) || "info";
  } catch {
    return "info";
  }
}

// Initialize log level
getLogLevel().then((level) => {
  LOG_LEVEL = level;
});

function shouldLog(level: LogLevel): boolean {
  // In service worker context, always check current LOG_LEVEL
  const currentLevel = LOG_LEVEL;
  if (currentLevel === "off") return false;
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  return levels.indexOf(level) <= levels.indexOf(currentLevel);
}

function maskSecret(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return "***";
  return value.substring(0, visibleChars) + "***";
}

function maskHeaders(headers: HeadersInit): Record<string, string> {
  const masked: Record<string, string> = {};
  const headersObj = headers instanceof Headers 
    ? Object.fromEntries(headers.entries())
    : Array.isArray(headers)
    ? Object.fromEntries(headers)
    : headers;

  for (const [key, value] of Object.entries(headersObj)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "x-api-key" || lowerKey === "authorization") {
      masked[key] = maskSecret(String(value));
    } else {
      masked[key] = String(value);
    }
  }
  return masked;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export interface ApiRequestOptions extends RequestInit {
  endpoint: string;
  method?: string;
  logPrefix?: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  message?: string;
  headers?: Headers;
  elapsed: number;
}

export async function apiRequest<T = any>(
  url: string,
  options: ApiRequestOptions
): Promise<ApiResponse<T>> {
  const startTime = Date.now();
  const { endpoint, method = "GET", logPrefix = "[EXT]", ...fetchOptions } = options;

  const fullUrl = url + endpoint;
  const payloadSize = fetchOptions.body 
    ? new Blob([fetchOptions.body]).size 
    : 0;

  // Log request
  if (shouldLog("debug")) {
    console.log(
      `${logPrefix}[request] ${method} ${endpoint}`,
      {
        headers: maskHeaders(fetchOptions.headers || {}),
        payloadSize: formatBytes(payloadSize)
      }
    );
  }

  try {
    const response = await fetch(fullUrl, {
      ...fetchOptions,
      method
    });

    const elapsed = Date.now() - startTime;
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    let data: T | undefined;
    let bodyPreview = "";

    if (isJson) {
      const text = await response.text();
      bodyPreview = text.substring(0, 300);
      try {
        data = JSON.parse(text) as T;
      } catch {
        // Not valid JSON, use text as data
        data = text as any;
      }
    } else {
      const text = await response.text();
      bodyPreview = text.substring(0, 300);
      data = text as any;
    }

    // Log response
    if (shouldLog("debug")) {
      console.log(
        `${logPrefix}[response] ${method} ${endpoint} status=${response.status} elapsed=${elapsed}ms`,
        {
          bodyPreview: bodyPreview.length > 300 ? bodyPreview + "..." : bodyPreview
        }
      );
    } else if (shouldLog("info")) {
      console.log(
        `${logPrefix}[${endpoint}] ${method} ${endpoint} status=${response.status} elapsed=${elapsed}ms payload=${formatBytes(payloadSize)}`
      );
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: response.headers,
      elapsed
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "UnknownError";

    // Log error
    console.error(
      `${logPrefix}[error] ${method} ${endpoint} elapsed=${elapsed}ms`,
      {
        errorName,
        errorMessage,
        fullUrl,
        url,
        endpoint,
        error: error,
      }
    );

    // Classify error
    let errorType = "UNKNOWN";
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("TypeError") || errorName === "TypeError") {
      errorType = "CORS_OR_NETWORK";
    } else if (errorMessage.includes("NetworkError") || errorName === "NetworkError") {
      errorType = "NETWORK";
    }

    console.error(`${logPrefix}[error] ${method} ${endpoint} failed (classified):`, {
      errorType,
      errorName,
      errorMessage,
      fullUrl,
      url,
      endpoint,
    });
    
    return {
      ok: false,
      status: 0,
      error: errorType,
      message: errorMessage,
      elapsed
    };
  }
}

export function classifyError(status: number, error?: string): {
  type: string;
  message: string;
  suggestion: string;
} {
  if (status === 0) {
    if (error === "CORS_OR_NETWORK") {
      return {
        type: "CORS/Network",
        message: "接続に失敗しました",
        suggestion: "API_URLが正しいか、CORS設定を確認してください"
      };
    }
    return {
      type: "Network Error",
      message: "ネットワークエラー",
      suggestion: "インターネット接続を確認してください"
    };
  }

  if (status === 401) {
    return {
      type: "認証エラー",
      message: "API_KEYが無効です",
      suggestion: "API_KEYが未設定または不一致の可能性があります"
    };
  }

  if (status === 403) {
    return {
      type: "アクセス拒否",
      message: "アクセスが拒否されました",
      suggestion: "userIdが不正/未登録、またはUsage Guard制限の可能性があります"
    };
  }

  if (status === 402) {
    return {
      type: "利用制限",
      message: "利用制限に達しました",
      suggestion: "プランの制限に達しているか、改善点分析が利用できないプランです"
    };
  }

  if (status === 400) {
    return {
      type: "入力エラー",
      message: "リクエストデータが不正です",
      suggestion: "入力データを確認してください（missingSignalsを確認）"
    };
  }

  if (status === 413) {
    return {
      type: "Payload過大",
      message: "リクエストサイズが大きすぎます",
      suggestion: "画像データを圧縮するか、サイズを削減してください"
    };
  }

  if (status >= 500) {
    return {
      type: "サーバーエラー",
      message: `サーバーエラー (${status})`,
      suggestion: "サーバーのログを確認してください"
    };
  }

  return {
    type: "エラー",
    message: `HTTP ${status}`,
    suggestion: "リクエストを確認してください"
  };
}
