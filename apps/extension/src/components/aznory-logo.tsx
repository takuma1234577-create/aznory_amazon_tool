import type React from "react"

interface AznoryLogoProps {
  size?: "sm" | "md" | "lg"
  showBrand?: boolean
  showServiceName?: boolean
  className?: string
  variant?: "dark" | "light"
}

export function AznoryLogo({
  size = "md",
  showBrand = true,
  showServiceName = true,
  className = "",
  variant = "dark",
}: AznoryLogoProps) {
  const sizeMap = {
    sm: { container: "h-8 w-8", icon: 32, brand: "text-sm", service: "text-[10px]" },
    md: { container: "h-10 w-10", icon: 40, brand: "text-base", service: "text-xs" },
    lg: { container: "h-14 w-14", icon: 56, brand: "text-xl", service: "text-sm" },
  }

  const { container, icon, brand, service } = sizeMap[size]

  // Chrome拡張機能では chrome.runtime.getURL を使用して画像を取得
  const logoUrl = chrome.runtime.getURL("images/aznory-logo.png")

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${container} rounded-lg overflow-hidden shrink-0`}>
        <img
          src={logoUrl}
          alt="AZNORY"
          width={icon}
          height={icon}
          className="object-cover w-full h-full"
          onError={(e) => {
            // フォールバック：画像が読み込めない場合は非表示
            const target = e.target as HTMLImageElement
            target.style.display = "none"
          }}
        />
      </div>
      {(showBrand || showServiceName) && (
        <div className="flex flex-col justify-center">
          {showBrand && (
            <span
              className={`font-bold ${brand} tracking-tight leading-none ${variant === "dark" ? "text-foreground" : "text-gray-900"}`}
            >
              AZNORY
            </span>
          )}
          {showServiceName && (
            <span
              className={`${service} leading-none mt-0.5 ${variant === "dark" ? "text-muted-foreground" : "text-gray-500"}`}
            >
              Page Score Analyzer
            </span>
          )}
        </div>
      )}
    </div>
  )
}
