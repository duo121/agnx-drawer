/**
 * Intent Parser for Unified Drawing Agent
 *
 * Parses user input to determine:
 * 1. Canvas preference (drawio/excalidraw/auto)
 * 2. DSL preference (plantuml/mermaid/none) - forces specific canvas
 * 3. Required icon libraries for auto-loading
 */

export type CanvasType = 'drawio' | 'excalidraw'
export type DSLType = 'plantuml' | 'mermaid' | 'none'

export interface UserIntent {
  // Canvas preference
  canvasPreference: CanvasType | 'auto'

  // DSL preference (forces canvas)
  dslPreference: DSLType

  // Required icon libraries to load
  requiredIconLibraries: string[]

  // Detected slash command (if any)
  slashCommand: string | null

  // Original input
  rawInput: string
}

// Canvas preference keywords
const CANVAS_KEYWORDS: Record<CanvasType, string[]> = {
  drawio: ['draw.io', 'drawio', 'draw io'],
  excalidraw: ['excalidraw', '手绘', '草图', 'sketch', 'whiteboard', '白板'],
}

// DSL detection with forced canvas mapping
const DSL_PATTERNS: Record<DSLType, { patterns: RegExp[], requiredCanvas: CanvasType }> = {
  plantuml: {
    patterns: [
      /plantuml/i,
      /@startuml/i,
      /@enduml/i,
      /\/plantuml\b/i,
    ],
    requiredCanvas: 'drawio',
  },
  mermaid: {
    patterns: [
      /mermaid/i,
      /```mermaid/i,
      /flowchart\s+(TD|TB|BT|RL|LR)/i,
      /sequenceDiagram/i,
      /classDiagram/i,
      /stateDiagram/i,
      /erDiagram/i,
      /\/mermaid\b/i,
    ],
    requiredCanvas: 'excalidraw',
  },
  none: {
    patterns: [],
    requiredCanvas: 'drawio', // default, not used
  },
}

// Icon library keywords for auto-loading
const ICON_LIBRARY_KEYWORDS: Record<string, string[]> = {
  aws: [
    'aws', 'amazon', 'lambda', 'ec2', 's3', 'dynamodb', 'cloudfront',
    'api gateway', 'sqs', 'sns', 'ecs', 'eks', 'fargate', 'rds',
    'aurora', 'redshift', 'kinesis', 'sagemaker', 'bedrock', 'cognito',
    'cloudwatch', 'route53', 'vpc', 'iam', 'elastic', 'beanstalk',
  ],
  azure: [
    'azure', 'microsoft cloud', 'blob storage', 'cosmos db',
    'azure functions', 'app service', 'aks', 'event hub',
    'service bus', 'azure sql', 'azure ad', 'logic apps',
  ],
  gcp: [
    'gcp', 'google cloud', 'bigquery', 'cloud run', 'cloud functions',
    'gke', 'pub/sub', 'dataflow', 'vertex ai', 'cloud storage',
    'compute engine', 'app engine', 'firebase', 'spanner',
  ],
  k8s: [
    'kubernetes', 'k8s', 'pod', 'deployment', 'service', 'ingress',
    'configmap', 'secret', 'helm', 'kubectl', 'namespace', 'replica',
    'daemonset', 'statefulset', 'cronjob', 'pvc', 'pv',
  ],
  android: [
    'android', '安卓', 'activity', 'fragment', 'service',
    'broadcast', 'content provider', 'apk', 'gradle', 'jetpack',
    'compose', 'viewmodel', 'livedata', 'room',
  ],
  ios: [
    'ios', 'iphone', 'swift', 'swiftui', 'uikit', 'xcode',
    'cocoapods', 'storyboard', 'viewcontroller', 'coredata',
  ],
  network: [
    '网络', 'network', 'router', 'switch', 'firewall', 'load balancer',
    'vpn', 'dns', 'cdn', 'topology', 'lan', 'wan', 'gateway',
    'proxy', 'nat', 'vlan', 'subnet', '拓扑',
  ],
  flowchart: [
    '流程图', 'flowchart', '决策树', 'decision tree', '工作流',
    'workflow', 'process', '业务流程', 'bpmn',
  ],
  sequence: [
    '时序图', 'sequence', '顺序图', 'interaction', '交互图',
  ],
  er: [
    'er图', 'entity relationship', '实体关系', 'database schema',
    '数据库设计', 'erd',
  ],
  class: [
    '类图', 'class diagram', 'uml class', '对象图',
  ],
}

// Slash command patterns
const SLASH_COMMAND_PATTERN = /^\/(\w+)(?:\s|$)/

/**
 * Parse user input to extract intent
 */
export function parseUserIntent(
  input: string,
  currentCanvas: CanvasType
): UserIntent {
  const intent: UserIntent = {
    canvasPreference: 'auto',
    dslPreference: 'none',
    requiredIconLibraries: [],
    slashCommand: null,
    rawInput: input,
  }

  const inputLower = input.toLowerCase()

  // 1. Check for slash commands first
  const slashMatch = input.match(SLASH_COMMAND_PATTERN)
  if (slashMatch) {
    intent.slashCommand = slashMatch[1].toLowerCase()

    // Handle canvas-switching slash commands
    if (intent.slashCommand === 'drawio') {
      intent.canvasPreference = 'drawio'
    } else if (intent.slashCommand === 'excalidraw') {
      intent.canvasPreference = 'excalidraw'
    } else if (intent.slashCommand === 'plantuml') {
      intent.dslPreference = 'plantuml'
      intent.canvasPreference = 'drawio'
    } else if (intent.slashCommand === 'mermaid') {
      intent.dslPreference = 'mermaid'
      intent.canvasPreference = 'excalidraw'
    }
  }

  // 2. Detect DSL preference (highest priority - forces canvas)
  if (intent.dslPreference === 'none') {
    for (const [dsl, config] of Object.entries(DSL_PATTERNS)) {
      if (dsl === 'none') continue
      for (const pattern of config.patterns) {
        if (pattern.test(input)) {
          intent.dslPreference = dsl as DSLType
          intent.canvasPreference = config.requiredCanvas
          break
        }
      }
      if (intent.dslPreference !== 'none') break
    }
  }

  // 3. Detect canvas preference from keywords (if not already set by DSL)
  if (intent.canvasPreference === 'auto') {
    for (const [canvas, keywords] of Object.entries(CANVAS_KEYWORDS)) {
      for (const keyword of keywords) {
        if (inputLower.includes(keyword.toLowerCase())) {
          intent.canvasPreference = canvas as CanvasType
          break
        }
      }
      if (intent.canvasPreference !== 'auto') break
    }
  }

  // 4. Detect required icon libraries
  for (const [library, keywords] of Object.entries(ICON_LIBRARY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (inputLower.includes(keyword.toLowerCase())) {
        if (!intent.requiredIconLibraries.includes(library)) {
          intent.requiredIconLibraries.push(library)
        }
        break // Found match for this library, move to next
      }
    }
  }

  return intent
}

/**
 * Determine if canvas switch is needed
 */
export function needsCanvasSwitch(
  intent: UserIntent,
  currentCanvas: CanvasType
): { needed: boolean; targetCanvas: CanvasType; reason: string } {
  // If user explicitly requested a canvas or DSL requires specific canvas
  if (intent.canvasPreference !== 'auto' && intent.canvasPreference !== currentCanvas) {
    let reason = ''

    if (intent.dslPreference === 'plantuml') {
      reason = 'PlantUML 需要 Draw.io 引擎来渲染'
    } else if (intent.dslPreference === 'mermaid') {
      reason = 'Mermaid 需要 Excalidraw 引擎来渲染'
    } else if (intent.slashCommand === 'drawio' || intent.slashCommand === 'excalidraw') {
      reason = `用户请求切换到 ${intent.canvasPreference === 'drawio' ? 'Draw.io' : 'Excalidraw'}`
    } else {
      reason = `检测到 ${intent.canvasPreference === 'drawio' ? 'Draw.io' : 'Excalidraw'} 相关关键词`
    }

    return {
      needed: true,
      targetCanvas: intent.canvasPreference,
      reason,
    }
  }

  return {
    needed: false,
    targetCanvas: currentCanvas,
    reason: '',
  }
}

/**
 * Format intent for logging/debugging
 */
export function formatIntent(intent: UserIntent): string {
  const parts: string[] = []

  if (intent.canvasPreference !== 'auto') {
    parts.push(`canvas=${intent.canvasPreference}`)
  }
  if (intent.dslPreference !== 'none') {
    parts.push(`dsl=${intent.dslPreference}`)
  }
  if (intent.requiredIconLibraries.length > 0) {
    parts.push(`icons=[${intent.requiredIconLibraries.join(',')}]`)
  }
  if (intent.slashCommand) {
    parts.push(`cmd=/${intent.slashCommand}`)
  }

  return parts.length > 0 ? parts.join(', ') : 'auto'
}
