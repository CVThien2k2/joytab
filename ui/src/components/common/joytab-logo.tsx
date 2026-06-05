import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/**
 * Input: props SVG tiêu chuẩn (className, width/height qua CSS...).
 * Output: Logo Joytab dạng vector, tô theo `currentColor` nên đồng bộ với màu
 *         primary của theme đang active. Độ sâu giữa các lớp tạo bằng opacity,
 *         không hardcode màu — đổi theme là logo đổi theo.
 *
 * Mặc định `text-primary`; muốn màu khác chỉ cần override class màu chữ
 * (vd `className="text-foreground"`). Các node mạch để rỗng bằng `--card`.
 */
export function JoytabLogo({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1200 420"
      fill="none"
      className={cn("text-primary", className)}
      role="img"
      aria-label="Joytab"
      {...props}
    >
      <title>Joytab</title>

      {/* Icon group */}
      <g transform="translate(85 56)" stroke="currentColor">
        {/* cashflow J / growth arrow */}
        <path
          d="M238 32 L290 92 H258 V188 C258 260 205 310 132 310 C75 310 29 278 12 229"
          strokeWidth="44"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M178 82 H214 V178 C214 229 180 262 132 262 C93 262 62 244 46 213"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />

        {/* flow arcs */}
        <path
          d="M27 245 C78 303 171 313 232 254"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M48 224 C91 266 161 271 205 229"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* finance coin */}
        <circle cx="92" cy="173" r="55" strokeWidth="12" />
        <text
          x="92"
          y="194"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="72"
          fontWeight="700"
          fill="currentColor"
          stroke="none"
        >
          $
        </text>

        {/* AI circuit lines */}
        <path
          d="M-16 122 H32 L56 150"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <circle cx="-16" cy="122" r="12" fill="var(--card)" strokeWidth="8" opacity="0.85" />

        <path d="M-42 173 H37" strokeWidth="10" strokeLinecap="round" opacity="0.85" />
        <circle cx="-42" cy="173" r="12" fill="var(--card)" strokeWidth="8" opacity="0.85" />

        <path
          d="M-6 70 H50 L88 112"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <circle cx="-6" cy="70" r="12" fill="var(--card)" strokeWidth="8" opacity="0.85" />
      </g>

      {/* Wordmark */}
      <text
        x="440"
        y="260"
        fontFamily="Inter, Arial, Helvetica, sans-serif"
        fontSize="150"
        fontWeight="800"
        letterSpacing="-7"
        fill="currentColor"
      >
        Joytab
      </text>
    </svg>
  )
}
