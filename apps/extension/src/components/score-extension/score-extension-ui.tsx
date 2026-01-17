"use client"

import { useState, useCallback, useEffect } from "react"
import type React from "react"
import { Button } from "../ui/button"
import { Card, CardHeader } from "../ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/accordion"
import {
  Play,
  FlaskConical,
  History,
  BarChart3,
  RefreshCw,
  MousePointerClick,
  ImageIcon,
  Images,
  FileText,
  Star,
  Award,
  Zap,
  Sparkles,
  ChevronDown,
  Check,
  X,
  Type,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Info,
} from "lucide-react"
import { cn } from "../../lib/utils"
import { AznoryLogo } from "../aznory-logo"

// V0 UI Types
interface ScoreDetail {
  item: string
  points: number
  achieved: boolean
}

interface SectionDetails {
  title: ScoreDetail[]
  mainImage: ScoreDetail[]
  subImages: ScoreDetail[]
  description: ScoreDetail[]
  reviews: ScoreDetail[]
  aplusBrand: ScoreDetail[]
}

interface SuperAnalysisItem {
  score: number
  max: number
  why: string
  reason?: string // 詳細な採点理由（APIのdetailsから取得）
  improvement?: string // 具体的な改善案（APIのdetailsから取得）
}

interface SuperMainImageAnalysis {
  listVisibility: SuperAnalysisItem
  visualImpact: SuperAnalysisItem
  instantUnderstanding: SuperAnalysisItem
  cvrBlockers: SuperAnalysisItem
}

interface SuperTitleAnalysis {
  seoStructure: SuperAnalysisItem
  ctrDesign: SuperAnalysisItem
  readability: SuperAnalysisItem
}

interface SuperSubImagesAnalysis {
  benefitDesign: SuperAnalysisItem
  worldviewConsistency: SuperAnalysisItem
  informationDesign: SuperAnalysisItem
  textVisibility: SuperAnalysisItem
  cvrBlockers: SuperAnalysisItem
}

interface SuperReviewsAnalysis {
  negativeVisibility: SuperAnalysisItem
  negativeSeverity: SuperAnalysisItem
  anxietyResolution: SuperAnalysisItem
}

interface SuperAplusBrandAnalysis {
  structureDesign: SuperAnalysisItem
  benefitAppeal: SuperAnalysisItem
  worldviewConsistency: SuperAnalysisItem
  visualDesign: SuperAnalysisItem
  comparisonAnxiety: SuperAnalysisItem
}

interface SuperAnalyses {
  mainImage: SuperMainImageAnalysis
  title: SuperTitleAnalysis
  subImages: SuperSubImagesAnalysis
  reviews: SuperReviewsAnalysis
  aplusBrand: SuperAplusBrandAnalysis
}

interface SuperBreakdown {
  mainImage: { score: number; max: 20; label: string }
  title: { score: number; max: 10; label: string }
  subImages: { score: number; max: 30; label: string }
  reviews: { score: number; max: 10; label: string }
  aplusBrand: { score: number; max: 30; label: string }
}

// API Response Types (既存)
interface SectionScore {
  score: number
  max: number
}

interface ScoreResult {
  scoreTotal: number
  sections: {
    title?: SectionScore
    mainImage: SectionScore
    subImages: SectionScore
    description: SectionScore
    reviews: SectionScore
    aplus: SectionScore
    brandContent?: SectionScore
  }
  notes: string[]
  missingSignals?: string[]
}

interface ImprovementPlan {
  current_total_score: number
  estimated_total_score_after: number
  score_gap: number
  priority_actions: Array<{
    priority: "P0" | "P1" | "P2"
    category: "score" | "super" | "both"
    action: string
    estimated_score_increase: number
    estimated_super_increase: number
    why: string
    implementation_hint?: string
  }>
  secondary_actions: Array<{
    priority: "P1"
    category: "score" | "super" | "both"
    action: string
    estimated_score_increase: number
    estimated_super_increase: number
    why: string
    implementation_hint?: string
  }>
  quick_wins: Array<{
    priority: "P2"
    category: "score" | "super" | "both"
    action: string
    estimated_score_increase: number
    estimated_super_increase: number
    why: string
    implementation_hint?: string
  }>
}

interface HistoryItem {
  id: string
  asin: string
  scoreTotal: number
  timestamp: Date
  result: ScoreResult
  url?: string
}

// V0 UI Types
interface V0ScoreResult {
  score: {
    total: number
    breakdown: {
      title: { score: number; max: number }
      mainImage: { score: number; max: number }
      subImages: { score: number; max: number }
      description: { score: number; max: number }
      reviews: { score: number; max: number }
      aplusBrand: { score: number; max: number }
    }
  }
  super?: {
    total: number
    breakdown: SuperBreakdown
    analyses: SuperAnalyses
  }
  totalScore: number
  maxScore: number
  sectionDetails?: SectionDetails
  grade: string
  timestamp: string
}

interface IntegratedSectionScore {
  label: string
  icon: React.ReactNode
  score: {
    value: number
    max: number
    details: ScoreDetail[]
  }
  super?: {
    value: number
    max: number
    analyses: Record<string, SuperAnalysisItem>
  }
  total: number
  totalMax: number
}

interface ImprovementItem {
  title: string
  points: number
  section: string
}

interface ImprovementResult {
  currentScore: number
  maxScore: number
  expectedScore: number
  expectedGain: number
  priority: ImprovementItem[]
  optional: ImprovementItem[]
}

type AnalysisMode = "score" | "super"

const modeConfig = {
  score: { label: "Score", description: "ルールベース", maxScore: 100, icon: Zap },
  super: { label: "Super", description: "LLM+Vision", maxScore: 200, icon: Sparkles },
}

const getGradeLabel = (grade: string) => {
  switch (grade) {
    case "Excellent":
      return "優秀"
    case "Good":
      return "良好"
    case "Poor":
      return "要改善"
    default:
      return grade
  }
}

const getGradeColor = (grade: string) => {
  if (grade === "Excellent") return "text-emerald-400"
  if (grade === "Good") return "text-amber-400"
  return "text-rose-400"
}

const getScoreColor = (score: number, max: number) => {
  const pct = (score / max) * 100
  if (pct >= 80) return "text-emerald-400"
  if (pct >= 60) return "text-amber-400"
  return "text-rose-400"
}

const getScoreBgColor = (score: number, max: number) => {
  const pct = (score / max) * 100
  if (pct >= 80) return "bg-emerald-500/10 border-emerald-500/20"
  if (pct >= 60) return "bg-amber-500/10 border-amber-500/20"
  return "bg-rose-500/10 border-rose-500/20"
}

// Helper functions
function extractAsinFromUrl(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i)
  return match ? match[1].toUpperCase() : null
}

