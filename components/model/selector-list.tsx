"use client"

import {
    AlertTriangle,
    Check,
    Server,
    Settings2,
    X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Input } from "@/components/ui/input"
import { useDictionary } from "@/hooks/use-dictionary"
import type { FlattenedModel } from "@/shared/types/model-config"
import { cn } from "@/shared/utils"

// Map our provider names to models.dev logo names
const PROVIDER_LOGO_MAP: Record<string, string> = {
    openai: "openai",
    anthropic: "anthropic",
    google: "google",
    azure: "azure",
    bedrock: "amazon-bedrock",
    openrouter: "openrouter",
    deepseek: "deepseek",
    siliconflow: "siliconflow",
    sglang: "openai",
    gateway: "vercel",
    edgeone: "tencent-cloud",
    doubao: "bytedance",
    modelscope: "modelscope",
}

// Group models by providerLabel
function groupModelsByProvider(
    models: FlattenedModel[],
): Map<string, { provider: string; models: FlattenedModel[] }> {
    const groups = new Map<
        string,
        { provider: string; models: FlattenedModel[] }
    >()
    for (const model of models) {
        const key = model.providerLabel
        const existing = groups.get(key)
        if (existing) {
            existing.models.push(model)
        } else {
            groups.set(key, { provider: model.provider, models: [model] })
        }
    }
    return groups
}

interface ModelSelectorListProps {
    models: FlattenedModel[]
    selectedModelId: string | undefined
    onSelect: (modelId: string | undefined) => void
    onConfigure: () => void
    onClose: () => void
    showUnvalidatedModels?: boolean
}

