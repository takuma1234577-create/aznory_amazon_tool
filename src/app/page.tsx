import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "24px" }}>
        FITPEAK Analyzer
      </h1>
      <p style={{ fontSize: "18px", color: "#666", marginBottom: "32px" }}>
        Amazon商品ページの分析ツール
      </p>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
        <Link
          href="/history"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#2563eb",
            color: "white",
            borderRadius: "8px",
            fontWeight: "600"
          }}
        >
          履歴を見る
        </Link>
      </div>
    </div>
  );
}
