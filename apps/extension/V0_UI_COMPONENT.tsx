"use client"

/**
 * Amazon Score Analyzer UI Component
 * 
 * This component is used in a Chrome Extension to analyze Amazon product pages.
 * It displays a score analyzer interface with input fields for URL/ASIN,
 * buttons to run score analysis, and displays the results.
 * 
 * Dependencies:
 * - React (useState, useCallback, useEffect)
 * - shadcn/ui components (Button, Card, Input, Label, Badge, Progress, Separator, Accordion, Sheet)
 * - lucide-react icons (BarChart3, Loader2, X, History, AlertTriangle)
 * - Tailwind CSS for styling
 * 
 * Chrome Extension Context:
 * - This component runs within a Chrome Extension content script
 * - Uses chrome.runtime.sendMessage to communicate with the background service worker
 * - Uses window.postMessage to communicate with the content script
 * - Mounted in a Shadow DOM or directly in the page DOM
 */

import { useState, useCallback, useEffect } from "react"
import { BarChart3, Loader2, X, History, AlertTriangle } from "lucide-react"

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(" ")
}

// ============================================================================
// Type Definitions
// ============================================================================

interface SectionScore {
  score: number
  max: number
}

interface ScoreResult {
  scoreTotal: number
  sections: {
    mainImage: SectionScore
    subImages: SectionScore
    description: SectionScore
    reviews: SectionScore
    aplus: SectionScore
    brandContent: SectionScore
  }
  notes: string[]
  missingSignals?: string[]
}

interface HistoryItem {
  id: string
  asin: string
  scoreTotal: number
  timestamp: Date
  result: ScoreResult
}

// ============================================================================
// UI Components (shadcn/ui style)
// ============================================================================

// Button Component
function Button({
  className,
  variant = "default",
  size = "default",
  children,
  disabled,
  onClick,
  ...props
}: {
  className?: string
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg"
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50"
  const variantStyles = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-white hover:bg-destructive/90",
  }
  const sizeStyles = {
    default: "h-9 px-4 py-2",
    sm: "h-8 px-3",
    lg: "h-10 px-6",
  }
  
  return (
    <button
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}

// Card Components
function Card({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-card text-card-foreground rounded-xl border shadow-sm", className)} {...props}>
      {children}
    </div>
  )
}

function CardHeader({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-2 px-6 pt-6", className)} {...props}>
      {children}
    </div>
  )
}

function CardTitle({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-lg font-semibold leading-none", className)} {...props}>
      {children}
    </div>
  )
}

function CardContent({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 pb-6", className)} {...props}>
      {children}
    </div>
  )
}

// Input Component
function Input({
  className,
  id,
  placeholder,
  value,
  onChange,
  maxLength,
  ...props
}: {
  className?: string
  id?: string
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  maxLength?: number
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      id={id}
      type="text"
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      {...props}
    />
  )
}

// Label Component
function Label({ className, htmlFor, children, ...props }: { className?: string; htmlFor?: string; children: React.ReactNode } & React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    >
      {children}
    </label>
  )
}

// Badge Component
function Badge({ className, variant = "default", children, ...props }: { className?: string; variant?: "default" | "destructive" | "secondary" | "outline"; children: React.ReactNode } & React.HTMLAttributes<HTMLSpanElement>) {
  const variantStyles = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-white",
    outline: "text-foreground",
  }
  
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

// Progress Component
function Progress({ className, value, ...props }: { className?: string; value?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  )
}

// Separator Component
function Separator({ className, ...props }: { className?: string } & React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={cn("shrink-0 bg-border", className)}
      {...props}
    />
  )
}

// Accordion Components
function Accordion({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {children}
    </div>
  )
}

function AccordionItem({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-b last:border-b-0", className)} {...props}>
      {children}
    </div>
  )
}

