---
sidebar_position: 2
---

# Environment Variables

Complete reference for all environment variables.

## AI Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `AI_PROVIDER` | AI provider to use | Auto-detected |
| `AI_MODEL` | Model identifier | Yes |
| `TEMPERATURE` | Model temperature (0-1) | No |

## Provider API Keys

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `AZURE_API_KEY` | Azure OpenAI |
| `DOUBAO_API_KEY` | ByteDance Doubao |
| `SILICONFLOW_API_KEY` | SiliconFlow |
| `OPENROUTER_API_KEY` | OpenRouter |
| `MODELSCOPE_API_KEY` | ModelScope |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway |

## Custom Endpoints

| Variable | Description |
|----------|-------------|
| `OPENAI_BASE_URL` | Custom OpenAI-compatible endpoint |
| `ANTHROPIC_BASE_URL` | Custom Anthropic endpoint |
| `GOOGLE_BASE_URL` | Custom Google AI endpoint |
| `DEEPSEEK_BASE_URL` | Custom DeepSeek endpoint |
| `AZURE_BASE_URL` | Azure OpenAI endpoint |
| `OLLAMA_BASE_URL` | Ollama server URL |

## AWS Bedrock

| Variable | Description |
|----------|-------------|
| `AWS_REGION` | AWS region |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |

## Access Control

| Variable | Description |
|----------|-------------|
| `ACCESS_CODE` | Optional access code for demo site |

## Example Configuration

```bash
# .env.local
OPENAI_API_KEY=sk-xxx
AI_MODEL=gpt-4o
TEMPERATURE=0
```
