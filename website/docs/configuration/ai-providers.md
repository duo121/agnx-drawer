---
sidebar_position: 1
---

# AI Provider Configuration

AGNX Drawer supports 10+ AI providers. Configure your preferred provider in `.env.local`.

## Supported Providers

### OpenAI

```bash
OPENAI_API_KEY=your_api_key
AI_MODEL=gpt-4o
```

Optional custom endpoint:
```bash
OPENAI_BASE_URL=https://your-custom-endpoint/v1
```

### Anthropic

```bash
ANTHROPIC_API_KEY=your_api_key
AI_MODEL=claude-sonnet-4-5-20250514
```

### Google Gemini

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key
AI_MODEL=gemini-2.0-flash
```

### DeepSeek

```bash
DEEPSEEK_API_KEY=your_api_key
AI_MODEL=deepseek-chat
```

### Azure OpenAI

```bash
AZURE_API_KEY=your_api_key
AZURE_RESOURCE_NAME=your-resource-name
AI_MODEL=your-deployment-name
```

### AWS Bedrock

```bash
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AI_MODEL=anthropic.claude-sonnet-4-5-20250514-v1:0
```

### Ollama (Local)

```bash
AI_PROVIDER=ollama
AI_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434
```

### Other Providers

- **SiliconFlow**: `SILICONFLOW_API_KEY`
- **OpenRouter**: `OPENROUTER_API_KEY`
- **ModelScope**: `MODELSCOPE_API_KEY`
- **Doubao (ByteDance)**: `DOUBAO_API_KEY`
- **Vercel AI Gateway**: `AI_GATEWAY_API_KEY`

## Auto-Detection

If you configure only one provider's API key, the system automatically detects and uses it.

For multiple providers, explicitly set:
```bash
AI_PROVIDER=google  # openai, anthropic, deepseek, azure, bedrock, ollama, etc.
```

## Model Requirements

This task requires strong model capabilities for generating long-form text with strict formatting (draw.io XML).

**Recommended models**:
- Claude Sonnet 4.5 / Opus 4.5
- GPT-4o / GPT-5.1
- Gemini 2.0 Flash / 3 Pro
- DeepSeek V3.2 / R1

:::tip
Claude models are trained on draw.io diagrams with cloud architecture logos (AWS, Azure, GCP), making them ideal for cloud architecture diagrams.
:::