export function ModelSelectorList({
    models,
    selectedModelId,
    onSelect,
    onConfigure,
    onClose,
    showUnvalidatedModels = false,
}: ModelSelectorListProps) {
    const dict = useDictionary()
    const [searchQuery, setSearchQuery] = useState("")
    const [isExpanded, setIsExpanded] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

    // Filter models based on showUnvalidatedModels setting
    const displayModels = useMemo(() => {
        if (showUnvalidatedModels) {
            return models
        }
        return models.filter((m) => m.validated === true)
    }, [models, showUnvalidatedModels])

    // Filter by search query
    const filteredModels = useMemo(() => {
        if (!searchQuery) return displayModels
        const query = searchQuery.toLowerCase()
        return displayModels.filter(
            (m) =>
                m.modelId.toLowerCase().includes(query) ||
                m.provider.toLowerCase().includes(query) ||
                m.providerLabel.toLowerCase().includes(query)
        )
    }, [displayModels, searchQuery])

    const groupedModels = useMemo(
        () => groupModelsByProvider(filteredModels),
        [filteredModels],
    )

    const handleSelect = (value: string) => {
        if (value === "__configure__") {
            onConfigure()
            onClose()
        } else if (value === "__server_default__") {
            onSelect(undefined)
            onClose()
        } else {
            onSelect(value)
            onClose()
        }
        setSearchQuery("")
    }

    // Find ChatPanel container for Portal
    useEffect(() => {
        const findChatPanelContainer = () => {
            if (!containerRef.current) return null
            let el = containerRef.current.parentElement
            while (el) {
                if (el.classList.contains('flex') && 
                    el.classList.contains('flex-col') &&
                    el.querySelector('header') &&
                    el.querySelector('main') &&
                    el.querySelector('footer')) {
                    return el
                }
                el = el.parentElement
            }
            return null
        }
        
        const container = findChatPanelContainer()
        setPortalTarget(container)
    }, [])

    // Render list content
    const renderListContent = (expanded: boolean) => (
        <>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30 flex-shrink-0">
                <span className="text-sm font-medium text-foreground">{dict.modelConfig.selectModel}</span>
                <div className="flex items-center gap-2">
                    <ButtonWithTooltip
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        tooltipContent="关闭"
                        className="h-7 w-7 p-0"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </ButtonWithTooltip>
                </div>
            </div>

            {/* Search Input */}
            <div className="px-3 py-2 border-b border-border/50">
                <Input
                    placeholder={dict.modelConfig.searchModels}
                    value={searchQuery || ""}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-sm"
                />
            </div>

            {/* Model List */}
            <div className={`p-2 overflow-y-auto flex-1 ${expanded ? "" : "max-h-64"}`}>
                {/* Empty State */}
                {filteredModels.length === 0 && (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        {displayModels.length === 0 && models.length > 0
                            ? dict.modelConfig.noVerifiedModels
                            : dict.modelConfig.noModelsFound}
                    </div>
                )}

                {filteredModels.length > 0 && (
                    <>
                        {/* Server Default Option */}
                        <div className="mb-2">
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                {dict.modelConfig.default}
                            </div>
                            <ModelItem
                                icon={<Server className="h-4 w-4 text-muted-foreground" />}
                                label={dict.modelConfig.serverDefault}
                                selected={!selectedModelId}
                                onClick={() => handleSelect("__server_default__")}
                            />
                        </div>

                        {/* Configured Models by Provider */}
                        {Array.from(groupedModels.entries()).map(
                            ([providerLabel, { provider, models: providerModels }]) => (
                                <div key={providerLabel} className="mb-2">
                                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                        {providerLabel}
                                    </div>
                                    {providerModels.map((model) => (
                                        <ModelItem
                                            key={model.id}
                                            icon={
                                                <ModelLogo
                                                    provider={PROVIDER_LOGO_MAP[provider] || provider}
                                                />
                                            }
                                            label={model.modelId}
                                            selected={selectedModelId === model.id}
                                            warning={model.validated !== true}
                                            warningTitle={dict.modelConfig.unvalidatedModelWarning}
                                            onClick={() => handleSelect(model.id)}
                                        />
                                    ))}
                                </div>
                            )
                        )}

                        {/* Configure Option */}
                        <div className="border-t border-border/50 pt-2 mt-2">
                            <ModelItem
                                icon={<Settings2 className="h-4 w-4" />}
                                label={dict.modelConfig.configureModels}
                                selected={false}
                                onClick={() => handleSelect("__configure__")}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Footer Info */}
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/50 bg-muted/30">
                {showUnvalidatedModels
                    ? dict.modelConfig.allModelsShown
                    : dict.modelConfig.onlyVerifiedShown}
            </div>
        </>
    )

    // Overlay - covers header + main area
    const overlayContent = portalTarget && createPortal(
        <div 
            className="absolute inset-0 bottom-auto bg-background/50 z-30 pointer-events-auto"
            style={{ 
                height: `calc(100% - ${portalTarget.querySelector('footer')?.offsetHeight || 0}px)` 
            }}
            onClick={onClose}
        />,
        portalTarget
    )

    // Expanded panel
    const expandedPanel = isExpanded && portalTarget && createPortal(
        <div
            className="absolute inset-x-4 top-4 bg-background border border-border rounded-xl shadow-lg z-40 overflow-hidden flex flex-col"
            style={{ 
                height: `calc(100% - ${(portalTarget.querySelector('footer')?.offsetHeight || 0) + 24}px)` 
            }}
        >
            {renderListContent(true)}
        </div>,
        portalTarget
    )

    return (
        <>
            {/* Overlay */}
            {overlayContent}
            
            {/* Normal panel */}
            <div
                ref={containerRef}
                className={`absolute left-0 right-0 bottom-full mb-2 bg-background border border-border rounded-xl shadow-lg z-40 overflow-hidden ${
                    isExpanded ? 'invisible' : ''
                }`}
            >
                {renderListContent(false)}
            </div>
            
            {/* Expanded panel */}
            {expandedPanel}
        </>
    )
}

// Model Item Component
interface ModelItemProps {
    icon: React.ReactNode
    label: string
    selected: boolean
    warning?: boolean
    warningTitle?: string
    onClick: () => void
}

function ModelItem({ icon, label, selected, warning, warningTitle, onClick }: ModelItemProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                selected ? "bg-accent" : "hover:bg-accent/50"
            )}
            onClick={onClick}
        >
            <Check
                className={cn(
                    "h-4 w-4 flex-shrink-0",
                    selected ? "opacity-100" : "opacity-0"
                )}
            />
            <div className="flex-shrink-0">{icon}</div>
            <span className="flex-1 text-sm truncate">{label}</span>
            {warning && (
                <span title={warningTitle}>
                    <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />
                </span>
            )}
        </div>
    )
}

// Model Logo Component
interface ModelLogoProps {
    provider: string
}

function ModelLogo({ provider }: ModelLogoProps) {
    if (provider === "amazon-bedrock") {
        return <Server className="h-4 w-4" />
    }

    return (
        <img
            alt={`${provider} logo`}
            className="h-4 w-4 dark:invert"
            height={16}
            src={`https://models.dev/logos/${provider}.svg`}
            width={16}
        />
    )
}
