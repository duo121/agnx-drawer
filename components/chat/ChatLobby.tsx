"use client"

import {
    Check,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Search,
    Trash2,
    X,
} from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import ExamplePanel from "./example-panel"

interface SessionMetadata {
    id: string
    title: string
    updatedAt: number
    thumbnailDataUrl?: string
    engineId?: string
    messageCount?: number
}

interface ChatLobbyProps {
    sessions: SessionMetadata[]
    onSelectSession: (id: string) => void
    onDeleteSession?: (id: string) => void
    setInput: (input: string) => void
    setFiles: (files: File[]) => void
    currentEngine?: string
    dict: {
        sessionHistory?: {
            recentChats?: string
            searchPlaceholder?: string
            noResults?: string
            justNow?: string
            deleteTitle?: string
            deleteDescription?: string
        }
        examples?: {
            quickExamples?: string
        }
        common: {
            delete: string
            cancel: string
        }
    }
}

// Helper to format session date
function formatSessionDate(
    timestamp: number,
    dict?: { justNow?: string },
): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffMins < 1) return dict?.justNow || "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    })
}

export function ChatLobby({
    sessions,
    onSelectSession,
    onDeleteSession,
    setInput,
    setFiles,
    currentEngine = "drawio",
    dict,
}: ChatLobbyProps) {
    // Track whether examples section is expanded (collapsed by default when there's history)
    const [examplesExpanded, setExamplesExpanded] = useState(false)
    // Track which session is in delete confirmation state
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
    // Search filter for history
    const [searchQuery, setSearchQuery] = useState("")
    // Ref to detect clicks outside
    const containerRef = useRef<HTMLDivElement>(null)

    const hasHistory = sessions.length > 0

    // Click outside to cancel delete confirmation
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sessionToDelete && containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setSessionToDelete(null)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [sessionToDelete])

    if (!hasHistory) {
        // Show full examples when no history
        return <ExamplePanel setInput={setInput} setFiles={setFiles} />
    }

    // Show history + collapsible examples when there are sessions
    return (
        <div ref={containerRef} className="py-6 px-2 animate-fade-in">
            {/* Recent Chats Section */}
            <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-3">
                    {dict.sessionHistory?.recentChats || "Recent Chats"}
                </p>
                {/* Search Bar */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={
                            dict.sessionHistory?.searchPlaceholder ||
                            "Search chats..."
                        }
                        value={searchQuery || ""}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
                        >
                            <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                    )}
                </div>
                <div className="space-y-2">
                    {sessions
                        .filter((session) =>
                            session.title
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase()),
                        )
                        .map((session) => {
                            const incompatible =
                                session.engineId &&
                                session.engineId !== currentEngine
                            const isExcalidraw = session.engineId === "excalidraw"
                            const iconColor = isExcalidraw ? "#a78bfa" : "#3b82f6"
                            const iconBgColor = isExcalidraw ? "rgba(167, 139, 250, 0.15)" : "rgba(59, 130, 246, 0.15)"
                            return (
                                // biome-ignore lint/a11y/useSemanticElements: Cannot use button - has nested delete button which causes hydration error
                                <div
                                    key={session.id}
                                    role="button"
                                    tabIndex={0}
                                    className={`group w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                                        incompatible
                                            ? "border-border/60 bg-muted/60"
                                            : "border-border/40 bg-card/80 hover:bg-linear-to-r hover:from-primary/5 hover:to-transparent hover:border-primary/30"
                                    } cursor-pointer`}
                                    onClick={() => onSelectSession(session.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault()
                                            onSelectSession(session.id)
                                        }
                                    }}
                                    title={
                                        incompatible
                                            ? "与当前画板不匹配,将自动切换画板后打开"
                                            : undefined
                                    }
                                >
                                    {session.thumbnailDataUrl ? (
                                        <div className="w-12 h-12 shrink-0 rounded-lg border bg-white overflow-hidden">
                                            {session.thumbnailDataUrl.startsWith('<svg') ? (
                                                <div 
                                                    className="w-full h-full"
                                                    dangerouslySetInnerHTML={{ __html: session.thumbnailDataUrl }}
                                                />
                                            ) : (
                                                <Image
                                                    src={session.thumbnailDataUrl}
                                                    alt=""
                                                    width={48}
                                                    height={48}
                                                    className="object-contain w-full h-full"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <MessageSquare className="w-5 h-5 text-primary" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div 
                                                className="px-1.5 py-0.5 rounded border flex items-center justify-center shrink-0"
                                                style={{ 
                                                    borderColor: iconColor,
                                                    backgroundColor: iconBgColor
                                                }}
                                            >
                                                {isExcalidraw ? (
                                                    <svg
                                                        width={12}
                                                        height={12}
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke={iconColor}
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M3 17.5l5-5 4 4 6-6"/>
                                                        <polyline points="16,12 18,10 22,6"/>
                                                        <circle cx="6" cy="20" r="2"/>
                                                        <path d="M20 4l-4 4"/>
                                                        <path d="M4 4h7v7"/>
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        width={12}
                                                        height={12}
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke={iconColor}
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                                                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                                                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                                                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                                                        <line x1="10" y1="6.5" x2="14" y2="6.5"/>
                                                        <line x1="10" y1="17.5" x2="14" y2="17.5"/>
                                                        <line x1="6.5" y1="10" x2="6.5" y2="14"/>
                                                        <line x1="17.5" y1="10" x2="17.5" y2="14"/>
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="text-sm font-medium truncate">
                                                {session.title}
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <span>
                                                {formatSessionDate(
                                                    session.updatedAt,
                                                    dict.sessionHistory,
                                                )}
                                            </span>
                                            {session.messageCount !== undefined && session.messageCount > 0 && (
                                                <>
                                                    <span className="text-muted-foreground/40">•</span>
                                                    <span className="text-muted-foreground/80">
                                                        {Math.ceil(session.messageCount / 2)} 轮
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {onDeleteSession && (
                                        sessionToDelete === session.id ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    // Second click - confirm delete
                                                    onDeleteSession(session.id)
                                                    setSessionToDelete(null)
                                                }}
                                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-destructive bg-destructive/10 hover:bg-destructive/20 transition-all text-xs font-medium"
                                                title="点击确认删除"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                                <span className="whitespace-nowrap">再次确认</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    // First click - show confirmation
                                                    setSessionToDelete(session.id)
                                                }}
                                                className="p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                                                title={dict.common.delete}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )
                                    )}
                                </div>
                            )
                        })}
                    {sessions.filter((s) =>
                        s.title
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()),
                    ).length === 0 &&
                        searchQuery && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                {dict.sessionHistory?.noResults ||
                                    "No chats found"}
                            </p>
                        )}
                </div>
            </div>

            {/* Collapsible Examples Section */}
            <div className="border-t border-border/50 pt-4">
                <button
                    type="button"
                    onClick={() => setExamplesExpanded(!examplesExpanded)}
                    className="w-full flex items-center justify-between px-1 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                    <span>
                        {dict.examples?.quickExamples || "Quick Examples"}
                    </span>
                    {examplesExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                    ) : (
                        <ChevronDown className="w-4 h-4" />
                    )}
                </button>
                {examplesExpanded && (
                    <div className="mt-2">
                        <ExamplePanel
                            setInput={setInput}
                            setFiles={setFiles}
                            minimal
                        />
                    </div>
                )}
            </div>

        </div>
    )
}
