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
    title: string
    titleEn?: string
    prompt: string
    promptEn?: string
    nodes: DemoNode[]
    edges: DemoEdge[]
}

// Demo configurations - different diagram types
const demos: Demo[] = [
    {
        title: "用户登录流程图",
        titleEn: "User login flowchart",
        prompt: "画一个用户登录流程图：用户输入账号密码后，系统验证凭据，验证成功则跳转首页，失败则显示错误信息并允许重试，包含开始、输入、验证、成功、失败等节点。",
        promptEn: "Draw a user login flowchart: After the user enters the account and password, the system verifies the credentials. If successful, redirect to the homepage; if failed, display an error message and allow retry. Include start, input, validation, success, and failure nodes.",
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
        title: "AWS 云原生微服务架构",
        titleEn: "AWS Cloud Native Microservices",
        prompt: "画一个 AWS 云原生微服务架构图：用户通过 CloudFront（CDN）访问，请求经 API Gateway 路由到 Lambda 函数，Lambda 连接 EKS 集群（内含用户服务、订单服务、支付服务三个 Pod，通过 Service Mesh 通信），数据层使用 RDS 和 ElastiCache，所有组件使用正确的 AWS 和 K8s 图标。",
        promptEn: "Draw an AWS cloud native microservices architecture: Users access via CloudFront (CDN), requests are routed through API Gateway to Lambda functions, Lambda connects to EKS cluster (containing User Service, Order Service, Payment Service pods communicating via Service Mesh), data layer uses RDS and ElastiCache, all components use correct AWS and K8s icons.",
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
        title: "OSI 七层网络模型",
        titleEn: "OSI 7-Layer Network Model",
        prompt: "画一个 OSI 七层网络架构图：从上到下依次是应用层（HTTP/FTP）、表示层（加密/压缩）、会话层（连接管理）、传输层（TCP/UDP）、网络层（IP路由）、数据链路层（MAC帧）、物理层（电信号），各层用不同颜色区分，显示层级编号和数据流向。",
        promptEn: "Draw an OSI 7-layer network architecture diagram: From top to bottom - Application layer (HTTP/FTP), Presentation layer (encryption/compression), Session layer (connection management), Transport layer (TCP/UDP), Network layer (IP routing), Data Link layer (MAC frames), Physical layer (electrical signals), use different colors for each layer, show layer numbers and data flow direction.",
        nodes: [
            { id: "l7", x: 80, y: 10, width: 180, height: 28, label: "7. 应用层", type: "rounded", color: "#ef4444" },
            { id: "l6", x: 80, y: 42, width: 180, height: 28, label: "6. 表示层", type: "rounded", color: "#f97316" },
            { id: "l5", x: 80, y: 74, width: 180, height: 28, label: "5. 会话层", type: "rounded", color: "#eab308" },
            { id: "l4", x: 80, y: 106, width: 180, height: 28, label: "4. 传输层", type: "rounded", color: "#22c55e" },
            { id: "l3", x: 80, y: 138, width: 180, height: 28, label: "3. 网络层", type: "rounded", color: "#06b6d4" },
            { id: "l2", x: 80, y: 170, width: 180, height: 28, label: "2. 数据链路层", type: "rounded", color: "#3b82f6" },
            { id: "l1", x: 80, y: 202, width: 180, height: 28, label: "1. 物理层", type: "rounded", color: "#8b5cf6" },
        ],
        edges: [
            { from: "l7", to: "l6" },
            { from: "l6", to: "l5" },
            { from: "l5", to: "l4" },
            { from: "l4", to: "l3" },
            { from: "l3", to: "l2" },
            { from: "l2", to: "l1" },
        ],
    },
    {
        title: "AI 绘图思维导图",
        titleEn: "AI Drawing Mind Map",
        prompt: "画一个 AI 绘图功能的思维导图：中心节点为“AI 绘图”，四个分支分别是流程图、架构图、时序图和 ER 图，使用不同颜色区分各个分支。",
        promptEn: "Draw a mind map of AI drawing features: Center node is 'AI Drawing', with four branches for Flowchart, Architecture Diagram, Sequence Diagram, and ER Diagram, using different colors to distinguish each branch.",
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
        title: "审批流程图",
        titleEn: "Approval Workflow",
        prompt: "绘制一个企业审批流程图：员工提交申请后，先经主管审批，通过后转经理审批，经理通过则审批完成，任一环节拒绝则返回驳回状态，使用菱形表示审批决策节点。",
        promptEn: "Draw an enterprise approval workflow: After employee submits a request, it goes through supervisor approval first, then manager approval if approved, completion if manager approves, rejection status if rejected at any stage, use diamonds for approval decision nodes.",
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

    // Typing animation - displays title
    useEffect(() => {
        if (phase !== "typing") return

        const title = currentDemo.title
        if (typedText.length < title.length) {
            const timer = setTimeout(() => {
                setTypedText(title.slice(0, typedText.length + 1))
            }, TYPING_SPEED)
            return () => clearTimeout(timer)
        } else {
            // Typing complete, move to nodes phase
            const timer = setTimeout(() => setPhase("nodes"), 300)
            return () => clearTimeout(timer)
        }
    }, [phase, typedText, currentDemo.title])

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
