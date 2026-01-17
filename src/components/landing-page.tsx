"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap,
  Sparkles,
  ImageIcon,
  Type,
  Star,
  FileText,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  BarChart3,
  TrendingUp,
  Shield,
  Clock,
  Download,
} from "lucide-react";
import { AznoryLogo } from "@/components/aznory-logo";

// ============================================
// Hero Section
// ============================================
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background pt-20 pb-32">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-20 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute top-40 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Badge */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Chrome Extension公開中</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="mx-auto max-w-4xl text-balance text-center text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
          Amazon商品ページを
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AIでスコア分析</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-balance text-center text-lg text-muted-foreground md:text-xl">
          AZNORY Page Score Analyzerで、タイトル、画像、説明文、レビュー、A+コンテンツを自動で分析。
          改善点を可視化し、売上アップをサポートします。
        </p>

        {/* CTA Buttons */}
        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Download className="h-5 w-5" />
            Chrome拡張を無料インストール
          </button>
          <Link
            href="/api/auth/signin"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-8 text-base font-medium text-foreground transition-colors hover:bg-muted"
          >
            デモを見る
          </Link>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: "10,000+", label: "分析実績" },
            { value: "平均+26点", label: "スコア改善" },
            { value: "3分", label: "分析時間" },
            { value: "4.8", label: "ユーザー評価" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// Features Section
// ============================================
function FeaturesSection() {
  const features = [
    {
      icon: BarChart3,
      title: "200点満点の詳細スコア",
      description: "ルールベース（100点）+ AI分析（100点）の2段構成で、商品ページを徹底的に評価します。",
    },
    {
      icon: Sparkles,
      title: "AI改善提案",
      description: "ChatGPT/Geminiが改善点を自動で洗い出し、優先度付きで提案します。",
    },
    {
      icon: TrendingUp,
      title: "改善シミュレーション",
      description: "改善後の想定スコアを予測。どの施策が効果的か一目でわかります。",
    },
    {
      icon: Clock,
      title: "ワンクリック分析",
      description: "Amazon商品ページでボタンを押すだけ。3分以内に詳細なレポートが完成します。",
    },
    {
      icon: Shield,
      title: "Amazonガイドライン準拠",
      description: "NG表現や規約違反のリスクも同時にチェック。安心して改善できます。",
    },
    {
      icon: FileText,
      title: "履歴管理",
      description: "過去の分析結果を保存。改善前後のスコア変化を追跡できます。",
    },
  ];

  return (
    <section id="features" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">商品ページの品質を数値化</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            6つのカテゴリで総合評価。何を改善すべきか明確になります。
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// Score Categories Section
// ============================================
function ScoreCategoriesSection() {
  const categories = [
    { icon: Type, name: "タイトル", max: 15, description: "キーワード、文字数、構成" },
    { icon: ImageIcon, name: "メイン画像", max: 20, description: "解像度、背景、商品表示" },
    { icon: ImageIcon, name: "サブ画像", max: 25, description: "枚数、情報量、一貫性" },
    { icon: FileText, name: "説明", max: 15, description: "特徴、ベネフィット、読みやすさ" },
    { icon: Star, name: "レビュー", max: 15, description: "評価、件数、回答率" },
    { icon: FileText, name: "A+/ブランド", max: 10, description: "A+コンテンツ、ブランドストーリー" },
  ];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">評価カテゴリ</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Score（ルールベース）100点 + Super（AI分析）100点 = 最大200点
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                <cat.icon className="h-6 w-6 text-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{cat.name}</span>
                  <span className="text-sm text-muted-foreground">/{cat.max}点</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Score Mode Explanation */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Score（100点）</h3>
                <p className="text-sm text-muted-foreground">ルールベース評価</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                画像枚数・解像度チェック
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                タイトル文字数・キーワード
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                レビュー数・評価スコア
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-primary/50 bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Super（+100点）</h3>
                <p className="text-sm text-muted-foreground">AI + Vision分析</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                画像の視覚的品質評価
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                コピーの説得力分析
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                競合比較・改善提案
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Demo Section
// ============================================
function DemoSection() {
  return (
    <section className="bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">改善提案の例</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            AIが自動で改善点を洗い出し、優先度付きで提案します
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl rounded-xl border border-border bg-card p-6">
          {/* Current Score */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <div className="text-sm text-muted-foreground">現在の総合スコア</div>
              <div className="text-3xl font-bold text-foreground">142 / 200</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">改善後の想定スコア</div>
              <div className="text-3xl font-bold text-emerald-500">
                168 / 200
                <span className="ml-2 text-lg">(+26)</span>
              </div>
            </div>
          </div>

          {/* Priority Improvements */}
          <div className="mt-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-red-500/10 text-xs text-red-500">
                !
              </span>
              最優先（今すぐやる）
            </h4>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  サブ画像の比較順変更
                </span>
                <span className="text-sm font-medium text-emerald-500">+6</span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  メイン画像の立体感改善
                </span>
                <span className="text-sm font-medium text-emerald-500">+4</span>
              </li>
            </ul>
          </div>

          {/* Optional Improvements */}
          <div className="mt-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/10 text-xs text-amber-500">
                ?
              </span>
              余力があれば
            </h4>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  タイトル改善
                </span>
                <span className="text-sm font-medium text-amber-500">+3</span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  A+使用シーン追加
                </span>
                <span className="text-sm font-medium text-amber-500">+2</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Pricing Section
// ============================================
function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const plans = [
    {
      name: "Free",
      price: { monthly: 0, yearly: 0 },
      description: "まずは試してみたい方に",
      features: ["月5回までのScore分析", "基本スコア表示（100点満点）", "履歴保存（7日間）"],
      cta: "無料で始める",
      popular: false,
    },
    {
      name: "SIMPLE",
      price: { monthly: 980, yearly: 9800 },
      description: "本格的に改善したい方に",
      features: ["無制限のScore分析", "Super分析（月10回）", "AI改善提案（月3回）", "履歴保存（無制限）"],
      cta: "SIMPLEを始める",
      popular: true,
    },
    {
      name: "PRO",
      price: { monthly: 3980, yearly: 39800 },
      description: "チームで使いたい方に",
      features: ["無制限のScore分析", "Super分析（月30回）", "AI改善提案（月20回）", "履歴保存（無制限）", "優先サポート"],
      cta: "PROを始める",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">料金プラン</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            無料から始められます。ニーズに合わせてアップグレード。
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center gap-4 rounded-full border border-border bg-card p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              月額
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              年額
              <span className="ml-1 text-xs text-emerald-500">2ヶ月無料</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-6 ${
                plan.popular ? "border-primary bg-card" : "border-border bg-card"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  人気
                </div>
              )}

              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">¥{plan.price[billingCycle].toLocaleString()}</span>
                <span className="text-muted-foreground">/{billingCycle === "monthly" ? "月" : "年"}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/api/auth/signin"
                className={`mt-8 block w-full rounded-lg py-3 text-center text-sm font-medium transition-colors ${
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// FAQ Section
// ============================================
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "どのブラウザで使えますか？",
      answer: "現在はGoogle Chromeのみ対応しています。Firefox、Edge版は近日公開予定です。",
    },
    {
      question: "分析結果はどのくらい正確ですか？",
      answer:
        "ルールベースの評価は100%正確です。AI分析は過去の改善事例と比較して約85%の精度で改善効果を予測しています。",
    },
    {
      question: "海外のAmazonでも使えますか？",
      answer: "現在はAmazon.co.jp（日本）のみ対応しています。Amazon.com、Amazon.co.uk等は今後対応予定です。",
    },
    {
      question: "返金保証はありますか？",
      answer: "有料プランは14日間の返金保証付きです。ご満足いただけない場合は全額返金いたします。",
    },
  ];

  return (
    <section id="faq" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">よくある質問</h2>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="rounded-xl border border-border bg-card">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="font-medium text-foreground">{faq.question}</span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// CTA Section
// ============================================
function CTASection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold text-foreground md:text-4xl">今すぐ商品ページを改善しよう</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">無料で始められます。クレジットカード不要。</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/api/auth/signin"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="h-5 w-5" />
            Chrome拡張をインストール
          </Link>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Header Component
// ============================================
function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <AznoryLogo size="md" showServiceName={true} />

        <nav className="hidden items-center gap-6 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
            機能
          </a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
            料金
          </a>
          <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
            FAQ
          </a>
        </nav>
        <Link
          href="/api/auth/signin"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          インストール
        </Link>
      </div>
    </header>
  );
}

// ============================================
// Footer Component
// ============================================
function Footer() {
  return (
    <footer className="border-t border-border bg-card py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <AznoryLogo size="sm" showServiceName={true} />

          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">
              利用規約
            </a>
            <a href="#" className="hover:text-foreground">
              プライバシーポリシー
            </a>
            <a href="#" className="hover:text-foreground">
              お問い合わせ
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          © 2025 AZNORY. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

// ============================================
// Main Landing Page Component
// ============================================
export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      <main className="pt-16">
        <HeroSection />
        <FeaturesSection />
        <ScoreCategoriesSection />
        <DemoSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
