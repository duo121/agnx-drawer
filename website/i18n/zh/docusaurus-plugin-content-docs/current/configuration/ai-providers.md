---
sidebar_position: 1
---

# AI 提供商配置

AGNX Drawer 支持 10+ AI 提供商。在 `.env.local` 中配置你偏好的提供商。

## 支持的提供商

### OpenAI

```bash
OPENAI_API_KEY=your_api_key
AI_MODEL=gpt-4o
```

可选自定义端点：
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

### Ollama（本地）

```bash
AI_PROVIDER=ollama
AI_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434
```

### 其他提供商

- **SiliconFlow**: `SILICONFLOW_API_KEY`
- **OpenRouter**: `OPENROUTER_API_KEY`
- **ModelScope**: `MODELSCOPE_API_KEY`
- **豆包（字节跳动）**: `DOUBAO_API_KEY`
- **Vercel AI Gateway**: `AI_GATEWAY_API_KEY`

## 自动检测

如果只配置了一个提供商的 API Key，系统会自动检测并使用。

配置多个提供商时，需要显式设置：
```bash
AI_PROVIDER=google  # openai, anthropic, deepseek, azure, bedrock, ollama 等
```

## 模型要求

此任务需要强大的模型能力，因为涉及生成具有严格格式约束的长文本（draw.io XML）。

**推荐模型**：
- Claude Sonnet 4.5 / Opus 4.5
- GPT-4o / GPT-5.1
- Gemini 2.0 Flash / 3 Pro
- DeepSeek V3.2 / R1

:::tip
Claude 模型在带有云架构 Logo（AWS、Azure、GCP）的 draw.io 图表上进行过训练，非常适合创建云架构图。
:::
