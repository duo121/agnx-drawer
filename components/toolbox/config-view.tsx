import { useCallback, useEffect, useMemo } from "react"
import {
    AlertCircle,
    Check,
    ChevronRight,
    Cloud,
    Download,
    Eye,
    EyeOff,
    Key,
    Link2,
    Loader2,
    Plus,
    Server,
    Sparkles,
    Tag,
    Trash2,
    X,
    Zap,
} from "lucide-react"
import { toast } from "sonner"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useDictionary } from "@/hooks/use-dictionary"
import type { UseModelConfigReturn } from "@/hooks/use-model-config"
import type { ProviderConfig, ProviderName } from "@/shared/types/model-config"
import { PROVIDER_INFO, SUGGESTED_MODELS } from "@/shared/types/model-config"
import { cn } from "@/shared/utils"

interface ToolboxConfigViewProps {
    // 搜索
    searchQuery: string

    // 模型配置
    modelConfig: UseModelConfigReturn
    showUnvalidatedModels: boolean

    // 状态
    selectedProviderId: string | null
    setSelectedProviderId: (id: string | null) => void
    showApiKey: boolean
    setShowApiKey: (show: boolean) => void
    validationStatus: "idle" | "validating" | "success" | "error"
    setValidationStatus: (status: "idle" | "validating" | "success" | "error") => void
    validationError: string
    setValidationError: (error: string) => void
    customModelInput: string
    setCustomModelInput: (input: string) => void
    duplicateError: string
    setDuplicateError: (error: string) => void
    validatingModelIndex: number | null
    setValidatingModelIndex: (index: number | null) => void
    providerDeleteConfirm: string | null
    setProviderDeleteConfirm: (id: string | null) => void
    validationResetTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>

    // 回调
    onBack: () => void
}

const PROVIDER_LOGO_MAP: Record<string, string> = {
    openai: "openai",
    anthropic: "anthropic",
    google: "google",
    azure: "azure",
    bedrock: "amazon-bedrock",
    openrouter: "openrouter",
    deepseek: "deepseek",
    siliconflow: "siliconflow",
    dashscope: "alibaba-cloud",
    doubao: "bytedance",
    modelscope: "modelscope",
    zhipu: "zhipu",
}

function ProviderLogo({ provider, className }: { provider: ProviderName; className?: string }) {
    if (provider === "bedrock") {
        return <Cloud className={cn("size-4", className)} />
    }
    if (provider === "sglang") {
        return <Server className={cn("size-4", className)} />
    }
    if (provider === "doubao") {
        return <Sparkles className={cn("size-4", className)} />
    }
    const logoName = PROVIDER_LOGO_MAP[provider] || provider
    return (
        <img
            alt={`${provider} logo`}
            className={cn("size-4 dark:invert", className)}
            height={16}
            src={`https://models.dev/logos/${logoName}.svg`}
            width={16}
        />
    )
}

