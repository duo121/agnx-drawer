"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Sparkles } from "lucide-react"

// Demo data structure
interface DemoNode {
    id: string
    x: number
    y: number
    width: number
    height: number
    label: string
    type: "rect" | "diamond" | "circle" | "rounded"
    color?: string
}

interface DemoEdge {
    from: string
    to: string
    label?: string
}

interface Demo {
    prompt: string
    promptEn?: string
    nodes: DemoNode[]
    edges: DemoEdge[]
}

// Demo configurations - different diagram types
const demos: Demo[] = [
    {
        prompt: "画一个用户登录流程图",
        promptEn: "Draw a user login flowchart",
        nodes: [
            { id: "start", x: 50, y: 80, width: 60, height: 60, label: "开始", type: "circle", color: "#10b981" },
            { id: "input", x: 150, y: 80, width: 80, height: 50, label: "输入账号", type: "rounded", color: "#3b82f6" },
            { id: "validate", x: 270, y: 80, width: 70, height: 70, label: "验证", type: "diamond", color: "#f59e0b" },
            { id: "success", x: 380, y: 50, width: 70, height: 40, label: "登录成功", type: "rounded", color: "#10b981" },
            { id: "error", x: 380, y: 110, width: 70, height: 40, label: "显示错误", type: "rounded", color: "#ef4444" },
        ],
        edges: [
            { from: "start", to: "input" },
            { from: "input", to: "validate" },
            { from: "validate", to: "success", label: "是" },
            { from: "validate", to: "error", label: "否" },
        ],
    },
    // AWS + K8s 混合架构图
    {
        prompt: "AWS + K8s 架构：CloudFront → API Gateway → Lambda → EKS（微服务 + Service Mesh）→ RDS/ElastiCache",
        promptEn: "AWS + K8s: CloudFront → API Gateway → Lambda → EKS (microservices) → RDS",
        nodes: [
            // AWS 服务链 (y=85 居中)
            { id: "user", x: 20, y: 75, width: 50, height: 50, label: "User", type: "circle", color: "#64748b" },
            { id: "cf", x: 95, y: 80, width: 55, height: 40, label: "CDN", type: "rounded", color: "#f97316" },
            { id: "apigw", x: 175, y: 80, width: 55, height: 40, label: "API GW", type: "rounded", color: "#f97316" },
            { id: "lambda", x: 255, y: 80, width: 55, height: 40, label: "Lambda", type: "rounded", color: "#f97316" },
            // EKS 集群 (中间区域)
            { id: "usersvc", x: 340, y: 35, width: 65, height: 40, label: "User Svc", type: "rounded", color: "#3b82f6" },
            { id: "ordersvc", x: 340, y: 85, width: 65, height: 40, label: "Order Svc", type: "rounded", color: "#3b82f6" },
            { id: "paysvc", x: 340, y: 135, width: 65, height: 40, label: "Pay Svc", type: "rounded", color: "#3b82f6" },
            // 数据层
            { id: "rds", x: 435, y: 55, width: 55, height: 40, label: "RDS", type: "rounded", color: "#10b981" },
            { id: "cache", x: 435, y: 115, width: 55, height: 40, label: "Cache", type: "rounded", color: "#10b981" },
        ],
        edges: [
            { from: "user", to: "cf" },
            { from: "cf", to: "apigw" },
            { from: "apigw", to: "lambda" },
            { from: "lambda", to: "usersvc" },
            { from: "lambda", to: "ordersvc" },
            { from: "lambda", to: "paysvc" },
            { from: "usersvc", to: "rds" },
            { from: "ordersvc", to: "rds" },
            { from: "ordersvc", to: "cache" },
            { from: "paysvc", to: "cache" },
        ],
    },
    {
        prompt: "设计一个三层架构图",
        promptEn: "Design a 3-tier architecture diagram",
        nodes: [
            { id: "ui1", x: 60, y: 30, width: 70, height: 40, label: "Web", type: "rounded", color: "#8b5cf6" },
            { id: "ui2", x: 150, y: 30, width: 70, height: 40, label: "Mobile", type: "rounded", color: "#8b5cf6" },
            { id: "ui3", x: 240, y: 30, width: 70, height: 40, label: "API", type: "rounded", color: "#8b5cf6" },
            { id: "svc1", x: 80, y: 100, width: 80, height: 40, label: "用户服务", type: "rect", color: "#3b82f6" },
            { id: "svc2", x: 200, y: 100, width: 80, height: 40, label: "订单服务", type: "rect", color: "#3b82f6" },
            { id: "db", x: 140, y: 170, width: 100, height: 40, label: "数据库", type: "rounded", color: "#10b981" },
        ],
        edges: [
            { from: "ui1", to: "svc1" },
            { from: "ui2", to: "svc1" },
            { from: "ui2", to: "svc2" },
            { from: "ui3", to: "svc2" },
            { from: "svc1", to: "db" },
            { from: "svc2", to: "db" },
        ],
    },
    {
        prompt: "画一个简单的思维导图",
        promptEn: "Draw a simple mind map",
        nodes: [
            { id: "center", x: 160, y: 90, width: 80, height: 50, label: "AI 绘图", type: "rounded", color: "#ec4899" },
            { id: "b1", x: 50, y: 30, width: 70, height: 35, label: "流程图", type: "rounded", color: "#8b5cf6" },
            { id: "b2", x: 280, y: 30, width: 70, height: 35, label: "架构图", type: "rounded", color: "#3b82f6" },
            { id: "b3", x: 50, y: 150, width: 70, height: 35, label: "时序图", type: "rounded", color: "#10b981" },
            { id: "b4", x: 280, y: 150, width: 70, height: 35, label: "ER 图", type: "rounded", color: "#f59e0b" },
        ],
        edges: [
            { from: "center", to: "b1" },
            { from: "center", to: "b2" },
            { from: "center", to: "b3" },
            { from: "center", to: "b4" },
        ],
    },
    {
        prompt: "绘制一个审批流程",
        promptEn: "Draw an approval workflow",
        nodes: [
            { id: "submit", x: 30, y: 90, width: 60, height: 40, label: "提交", type: "rounded", color: "#3b82f6" },
            { id: "review1", x: 120, y: 90, width: 70, height: 50, label: "主管", type: "diamond", color: "#f59e0b" },
            { id: "review2", x: 220, y: 90, width: 70, height: 50, label: "经理", type: "diamond", color: "#f59e0b" },
            { id: "done", x: 320, y: 90, width: 60, height: 40, label: "完成", type: "rounded", color: "#10b981" },
            { id: "reject", x: 170, y: 170, width: 60, height: 35, label: "驳回", type: "rounded", color: "#ef4444" },
        ],
        edges: [
            { from: "submit", to: "review1" },
            { from: "review1", to: "review2", label: "通过" },
            { from: "review2", to: "done", label: "通过" },
            { from: "review1", to: "reject", label: "拒绝" },
            { from: "review2", to: "reject", label: "拒绝" },
        ],
    },
]

