# 🛡️ Code Guardian — AI Security Review Agent

> **NeuroX Hackathon 2026 | ArmorIQ Track 2: AI Agent for the Real World**

AI-powered code security scanner that finds vulnerabilities, explains them in plain English using real LLM analysis, auto-triages with policy-gated decisions, and logs everything via ArmorIQ SDK.

## 🔥 What It Does

1. **Paste your code** → real-time static analysis with 15 vulnerability detection patterns
2. **AI explains** → each finding sent to LLM (Gemini 2.5 Flash via OpenRouter) for context-aware explanation mentioning actual variable names, line numbers
3. **Agent triages** → severity-based auto-triage (block/flag/approve) with policy-backed reasoning
4. **ArmorIQ logs** → plan capture + intent token issuance via `@armoriq/sdk` for cryptographic audit trail

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, TypeScript |
| Styling | Tailwind CSS + Custom CSS (Glassmorphism, Animations) |
| AI/LLM | Google Gemini 2.5 Flash via OpenRouter API |
| Security SDK | ArmorIQ TypeScript SDK (`@armoriq/sdk`) |
| Scanner | Custom regex-based static analysis engine |
| Deployment | Vercel |

## 🚀 Quick Start

```bash
# Clone
git clone <repo-url>
cd code-guardian

# Install
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run
npm run dev
```

## 🔑 Environment Variables

| Variable | Description | Get it from |
|----------|-------------|-------------|
| `OPENROUTER_API_KEY` | LLM API key for AI explanations | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `ARMORIQ_API_KEY` | ArmorIQ SDK key for audit + policy | [platform.armoriq.ai](https://platform.armoriq.ai) |

## 📁 Project Structure

```
src/
├── app/
│   ├── api/scan/route.ts    # API: scanner + LLM + ArmorIQ pipeline
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Main dashboard
│   └── globals.css          # Design system
├── components/
│   ├── Navbar.tsx           # Top navigation
│   ├── StatsPanel.tsx       # Security score + severity breakdown
│   ├── FindingsPanel.tsx    # Expandable vulnerability cards
│   ├── AuditLog.tsx         # ArmorIQ audit trail viewer
│   └── ScanAnimation.tsx    # Scanning state animation
└── lib/
    ├── scanner.ts           # Static analysis engine (15 vuln patterns)
    ├── llm.ts               # OpenRouter LLM integration
    ├── armoriq.ts           # ArmorIQ SDK integration
    ├── types.ts             # TypeScript types
    └── demo-code.ts         # Demo vulnerable code samples
```

## 🔍 Vulnerability Patterns Detected

- SQL Injection (CWE-89)
- Cross-Site Scripting / XSS (CWE-79)
- Hardcoded Secrets / API Keys (CWE-798)
- OS Command Injection (CWE-78)
- Path Traversal (CWE-22)
- Insecure Deserialization (CWE-502)
- Weak Cryptography (CWE-327)
- CORS Misconfiguration (CWE-942)
- Missing Authentication (CWE-306)
- SSRF (CWE-918)
- JWT Verification Bypass (CWE-347)
- Debug Mode / Sensitive Logging (CWE-215)

## 🌐 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables (`OPENROUTER_API_KEY`, `ARMORIQ_API_KEY`)
4. Deploy

## 👥 Team

**Code Guardian Team** — NeuroX Hackathon 2026