export function ToolboxConfigView({
    searchQuery,
    modelConfig,
    showUnvalidatedModels,
    selectedProviderId,
    setSelectedProviderId,
    showApiKey,
    setShowApiKey,
    validationStatus,
    setValidationStatus,
    validationError,
    setValidationError,
    customModelInput,
    setCustomModelInput,
    duplicateError,
    setDuplicateError,
    validatingModelIndex,
    setValidatingModelIndex,
    providerDeleteConfirm,
    setProviderDeleteConfirm,
    validationResetTimeoutRef,
    onBack,
}: ToolboxConfigViewProps) {
    const dict = useDictionary()

    // 计算值
    const selectedProvider = modelConfig.config.providers.find((p) => p.id === selectedProviderId)

    const suggestedModels = selectedProvider
        ? SUGGESTED_MODELS[selectedProvider.provider] || []
        : []

    const existingModelIds = selectedProvider?.models.map((m) => m.modelId) || []
    const availableSuggestions = suggestedModels.filter((modelId) => !existingModelIds.includes(modelId))

    const filteredProviders = useMemo(() => {
        if (!searchQuery) return modelConfig.config.providers
        const q = searchQuery.toLowerCase()
        return modelConfig.config.providers.filter((p) => {
            const name = p.name || PROVIDER_INFO[p.provider]?.label || p.provider
            return (
                name.toLowerCase().includes(q) ||
                p.provider.toLowerCase().includes(q) ||
                p.models.some((m) => m.modelId.toLowerCase().includes(q))
            )
        })
    }, [modelConfig.config.providers, searchQuery])

    const filteredProviderModels = useMemo(() => {
        if (!selectedProvider) return []
        if (!searchQuery) return selectedProvider.models
        const q = searchQuery.toLowerCase()
        return selectedProvider.models.filter((m) => m.modelId.toLowerCase().includes(q))
    }, [selectedProvider, searchQuery])

    // 清理验证超时
    useEffect(() => {
        return () => {
            if (validationResetTimeoutRef.current) {
                clearTimeout(validationResetTimeoutRef.current)
            }
        }
    }, [validationResetTimeoutRef])

    // 处理器
    const handleAddProvider = (providerType: ProviderName) => {
        const newProvider = modelConfig.addProvider(providerType)
        setSelectedProviderId(newProvider.id)
        setValidationStatus("idle")
    }

    const handleProviderUpdate = (field: keyof ProviderConfig, value: string | boolean) => {
        if (!selectedProviderId) return
        modelConfig.updateProvider(selectedProviderId, { [field]: value })
        const credentialFields = ["apiKey", "baseUrl", "awsAccessKeyId", "awsSecretAccessKey", "awsRegion"]
        if (credentialFields.includes(field)) {
            setValidationStatus("idle")
            modelConfig.updateProvider(selectedProviderId, { validated: false })
        }
    }

    const handleAddModel = (modelId: string): boolean => {
        if (!selectedProviderId || !selectedProvider) return false
        if (existingModelIds.includes(modelId)) {
            setDuplicateError(`Model "${modelId}" already exists`)
            return false
        }
        setDuplicateError("")
        modelConfig.addModel(selectedProviderId, modelId)
        return true
    }

    const handleDeleteModelInConfig = (modelConfigId: string) => {
        if (!selectedProviderId) return
        modelConfig.deleteModel(selectedProviderId, modelConfigId)
    }

    const handleDeleteProvider = () => {
        if (!selectedProviderId) return
        modelConfig.deleteProvider(selectedProviderId)
        setSelectedProviderId(null)
        setValidationStatus("idle")
        setProviderDeleteConfirm(null)
    }

    const handleValidate = useCallback(async () => {
        if (!selectedProvider || !selectedProviderId) return

        const isBedrock = selectedProvider.provider === "bedrock"
        const isEdgeOne = selectedProvider.provider === "edgeone"
        if (isBedrock) {
            if (!selectedProvider.awsAccessKeyId || !selectedProvider.awsSecretAccessKey || !selectedProvider.awsRegion) {
                return
            }
        } else if (!isEdgeOne && !selectedProvider.apiKey) {
            return
        }

        if (selectedProvider.models.length === 0) {
            setValidationError("Add at least one model to validate")
            setValidationStatus("error")
            return
        }

        setValidationStatus("validating")
        setValidationError("")

        let allValid = true
        let errorCount = 0

        for (let i = 0; i < selectedProvider.models.length; i++) {
            const model = selectedProvider.models[i]
            setValidatingModelIndex(i)

            try {
                const baseUrl = isEdgeOne ? `${window.location.origin}/api/edgeai` : selectedProvider.baseUrl

                const response = await fetch("/api/validate-model", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        provider: selectedProvider.provider,
                        apiKey: selectedProvider.apiKey,
                        baseUrl,
                        modelId: model.modelId,
                        awsAccessKeyId: selectedProvider.awsAccessKeyId,
                        awsSecretAccessKey: selectedProvider.awsSecretAccessKey,
                        awsRegion: selectedProvider.awsRegion,
                    }),
                })
                const data = await response.json()

                if (data.valid) {
                    modelConfig.updateModel(selectedProviderId, model.id, {
                        validated: true,
                        validationError: undefined,
                    })
                } else {
                    allValid = false
                    errorCount++
                    modelConfig.updateModel(selectedProviderId, model.id, {
                        validated: false,
                        validationError: data.error || "Validation failed",
                    })
                }
            } catch {
                allValid = false
                errorCount++
                modelConfig.updateModel(selectedProviderId, model.id, {
                    validated: false,
                    validationError: "Network error",
                })
            }
        }

        setValidatingModelIndex(null)

        if (allValid) {
            setValidationStatus("success")
            modelConfig.updateProvider(selectedProviderId, { validated: true })
            if (validationResetTimeoutRef.current) {
                clearTimeout(validationResetTimeoutRef.current)
            }
            validationResetTimeoutRef.current = setTimeout(() => {
                setValidationStatus("idle")
                validationResetTimeoutRef.current = null
            }, 1500)
        } else {
            setValidationStatus("error")
            setValidationError(`${errorCount} model(s) failed validation`)
        }
    }, [selectedProvider, selectedProviderId, modelConfig, setValidatingModelIndex, setValidationStatus, setValidationError, validationResetTimeoutRef])

    return (
        <div className="flex h-full min-h-[300px]">
            {/* 左侧 Provider 列表 */}
            <div className="w-48 shrink-0 flex flex-col border-r border-border/30">
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {filteredProviders.length === 0 ? (
                            <div className="px-2 py-6 text-center">
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-background mb-2">
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {dict.modelConfig.addProviderHint}
                                </p>
                            </div>
                        ) : (
                            filteredProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedProviderId(provider.id)
                                        setValidationStatus("idle")
                                        setShowApiKey(false)
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors",
                                        "hover:bg-background/60",
                                        selectedProviderId === provider.id && "bg-background/80 ring-1 ring-border"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "w-6 h-6 rounded-md flex items-center justify-center",
                                            "bg-background",
                                            selectedProviderId === provider.id && "bg-primary/10"
                                        )}
                                    >
                                        <ProviderLogo provider={provider.provider} className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="flex-1 truncate">
                                        {provider.name || PROVIDER_INFO[provider.provider]?.label}
                                    </span>
                                    {provider.validated ? (
                                        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <Check className="h-2.5 w-2.5 text-green-600" />
                                        </div>
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>

                {/* 添加 Provider */}
                <div className="p-2 border-t border-border/30">
                    <Select onValueChange={(v) => handleAddProvider(v as ProviderName)}>
                        <SelectTrigger className="w-full h-8 rounded-lg bg-background border-border/50 text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                            <SelectValue placeholder={dict.modelConfig.addProvider} />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(PROVIDER_INFO) as ProviderName[]).map((p) => (
                                <SelectItem key={p} value={p} className="text-xs">
                                    <div className="flex items-center gap-2">
                                        <ProviderLogo provider={p} className="h-3.5 w-3.5" />
                                        <span>{PROVIDER_INFO[p].label}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 右侧 Provider 详情 - 太长，使用条件渲染 */}
            <div className="flex-1 min-w-0 overflow-y-auto">
                {selectedProvider ? (
                    <div className="p-3 space-y-4">
                        {/* Provider 头部 */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
                                <ProviderLogo provider={selectedProvider.provider} className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium truncate">
                                    {PROVIDER_INFO[selectedProvider.provider]?.label}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    {selectedProvider.models.length} 个模型
                                </p>
                            </div>
                            {selectedProvider.validated && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                                    <Check className="h-3 w-3" />
                                    <span className="text-xs">已验证</span>
                                </div>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (providerDeleteConfirm === selectedProviderId) {
                                        handleDeleteProvider()
                                    } else {
                                        setProviderDeleteConfirm(selectedProviderId)
                                    }
                                }}
                                className={cn(
                                    "h-7 px-2 text-xs",
                                    providerDeleteConfirm === selectedProviderId
                                        ? "text-destructive bg-destructive/10 hover:bg-destructive/20"
                                        : "text-muted-foreground hover:text-destructive"
                                )}
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                {providerDeleteConfirm === selectedProviderId ? "确认删除" : "删除"}
                            </Button>
                        </div>

                        {/* 配置区域 */}
                        <div className="space-y-3 rounded-xl border border-border/30 bg-background/50 p-3">
                            {/* 显示名称 */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Tag className="h-3 w-3" />
                                    {dict.modelConfig.displayName}
                                </Label>
                                <Input
                                    value={selectedProvider.name || ""}
                                    onChange={(e) => handleProviderUpdate("name", e.target.value)}
                                    placeholder={PROVIDER_INFO[selectedProvider.provider]?.label}
                                    className="h-8 text-sm"
                                />
                            </div>

                            {/* API Key - 非 Bedrock 和 EdgeOne */}
                            {selectedProvider.provider !== "bedrock" && selectedProvider.provider !== "edgeone" && (
                                <>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Key className="h-3 w-3" />
                                            {dict.modelConfig.apiKey}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                type={showApiKey ? "text" : "password"}
                                                value={selectedProvider.apiKey || ""}
                                                onChange={(e) => handleProviderUpdate("apiKey", e.target.value)}
                                                placeholder={dict.modelConfig.enterApiKey}
                                                className="h-8 text-sm pr-8 font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showApiKey ? (
                                                    <EyeOff className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Eye className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Link2 className="h-3 w-3" />
                                            {dict.modelConfig.baseUrl}
                                            <span className="text-muted-foreground/60">({dict.modelConfig.optional})</span>
                                        </Label>
                                        <Input
                                            value={selectedProvider.baseUrl || ""}
                                            onChange={(e) => handleProviderUpdate("baseUrl", e.target.value)}
                                            placeholder={
                                                PROVIDER_INFO[selectedProvider.provider]?.defaultBaseUrl ||
                                                dict.modelConfig.customEndpoint
                                            }
                                            className="h-8 text-sm font-mono"
                                        />
                                    </div>
                                </>
                            )}

                            {/* AWS Bedrock 凭证 */}
                            {selectedProvider.provider === "bedrock" && (
                                <>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Key className="h-3 w-3" />
                                            {dict.modelConfig.awsAccessKeyId}
                                        </Label>
                                        <Input
                                            type={showApiKey ? "text" : "password"}
                                            value={selectedProvider.awsAccessKeyId || ""}
                                            onChange={(e) => handleProviderUpdate("awsAccessKeyId", e.target.value)}
                                            placeholder="AKIA..."
                                            className="h-8 text-sm font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Key className="h-3 w-3" />
                                            {dict.modelConfig.awsSecretAccessKey}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                type={showApiKey ? "text" : "password"}
                                                value={selectedProvider.awsSecretAccessKey || ""}
                                                onChange={(e) => handleProviderUpdate("awsSecretAccessKey", e.target.value)}
                                                placeholder={dict.modelConfig.enterSecretKey}
                                                className="h-8 text-sm pr-8 font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showApiKey ? (
                                                    <EyeOff className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Eye className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Link2 className="h-3 w-3" />
                                            {dict.modelConfig.awsRegion}
                                        </Label>
                                        <Select
                                            value={selectedProvider.awsRegion || ""}
                                            onValueChange={(v) => handleProviderUpdate("awsRegion", v)}
                                        >
                                            <SelectTrigger className="h-8 text-sm font-mono">
                                                <SelectValue placeholder={dict.modelConfig.selectRegion} />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-48">
                                                {[
                                                    "us-east-1",
                                                    "us-east-2",
                                                    "us-west-2",
                                                    "eu-west-1",
                                                    "eu-west-2",
                                                    "eu-central-1",
                                                    "ap-northeast-1",
                                                    "ap-southeast-1",
                                                    "ap-southeast-2",
                                                ].map((region) => (
                                                    <SelectItem key={region} value={region} className="text-xs font-mono">
                                                        {region}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}

                            {/* 验证按钮 */}
                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    variant={validationStatus === "success" ? "outline" : "default"}
                                    size="sm"
                                    onClick={handleValidate}
                                    disabled={
                                        (selectedProvider.provider === "bedrock"
                                            ? !selectedProvider.awsAccessKeyId ||
                                              !selectedProvider.awsSecretAccessKey ||
                                              !selectedProvider.awsRegion
                                            : selectedProvider.provider !== "edgeone" && !selectedProvider.apiKey) ||
                                        validationStatus === "validating"
                                    }
                                    className={cn(
                                        "h-7 px-3 text-xs",
                                        validationStatus === "success" && "text-green-600 border-green-500/30 bg-green-500/10"
                                    )}
                                >
                                    {validationStatus === "validating" ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : validationStatus === "success" ? (
                                        <>
                                            <Check className="h-3.5 w-3.5 mr-1" />
                                            {dict.modelConfig.verified}
                                        </>
                                    ) : (
                                        dict.modelConfig.test
                                    )}
                                </Button>
                                {validationStatus === "error" && validationError && (
                                    <p className="text-xs text-destructive flex items-center gap-1">
                                        <X className="h-3 w-3" />
                                        {validationError}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 模型列表 */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    {dict.modelConfig.models}
                                </Label>
                                <div className="flex items-center gap-1.5">
                                    <div className="relative">
                                        <Input
                                            placeholder={dict.modelConfig.customModelId}
                                            value={customModelInput || ""}
                                            onChange={(e) => {
                                                setCustomModelInput(e.target.value)
                                                if (duplicateError) setDuplicateError("")
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && customModelInput.trim()) {
                                                    const success = handleAddModel(customModelInput.trim())
                                                    if (success) setCustomModelInput("")
                                                }
                                            }}
                                            className={cn("h-7 w-32 text-xs font-mono", duplicateError && "border-destructive")}
                                        />
                                        {duplicateError && (
                                            <p className="absolute top-full left-0 mt-0.5 text-[10px] text-destructive whitespace-nowrap">
                                                {duplicateError}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => {
                                            if (customModelInput.trim()) {
                                                const success = handleAddModel(customModelInput.trim())
                                                if (success) setCustomModelInput("")
                                            }
                                        }}
                                        disabled={!customModelInput.trim()}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                    <Select
                                        onValueChange={(value) => value && handleAddModel(value)}
                                        disabled={availableSuggestions.length === 0}
                                    >
                                        <SelectTrigger className="h-7 w-20 text-xs">
                                            <span>
                                                {availableSuggestions.length === 0
                                                    ? dict.modelConfig.allAdded
                                                    : dict.modelConfig.suggested}
                                            </span>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-48">
                                            {availableSuggestions.map((modelId) => (
                                                <SelectItem key={modelId} value={modelId} className="text-xs font-mono">
                                                    {modelId}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* 模型列表 */}
                            <div className="rounded-lg border border-border/30 bg-background/30 overflow-hidden">
                                {filteredProviderModels.length === 0 ? (
                                    <div className="p-4 text-center">
                                        <Sparkles className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-xs text-muted-foreground">{dict.modelConfig.noModelsConfigured}</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/30">
                                        {filteredProviderModels.map((model, index) => (
                                            <div
                                                key={model.id}
                                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/30 transition-colors"
                                            >
                                                {/* 状态图标 */}
                                                <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
                                                    {validatingModelIndex !== null && index === validatingModelIndex ? (
                                                        <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                                                    ) : validatingModelIndex !== null && index > validatingModelIndex && model.validated === undefined ? (
                                                        <div className="h-3.5 w-3.5 text-muted-foreground">⏱</div>
                                                    ) : model.validated === true ? (
                                                        <Check className="h-3.5 w-3.5 text-green-600" />
                                                    ) : model.validated === false ? (
                                                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                                                    ) : (
                                                        <Zap className="h-3.5 w-3.5 text-primary" />
                                                    )}
                                                </div>

                                                {/* 模型 ID */}
                                                <span className="flex-1 text-xs font-mono truncate" title={model.modelId}>
                                                    {model.modelId}
                                                </span>

                                                {/* 错误信息 */}
                                                {model.validated === false && model.validationError && (
                                                    <span
                                                        className="text-[10px] text-destructive truncate max-w-24"
                                                        title={model.validationError}
                                                    >
                                                        {model.validationError}
                                                    </span>
                                                )}

                                                {/* 删除按钮 */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeleteModelInConfig(model.id)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center mb-3">
                            <Server className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h4 className="text-sm font-medium mb-1">{dict.modelConfig.configureProviders}</h4>
                        <p className="text-xs text-muted-foreground">{dict.modelConfig.selectProviderHint}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
