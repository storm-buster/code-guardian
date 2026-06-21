# 🛡️ Code Guardian — AI Security Review Agent

> **NeuroX Hackathon 2026 | ArmorIQ Track 2: AI Agent for the Real World**

An AI-powered security code review agent wrapped in a stunning 2026-era Cybernetic Terminal UI. It automatically scans repositories or raw code for vulnerabilities, generates context-aware explanations and remediation code using LLMs, triages findings based on ArmorIQ policies, and takes real-time action directly on GitHub.

## 🔥 Key Features

1. **GitHub Integration (OAuth)**: Securely connect your GitHub account via NextAuth to import repositories or individual files.
2. **Real-Time Remediation (Octokit)**: 
   - **Approve**: The agent automatically creates a new branch on GitHub, applies the AI-generated security fix, and opens a Pull Request.
   - **Flag / Block**: Instantly opens a labeled Issue (`needs-security-review` / `security-blocked`) on the target GitHub repository for developer attention.
3. **Full Repository Scanning**: Scan entire GitHub repositories at once. (Note: Automated PRs are disabled during full repo scans to prevent branch pollution; blocking/flagging remains active).
4. **AI Vulnerability Analysis**: Powered by Google Gemini 2.5 Flash via OpenRouter. The AI explains the vulnerability context, line numbers, variables, and writes exact drop-in replacement code.
5. **ArmorIQ Policy Triage**: Findings are run against ArmorIQ SDK policies, issuing verifiable cryptographic audit trails and intent tokens for every decision.
6. **2026 "Threat Intelligence" UI**: Features a high-performance Three.js (`@react-three/fiber`) interactive particle background, glassmorphism design, pulsing threat indicators, and live triage statistics.

## 🏗️ Architecture Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | Next.js 16 (App Router), React, TypeScript |
| **Styling & 3D** | Custom CSS (Glassmorphism), Tailwind CSS, `@react-three/fiber`, `three` |
| **Authentication** | NextAuth (`next-auth`) with GitHub Provider (`read:user`, `repo` scopes) |
| **GitHub Actions** | `@octokit/rest` for automated Git branching, commits, PRs, and Issues |
| **AI/LLM Engine** | Google Gemini 2.5 Flash via OpenRouter API |
| **Security Audit** | ArmorIQ TypeScript SDK (`@armoriq/sdk`) |
| **Static Analysis** | Custom regex-based AST scanner (15+ vulnerability patterns) |

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd code-guardian

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Configure `.env.local`

```env
# NextAuth settings
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-secure-random-string

# GitHub OAuth App (Create at GitHub -> Settings -> Developer Settings -> OAuth Apps)
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret

# AI & Security Services
OPENROUTER_API_KEY=your_openrouter_key
ARMORIQ_API_KEY=your_armoriq_key
```

```bash
# Run the development server
npm run dev
```

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # NextAuth GitHub Provider configuration
│   │   ├── github/        # Octokit endpoints (approve, block, flag, repos, tree, file)
│   │   └── scan/          # Scanner + LLM + ArmorIQ pipeline
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Threat Terminal Dashboard & Triage Orchestrator
│   └── globals.css        # 2026 Design System (CSS variables, animations)
├── components/
│   ├── ParticleBackground.tsx # Three.js interactive 3D background
│   ├── RepoPicker.tsx         # GitHub repository & file selection modal
│   ├── ToastContainer.tsx     # Real-time event notification system
│   ├── StatsPanel.tsx         # Live triage statistics
│   ├── FindingsPanel.tsx      # Expandable vulnerability cards
│   └── AuditLog.tsx           # ArmorIQ audit trail viewer
└── lib/
    ├── scanner.ts         # Static analysis engine (CWE patterns)
    ├── llm.ts             # OpenRouter LLM integration
    └── armoriq.ts         # ArmorIQ SDK integration
```

## 🔐 GitHub Permissions

When users click **Connect GitHub**, they will be prompted to authorize the application with the `repo` scope. This is strictly required to enable the AI Agent to:
- Read repository files and directory trees.
- Create new git branches and commit remediation code.
- Open Pull Requests (`Approve` action).
- Open Security Issues and apply labels (`Block` / `Flag` actions).

Because it uses the logged-in user's Personal Access Token via OAuth, the agent acts entirely on their behalf and is bound by their specific repository permissions.

## 🌐 Deployment (Vercel)

1. Push code to your GitHub repository.
2. Import the project into Vercel.
3. In your Vercel Project Settings → Environment Variables, add **all** variables from your `.env.local`.
   - *Note: Ensure `NEXTAUTH_URL` is set to your production Vercel domain.*
4. Deploy.

## 👥 Team
**Code Guardian Team** — NeuroX Hackathon 2026
