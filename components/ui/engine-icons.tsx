import { cn } from "@/shared/utils"

interface IconProps extends React.SVGProps<SVGSVGElement> {
    className?: string
}

/**
 * Excalidraw 引擎图标
 * 手绘风格的折线图图标
 */
export function ExcalidrawIcon({ className, ...props }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("h-4 w-4", className)}
            {...props}
        >
            <path d="M3 17.5l5-5 4 4 6-6" />
            <polyline points="16,12 18,10 22,6" />
            <circle cx="6" cy="20" r="2" />
            <path d="M20 4l-4 4" />
            <path d="M4 4h7v7" />
        </svg>
    )
}

/**
 * Draw.io 引擎图标
 * 流程图风格的四方格连接图标
 */
export function DrawioIcon({ className, ...props }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("h-4 w-4", className)}
            {...props}
        >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <line x1="10" y1="6.5" x2="14" y2="6.5" />
            <line x1="10" y1="17.5" x2="14" y2="17.5" />
            <line x1="6.5" y1="10" x2="6.5" y2="14" />
            <line x1="17.5" y1="10" x2="17.5" y2="14" />
        </svg>
    )
}
