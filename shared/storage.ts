// Centralized localStorage keys for quota tracking and settings
// Chat data is now stored in IndexedDB via session-storage.ts

export const STORAGE_KEYS = {
    // Quota tracking
    requestCount: "agnx-request-count",
    requestDate: "agnx-request-date",
    tokenCount: "agnx-token-count",
    tokenDate: "agnx-token-date",
    tpmCount: "agnx-tpm-count",
    tpmMinute: "agnx-tpm-minute",

    // Settings
    accessCode: "agnx-access-code",
    closeProtection: "agnx-close-protection",
    accessCodeRequired: "agnx-access-code-required",
    aiProvider: "agnx-ai-provider",
    aiBaseUrl: "agnx-ai-base-url",
    aiApiKey: "agnx-ai-api-key",
    aiModel: "agnx-ai-model",

    // Multi-model configuration
    modelConfigs: "agnx-model-configs",
    selectedModelId: "agnx-selected-model-id",
} as const
