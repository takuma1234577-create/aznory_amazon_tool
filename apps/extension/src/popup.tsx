/**
 * Chrome Extension Popup UI
 * React-based popup with dark theme and AZNORY branding
 */

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AznoryLogo } from "./components/aznory-logo";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { apiRequest, classifyError } from "./lib/apiClient";
import { getSettings, saveSettings, maskApiKey } from "./storage";
import { Check, X, Settings, TestTube, Copy, AlertTriangle, RefreshCw, Play } from "lucide-react";

interface PopupSettings {
  apiUrl: string;
  apiKey: string;
  userId: string;
}

interface PageSnapshot {
  asin: string | null;
  url: string;
  title: string;
  injected: boolean;
  bullets: string[];
  imageUrls: string[];
  hasAplus: boolean;
  reviewCount: number | null;
  rating: number | null;
}

function PopupApp() {
  const [settings, setSettings] = useState<PopupSettings>({
    apiUrl: "",
    apiKey: "",
    userId: "",
  });
  const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [dryRun, setDryRun] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    updatePageSnapshot();
  }, []);

  async function loadSettings() {
    const loaded = await getSettings();
    setSettings(loaded);
  }

  async function handleSaveSettings() {
    try {
      await saveSettings(settings);
      alert("設定を保存しました");
    } catch (err) {
      alert("設定の保存に失敗しました: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleTestConnection() {
    if (!settings.apiUrl) {
      setTestResult({
        success: false,
        message: "API_URLが設定されていません",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const startTime = Date.now();

    try {
      const response = await apiRequest<{ ok: boolean; env?: string; timeISO?: string; db?: boolean; version?: string; elapsed?: string }>(
        settings.apiUrl,
        {
          endpoint: "/api/health",
          method: "GET",
          logPrefix: "[EXT][health]",
        }
      );

      const elapsed = Date.now() - startTime;

      if (response.ok && response.data?.ok) {
        const data = response.data;
        setTestResult({
          success: true,
          message: `接続成功 (${elapsed}ms)`,
          details: {
            status: response.status,
            env: data.env || "N/A",
            db: data.db ? "✓" : "✗",
            version: data.version,
            fullData: data,
          },
        });
      } else {
        const errorInfo = classifyError(response.status, response.error);
        setTestResult({
          success: false,
          message: `${errorInfo.type}: ${errorInfo.message}`,
          details: {
            status: response.status,
            suggestion: errorInfo.suggestion,
            data: response.data,
          },
        });
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorInfo = classifyError(0, "CORS_OR_NETWORK");
      setTestResult({
        success: false,
        message: `${errorInfo.type}: ${errorInfo.message}`,
        details: {
          elapsed,
          suggestion: errorInfo.suggestion,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleCopySettings() {
    try {
      const logLevelResult = await chrome.storage.local.get("LOG_LEVEL");
      const logLevel = logLevelResult.LOG_LEVEL || "info";

      const settingsText = `API_URL: ${settings.apiUrl || "未設定"}
API_KEY: ${maskApiKey(settings.apiKey)}
userId: ${settings.userId || "未設定"}
LOG_LEVEL: ${logLevel}`;

      await navigator.clipboard.writeText(settingsText);
      alert("設定をクリップボードにコピーしました");
    } catch (err) {
      alert("コピーに失敗しました: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function updatePageSnapshot() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        setSnapshot({
          asin: null,
          url: "",
          title: "",
          injected: false,
          bullets: [],
          imageUrls: [],
          hasAplus: false,
          reviewCount: null,
          rating: null,
        });
        return;
      }

      const url = tab.url || "";
      const isAmazonPage = url.includes("amazon.co.jp") || url.includes("amazon.com");

      if (!isAmazonPage) {
        setSnapshot({
          asin: null,
          url,
          title: tab.title || "",
          injected: false,
          bullets: [],
          imageUrls: [],
          hasAplus: false,
          reviewCount: null,
          rating: null,
        });
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: "GET_SNAPSHOT",
        tabId: tab.id,
      });

      if (response?.ok && response.snapshot) {
        const snap = response.snapshot;
        setSnapshot({
          asin: snap.asin || null,
          url: snap.url || url,
          title: snap.title || "",
          injected: snap.injected || false,
          bullets: snap.bullets || [],
          imageUrls: snap.imageUrls || [],
          hasAplus: snap.hasAplus || false,
          reviewCount: snap.reviewCount || null,
          rating: snap.rating || null,
        });
      } else {
        setSnapshot({
          asin: null,
          url,
          title: tab.title || "",
          injected: false,
          bullets: [],
          imageUrls: [],
          hasAplus: false,
          reviewCount: null,
          rating: null,
        });
      }
    } catch (err) {
      console.error("[FITPEAK] Failed to get page snapshot:", err);
      setSnapshot({
        asin: null,
        url: "",
        title: "",
        injected: false,
        bullets: [],
        imageUrls: [],
        hasAplus: false,
        reviewCount: null,
        rating: null,
      });
    }
  }

  async function handleAnalyze(feature: "score" | "super") {
    if (!settings.apiUrl || !settings.apiKey || !settings.userId) {
      setAnalyzeResult({
        success: false,
        message: "設定が不完全です。API_URL, API_KEY, userIdを設定してください。",
      });
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !snapshot?.asin) {
      setAnalyzeResult({
        success: false,
        message: "ASINが検出されませんでした。",
      });
      return;
    }

    setIsLoading(true);
    setAnalyzeResult(null);

    try {
      const payload: any = {
        asin: snapshot.asin,
        url: snapshot.url || snapshot.asin,
        title: snapshot.title || "",
        bullets: snapshot.bullets || [],
        imageUrls: snapshot.imageUrls || [],
        reviewCount: snapshot.reviewCount !== undefined ? snapshot.reviewCount : null,
        rating: snapshot.rating !== undefined ? snapshot.rating : null,
      };

      const analyzeResponse = await chrome.runtime.sendMessage({
        type: "analyze",
        feature,
        data: payload,
        dryRun: dryRun,
      });

      if (analyzeResponse?.ok) {
        setAnalyzeResult({
          success: true,
          message: `${feature === "score" ? "Score" : "Super"}分析完了`,
          data: analyzeResponse.result,
        });
      } else {
        setAnalyzeResult({
          success: false,
          message: analyzeResponse?.error || "不明なエラー",
        });
      }
    } catch (err) {
      setAnalyzeResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="dark w-[420px] min-h-[600px] bg-background text-foreground">
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <AznoryLogo size="sm" showBrand={true} showServiceName={false} />
            <div className="flex items-center gap-2">
              <Badge variant={snapshot?.injected ? "default" : "destructive"} className="text-xs">
                {snapshot?.injected ? "注入済み" : "未注入"}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 設定セクション */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">設定</CardTitle>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiUrl" className="text-xs">API URL</Label>
              <Input
                id="apiUrl"
                type="text"
                placeholder="https://your-api.com"
                value={settings.apiUrl}
                onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-xs">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="your-api-key"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userId" className="text-xs">User ID</Label>
              <Input
                id="userId"
                type="text"
                placeholder="user-id"
                value={settings.userId}
                onChange={(e) => setSettings({ ...settings, userId: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveSettings} size="sm" className="flex-1 text-xs h-8">
                <Settings className="h-3 w-3 mr-1.5" />
                保存
              </Button>
              <Button
                onClick={handleTestConnection}
                disabled={isTesting}
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8"
              >
                {isTesting ? (
                  <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <TestTube className="h-3 w-3 mr-1.5" />
                )}
                テスト
              </Button>
              <Button onClick={handleCopySettings} variant="ghost" size="sm" className="text-xs h-8 px-2">
                <Copy className="h-3 w-3" />
              </Button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  testResult.success
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-destructive/10 border border-destructive/20 text-destructive"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  <span className="font-semibold">{testResult.message}</span>
                </div>
                {testResult.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      詳細
                    </summary>
                    <pre className="mt-2 text-[10px] overflow-auto max-h-32">
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* ページ情報セクション */}
          {snapshot && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">ページ情報</CardTitle>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ASIN:</span>
                  <Badge variant={snapshot.asin ? "default" : "secondary"} className="text-xs">
                    {snapshot.asin || "未検出"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bullets:</span>
                  <span>{snapshot.bullets.length}件</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">画像:</span>
                  <span>{snapshot.imageUrls.length}件</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">レビュー:</span>
                  <span>
                    {snapshot.reviewCount !== null ? `${snapshot.reviewCount.toLocaleString()}件` : "未取得"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">評価:</span>
                  <span>{snapshot.rating !== null ? `${snapshot.rating.toFixed(1)}点` : "未取得"}</span>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* 分析実行セクション */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">分析実行</CardTitle>
            </div>

            <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <input
                type="checkbox"
                id="dryRun"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="dryRun" className="text-xs text-amber-400 cursor-pointer">
                Dry Run（使用回数消費なし・開発環境のみ）
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleAnalyze("score")}
                disabled={isLoading || !snapshot?.asin}
                size="sm"
                className="flex-1 text-xs h-8"
              >
                {isLoading ? (
                  <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1.5" />
                )}
                Score
              </Button>
              <Button
                onClick={() => handleAnalyze("super")}
                disabled={isLoading || !snapshot?.asin}
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8"
              >
                {isLoading ? (
                  <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1.5" />
                )}
                Super
              </Button>
            </div>

            {analyzeResult && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  analyzeResult.success
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-destructive/10 border border-destructive/20 text-destructive"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {analyzeResult.success ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span className="font-semibold">{analyzeResult.message}</span>
                </div>
                {analyzeResult.data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      結果詳細
                    </summary>
                    <pre className="mt-2 text-[10px] overflow-auto max-h-48">
                      {JSON.stringify(analyzeResult.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mount React app
const container = document.getElementById("popup-root");
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(PopupApp));
} else {
  console.error("[FITPEAK][popup] popup-root element not found");
}
