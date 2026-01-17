import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "@/lib/env";

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const env = getEnv();
    geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return geminiClient;
}

export interface VisionInput {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
}

export async function callGeminiVision(
  prompt: string,
  images: VisionInput[],
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: "gemini-1.5-pro",
  });

  // Convert images to Gemini format
  // Gemini API requires base64, so we need to fetch URLs and convert
  const imageParts = await Promise.all(
    images.map(async (img) => {
      if (img.imageBase64) {
        return {
          inlineData: {
            data: img.imageBase64,
            mimeType: img.mimeType || "image/jpeg",
          },
        };
      } else if (img.imageUrl) {
        // Fetch URL and convert to base64
        const { base64, mimeType } = await fetchImageAsBase64(img.imageUrl);
        return {
          inlineData: {
            data: base64,
            mimeType: mimeType,
          },
        };
      }
      throw new Error("Image must have either imageUrl or imageBase64");
    })
  );

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 2000,
    },
  });

  const response = result.response;
  const text = response.text();
  if (!text) {
    throw new Error("Gemini Vision returned empty response");
  }

  return text;
}

/**
 * Fetch image from URL and convert to base64
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<{
  base64: string;
  mimeType: string;
}> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const contentType = response.headers.get("content-type") || "image/jpeg";

  return {
    base64,
    mimeType: contentType,
  };
}
