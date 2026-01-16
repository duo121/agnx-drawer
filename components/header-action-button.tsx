"use client"

import type React from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/shared/utils"

interface HeaderActionButtonProps {
    onClick: () => void
    tooltip: string
    disabled?: boolean
    children: React.ReactNode
    className?: string
}

export function HeaderActionButton({
    onClick,
    tooltip,
    disabled = false,
    children,
    className,
}: HeaderActionButtonProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={onClick}
                        disabled={disabled}
                        className={cn(
                            "h-12 w-12 flex items-center justify-center rounded-full",
                            "transition-all duration-200",
                            "hover:scale-175 disabled:hover:scale-100",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            className
                        )}
                    >
                        {children}
                    </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={-10}>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