function AccordionTrigger({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex w-full items-center justify-between py-4 text-left text-sm font-medium transition-all hover:underline",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function AccordionContent({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pb-4 pt-0 text-sm", className)} {...props}>
      {children}
    </div>
  )
}

// Sheet Components (simplified for V0)
function Sheet({ open, onOpenChange, children, ...props }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  if (!open) return null
  return <div {...props}>{children}</div>
}

function SheetContent({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 h-full w-3/4 border-l bg-background p-6 shadow-lg transition-transform",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SheetHeader({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5 pb-4 border-b", className)} {...props}>
      {children}
    </div>
  )
}

function SheetTitle({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-lg font-semibold", className)} {...props}>
      {children}
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

const SECTION_CONFIG = [
  { key: "mainImage", labelEn: "Main Image", labelJa: "メイン画像", max: 20 },
  { key: "subImages", labelEn: "Sub Images", labelJa: "サブ画像", max: 30 },
  { key: "description", labelEn: "Description", labelJa: "説明文", max: 5 },
  { key: "reviews", labelEn: "Reviews", labelJa: "レビュー", max: 20 },
  { key: "aplus", labelEn: "A+ Content", labelJa: "A+コンテンツ", max: 15 },
  { key: "brandContent", labelEn: "Brand Content", labelJa: "ブランドコンテンツ", max: 5 },
] as const

function getScoreEvaluation(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Excellent", color: "text-green-600" }
  if (score >= 60) return { text: "Good", color: "text-blue-600" }
  if (score >= 40) return { text: "Needs work", color: "text-yellow-600" }
  return { text: "Critical", color: "text-red-600" }
}

function isValidAsin(asin: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(asin)
}

function extractAsinFromUrl(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i)
  return match ? match[1].toUpperCase() : null
}

// ============================================================================
// Sub-Components
// ============================================================================

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} />
}

function ScoreSectionCard({
  labelEn,
  labelJa,
  score,
  max,
}: {
  labelEn: string
  labelJa: string
  score: number
  max: number
}) {
  const percentage = (score / max) * 100
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{labelEn}</p>
          <p className="text-xs text-muted-foreground">{labelJa}</p>
        </div>
        <span className="text-sm font-semibold">
          {score} / {max}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  )
}