// Animation timing constants (in ms)
const TYPING_SPEED = 40  // 加快打字速度以适应较长的提示词
const NODE_APPEAR_DELAY = 180
const EDGE_APPEAR_DELAY = 120
const COMPLETE_DISPLAY_TIME = 3500  // 稍微增加完成后的展示时间
const FADE_DURATION = 500

interface AnimatedDemoProps {
    onPromptClick?: (prompt: string) => void
    className?: string
}

export function AnimatedDemo({ onPromptClick, className = "" }: AnimatedDemoProps) {
    const [currentDemoIndex, setCurrentDemoIndex] = useState(0)
    const [typedText, setTypedText] = useState("")
    const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set())
    const [visibleEdges, setVisibleEdges] = useState<Set<number>>(new Set())
    const [phase, setPhase] = useState<"typing" | "nodes" | "edges" | "complete" | "fade">("typing")
    const [isFading, setIsFading] = useState(false)

    const currentDemo = demos[currentDemoIndex]

    // Get node center position for edge connections
    const getNodeCenter = useCallback((nodeId: string): { x: number; y: number } => {
        const node = currentDemo.nodes.find((n) => n.id === nodeId)
        if (!node) return { x: 0, y: 0 }
        return {
            x: node.x + node.width / 2,
            y: node.y + node.height / 2,
        }
    }, [currentDemo])

    // Get edge connection points (from node edge to target node edge)
    const getEdgePath = useCallback((edge: DemoEdge): string => {
        const fromNode = currentDemo.nodes.find((n) => n.id === edge.from)
        const toNode = currentDemo.nodes.find((n) => n.id === edge.to)
        if (!fromNode || !toNode) return ""

        const fromCenter = getNodeCenter(edge.from)
        const toCenter = getNodeCenter(edge.to)

        // Calculate direction and edge points
        const dx = toCenter.x - fromCenter.x
        const dy = toCenter.y - fromCenter.y
        const angle = Math.atan2(dy, dx)

        // Start point (from node edge)
        let startX = fromCenter.x
        let startY = fromCenter.y
        if (Math.abs(dx) > Math.abs(dy)) {
            startX = dx > 0 ? fromNode.x + fromNode.width : fromNode.x
        } else {
            startY = dy > 0 ? fromNode.y + fromNode.height : fromNode.y
        }

        // End point (to node edge)
        let endX = toCenter.x
        let endY = toCenter.y
        if (Math.abs(dx) > Math.abs(dy)) {
            endX = dx > 0 ? toNode.x : toNode.x + toNode.width
        } else {
            endY = dy > 0 ? toNode.y : toNode.y + toNode.height
        }

        // Simple straight line for now
        return `M ${startX} ${startY} L ${endX} ${endY}`
    }, [currentDemo, getNodeCenter])

    // Typing animation
    useEffect(() => {
        if (phase !== "typing") return

        const prompt = currentDemo.prompt
        if (typedText.length < prompt.length) {
            const timer = setTimeout(() => {
                setTypedText(prompt.slice(0, typedText.length + 1))
            }, TYPING_SPEED)
            return () => clearTimeout(timer)
        } else {
            // Typing complete, move to nodes phase
            const timer = setTimeout(() => setPhase("nodes"), 300)
            return () => clearTimeout(timer)
        }
    }, [phase, typedText, currentDemo.prompt])

    // Node appearance animation
    useEffect(() => {
        if (phase !== "nodes") return

        const nodeIds = currentDemo.nodes.map((n) => n.id)
        const currentCount = visibleNodes.size

        if (currentCount < nodeIds.length) {
            const timer = setTimeout(() => {
                setVisibleNodes((prev) => new Set([...prev, nodeIds[currentCount]]))
            }, NODE_APPEAR_DELAY)
            return () => clearTimeout(timer)
        } else {
            // All nodes visible, move to edges phase
            const timer = setTimeout(() => setPhase("edges"), 200)
            return () => clearTimeout(timer)
        }
    }, [phase, visibleNodes, currentDemo.nodes])

    // Edge appearance animation
    useEffect(() => {
        if (phase !== "edges") return

        const edgeCount = currentDemo.edges.length
        const currentCount = visibleEdges.size

        if (currentCount < edgeCount) {
            const timer = setTimeout(() => {
                setVisibleEdges((prev) => new Set([...prev, currentCount]))
            }, EDGE_APPEAR_DELAY)
            return () => clearTimeout(timer)
        } else {
            // All edges visible, move to complete phase
            const timer = setTimeout(() => setPhase("complete"), 200)
            return () => clearTimeout(timer)
        }
    }, [phase, visibleEdges, currentDemo.edges.length])

    // Complete phase - wait then fade out
    useEffect(() => {
        if (phase !== "complete") return

        const timer = setTimeout(() => {
            setPhase("fade")
            setIsFading(true)
        }, COMPLETE_DISPLAY_TIME)
        return () => clearTimeout(timer)
    }, [phase])

    // Fade phase - transition to next demo
    useEffect(() => {
        if (phase !== "fade") return

        const timer = setTimeout(() => {
            // Reset state for next demo
            setTypedText("")
            setVisibleNodes(new Set())
            setVisibleEdges(new Set())
            setIsFading(false)
            setCurrentDemoIndex((prev) => (prev + 1) % demos.length)
            setPhase("typing")
        }, FADE_DURATION)
        return () => clearTimeout(timer)
    }, [phase])

    // Render node based on type
    const renderNode = (node: DemoNode, isVisible: boolean) => {
        const baseStyle = {
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "scale(1)" : "scale(0.8)",
            transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
        }

        const fill = node.color || "#3b82f6"
        const textColor = "#ffffff"

        switch (node.type) {
            case "circle":
                const radius = Math.min(node.width, node.height) / 2
                return (
                    <g key={node.id} style={baseStyle}>
                        <circle
                            cx={node.x + node.width / 2}
                            cy={node.y + node.height / 2}
                            r={radius}
                            fill={fill}
                            className="drop-shadow-md"
                        />
                        <text
                            x={node.x + node.width / 2}
                            y={node.y + node.height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={textColor}
                            fontSize="11"
                            fontWeight="500"
                        >
                            {node.label}
                        </text>
                    </g>
                )

            case "diamond":
                const cx = node.x + node.width / 2
                const cy = node.y + node.height / 2
                const hw = node.width / 2
                const hh = node.height / 2
                return (
                    <g key={node.id} style={baseStyle}>
                        <polygon
                            points={`${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`}
                            fill={fill}
                            className="drop-shadow-md"
                        />
                        <text
                            x={cx}
                            y={cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={textColor}
                            fontSize="10"
                            fontWeight="500"
                        >
                            {node.label}
                        </text>
                    </g>
                )

            case "rounded":
            default:
                return (
                    <g key={node.id} style={baseStyle}>
                        <rect
                            x={node.x}
                            y={node.y}
                            width={node.width}
                            height={node.height}
                            rx={8}
                            ry={8}
                            fill={fill}
                            className="drop-shadow-md"
                        />
                        <text
                            x={node.x + node.width / 2}
                            y={node.y + node.height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={textColor}
                            fontSize="11"
                            fontWeight="500"
                        >
                            {node.label}
                        </text>
                    </g>
                )
        }
    }

    // Render edge with path animation
    const renderEdge = (edge: DemoEdge, index: number, isVisible: boolean) => {
        const path = getEdgePath(edge)
        
        return (
            <g key={`edge-${index}`}>
                {/* Edge line */}
                <path
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted-foreground/60"
                    strokeDasharray={isVisible ? "none" : "1000"}
                    strokeDashoffset={isVisible ? 0 : 1000}
                    style={{
                        transition: "stroke-dashoffset 0.4s ease-out",
                    }}
                    markerEnd="url(#arrowhead)"
                />
                {/* Edge label */}
                {edge.label && isVisible && (
                    <text
                        x={(getNodeCenter(edge.from).x + getNodeCenter(edge.to).x) / 2}
                        y={(getNodeCenter(edge.from).y + getNodeCenter(edge.to).y) / 2 - 8}
                        textAnchor="middle"
                        fontSize="9"
                        className="fill-muted-foreground"
                        style={{
                            opacity: isVisible ? 1 : 0,
                            transition: "opacity 0.3s ease-out",
                        }}
                    >
                        {edge.label}
                    </text>
                )}
            </g>
        )
    }

    const handleClick = () => {
        if (onPromptClick) {
            onPromptClick(currentDemo.prompt)
        }
    }

    // Calculate SVG viewBox based on nodes
    const viewBox = useMemo(() => {
        if (currentDemo.nodes.length === 0) return "0 0 400 220"
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        currentDemo.nodes.forEach(node => {
            minX = Math.min(minX, node.x)
            minY = Math.min(minY, node.y)
            maxX = Math.max(maxX, node.x + node.width)
            maxY = Math.max(maxY, node.y + node.height)
        })
        
        const padding = 30
        return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`
    }, [currentDemo.nodes])

    return (
        <div
            className={`flex flex-col items-center justify-center py-8 px-4 ${className}`}
            style={{
                opacity: isFading ? 0 : 1,
                transition: `opacity ${FADE_DURATION}ms ease-in-out`,
            }}
        >
            {/* Typing prompt area */}
            <div 
                className="mb-5 px-4 py-2.5 rounded-2xl bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors max-w-[95%] min-h-[44px]"
                onClick={handleClick}
                title="点击使用此提示"
            >
                <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground leading-relaxed">
                        {typedText}
                        {phase === "typing" && (
                            <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                        )}
                    </span>
                </div>
            </div>

            {/* SVG Diagram area */}
            <div 
                className="w-full max-w-lg aspect-[16/9] rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
                onClick={handleClick}
                title="点击使用此提示"
            >
                <svg
                    viewBox={viewBox}
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Arrow marker definition */}
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="7"
                            refX="9"
                            refY="3.5"
                            orient="auto"
                        >
                            <polygon
                                points="0 0, 10 3.5, 0 7"
                                className="fill-muted-foreground/60"
                            />
                        </marker>
                    </defs>

                    {/* Render edges first (below nodes) */}
                    {currentDemo.edges.map((edge, index) =>
                        renderEdge(edge, index, visibleEdges.has(index))
                    )}

                    {/* Render nodes */}
                    {currentDemo.nodes.map((node) =>
                        renderNode(node, visibleNodes.has(node.id))
                    )}
                </svg>
            </div>

            {/* Progress indicators */}
            <div className="flex items-center gap-2 mt-6">
                {demos.map((_, index) => (
                    <button
                        key={index}
                        type="button"
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            index === currentDemoIndex
                                ? "bg-primary w-6"
                                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        }`}
                        onClick={() => {
                            // Jump to specific demo
                            setTypedText("")
                            setVisibleNodes(new Set())
                            setVisibleEdges(new Set())
                            setIsFading(false)
                            setCurrentDemoIndex(index)
                            setPhase("typing")
                        }}
                        aria-label={`切换到演示 ${index + 1}`}
                    />
                ))}
            </div>

            {/* Hint text */}
            <p className="text-xs text-muted-foreground mt-4 text-center">
                点击上方卡片使用此示例 · 或在下方输入您的需求
            </p>
        </div>
    )
}