// Score詳細項目を構築するヘルパー関数
function buildScoreDetails(breakdown: any, signals?: any): SectionDetails {
  const details: SectionDetails = {
    title: [],
    mainImage: [],
    subImages: [],
    description: [],
    reviews: [],
    aplusBrand: [],
  }

  // タイトル（10点）
  const titleScore = breakdown.title?.score || 0
  const titleBreakdown = breakdown.title as any
  const keywordCount = titleBreakdown?.keywordCount ?? 0
  const keywordMin = titleBreakdown?.keywordMin ?? 7
  const passed = titleBreakdown?.passed ?? false
  
  // キーワード数表示：keywordCountが存在する場合はそれを表示、ない場合は従来の表示
  if (keywordCount !== undefined) {
    details.title.push({ 
      item: `キーワード数: ${keywordCount}/${keywordMin}`, 
      points: 10, 
      achieved: passed 
    })
  } else {
    // 後方互換性：keywordCountがない場合は従来の表示
    if (titleScore >= 10) {
      details.title.push({ item: "SEOキーワードが7語以上", points: 10, achieved: true })
    } else {
      details.title.push({ item: "SEOキーワードが7語以上", points: 10, achieved: false })
    }
  }

  // メイン画像（10点）
  const mainImageScore = breakdown.mainImage?.score || 0
  const mainImageMax = breakdown.mainImage?.max || 10
  if (mainImageMax === 10) {
    details.mainImage.push({ item: "正方形かつ1500×1500以上", points: 5, achieved: mainImageScore >= 5 })
    details.mainImage.push({ item: "背景が白", points: 5, achieved: mainImageScore >= 10 })
  }

  // サブ画像（20点）
  const subImagesScore = breakdown.subImages?.score || 0
  const subImagesMax = breakdown.subImages?.max || 20
  if (subImagesMax === 20) {
    details.subImages.push({ item: "サブ画像6枚以上", points: 10, achieved: subImagesScore >= 10 })
    details.subImages.push({ item: "各画像1500×1500以上", points: 5, achieved: subImagesScore >= 15 })
    details.subImages.push({ item: "動画あり", points: 5, achieved: subImagesScore >= 20 })
  }

  // 説明（5点）
  const descriptionScore = breakdown.description?.score || 0
  details.description.push({ item: "箇条書き5行以上", points: 5, achieved: descriptionScore >= 5 })

  // レビュー（25点）
  const reviewsScore = breakdown.reviews?.score || 0
  const reviewsMax = breakdown.reviews?.max || 25
  if (reviewsMax === 25) {
    details.reviews.push({ item: "星4.0以上", points: 5, achieved: reviewsScore >= 5 })
    details.reviews.push({ item: "星4.3以上", points: 5, achieved: reviewsScore >= 10 })
    details.reviews.push({ item: "レビュー30件以上", points: 5, achieved: reviewsScore >= 15 })
    details.reviews.push({ item: "レビュー100件以上", points: 5, achieved: reviewsScore >= 20 })
    details.reviews.push({ item: "レビュー1000件以上", points: 5, achieved: reviewsScore >= 25 })
  }

  // A+・ブランド（20点）
  const aplusBrandScore = breakdown.aplusBrand?.score || breakdown.aplus?.score || 0
  const aplusBrandMax = breakdown.aplusBrand?.max || breakdown.aplus?.max || 20
  if (aplusBrandMax === 20) {
    details.aplusBrand.push({ item: "A+導入", points: 5, achieved: aplusBrandScore >= 5 })
    details.aplusBrand.push({ item: "Premium A+導入", points: 5, achieved: aplusBrandScore >= 10 })
    details.aplusBrand.push({ item: "モジュール5つ以上", points: 5, achieved: aplusBrandScore >= 15 })
    details.aplusBrand.push({ item: "ブランドストーリー導入", points: 5, achieved: aplusBrandScore >= 20 })
  }

  return details
}

// API Response Converter: 既存のAPIレスポンスをV0形式に変換
function convertApiResponseToV0Format(apiData: any, mode: AnalysisMode): V0ScoreResult | null {
  console.log("[FITPEAK][UI] convertApiResponseToV0Format called, apiData:", JSON.stringify(apiData, null, 2))
  console.log("[FITPEAK][UI] apiData keys:", apiData ? Object.keys(apiData) : "null")
  
  if (!apiData) {
    console.warn("[FITPEAK][UI] apiData is null or undefined")
    return null
  }
  
  // apiDataがresultプロパティを持っている場合、それを展開
  if (apiData.result && typeof apiData.result === 'object') {
    console.log("[FITPEAK][UI] apiData has result property, using it")
    apiData = apiData.result
  }
  
  // 条件チェックを修正（apiData.score または apiData.result または apiData.sections があるか）
  if (!apiData.result && !apiData.score && !apiData.sections) {
    console.warn("[FITPEAK][UI] apiData does not have result, score, or sections")
    return null
  }
  
  // score-extension API レスポンスの場合（apiData.score が直接ある場合、かつ super がない場合）
  if (apiData.score && apiData.score.scoreTotal !== undefined && !apiData.super) {
    const scoreData = apiData.score
    const scoreBreakdown = scoreData.breakdown || {}
    const totalScore = scoreData.scoreTotal || 0
    const maxScore = 100

    console.log("[FITPEAK][UI] Processing score-extension response (direct score), totalScore:", totalScore, "breakdown:", Object.keys(scoreBreakdown))

    const sectionDetails = buildScoreDetails(scoreBreakdown)

    const grade = totalScore >= maxScore * 0.8 ? "Excellent" : totalScore >= maxScore * 0.6 ? "Good" : "Poor"

    return {
      score: {
        total: totalScore,
        breakdown: {
          title: scoreBreakdown.title || { score: 0, max: 10 },
          mainImage: scoreBreakdown.mainImage || { score: 0, max: 10 },
          subImages: scoreBreakdown.subImages || { score: 0, max: 20 },
          description: scoreBreakdown.description || { score: 0, max: 5 },
          reviews: scoreBreakdown.reviews || { score: 0, max: 25 },
          aplusBrand: scoreBreakdown.aplusBrand || scoreBreakdown.aplus || { score: 0, max: 20 },
        },
      },
      super: undefined,
      totalScore,
      maxScore,
      sectionDetails,
      grade,
      timestamp: new Date().toISOString(),
    }
  }

  // super-extension API レスポンスの場合
  if (apiData.score && apiData.super) {
    const scoreBreakdown = apiData.score.breakdown || {}
    const superBreakdownRaw = apiData.super.breakdown || {}
    const superAnalyses = apiData.super.analyses || {}

    // Super APIのレスポンスでは、breakdownが数値のオブジェクト（{ main_image: 13, title: 0, ... }）なので、
    // それを{ score, max, label }形式に変換する
    const superBreakdown: SuperBreakdown = {
      mainImage: {
        score: superBreakdownRaw.main_image || 0,
        max: 20,
        label: "メイン画像",
      },
      title: {
        score: superBreakdownRaw.title || 0,
        max: 10,
        label: "タイトル",
      },
      subImages: {
        score: superBreakdownRaw.sub_images || 0,
        max: 30,
        label: "サブ画像",
      },
      reviews: {
        score: superBreakdownRaw.reviews || 0,
        max: 10,
        label: "レビュー",
      },
      aplusBrand: {
        score: superBreakdownRaw.aplus_brand || 0,
        max: 30,
        label: "A+・ブランド",
      },
    }

    const totalScore = apiData.totalScore || (apiData.score.scoreTotal || 0) + (apiData.super.total || 0)
    const maxScore = mode === "super" ? 200 : 100

    console.log("[FITPEAK][UI] Processing super-extension response, totalScore:", totalScore, "superBreakdown:", superBreakdown)
    console.log("[FITPEAK][UI] superAnalyses keys:", Object.keys(superAnalyses))
    console.log("[FITPEAK][UI] superAnalyses sample:", {
      main_image: superAnalyses.main_image ? Object.keys(superAnalyses.main_image) : "not found",
      title: superAnalyses.title ? Object.keys(superAnalyses.title) : "not found",
      sub_images: superAnalyses.sub_images ? Object.keys(superAnalyses.sub_images) : "not found",
      reviews: superAnalyses.reviews ? Object.keys(superAnalyses.reviews) : "not found",
      aplus_brand: superAnalyses.aplus_brand ? Object.keys(superAnalyses.aplus_brand) : "not found",
    })
    console.log("[FITPEAK][UI] superAnalyses.title:", superAnalyses.title)

    // SectionDetails を構築
    const sectionDetails = buildScoreDetails(scoreBreakdown)

    const grade = totalScore >= maxScore * 0.8 ? "Excellent" : totalScore >= maxScore * 0.6 ? "Good" : "Poor"

    const result = {
      score: {
        total: apiData.score.scoreTotal || 0,
        breakdown: {
          title: scoreBreakdown.title || { score: 0, max: 10 },
          mainImage: scoreBreakdown.mainImage || { score: 0, max: 10 },
          subImages: scoreBreakdown.subImages || { score: 0, max: 20 },
          description: scoreBreakdown.description || { score: 0, max: 5 },
          reviews: scoreBreakdown.reviews || { score: 0, max: 25 },
          aplusBrand: scoreBreakdown.aplusBrand || scoreBreakdown.aplus || { score: 0, max: 20 },
        },
      },
      super: mode === "super" ? {
        total: apiData.super.total || 0,
        breakdown: superBreakdown,
        analyses: superAnalyses as any, // スネークケースのキー名を保持
      } : undefined,
      totalScore,
      maxScore,
      sectionDetails,
      grade,
      timestamp: new Date().toISOString(),
    }
    
    console.log("[FITPEAK][UI] Converted result, super.analyses keys:", result.super?.analyses ? Object.keys(result.super.analyses) : "no super")
    
    return result
  }

  // score-extension API レスポンスの場合（Scoreのみ）
  // apiData.result または apiData.sections がある場合
  if (apiData.result || apiData.sections) {
    const result = apiData.result || apiData
    const scoreBreakdown = result.sections || {}
    const totalScore = result.scoreTotal || 0
    const maxScore = 100

    console.log("[FITPEAK][UI] Processing score-extension response, totalScore:", totalScore, "sections:", Object.keys(scoreBreakdown))

    const sectionDetails = buildScoreDetails(scoreBreakdown)

    const grade = totalScore >= maxScore * 0.8 ? "Excellent" : totalScore >= maxScore * 0.6 ? "Good" : "Poor"

    return {
      score: {
        total: totalScore,
        breakdown: {
          title: scoreBreakdown.title || { score: 0, max: 10 },
          mainImage: scoreBreakdown.mainImage || { score: 0, max: 10 },
          subImages: scoreBreakdown.subImages || { score: 0, max: 20 },
          description: scoreBreakdown.description || { score: 0, max: 5 },
          reviews: scoreBreakdown.reviews || { score: 0, max: 25 },
          aplusBrand: scoreBreakdown.aplusBrand || scoreBreakdown.aplus || { score: 0, max: 20 },
        },
      },
      super: undefined,
      totalScore,
      maxScore,
      sectionDetails,
      grade,
      timestamp: new Date().toISOString(),
    }
  }

  console.warn("[FITPEAK][UI] No matching response format found")
  return null
}

