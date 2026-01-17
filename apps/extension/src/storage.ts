/**
 * Storage utilities for Chrome Extension settings
 */

export interface ExtensionSettings {
  apiUrl: string;
  apiKey: string;
  userId: string;
}

const STORAGE_KEYS = {
  API_URL: "apiUrl",
  API_KEY: "apiKey",
  USER_ID: "userId"
} as const;

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.API_URL,
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.USER_ID
  ]);

  return {
    apiUrl: result[STORAGE_KEYS.API_URL] || "",
    apiKey: result[STORAGE_KEYS.API_KEY] || "",
    userId: result[STORAGE_KEYS.USER_ID] || ""
  };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const updates: Record<string, string> = {};
  
  if (settings.apiUrl !== undefined) {
    updates[STORAGE_KEYS.API_URL] = settings.apiUrl;
  }
  if (settings.apiKey !== undefined) {
    updates[STORAGE_KEYS.API_KEY] = settings.apiKey;
  }
  if (settings.userId !== undefined) {
    updates[STORAGE_KEYS.USER_ID] = settings.userId;
  }

  await chrome.storage.local.set(updates);
}

export function maskApiKey(apiKey: string, visibleChars: number = 4): string {
  if (!apiKey) return "未設定";
  if (apiKey.length <= visibleChars) return "***";
  return apiKey.substring(0, visibleChars) + "***";
}
