import OpenAI from "openai";
import { getEnv } from "@/lib/env";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const env = getEnv();
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callChatGPT(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("ChatGPT returned empty response");
  }

  return content;
}