// V0 UI Components
function IntegratedScoreCard({
  section,
  isSuper,
  expandedSection,
  onToggle,
  detailsPanel,
  getScoreColor,
}: {
  section: IntegratedSectionScore
  isSuper: boolean
  expandedSection: string | null
  onToggle: (section: string) => void
  detailsPanel: React.ReactNode
  getScoreColor: (score: number, max: number) => string
}) {
  const isExpanded = expandedSection === section.label
  const percentage = (section.total / section.totalMax) * 100

  const getColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-400"
    if (pct >= 60) return "text-amber-400"
    return "text-rose-400"
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex flex-col items-center gap-1 p-2 rounded-md bg-background/50 border min-w-[80px] transition-all",
          isExpanded ? "border-primary/50 ring-1 ring-primary/20" : "border-border/30"
        )}
      >
        <div className="flex items-center gap-1 text-muted-foreground">
          {section.icon}
          <span className="text-[10px] font-medium truncate max-w-[60px]">{section.label}</span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className={cn("text-sm font-bold", getColor(percentage))}>{section.total}</span>
          <span className="text-[10px] text-muted-foreground">/ {section.totalMax}</span>
        </div>
        {isSuper && section.super && (
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Zap className="h-2.5 w-2.5" />
              {section.score.value}
            </span>
            <span>+</span>
            <span className="flex items-center gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              {section.super.value}
            </span>
          </div>
        )}
        <button
          onClick={() => onToggle(section.label)}
          className={cn(
            "mt-1 px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
            isExpanded
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {isExpanded ? "詳細を閉じる" : "詳細を見る"}
          <ChevronDown className={cn("inline-block h-2.5 w-2.5 ml-1 transition-transform", isExpanded && "rotate-180")} />
        </button>
      </div>
      {isExpanded && detailsPanel}
    </div>
  )
}

function getSuperItemLabel(sectionLabel: string, key: string): string {
  const labels: Record<string, Record<string, string>> = {
    メイン画像: {
      listVisibility: "一覧視認性",
      visualImpact: "立体感・視覚インパクト",
      instantUnderstanding: "瞬間理解性",
      cvrBlockers: "CVR阻害要因",
    },
    タイトル: {
      seoStructure: "SEO構造の最適性",
      ctrDesign: "CTR設計",
      readability: "可読性",
    },
    サブ画像: {
      benefitDesign: "ベネフィット設計",
      worldviewConsistency: "世界観・一貫性",
      informationDesign: "情報設計・導線",
      textVisibility: "文字占有率・視認性",
      cvrBlockers: "CVR阻害要因",
    },
    レビュー: {
      negativeVisibility: "ネガティブの目立ちやすさ",
      negativeSeverity: "ネガティブ内容の致命度",
      anxietyResolution: "不安解消導線",
    },
    "A+・ブランド": {
      structureDesign: "構成設計",
      benefitAppeal: "ベネフィット訴求",
      worldviewConsistency: "世界観・一貫性",
      visualDesign: "視覚設計",
      comparisonAnxiety: "比較・不安解消",
    },
  }
  return labels[sectionLabel]?.[key] || key
}

