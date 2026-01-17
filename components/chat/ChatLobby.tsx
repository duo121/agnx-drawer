"use client"

import { AnimatedDemo } from "./AnimatedDemo"

interface ChatLobbyProps {
    onPromptClick?: (prompt: string) => void
    className?: string
}

export function ChatLobby({
    onPromptClick,
    className = "",
}: ChatLobbyProps) {
    return (
        <div className={`h-full flex items-center justify-center ${className}`}>
            <AnimatedDemo onPromptClick={onPromptClick} />
        </div>
    )
}
