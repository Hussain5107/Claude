# Notes for Claude Code sessions

## Free LLM API providers

Reference list: https://github.com/cheahjs/free-llm-api-resources

Reviewed July 2026. Useful whenever a project needs an LLM call and we want to
avoid paying during development. Re-check the limits at the link before relying
on them — free tiers change often.

### Preferred picks

| Use | Provider | Why |
|---|---|---|
| High volume, fast | **Groq** | Best free throughput (~14,400 req/day on Llama 3.1 8B), fast inference, no training opt-in |
| Best free model quality | **Google AI Studio (Gemini)** | Strong models, large context — but see training caveat |
| Trying many models | **OpenRouter** | One API across dozens of models; 50 req/day free, 1,000/day after a one-off $10 topup |
| Edge / Cloudflare deploys | **Workers AI** | 10,000 neurons/day, runs next to Pages/Workers |
| Also free | Cohere (1,000 req/month), NVIDIA NIM (40 req/min, phone verification), Mistral La Plateforme (requires training opt-in) |

### Rules we agreed on

1. **Training terms matter.** Google AI Studio's free tier uses prompts for
   training outside the UK/CH/EEA/EU — that includes the UAE. Mistral's free
   tier requires explicitly opting into training. Groq, OpenRouter and
   Cloudflare are cleaner on this.
2. **Never send sensitive data to a training-enabled free tier.** Rules out the
   finance and crypto projects (`smart-finance-pro`, `crypto-day-trading-desk`)
   and anything carrying other people's data.
3. **Free tiers are for personal tooling and development, not production.**
   Fine for meditation/voice/script pipelines and experiments. For a real
   user-facing app (`forge-saas`), develop on free, budget for paid before
   launch — free tiers get revoked or rate-limited without notice.
4. **Always go through a thin provider interface** (or just use OpenRouter) so
   swapping providers is a config change, not a refactor.
