---
sidebar_position: 2
---

# 环境变量

所有环境变量的完整参考。

## AI 配置

| 变量 | 描述 | 必需 |
|------|------|------|
| `AI_PROVIDER` | 使用的 AI 提供商 | 自动检测 |
| `AI_MODEL` | 模型标识符 | 是 |
| `TEMPERATURE` | 模型温度 (0-1) | 否 |

## 提供商 API Key

| 变量 | 提供商 |
|------|--------|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `AZURE_API_KEY` | Azure OpenAI |
| `DOUBAO_API_KEY` | 字节跳动豆包 |
| `SILICONFLOW_API_KEY` | SiliconFlow |
| `OPENROUTER_API_KEY` | OpenRouter |
| `MODELSCOPE_API_KEY` | ModelScope |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway |

## 自定义端点

| 变量 | 描述 |
|------|------|
| `OPENAI_BASE_URL` | 自定义 OpenAI 兼容端点 |
| `ANTHROPIC_BASE_URL` | 自定义 Anthropic 端点 |
| `GOOGLE_BASE_URL` | 自定义 Google AI 端点 |
| `DEEPSEEK_BASE_URL` | 自定义 DeepSeek 端点 |
| `AZURE_BASE_URL` | Azure OpenAI 端点 |
| `OLLAMA_BASE_URL` | Ollama 服务器 URL |

## 示例配置

```bash
# .env.local
OPENAI_API_KEY=sk-xxx
AI_MODEL=gpt-4o
TEMPERATURE=0
```
