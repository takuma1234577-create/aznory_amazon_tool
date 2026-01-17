"use client";

import Image from "next/image";

interface AznoryLogoProps {
  size?: "sm" | "md" | "lg";
  showBrand?: boolean;
  showServiceName?: boolean;
  className?: string;
  variant?: "dark" | "light";
  width?: number;
  height?: number;
}

export function AznoryLogo({
  size = "md",
  showBrand = true,
  showServiceName = true,
  className = "",
  variant = "dark",
  width,
  height,
}: AznoryLogoProps) {
  const sizeMap = {
    sm: { container: "h-8 w-8", icon: 32, brand: "text-sm", service: "text-[10px]" },
    md: { container: "h-10 w-10", icon: 40, brand: "text-base", service: "text-xs" },
    lg: { container: "h-14 w-14", icon: 56, brand: "text-xl", service: "text-sm" },
  };

  const { container, icon, brand, service } = sizeMap[size];
  const iconWidth = width || icon;
  const iconHeight = height || icon;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${container} rounded-lg overflow-hidden shrink-0`}>
        <Image
          src="/images/aznory-logo.png"
          alt="AZNORY"
          width={iconWidth}
          height={iconHeight}
          className="object-cover w-full h-full"
          onError={(e) => {
            // フォールバック：画像が読み込めない場合は非表示
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
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
  );
}
