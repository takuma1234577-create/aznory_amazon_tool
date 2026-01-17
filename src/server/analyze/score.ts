import { AnalyzeInput } from "./schema";

export interface ScoreResult {
  scoreTotal: number;
  breakdown: Record<string, { score: number; max: number; [key: string]: any }>;
  notes?: string[];
  missingSignals?: string[];
}

/**
 * Score（100点満点）を計算
 * ルールベースのみ。主観評価は禁止。
 */
export async function calculateScore(input: AnalyzeInput): Promise<ScoreResult> {
  const missingSignals: string[] = [];
  const breakdown: Record<string, { score: number; max: number; [key: string]: any }> = {};
  let scoreTotal = 0;

  // メイン画像とサブ画像を分離
  let mainImage: any = null;
  let subImages: any[] = [];
  
  // Type guard: Check if input.images is an object with 'main' and 'subs' properties
  if (input.images && 
      typeof input.images === 'object' && 
      !Array.isArray(input.images) &&
      'main' in input.images && 
      'subs' in input.images) {
    // Type-safe access: input.images is { main, subs } shape
    const imagesObj = input.images as { main?: any; subs?: any[] };
    mainImage = imagesObj.main || null;
    subImages = Array.isArray(imagesObj.subs) ? imagesObj.subs : [];
  } else if (Array.isArray(input.images)) {
    // input.images is an array
    mainImage = input.images.length > 0 ? input.images[0] : null;
    subImages = input.images.length > 1 ? input.images.slice(1) : [];
  }
  
  const mainImageWidth = (mainImage as any)?.width;
  const mainImageHeight = (mainImage as any)?.height;
  const mainImageBgIsWhite = mainImage ? (mainImage as any)?.bgIsWhite : undefined;

  // ===== 1. タイトル（10点）【新設】 =====
  let titleScore = 0;
  const titleMax = 10;
  const keywordMin = 7;
  
  // titleはinput.titleから取得（ExtensionInputSchemaでoptional）
  const title = (input as any)?.title || "";
  
  let keywordCount = 0;
  let passed = false;
  let excludedBracketTextCount = 0;
  const excludedTokens: string[] = [];
  
  if (title) {
    // SEOキーワードが7語以上含まれている：10点
    // LLMなしで判断する暫定ルール
    
    // 1. 括弧内（【...】など）をすべて削除
    // 全角の【】を最優先、次に [] () {} （）
    let cleanedTitle = title;
    const bracketPatterns = [
      /【[^】]*】/g,  // 【...】（全角、最優先）
      /\[[^\]]*\]/g,  // [...]
      /\([^)]*\)/g,   // (...)
      /\{[^}]*\}/g,   // {...}
      /（[^）]*）/g,   // （...）（全角）
    ];
    
    for (const pattern of bracketPatterns) {
      const matches = cleanedTitle.match(pattern);
      if (matches) {
        excludedBracketTextCount += matches.length;
      }
      cleanedTitle = cleanedTitle.replace(pattern, " ");
    }
    
    // 2. 全角/半角スペースでトークン分割
    // 全角スペース（\u3000）と半角スペースで分割
    const rawTokens = cleanedTitle
      .split(/[\s\u3000]+/)
      .map(token => token.trim())
      .filter(token => token.length > 0);
    
    // 3. 各トークンをフィルタ
    const particles = ["の", "は", "に", "を", "と", "で", "も", "が", "へ", "や", "から", "まで", "より"];
    
    const keywords = rawTokens.filter(token => {
      // 空は除外（既にfilterで除外済み）
      
      // 記号だけ/数字だけは除外
      if (/^[^\p{L}\p{N}]*$/u.test(token) || /^\d+$/.test(token)) {
        excludedTokens.push(token);
        return false;
      }
      
      // 1文字トークンは除外
      if (token.length === 1) {
        excludedTokens.push(token);
        return false;
      }
      
      // 助詞文字を含むトークンは除外
      const hasParticle = particles.some(particle => token.includes(particle));
      if (hasParticle) {
        excludedTokens.push(token);
        return false;
      }
      
      return true;
    });
    
    keywordCount = keywords.length;
    
    // 4. 残ったトークン数 >= 7 ならOK
    passed = keywordCount >= keywordMin;
    if (passed) {
      titleScore = 10;
    }
  } else {
    missingSignals.push("title");
  }

  // breakdownに詳細情報を含める（UI表示用）
  breakdown["title"] = { 
    score: titleScore, 
    max: titleMax,
    keywordCount,
    keywordMin,
    passed,
    ...(excludedBracketTextCount > 0 && { excludedBracketTextCount }),
    ...(process.env.NODE_ENV === "development" && excludedTokens.length > 0 && { excludedTokens })
  };
  scoreTotal += titleScore;

  // ===== 2. メイン画像（10点） =====
  let mainImageScore = 0;
  const mainImageMax = 10;

  if (mainImage) {
    // 正方形かつ1500×1500以上：5点
    if (mainImageWidth && mainImageHeight) {
      const minSize = Math.min(mainImageWidth, mainImageHeight);
      const maxSize = Math.max(mainImageWidth, mainImageHeight);
      const isSquare = Math.abs(mainImageWidth - mainImageHeight) / maxSize < 0.05;
      if (minSize >= 1500 && isSquare) {
        mainImageScore += 5;
      }
    } else {
      missingSignals.push("mainImageDimensions");
    }
    
    // 背景が白：5点
    if (mainImageBgIsWhite !== undefined) {
      if (mainImageBgIsWhite === true) {
        mainImageScore += 5;
      }
    } else {
      missingSignals.push("mainImageBgWhite");
    }
  } else {
    missingSignals.push("mainImageDimensions");
    missingSignals.push("mainImageBgWhite");
  }

  breakdown["mainImage"] = { score: mainImageScore, max: mainImageMax };
  scoreTotal += mainImageScore;

  // ===== 3. サブ画像（20点） =====
  let subImagesScore = 0;
  const subImagesMax = 20;

  if (subImages === undefined || subImages === null) {
    missingSignals.push("subImageCount");
    missingSignals.push("subImageDimensions");
    missingSignals.push("subImageHasVideo");
  } else {
    // サブ画像6枚以上：10点
    if (subImages.length >= 6) {
      subImagesScore += 10;
    }

    // 各画像1500×1500以上：5点
    let hasValidDimensions = false;
    let hasAnyDimensions = false;
    for (const subImage of subImages) {
      const width = (subImage as any)?.width;
      const height = (subImage as any)?.height;
      if (width && height) {
        hasAnyDimensions = true;
        if (width >= 1500 && height >= 1500) {
          hasValidDimensions = true;
          break;
        }
      }
    }
    if (hasValidDimensions) {
      subImagesScore += 5;
    } else if (!hasAnyDimensions) {
      missingSignals.push("subImageDimensions");
    }

    // 動画（Video）あり：5点
    // input.subImageHasVideo または input.images.hasVideo から取得
    const subImageHasVideo = (input as any)?.subImageHasVideo ?? (input as any)?.images?.hasVideo;
    if (subImageHasVideo === true) {
      subImagesScore += 5;
    } else if (subImageHasVideo === false) {
      // falseの場合は動画なし
    } else {
      missingSignals.push("subImageHasVideo");
    }
  }

  breakdown["subImages"] = { score: subImagesScore, max: subImagesMax };
  scoreTotal += subImagesScore;

  // ===== 4. 説明文（5点） =====
  let descriptionScore = 0;
  const descriptionMax = 5;

  if (input.description) {
    const bullets = input.description.split("\n").filter(line => line.trim().length > 0);
    if (bullets.length >= 5) {
      descriptionScore = 5;
    } else {
      missingSignals.push("bullets");
    }
  } else {
    missingSignals.push("bullets");
  }

  breakdown["description"] = { score: descriptionScore, max: descriptionMax };
  scoreTotal += descriptionScore;

  // ===== 5. レビュー（25点） =====
  let reviewsScore = 0;
  const reviewsMax = 25;

  const rating = input.reviews?.averageRating;
  const reviewCount = input.reviews?.totalCount;

  if (rating !== undefined && rating !== null) {
    // 星4.0以上：5点
    if (rating >= 4.0) {
      reviewsScore += 5;
    }
    // 星4.3以上（累積）：5点
    if (rating >= 4.3) {
      reviewsScore += 5;
    }
  } else {
    missingSignals.push("reviewRating");
  }

  if (reviewCount !== undefined && reviewCount !== null) {
    // レビュー30件以上：5点
    if (reviewCount >= 30) {
      reviewsScore += 5;
    }
    // レビュー100件以上（累積）：5点
    if (reviewCount >= 100) {
      reviewsScore += 5;
    }
    // レビュー1000件以上（累積）：5点
    if (reviewCount >= 1000) {
      reviewsScore += 5;
    }
  } else {
    missingSignals.push("reviewCount");
  }

  breakdown["reviews"] = { score: reviewsScore, max: reviewsMax };
  scoreTotal += reviewsScore;

  // ===== 6. A+コンテンツ＋ブランド（20点）【統合】 =====
  let aplusBrandScore = 0;
  const aplusBrandMax = 20;

  const aPlusContent = input.aPlusContent;
  const aplusModuleCount = (input as any).aplusModuleCount;
  const aplusIsPremium = (input as any).aplusIsPremium;
  const brandContent = input.brandContent;
  
  // A+導入：5点
  if (aPlusContent === true) {
    aplusBrandScore += 5;
  } else if (aPlusContent === false) {
    // falseの場合はA+なし
  } else {
    missingSignals.push("aplusPresence");
  }

  // Premium A+導入：5点
  if (aplusIsPremium === true) {
    aplusBrandScore += 5;
  } else if (aplusIsPremium === false) {
    // falseの場合はPremium A+なし
  } else {
    missingSignals.push("aplusIsPremium");
  }

  // モジュール5つ以上：5点
  if (aplusModuleCount !== undefined && aplusModuleCount !== null) {
    if (aplusModuleCount >= 5) {
      aplusBrandScore += 5;
    }
  } else {
    missingSignals.push("aplusModuleCount");
  }

  // ブランドストーリー導入：5点
  if (brandContent === true) {
    aplusBrandScore += 5;
  } else if (brandContent === false) {
    // falseの場合はブランドコンテンツなし
  } else {
    missingSignals.push("brandContent");
  }

  breakdown["aplusBrand"] = { score: aplusBrandScore, max: aplusBrandMax };
  scoreTotal += aplusBrandScore;

  return {
    scoreTotal,
    breakdown,
    notes: ["Score calculated successfully"],
    missingSignals: missingSignals.length > 0 ? missingSignals : []
  };
}