// Main Component
export function ScoreExtensionUI() {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [mode, setMode] = useState<AnalysisMode>("score")
  const [currentScore, setCurrentScore] = useState<V0ScoreResult | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [improvementStatus, setImprovementStatus] = useState<"idle" | "running" | "done">("idle")
  const [improvements, setImprovements] = useState<ImprovementResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [lastRunId, setLastRunId] = useState<string | null>(null)
  const [url, setUrl] = useState("")
  const [asin, setAsin] = useState("")
  const [activeTab, setActiveTab] = useState<"analyze" | "history">("analyze")

  // Initialize URL/ASIN from current page
  const initializeFromCurrentPage = useCallback(() => {
    if (typeof window !== "undefined") {
      const currentUrl = window.location.href
      if (currentUrl.includes("amazon")) {
        setUrl(currentUrl)
        const extracted = extractAsinFromUrl(currentUrl)
        if (extracted) setAsin(extracted)
      }
    }
  }, [])

  useEffect(() => {
    initializeFromCurrentPage()
  }, [initializeFromCurrentPage])

  // Update URL/ASIN when page changes (SPA navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      if (window.location.href.includes("amazon")) {
        initializeFromCurrentPage()
      }
    }

    const observer = new MutationObserver(handleLocationChange)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("popstate", handleLocationChange)

    return () => {
      observer.disconnect()
      window.removeEventListener("popstate", handleLocationChange)
    }
  }, [initializeFromCurrentPage])

  // Run Score API via chrome.runtime.sendMessage
  const handleRunScore = async () => {
    const targetAsin = asin || extractAsinFromUrl(url)
    if (!targetAsin) {
      setStatus("error")
      setErrorMsg("有効なASINまたはURLを入力してください")
      return
    }

    console.log("[FITPEAK][UI] run score", { asin: targetAsin, url: url || targetAsin, mode, dryRun: false })

    setStatus("running")
    setExpandedSection(null)
    setImprovements(null)
    setImprovementStatus("idle")
    setErrorMsg("")

    try {
      // Step 1: contentScriptからScore用signalsを取得
      const signalsResponse = await new Promise<{ ok: boolean; signals?: any; error?: any }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener("message", handler)
          reject(new Error("GET_SCORE_SIGNALS timeout"))
        }, 10000)

        const handler = (event: MessageEvent) => {
          if (event.data && event.data.type === "GET_SCORE_SIGNALS_RESPONSE") {
            clearTimeout(timeout)
            window.removeEventListener("message", handler)
            if (event.data.ok) {
              console.log("[FITPEAK][UI] signals received:", event.data.signals)
              resolve(event.data)
            } else {
              const errorMsg = event.data.error?.message || event.data.error || "Failed to get score signals"
              reject(new Error(errorMsg))
            }
          }
        }

        window.addEventListener("message", handler)
        window.postMessage({ type: "GET_SCORE_SIGNALS" }, "*")
      })

      if (!signalsResponse.ok || !signalsResponse.signals) {
        throw new Error(signalsResponse.error?.message || signalsResponse.error || "Failed to get score signals")
      }

      const signals = signalsResponse.signals

      // API側の期待する形式に変換
      const payload: any = {
        asin: targetAsin,
        url: url || signals.url || targetAsin,
      }

      if (signals.images) {
        payload.images = {
          ...(signals.images.main && { main: signals.images.main }),
          ...(signals.images.subs && signals.images.subs.length > 0 && { subs: signals.images.subs }),
          // hasVideoは必ず含める（falseでも明示的に送信）
          hasVideo: signals.images.hasVideo ?? false,
        }
      }

      if (signals.bullets && signals.bullets.length > 0) {
        payload.bullets = signals.bullets
      }

      if (signals.reviews) {
        payload.reviews = {
          ...(signals.reviews.rating !== undefined && signals.reviews.rating !== null && {
            rating: signals.reviews.rating,
            averageRating: signals.reviews.rating,
          }),
          ...(signals.reviews.count !== undefined && signals.reviews.count !== null && {
            count: signals.reviews.count,
            totalCount: signals.reviews.count,
          }),
        }
        if (signals.reviews.rating !== undefined && signals.reviews.rating !== null) {
          payload.rating = signals.reviews.rating
        }
        if (signals.reviews.count !== undefined && signals.reviews.count !== null) {
          payload.reviewCount = signals.reviews.count
        }
      }

      if (signals.aplus) {
        payload.aplus = {
          hasAPlus: signals.aplus.hasAplus,
          ...(signals.aplus.moduleCount !== undefined && { moduleCount: signals.aplus.moduleCount }),
          ...(signals.aplus.isPremium !== undefined && { isPremium: signals.aplus.isPremium }),
        }
      }

      if (signals.brandContent !== undefined) {
        payload.brandContent = signals.brandContent
        payload.brand = {
          hasBrandStory: signals.brandContent,
        }
      }

      // Step 2: background経由でAPIを呼び出し（modeに応じてsuper-extensionまたはscore-extension）
      const apiEndpoint = mode === "super" ? "RUN_SUPER" : "RUN_SCORE"
      console.log("[FITPEAK][UI] Sending message to background:", { type: apiEndpoint, dryRun: false, payloadKeys: Object.keys(payload) })
      
      const apiResponse = await new Promise<{ ok: boolean; result?: any; error?: string; message?: string; details?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: apiEndpoint,
            payload: payload,
            dryRun: false,
          },
          (response) => {
            console.log("[FITPEAK][UI] Background response received:", response)
            
            if (chrome.runtime.lastError) {
              console.error("[FITPEAK][UI] chrome.runtime.lastError:", chrome.runtime.lastError)
              console.error("[FITPEAK][UI] chrome.runtime.lastError details:", {
                message: chrome.runtime.lastError.message,
                fullError: chrome.runtime.lastError
              })
              reject(new Error(`Chrome Extension Error: ${chrome.runtime.lastError.message}`))
              return
            }
            
            if (!response) {
              console.error("[FITPEAK][UI] No response from background")
              reject(new Error("Background script did not respond. Check background script logs."))
              return
            }
            
            if (response.ok) {
              console.log("[FITPEAK][UI] API response ok, result:", response.result)
              resolve(response)
            } else {
              console.error("[FITPEAK][UI] API response error:", response)
              const errorMsg = response.error || response.message || "API returned error"
              const details = response.details ? `\n詳細: ${response.details}` : ""
              console.error("[FITPEAK][UI] Error details:", {
                error: response.error,
                message: response.message,
                details: response.details,
                fullResponse: response
              })
              reject(new Error(`${errorMsg}${details}`))
            }
          }
        )
      })

      if (!apiResponse.ok) {
        throw new Error(apiResponse.error || "API returned error")
      }

      const apiData = apiResponse.result
      console.log("[FITPEAK][UI] api data:", apiData)
      console.log("[FITPEAK][UI] api data type:", typeof apiData)
      console.log("[FITPEAK][UI] api data keys:", apiData ? Object.keys(apiData) : "null")

      // V0形式に変換
      const v0Result = convertApiResponseToV0Format(apiData, mode)
      if (!v0Result) {
        console.error("[FITPEAK][UI] Failed to convert API response, apiData:", JSON.stringify(apiData, null, 2))
        throw new Error(`APIレスポンスの変換に失敗しました。レスポンス構造: ${JSON.stringify(apiData, null, 2)}`)
      }

      setCurrentScore(v0Result)

      // Add to history
      const runId = apiData.runId || `run-${Date.now()}`
      const newHistoryItem: HistoryItem = {
        id: runId,
        asin: targetAsin,
        scoreTotal: v0Result.totalScore,
        timestamp: new Date(),
        result: apiData.result || apiData.score,
        url: url || targetAsin,
      }
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 9)])
      setLastRunId(runId)
      setImprovements(null)

      setStatus("success")
    } catch (error: any) {
      console.error("[FITPEAK][UI] Error:", error)
      setStatus("error")
      setErrorMsg(`${error.message || "エラーが発生しました"}\n${error.stack || ""}`)
    }
  }

  const handleDryRun = async () => {
    const targetAsin = asin || extractAsinFromUrl(url)
    if (!targetAsin) {
      setStatus("error")
      setErrorMsg("有効なASINまたはURLを入力してください")
      return
    }

    console.log("[FITPEAK][UI] dry run", { asin: targetAsin, url: url || targetAsin, mode, dryRun: true })

    setStatus("running")
    setExpandedSection(null)
    setImprovements(null)
    setImprovementStatus("idle")
    setErrorMsg("")

    try {
      // Step 1: contentScriptからScore用signalsを取得
      const signalsResponse = await new Promise<{ ok: boolean; signals?: any; error?: any }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener("message", handler)
          reject(new Error("GET_SCORE_SIGNALS timeout"))
        }, 10000)

        const handler = (event: MessageEvent) => {
          if (event.data && event.data.type === "GET_SCORE_SIGNALS_RESPONSE") {
            clearTimeout(timeout)
            window.removeEventListener("message", handler)
            if (event.data.ok) {
              console.log("[FITPEAK][UI] signals received:", event.data.signals)
              resolve(event.data)
            } else {
              const errorMsg = event.data.error?.message || event.data.error || "Failed to get score signals"
              reject(new Error(errorMsg))
            }
          }
        }

        window.addEventListener("message", handler)
        window.postMessage({ type: "GET_SCORE_SIGNALS" }, "*")
      })

      if (!signalsResponse.ok || !signalsResponse.signals) {
        throw new Error(signalsResponse.error?.message || signalsResponse.error || "Failed to get score signals")
      }

      const signals = signalsResponse.signals

      // API側の期待する形式に変換
      const payload: any = {
        asin: targetAsin,
        url: url || signals.url || targetAsin,
        ...(signals.title && { title: signals.title }), // タイトルを追加
      }

      if (signals.images) {
        payload.images = {
          ...(signals.images.main && { main: signals.images.main }),
          ...(signals.images.subs && signals.images.subs.length > 0 && { subs: signals.images.subs }),
          // hasVideoは必ず含める（falseでも明示的に送信）
          hasVideo: signals.images.hasVideo ?? false,
        }
      }

      if (signals.bullets && signals.bullets.length > 0) {
        payload.bullets = signals.bullets
      }

      if (signals.reviews) {
        payload.reviews = {
          ...(signals.reviews.rating !== undefined && signals.reviews.rating !== null && {
            rating: signals.reviews.rating,
            averageRating: signals.reviews.rating,
          }),
          ...(signals.reviews.count !== undefined && signals.reviews.count !== null && {
            count: signals.reviews.count,
            totalCount: signals.reviews.count,
          }),
        }
        if (signals.reviews.rating !== undefined && signals.reviews.rating !== null) {
          payload.rating = signals.reviews.rating
        }
        if (signals.reviews.count !== undefined && signals.reviews.count !== null) {
          payload.reviewCount = signals.reviews.count
        }
      }

      if (signals.aplus) {
        payload.aplus = {
          hasAPlus: signals.aplus.hasAplus,
          ...(signals.aplus.moduleCount !== undefined && { moduleCount: signals.aplus.moduleCount }),
          ...(signals.aplus.isPremium !== undefined && { isPremium: signals.aplus.isPremium }),
        }
      }

      if (signals.brandContent !== undefined) {
        payload.brandContent = signals.brandContent
        payload.brand = {
          hasBrandStory: signals.brandContent,
        }
      }

      // Step 2: background経由でAPIを呼び出し（dryRun: true）
      const apiEndpoint = mode === "super" ? "RUN_SUPER" : "RUN_SCORE"
      console.log("[FITPEAK][UI] Sending message to background (dry run):", { type: apiEndpoint, dryRun: true, payloadKeys: Object.keys(payload) })
      
      const apiResponse = await new Promise<{ ok: boolean; result?: any; error?: string; message?: string; details?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: apiEndpoint,
            payload: payload,
            dryRun: true, // dryRunフラグをtrueに設定
          },
          (response) => {
            console.log("[FITPEAK][UI] Background response received (dry run):", response)
            
            if (chrome.runtime.lastError) {
              console.error("[FITPEAK][UI] chrome.runtime.lastError (dry run):", chrome.runtime.lastError)
              console.error("[FITPEAK][UI] chrome.runtime.lastError details (dry run):", {
                message: chrome.runtime.lastError.message,
                fullError: chrome.runtime.lastError
              })
              reject(new Error(`Chrome Extension Error: ${chrome.runtime.lastError.message}`))
              return
            }
            
            if (!response) {
              console.error("[FITPEAK][UI] No response from background (dry run)")
              reject(new Error("Background script did not respond. Check background script logs."))
              return
            }
            
            if (response.ok) {
              console.log("[FITPEAK][UI] API response ok (dry run), result:", response.result)
              resolve(response)
            } else {
              console.error("[FITPEAK][UI] API response error (dry run):", response)
              const errorMsg = response.error || response.message || "API returned error"
              const details = response.details ? `\n詳細: ${response.details}` : ""
              console.error("[FITPEAK][UI] Error details (dry run):", {
                error: response.error,
                message: response.message,
                details: response.details,
                fullResponse: response
              })
              reject(new Error(`${errorMsg}${details}`))
            }
          }
        )
      })

      if (!apiResponse.ok) {
        throw new Error(apiResponse.error || "API returned error")
      }

      const apiData = apiResponse.result
      console.log("[FITPEAK][UI] api data (dry run):", apiData)
      console.log("[FITPEAK][UI] api data type (dry run):", typeof apiData)
      console.log("[FITPEAK][UI] api data keys (dry run):", apiData ? Object.keys(apiData) : "null")

      // V0形式に変換
      const v0Result = convertApiResponseToV0Format(apiData, mode)
      if (!v0Result) {
        console.error("[FITPEAK][UI] Failed to convert API response (dry run), apiData:", JSON.stringify(apiData, null, 2))
        throw new Error(`APIレスポンスの変換に失敗しました（テスト実行）。レスポンス構造: ${JSON.stringify(apiData, null, 2)}`)
      }

      setCurrentScore(v0Result)

      // Add to history (dry runも履歴に追加)
      const runId = apiData.runId || `run-dry-${Date.now()}`
      const newHistoryItem: HistoryItem = {
        id: runId,
        asin: targetAsin,
        scoreTotal: v0Result.totalScore,
        timestamp: new Date(),
        result: apiData.result || apiData.score,
        url: url || targetAsin,
      }
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 9)])
      setLastRunId(runId)
      setImprovements(null)

      setStatus("success")
    } catch (error: any) {
      console.error("[FITPEAK][UI] Error (dry run):", error)
      setStatus("error")
      setErrorMsg(`${error.message || "エラーが発生しました"}\n${error.stack || ""}`)
    }
  }

  const handleAnalyzeImprovements = async () => {
    if (!lastRunId) {
      setErrorMsg("改善計画を生成するには、まずScore分析を実行してください")
      setStatus("error")
      return
    }

    setImprovementStatus("running")
    setErrorMsg("")

    try {
      const apiResponse = await new Promise<{ ok: boolean; improvement_plan?: ImprovementPlan; error?: string }>(
        (resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: "GENERATE_IMPROVEMENT_PLAN",
              runId: lastRunId,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else if (response && response.ok) {
                resolve(response)
              } else {
                reject(new Error(response?.error || "API returned error"))
              }
            }
          )
        }
      )

      if (!apiResponse.ok || !apiResponse.improvement_plan) {
        // エラーメッセージを詳細に表示
        const errorMessage = apiResponse.error || apiResponse.message || "改善計画の生成に失敗しました";
        throw new Error(errorMessage);
      }

      const plan = apiResponse.improvement_plan

      // V0形式に変換
      const improvementResult: ImprovementResult = {
        currentScore: plan.current_total_score,
        maxScore: 200,
        expectedScore: plan.estimated_total_score_after,
        expectedGain: plan.score_gap,
        priority: plan.priority_actions.map((a) => ({
          title: a.action,
          points: a.estimated_score_increase + a.estimated_super_increase,
          section: a.category,
        })),
        optional: [...plan.secondary_actions, ...plan.quick_wins].map((a) => ({
          title: a.action,
          points: a.estimated_score_increase + a.estimated_super_increase,
          section: a.category,
        })),
      }

      setImprovements(improvementResult)
      setImprovementStatus("done")
    } catch (error: any) {
      console.error("[FITPEAK][UI] Error generating improvement plan:", error)
      setErrorMsg(`改善計画の生成に失敗しました: ${error.message || "エラーが発生しました"}`)
      setStatus("error")
      setImprovementStatus("idle")
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const handleSelectHistory = (item: HistoryItem) => {
    const v0Result = convertApiResponseToV0Format({ result: item.result }, mode)
    if (v0Result) {
      setCurrentScore(v0Result)
    }
    setAsin(item.asin)
    setLastRunId(item.id)
    setImprovements(null)
    setActiveTab("analyze")
  }

  const getIntegratedSections = (): IntegratedSectionScore[] => {
    if (!currentScore) return []

    const isSuper = mode === "super" && currentScore.super

    // Super APIのレスポンスでは、analysesのキー名がスネークケース（main_image, sub_images, aplus_brand）なので、
    // それをキャメルケース（mainImage, subImages, aplusBrand）にマッピングする
    // また、APIレスポンスの構造（{ listVisibility: 6, visualImpact: 3, ..., why: "..." }）を
    // UIが期待する形式（{ score: number, max: number, why: string }）に変換する
    const getSuperAnalyses = (sectionKey: string) => {
      if (!isSuper || !currentScore.super) {
        console.log("[FITPEAK][UI] getSuperAnalyses: not super mode or no super data", { isSuper, hasSuper: !!currentScore.super })
        return undefined
      }
      const analyses = currentScore.super.analyses as any
      if (!analyses) {
        console.log("[FITPEAK][UI] getSuperAnalyses: no analyses", { sectionKey })
        return undefined
      }
      
      console.log("[FITPEAK][UI] getSuperAnalyses: analyses keys", { sectionKey, analysesKeys: Object.keys(analyses) })
      
      // スネークケースからキャメルケースへのマッピング
      const keyMap: Record<string, string> = {
        mainImage: "main_image",
        subImages: "sub_images",
        aplusBrand: "aplus_brand",
        title: "title",
        reviews: "reviews",
      }
      
      const snakeKey = keyMap[sectionKey] || sectionKey
      const sectionData = analyses[snakeKey] as any
      
      if (!sectionData) {
        console.log("[FITPEAK][UI] getSuperAnalyses: no section data", { sectionKey, snakeKey })
        return undefined
      }
      
      console.log("[FITPEAK][UI] getSuperAnalyses: section data", { sectionKey, snakeKey, sectionDataKeys: Object.keys(sectionData) })
      
      // セクションごとの評価項目と最大値のマッピング
      const sectionConfigs: Record<string, Record<string, { max: number; label: string }>> = {
        main_image: {
          listVisibility: { max: 8, label: "一覧視認性" },
          visualImpact: { max: 5, label: "立体感・視覚インパクト" },
          instantUnderstanding: { max: 4, label: "瞬間理解性" },
          cvrBlockers: { max: 3, label: "CVR阻害要因の有無" },
        },
        title: {
          seoStructure: { max: 4, label: "SEO構造の最適性" },
          ctrDesign: { max: 4, label: "CTR設計" },
          readability: { max: 2, label: "可読性" },
        },
        sub_images: {
          benefitDesign: { max: 10, label: "ベネフィット設計" },
          worldView: { max: 5, label: "世界観・一貫性" }, // APIレスポンスではworldView
          worldviewConsistency: { max: 5, label: "世界観・一貫性" }, // 後方互換性のため両方対応
          informationDesign: { max: 5, label: "情報設計・導線" },
          textVisibility: { max: 5, label: "文字占有率・視認性" },
          cvrBlockers: { max: 5, label: "CVR阻害要因" },
        },
        reviews: {
          negativeVisibility: { max: 4, label: "ネガティブレビューの目立ちやすさ" },
          negativeSeverity: { max: 3, label: "ネガティブ内容の致命度" },
          reassurancePath: { max: 3, label: "不安解消導線の有無" }, // APIレスポンスではreassurancePath
          anxietyResolution: { max: 3, label: "不安解消導線の有無" }, // 後方互換性のため両方対応
        },
        aplus_brand: {
          compositionDesign: { max: 8, label: "構成設計（迷わせない）" }, // APIレスポンスではcompositionDesign
          structureDesign: { max: 8, label: "構成設計（迷わせない）" }, // 後方互換性のため両方対応
          benefitAppeal: { max: 8, label: "ベネフィット訴求" },
          worldView: { max: 6, label: "世界観が統一されているか" }, // APIレスポンスではworldView
          worldviewConsistency: { max: 6, label: "世界観が統一されているか" }, // 後方互換性のため両方対応
          visualDesign: { max: 5, label: "視覚設計（文字量・見やすさ）" },
          comparisonReassurance: { max: 3, label: "比較・不安解消" }, // APIレスポンスではcomparisonReassurance
          comparisonAnxiety: { max: 3, label: "比較・不安解消" }, // 後方互換性のため両方対応
        },
      }
      
      const config = sectionConfigs[snakeKey]
      if (!config) {
        console.warn("[FITPEAK][UI] getSuperAnalyses: unknown section", { sectionKey, snakeKey })
        return undefined
      }
      
      // APIレスポンスの各評価項目をSuperAnalysisItem形式に変換
      const result: Record<string, SuperAnalysisItem> = {}
      
      // 各項目に特化した短い説明を生成する関数（50文字以内）
      const generateItemWhy = (itemKey: string, itemScore: number, itemMax: number, label: string): string => {
        // 項目名に基づいて簡潔な説明を生成
        const scoreRatio = itemScore / itemMax
        
        // 項目ごとの基本説明
        const itemDescriptions: Record<string, string> = {
          benefitDesign: "ベネフィットが明確に伝わるか",
          worldView: "世界観が統一されているか",
          informationDesign: "情報の順序・導線が適切か",
          textVisibility: "文字の視認性が適切か",
          cvrBlockers: "CVRを下げる要素がないか",
          listVisibility: "一覧で目立つか",
          visualImpact: "立体感・視覚インパクト",
          instantUnderstanding: "瞬間理解性",
          seoStructure: "SEO構造の最適性",
          ctrDesign: "CTR設計",
          readability: "可読性",
          negativeVisibility: "ネガティブレビューの目立ちやすさ",
          negativeSeverity: "ネガティブ内容の致命度",
          reassurancePath: "不安解消導線の有無",
          compositionDesign: "構成設計（迷わせない）",
          benefitAppeal: "ベネフィット訴求",
          visualDesign: "視覚設計（文字量・見やすさ）",
          comparisonReassurance: "比較・不安解消",
        }
        
        const baseDescription = itemDescriptions[itemKey] || label
        
        // スコアに基づいて簡潔な評価を追加（50文字以内に収める）
        let evaluation = ""
        if (scoreRatio >= 0.8) {
          evaluation = "優秀"
        } else if (scoreRatio >= 0.6) {
          evaluation = "良好"
        } else if (scoreRatio >= 0.4) {
          evaluation = "改善余地あり"
        } else {
          evaluation = "要改善"
        }
        
        const why = `${baseDescription}：${evaluation}`
        // 50文字を超える場合は切り詰める
        return why.length > 50 ? why.substring(0, 47) + "..." : why
      }
      
      // detailsオブジェクトから詳細情報を取得
      const details = (sectionData as any).details || {}
      
      // まず、APIレスポンスのキーを直接確認
      for (const [apiKey, score] of Object.entries(sectionData)) {
        if (apiKey === "why" || apiKey === "details") continue // whyとdetailsはスキップ
        
        // configに該当するキーを探す（完全一致またはエイリアス）
        let matchedKey: string | undefined
        let matchedLabel: string | undefined
        for (const [configKey, itemConfig] of Object.entries(config)) {
          if (configKey === apiKey) {
            matchedKey = configKey
            matchedLabel = itemConfig.label
            break
          }
        }
        
        // マッチしたキーが見つかった場合、またはconfigにないキーでも数値の場合は追加
        if (matchedKey && typeof score === "number") {
          // detailsから詳細情報を取得（キャメルケースとスネークケースの両方に対応）
          const detailKey = details[matchedKey] || details[apiKey] || {}
          result[matchedKey] = {
            score: score as number,
            max: config[matchedKey].max,
            why: generateItemWhy(matchedKey, score as number, config[matchedKey].max, matchedLabel || matchedKey),
            reason: detailKey.reason || undefined,
            improvement: detailKey.improvement || detailKey.improvement_suggestion || undefined,
          }
        } else if (typeof score === "number" && !matchedKey) {
          // configにないキーでも数値の場合は、そのまま追加（最大値は推測）
          console.warn("[FITPEAK][UI] Unknown analysis key in API response:", { sectionKey, apiKey, score })
          const detailKey = details[apiKey] || {}
          result[apiKey] = {
            score: score as number,
            max: 10, // デフォルト値
            why: generateItemWhy(apiKey, score as number, 10, apiKey),
            reason: detailKey.reason || undefined,
            improvement: detailKey.improvement || detailKey.improvement_suggestion || undefined,
          }
        }
      }
      
      // さらに、configのすべてのキーをチェックして、APIレスポンスにない場合は0点として追加
      for (const [configKey, itemConfig] of Object.entries(config)) {
        if (!(configKey in result)) {
          // APIレスポンスにない場合は、0点として追加しない（表示しない）
          // ただし、ログには出力
          console.log("[FITPEAK][UI] Analysis key not found in API response:", { sectionKey, configKey })
        }
      }
      
      console.log("[FITPEAK][UI] getSuperAnalyses: converted result", { sectionKey, snakeKey, resultKeys: Object.keys(result) })
      return result
    }

    const sections: IntegratedSectionScore[] = [
      {
        label: "タイトル",
        icon: <Type className="h-3.5 w-3.5" />,
        score: {
          value: currentScore.score.breakdown.title.score,
          max: currentScore.score.breakdown.title.max,
          details: currentScore.sectionDetails?.title || [],
        },
        super:
          isSuper && currentScore.super
            ? {
                value: currentScore.super.breakdown.title.score,
                max: currentScore.super.breakdown.title.max,
                analyses: getSuperAnalyses("title") || {},
              }
            : undefined,
        total:
          currentScore.score.breakdown.title.score + (isSuper && currentScore.super ? currentScore.super.breakdown.title.score : 0),
        totalMax: currentScore.score.breakdown.title.max + (isSuper ? 10 : 0),
      },
      {
        label: "メイン画像",
        icon: <ImageIcon className="h-3.5 w-3.5" />,
        score: {
          value: currentScore.score.breakdown.mainImage.score,
          max: currentScore.score.breakdown.mainImage.max,
          details: currentScore.sectionDetails?.mainImage || [],
        },
        super:
          isSuper && currentScore.super
            ? {
                value: currentScore.super.breakdown.mainImage.score,
                max: currentScore.super.breakdown.mainImage.max,
                analyses: getSuperAnalyses("mainImage") || {},
              }
            : undefined,
        total:
          currentScore.score.breakdown.mainImage.score +
          (isSuper && currentScore.super ? currentScore.super.breakdown.mainImage.score : 0),
        totalMax: currentScore.score.breakdown.mainImage.max + (isSuper ? 20 : 0),
      },
      {
        label: "サブ画像",
        icon: <Images className="h-3.5 w-3.5" />,
        score: {
          value: currentScore.score.breakdown.subImages.score,
          max: currentScore.score.breakdown.subImages.max,
          details: currentScore.sectionDetails?.subImages || [],
        },
        super:
          isSuper && currentScore.super
            ? {
                value: currentScore.super.breakdown.subImages.score,
                max: currentScore.super.breakdown.subImages.max,
                analyses: getSuperAnalyses("subImages") || {},
              }
            : undefined,
        total:
          currentScore.score.breakdown.subImages.score +
          (isSuper && currentScore.super ? currentScore.super.breakdown.subImages.score : 0),
        totalMax: currentScore.score.breakdown.subImages.max + (isSuper ? 30 : 0),
      },
      {
        label: "説明",
        icon: <FileText className="h-3.5 w-3.5" />,
        score: {
          value: currentScore.score.breakdown.description.score,
          max: currentScore.score.breakdown.description.max,
          details: currentScore.sectionDetails?.description || [],
        },
        total: currentScore.score.breakdown.description.score,
        totalMax: currentScore.score.breakdown.description.max,
      },
      {
        label: "レビュー",
        icon: <Star className="h-3.5 w-3.5" />,
        score: {
          value: currentScore.score.breakdown.reviews.score,
          max: currentScore.score.breakdown.reviews.max,
          details: currentScore.sectionDetails?.reviews || [],
        },
        super:
          isSuper && currentScore.super
            ? {
                value: currentScore.super.breakdown.reviews.score,
                max: currentScore.super.breakdown.reviews.max,
                analyses: getSuperAnalyses("reviews") || {},
              }
            : undefined,
        total:
          currentScore.score.breakdown.reviews.score +
          (isSuper && currentScore.super ? currentScore.super.breakdown.reviews.score : 0),
        totalMax: currentScore.score.breakdown.reviews.max + (isSuper ? 10 : 0),
      },
      {
        label: "A+・ブランド",
        icon: <Award className="h-3.5 w-3.5" />,
        score: {
          value: currentScore.score.breakdown.aplusBrand.score,
          max: currentScore.score.breakdown.aplusBrand.max,
          details: currentScore.sectionDetails?.aplusBrand || [],
        },
        super:
          isSuper && currentScore.super
            ? {
                value: currentScore.super.breakdown.aplusBrand.score,
                max: currentScore.super.breakdown.aplusBrand.max,
                analyses: getSuperAnalyses("aplusBrand") || {},
              }
            : undefined,
        total:
          currentScore.score.breakdown.aplusBrand.score +
          (isSuper && currentScore.super ? currentScore.super.breakdown.aplusBrand.score : 0),
        totalMax: currentScore.score.breakdown.aplusBrand.max + (isSuper ? 30 : 0),
      },
    ]

    return sections
  }

  const getIntegratedDetails = (section: IntegratedSectionScore) => {
    return (
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-80 p-3 rounded-lg bg-popover border border-border shadow-xl">
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>Score（ルールベース）</span>
            <span className="ml-auto">
              {section.score.value}/{section.score.max}
            </span>
          </div>
          <div className="space-y-1.5">
            {section.score.details.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                {detail.achieved ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <X className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span className={detail.achieved ? "text-foreground" : "text-muted-foreground"}>{detail.item}</span>
                <span className="ml-auto text-muted-foreground">{detail.points}点</span>
              </div>
            ))}
          </div>
        </div>

        {section.super && (
          <>
            <div className="border-t border-border/50 my-3" />
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>Super（LLM+Vision）</span>
                <span className="ml-auto">
                  {section.super.value}/{section.super.max}
                </span>
              </div>
              <div className="space-y-2.5">
                {section.super.analyses && Object.keys(section.super.analyses).length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(section.super.analyses).map(([key, item]) => {
                      console.log("[FITPEAK][UI] Rendering super analysis item", { 
                        sectionLabel: section.label, 
                        key, 
                        item,
                        hasScore: item.score !== undefined,
                        hasMax: item.max !== undefined,
                        hasWhy: !!item.why,
                        hasReason: !!item.reason,
                        hasImprovement: !!item.improvement,
                      })
                      if (!item || typeof item !== 'object' || !('score' in item)) {
                        console.warn("[FITPEAK][UI] Invalid super analysis item:", { key, item })
                        return null
                      }
                      
                      const scoreRatio = item.score / item.max
                      const isLowScore = scoreRatio < 0.6 // 60%未満は低スコアとして扱う
                      
                      return (
                        <AccordionItem key={key} value={key} className="border-none">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center justify-between w-full text-xs pr-2">
                              <span className="font-medium text-foreground">{getSuperItemLabel(section.label, key)}</span>
                              <span className={cn(getScoreColor(item.score, item.max), "ml-auto mr-2")}>
                                {item.score}/{item.max}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-3">
                            <div className="space-y-2 text-[11px]">
                              {item.reason && (
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium text-muted-foreground">採点理由</span>
                                  </div>
                                  <p className={cn(
                                    "leading-relaxed pl-4",
                                    isLowScore ? "text-rose-400" : "text-foreground"
                                  )}>
                                    {item.reason}
                                  </p>
                                </div>
                              )}
                              {item.improvement && item.improvement !== "なし" && item.improvement !== "特になし。" && item.improvement !== "現状維持で問題ありません。" && (
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <Lightbulb className="h-3 w-3 text-amber-400" />
                                    <span className="font-medium text-amber-400">改善案</span>
                                  </div>
                                  <p className="leading-relaxed pl-4 text-foreground">
                                    {item.improvement}
                                  </p>
                                </div>
                              )}
                              {!item.reason && item.why && (
                                <p className="text-muted-foreground leading-relaxed">{item.why}</p>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    }).filter(Boolean)}
                  </Accordion>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Super分析データがありません
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  const integratedSections = getIntegratedSections()

  return (
    <Card className="w-full bg-card border-border shadow-lg">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "analyze" | "history")}>
        <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between gap-4">
          {/* 左側: ロゴ + モード + ボタン */}
          <div className="flex items-center gap-4">
            <AznoryLogo size="sm" showBrand={true} showServiceName={true} />

            {/* モード切替 */}
            <div className="flex items-center bg-secondary/50 rounded-lg p-0.5">
              {(Object.keys(modeConfig) as AnalysisMode[]).map((modeKey) => {
                const config = modeConfig[modeKey]
                const Icon = config.icon
                const isSelected = mode === modeKey
                return (
                  <button
                    key={modeKey}
                    onClick={() => setMode(modeKey)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{config.label}</span>
                    <span
                      className={cn(
                        "text-[10px]",
                        isSelected ? "text-primary-foreground/70" : "text-muted-foreground/70"
                      )}
                    >
                      ({config.maxScore}点)
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 分析ボタン */}
            <Button onClick={handleRunScore} disabled={status === "running"} size="sm" className="gap-1.5">
              {status === "running" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              スコア分析
            </Button>

            {/* テスト実行ボタン */}
            <Button
              onClick={handleDryRun}
              disabled={status === "running"}
              variant="outline"
              size="sm"
              className="gap-1.5 bg-transparent"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              テスト実行
            </Button>

            {/* 閉じるボタン */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const rootHost = document.getElementById("fitpeak-score-root-host")
                if (rootHost) {
                  rootHost.style.display = "none"
                }
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 右側: タブ */}
          <div className="shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="analyze" className="text-xs px-3">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                分析
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs px-3">
                <History className="h-3.5 w-3.5 mr-1.5" />
                履歴
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        </CardHeader>

        <TabsContent value="analyze" className="mt-0">
          <div className="min-h-[120px] flex items-center gap-4">
            {!currentScore && status === "idle" && (
              <div className="flex-1 flex items-center justify-center gap-3 py-6 px-6 rounded-lg bg-muted/30 border border-border/50 h-full">
                <MousePointerClick className="h-6 w-6 text-primary shrink-0" />
                <p className="text-base text-muted-foreground">
                  「スコア分析」をクリックして商品ページを分析してください（モード: {modeConfig[mode].label} - {modeConfig[mode].maxScore}点満点）
                </p>
              </div>
            )}

            {status === "running" && (
              <div className="flex-1 flex items-center justify-center gap-3 py-6 px-6 rounded-lg bg-muted/30 border border-border/50 h-full">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                <p className="text-base text-muted-foreground">{modeConfig[mode].label}モードで分析中...</p>
              </div>
            )}

            {status === "error" && errorMsg && (
              <div className="flex-1 flex items-center justify-center gap-3 py-6 px-6 rounded-lg bg-destructive/10 border border-destructive/20 h-full">
                <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="text-sm font-medium text-destructive">エラーが発生しました</div>
                  <details className="text-xs text-destructive/80">
                    <summary className="cursor-pointer hover:text-destructive">詳細を表示</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[10px]">{errorMsg}</pre>
                  </details>
                </div>
              </div>
            )}

            {currentScore && status !== "running" && (
              <>
                <div
                  className={cn(
                    "flex items-center gap-6 py-4 px-6 rounded-lg border",
                    getScoreBgColor(currentScore.totalScore, currentScore.maxScore)
                  )}
                >
                  <div className="flex flex-col items-center gap-1 pr-6 border-r border-border/50 min-w-[120px]">
                    <span className="text-xs text-muted-foreground font-medium">総合スコア</span>
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-4xl font-bold", getScoreColor(currentScore.totalScore, currentScore.maxScore))}>
                        {currentScore.totalScore}
                      </span>
                      <span className="text-lg text-muted-foreground">/ {currentScore.maxScore}</span>
                    </div>
                    <span className={cn("text-sm font-medium", getGradeColor(currentScore.grade))}>
                      {getGradeLabel(currentScore.grade)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {integratedSections.map((section) => (
                      <IntegratedScoreCard
                        key={section.label}
                        section={section}
                        isSuper={mode === "super"}
                        expandedSection={expandedSection}
                        onToggle={toggleSection}
                        detailsPanel={getIntegratedDetails(section)}
                        getScoreColor={getScoreColor}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex-1 h-full">
                  {improvementStatus === "idle" && (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 px-6 rounded-lg bg-muted/30 border border-border/50 h-full min-h-[120px]">
                      <Button
                        onClick={handleAnalyzeImprovements}
                        variant="outline"
                        className="gap-2 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                      >
                        <Lightbulb className="h-4 w-4" />
                        スコア詳細・AI改善点分析
                      </Button>
                      <p className="text-xs text-muted-foreground">各セクションの点数理由とCVR/CTR/売上向上に直結する改善点を分析します</p>
                    </div>
                  )}

                  {improvementStatus === "running" && (
                    <div className="flex items-center justify-center gap-3 py-6 px-6 rounded-lg bg-muted/30 border border-border/50 h-full min-h-[120px]">
                      <RefreshCw className="h-5 w-5 text-amber-400 animate-spin" />
                      <p className="text-sm text-muted-foreground">改善点を分析中...</p>
                    </div>
                  )}

                  {improvementStatus === "done" && improvements && (
                    <div className="py-3 px-4 rounded-lg bg-gradient-to-br from-amber-500/5 to-emerald-500/5 border border-amber-500/20 h-full min-h-[120px] overflow-auto">
                      <div className="flex items-center gap-4 mb-3 pb-3 border-b border-border/30">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground">現在のスコア</span>
                          <span className="text-lg font-bold text-foreground">
                            {improvements.currentScore}
                            <span className="text-sm text-muted-foreground font-normal"> / {improvements.maxScore}</span>
                          </span>
                        </div>
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground">改善後の想定</span>
                          <span className="text-lg font-bold text-emerald-400">
                            {improvements.expectedScore}
                            <span className="text-sm text-muted-foreground font-normal"> / {improvements.maxScore}</span>
                            <span className="text-xs text-emerald-400 ml-1">(+{improvements.expectedGain})</span>
                          </span>
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-semibold text-amber-400">【最優先（今すぐやる）】</span>
                        </div>
                        <div className="space-y-1">
                          {improvements.priority.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <Check className="h-3 w-3 text-amber-400 shrink-0" />
                              <span className="text-foreground">{item.title}</span>
                              <span className="text-emerald-400 ml-auto">(+{item.points})</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-semibold text-muted-foreground">【余力があれば】</span>
                        </div>
                        <div className="space-y-1">
                          {improvements.optional.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <Check className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">{item.title}</span>
                              <span className="text-emerald-400/70 ml-auto">(+{item.points})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="py-4">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">履歴がありません</p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectHistory(item)}
                    className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-medium">{item.asin}</span>
                      <span className="text-lg font-bold">{item.scoreTotal} / {mode === "super" ? "200" : "100"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.timestamp.toLocaleString("ja-JP")}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