function ScoreAnalyzerPanel({
  url,
  setUrl,
  asin,
  setAsin,
  isLoading,
  onRunScore,
  onDryRun,
  history,
  onSelectHistory,
}: {
  url: string
  setUrl: (url: string) => void
  asin: string
  setAsin: (asin: string) => void
  isLoading: boolean
  onRunScore: () => void
  onDryRun: () => void
  history: HistoryItem[]
  onSelectHistory: (item: HistoryItem) => void
}) {
  const canExecute = isValidAsin(asin) || extractAsinFromUrl(url)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5" />
          Score Analyzer
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="amazon-url" className="text-sm">
              Amazon URL
            </Label>
            <Input
              id="amazon-url"
              placeholder="https://www.amazon.co.jp/dp/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                const extracted = extractAsinFromUrl(e.target.value)
                if (extracted) setAsin(extracted)
              }}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asin" className="text-sm">
              ASIN
            </Label>
            <Input
              id="asin"
              placeholder="B0XXXXXXXXXX"
              value={asin}
              onChange={(e) => setAsin(e.target.value.toUpperCase())}
              maxLength={10}
              className="text-sm font-mono"
            />
            {asin && !isValidAsin(asin) && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                ASINは英数字10文字です
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onRunScore} disabled={!canExecute || isLoading} className="flex-1">
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Running...
              </>
            ) : (
              "Run Score"
            )}
          </Button>
          <Button variant="secondary" onClick={onDryRun} disabled={!canExecute || isLoading}>
            Dry Run
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            実行履歴（最新5件）
          </h4>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">履歴がありません</p>
          ) : (
            <div className="space-y-1">
              {history.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item)}
                  className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{item.asin}</span>
                    <span className="font-semibold">{item.scoreTotal}/100</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.timestamp.toLocaleString("ja-JP")}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreResultPanel({ result }: { result: ScoreResult | null }) {
  if (!result) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Scoreを実行すると結果がここに表示されます</p>
        </CardContent>
      </Card>
    )
  }

  const evaluation = getScoreEvaluation(result.scoreTotal)

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Score Result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-4 bg-muted/50 rounded-lg">
          <div className="text-5xl font-bold tracking-tight">
            {result.scoreTotal}
            <span className="text-2xl text-muted-foreground font-normal"> / 100</span>
          </div>
          <p className={cn("text-lg font-medium mt-1", evaluation.color)}>{evaluation.text}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3">セクション別スコア</h4>
          <div className="grid gap-2">
            {SECTION_CONFIG.map(({ key, labelEn, labelJa }) => {
              const section = result.sections[key as keyof typeof result.sections]
              return (
                <ScoreSectionCard
                  key={key}
                  labelEn={labelEn}
                  labelJa={labelJa}
                  score={section?.score ?? 0}
                  max={section?.max ?? 0}
                />
              )
            })}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Missing Signals</h4>
          {result.missingSignals && result.missingSignals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {result.missingSignals.map((signal, index) => (
                <Badge key={index} variant="destructive" className="text-xs">
                  {signal}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/70">No missing signals</p>
          )}
        </div>

        {result.notes && result.notes.length > 0 && (
          <Accordion>
            <AccordionItem>
              <AccordionTrigger className="text-sm font-medium py-2">
                Notes ({result.notes.length})
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {result.notes.map((note, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-muted-foreground/50">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ScoreExtensionUI() {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [asin, setAsin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [status, setStatus] = useState<"idle" | "collecting" | "calling_api" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined)

  useEffect(() => {
    const rootHost = document.getElementById("fitpeak-score-root-host")
    if (rootHost) {
      setPortalContainer(rootHost)
    }
  }, [])

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

  const runScore = async (dryRun = false) => {
    const targetAsin = asin || extractAsinFromUrl(url)
    if (!targetAsin) {
      setStatus("error")
      setErrorMsg("有効なASINまたはURLを入力してください")
      return
    }

    setIsLoading(true)
    setStatus("collecting")
    setErrorMsg("")
    setDebugInfo(null)

    try {
      // Step 1: Get signals from content script via window.postMessage
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
              resolve(event.data)
            } else {
              reject(new Error(event.data.error?.message || event.data.error || "Failed to get score signals"))
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

      // Transform payload to API format
      const payload: any = {
        asin: targetAsin,
        url: url || signals.url || targetAsin,
      }

      if (signals.images) {
        payload.images = {
          ...(signals.images.main && { main: signals.images.main }),
          ...(signals.images.subs && signals.images.subs.length > 0 && { subs: signals.images.subs }),
          ...(signals.images.hasVideo !== undefined && { hasVideo: signals.images.hasVideo }),
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

      setDebugInfo({
        subsCount: payload.images?.subs?.length ?? 0,
        bulletsCount: payload.bullets?.length ?? 0,
        hasRating: payload.reviews?.rating !== undefined,
        hasCount: payload.reviews?.count !== undefined,
        hasAplus: payload.aplus?.hasAplus,
        hasBrand: payload.brandContent !== undefined,
      })

      setStatus("calling_api")

      // Step 2: Call API via background service worker
      const apiResponse = await new Promise<{ ok: boolean; result?: any; error?: string }>((resolve, reject) => {
        // Note: chrome.runtime.sendMessage is Chrome Extension API
        // In V0, you may want to mock this or handle it differently
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(
            {
              type: "RUN_SCORE",
              payload: payload,
              dryRun: dryRun,
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
        } else {
          // Mock for V0 preview
          setTimeout(() => {
            resolve({
              ok: true,
              result: {
                runId: "mock-run-id",
                result: {
                  scoreTotal: 65,
                  sections: {
                    mainImage: { score: 15, max: 20 },
                    subImages: { score: 25, max: 30 },
                    description: { score: 5, max: 5 },
                    reviews: { score: 15, max: 20 },
                    aplus: { score: 5, max: 15 },
                    brandContent: { score: 0, max: 5 },
                  },
                  notes: ["Score calculated successfully"],
                  missingSignals: [],
                },
              },
            })
          }, 1000)
        }
      })

      if (!apiResponse.ok) {
        throw new Error(apiResponse.error || "API returned error")
      }

      const apiData = apiResponse.result
      if (!apiData || !apiData.result) {
        throw new Error("APIレスポンスが不正です: resultが見つかりません")
      }

      setResult(apiData.result)

      const newHistoryItem: HistoryItem = {
        id: apiData.runId || `run-${Date.now()}`,
        asin: targetAsin,
        scoreTotal: apiData.result.scoreTotal,
        timestamp: new Date(),
        result: apiData.result,
      }
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 4)])

      setStatus("done")
    } catch (error: any) {
      setStatus("error")
      setErrorMsg(`${error.message || "エラーが発生しました"}\n${error.stack || ""}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectHistory = (item: HistoryItem) => {
    setResult(item.result)
    setAsin(item.asin)
  }

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

  return (
    <>
      {/* Main UI Container */}
      <div className="w-full bg-background border rounded-lg shadow-lg overflow-hidden">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <h2 className="text-base font-semibold">Amazon Score Analyzer</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const rootHost = document.getElementById("fitpeak-score-root-host")
              if (rootHost) {
                rootHost.style.display = "none"
                setIsOpen(false)
              }
            }}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-col lg:flex-row">
          {/* Left: Analyzer Panel */}
          <div className="lg:w-[320px] p-3 border-b lg:border-b-0 lg:border-r overflow-y-auto space-y-3">
            <ScoreAnalyzerPanel
              url={url}
              setUrl={setUrl}
              asin={asin}
              setAsin={setAsin}
              isLoading={isLoading}
              onRunScore={() => runScore(false)}
              onDryRun={() => runScore(true)}
              history={history}
              onSelectHistory={handleSelectHistory}
            />

            {/* Status Display */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Status:{" "}
                <span
                  className={cn(
                    status === "idle" && "text-muted-foreground",
                    status === "collecting" && "text-blue-600",
                    status === "calling_api" && "text-yellow-600",
                    status === "done" && "text-green-600",
                    status === "error" && "text-red-600"
                  )}
                >
                  {status === "idle" && "待機中"}
                  {status === "collecting" && "データ収集中..."}
                  {status === "calling_api" && "API呼び出し中..."}
                  {status === "done" && "完了"}
                  {status === "error" && "エラー"}
                </span>
              </div>

              {/* Debug Info */}
              {debugInfo && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  <div>Subs: {debugInfo.subsCount}</div>
                  <div>Bullets: {debugInfo.bulletsCount}</div>
                  <div>Rating: {debugInfo.hasRating ? "✓" : "✗"}</div>
                  <div>Count: {debugInfo.hasCount ? "✓" : "✗"}</div>
                  <div>A+: {debugInfo.hasAplus ? "✓" : "✗"}</div>
                  <div>Brand: {debugInfo.hasBrand ? "✓" : "✗"}</div>
                </div>
              )}

              {/* Error Display */}
              {status === "error" && errorMsg && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-medium text-destructive">エラーが発生しました</div>
                      <details className="text-xs text-destructive/80">
                        <summary className="cursor-pointer hover:text-destructive">詳細を表示</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[10px]">
                          {errorMsg}
                        </pre>
                      </details>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Result Panel */}
          <div className="flex-1 p-3 overflow-y-auto">
            <ScoreResultPanel result={result} />
          </div>
        </div>
      </div>
    </>
  )
}
