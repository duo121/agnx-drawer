import { ArrowLeft } from "lucide-react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { cn } from "@/shared/utils"

interface SubviewHeaderProps {
    onBack: () => void
    backTooltip?: string
    children: React.ReactNode
    className?: string
}

export function SubviewHeader({
    onBack,
    backTooltip = "返回",
    children,
    className,
}: SubviewHeaderProps) {
    return (
        <div className={cn("px-3 py-2 flex items-center gap-2", className)}>
            <ButtonWithTooltip
                variant="ghost"
                size="icon"
                onClick={onBack}
                tooltipContent={backTooltip}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
                <ArrowLeft className="h-4 w-4" />
            </ButtonWithTooltip>
            {children}
        </div>
    )
}

// 搜索输入框样式容器
interface SearchInputContainerProps {
    children: React.ReactNode
    className?: string
}

export function SearchInputContainer({ children, className }: SearchInputContainerProps) {
    return (
        <div
            className={cn(
                "flex-1 flex items-center gap-2 h-9 px-3 rounded-xl bg-background border border-border/30",
                className
            )}
        >
            {children}
        </div>
    )
}

// 标准搜索输入框
interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    onKeyDown?: (e: React.KeyboardEvent) => void
    inputRef?: React.RefObject<HTMLInputElement | null>
    className?: string
}

export function SearchInput({
    value,
    onChange,
    placeholder = "搜索...",
    onKeyDown,
    inputRef,
    className,
}: SearchInputProps) {
    return (
        <SearchInputContainer className={className}>
            <input
                ref={inputRef}
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
        </SearchInputContainer>
    )
}
