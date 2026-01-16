import type { VariantProps } from "class-variance-authority"
import type React from "react"
import { forwardRef } from "react"
import { Button, type buttonVariants } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface ButtonWithTooltipProps
    extends React.ComponentProps<"button">,
        VariantProps<typeof buttonVariants> {
    tooltipContent: string
    children: React.ReactNode
    asChild?: boolean
    /** @deprecated 已弃用，会导致 Radix UI 无限循环 */
    forceShowTooltip?: boolean
}

export const ButtonWithTooltip = forwardRef<HTMLButtonElement, ButtonWithTooltipProps>(
    function ButtonWithTooltip({
        tooltipContent,
        children,
        type = "button",
        forceShowTooltip: _forceShowTooltip,
        disabled,
        ...buttonProps
    }, ref) {
        // 禁用状态下，用 span 包裹按钮以保持 tooltip 可触发
        const buttonElement = (
            <Button ref={ref} type={type} disabled={disabled} {...buttonProps}>
                {children}
            </Button>
        )

        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {disabled ? (
                        <span className="inline-flex rounded-full" tabIndex={-1}>
                            {buttonElement}
                        </span>
                    ) : (
                        buttonElement
                    )}
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-wrap">
                    {tooltipContent}
                </TooltipContent>
            </Tooltip>
        )
    }
)
