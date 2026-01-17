"use client";

import Link from "next/link";
import { BarChart3, Zap, Shield, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-lg text-gray-900">AZNORY</div>
                <div className="text-xs text-gray-500">Page Score Analyzer</div>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                機能
              </Link>
              <Link href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                料金
              </Link>
              <Link
                href="/api/auth/signin"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                ログイン
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Amazon商品ページを
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800">
              AIで分析・最適化
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            AZNORYは、Amazon商品ページのCVR（コンバージョン率）を向上させるための
            <br className="hidden sm:block" />
            AI分析ツールです。スコアリング、改善提案、詳細分析をワンクリックで。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/api/auth/signin"
              className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              無料で始める
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors"
            >
              機能を見る
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              主要機能
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Amazon商品ページの分析から改善提案まで、すべてを自動化
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">スコア分析</h3>
              <p className="text-gray-600">
                100点満点で商品ページを評価。メイン画像、サブ画像、説明文、レビュー、A+コンテンツを総合的に分析します。
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Super分析</h3>
              <p className="text-gray-600">
                AIによる詳細分析で、CVR向上のための具体的な改善点を提案。LLMとVision AIを組み合わせた高度な分析です。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">改善提案</h3>
              <p className="text-gray-600">
                スコア詳細とAI改善点分析で、CVR・CTR・売上に直結する具体的な改善アクションを提示します。
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Chrome拡張機能</h3>
              <p className="text-gray-600">
                Amazon商品ページ上で直接分析を実行。ページ遷移なしで、リアルタイムにスコアと改善提案を確認できます。
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">画像分析</h3>
              <p className="text-gray-600">
                Gemini Vision AIによる画像分析で、メイン画像とサブ画像の視覚的な改善点を特定します。
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-pink-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">詳細レポート</h3>
              <p className="text-gray-600">
                セクション別のスコア詳細と、各スコアの理由を明確に提示。改善アクションの影響（CVR/CTR/売上）も表示します。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-gray-50 py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                料金プラン
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                あなたのニーズに合わせたプランを選択
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* FREE Plan */}
              <div className="bg-white p-8 rounded-xl border-2 border-gray-200">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">FREE</h3>
                  <div className="text-4xl font-bold text-gray-900 mb-1">¥0</div>
                  <p className="text-sm text-gray-500">/月</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">スコア分析: 月5回</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">Super分析: 利用不可</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">改善提案: 利用不可</span>
                  </li>
                </ul>
                <Link
                  href="/api/auth/signin"
                  className="block w-full text-center px-6 py-3 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  今すぐ始める
                </Link>
              </div>

              {/* SIMPLE Plan */}
              <div className="bg-white p-8 rounded-xl border-2 border-blue-500 relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                  おすすめ
                </div>
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">SIMPLE</h3>
                  <div className="text-4xl font-bold text-gray-900 mb-1">¥980</div>
                  <p className="text-sm text-gray-500">/月</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">スコア分析: 無制限</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">Super分析: 月10回</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">改善提案: 月3回</span>
                  </li>
                </ul>
                <Link
                  href="/api/auth/signin"
                  className="block w-full text-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  プランを選択
                </Link>
              </div>

              {/* PRO Plan */}
              <div className="bg-white p-8 rounded-xl border-2 border-gray-200">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">PRO</h3>
                  <div className="text-4xl font-bold text-gray-900 mb-1">¥3,980</div>
                  <p className="text-sm text-gray-500">/月</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">スコア分析: 無制限</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">Super分析: 月30回</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">改善提案: 月20回</span>
                  </li>
                </ul>
                <Link
                  href="/api/auth/signin"
                  className="block w-full text-center px-6 py-3 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  プランを選択
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-12 text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Amazon商品ページのCVRを向上させませんか？
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            AI分析で、データに基づいた改善提案を即座に取得
          </p>
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            無料で始める
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">AZNORY</div>
                  <div className="text-xs text-gray-500">Page Score Analyzer</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                © 2025 AZNORY. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
