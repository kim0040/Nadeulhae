# Nadeulhae (나들해)

> 🌐 [한국어](docs/README_KO.md) · [中文](docs/README_ZH.md) · [日本語](docs/README_JA.md)

> **Weather-based picnic scoring + AI dashboard chat + Lab (vocab/code-share) + Jeonju local briefing**

Full-stack Next.js 16 web application. Real-time collaborative code editor, FSRS spaced repetition learning, AI web-search chat, GPS-based weather scoring — all in one service.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributors](#contributors)
- [License](#license)

---

## Features

| Feature | Description |
|---------|-------------|
| **🌤️ Weather Intelligence** | Combines KMA, AirKorea, and APIHub real-time data to compute a 0-100 outdoor activity score. Satellite/radar imagery, hourly forecasts, and wildfire information |
| **🤖 Dashboard AI Chat** | AI chatbot with weather context injection. SSE streaming responses, cross-session user memory, and automatic context compaction |
| **📚 Lab** | FSRS v5 algorithm-based vocabulary cards, AI deck generation, and web-search-integrated AI chat |
| **💻 Code Share** | CodeMirror 6-based real-time collaborative editor. WebSocket presence, typing indicators, and optimistic concurrency control |
| **📍 Jeonju Daily Briefing** | AI-generated daily briefing tailored for Jeonju City. Local chat and safety information |
| **📊 Statistics Calendar** | Historical weather archives and monthly outdoor activity score trends |
| **🌐 4 Languages** | 한국어, English, 中文, 日本語 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 6 (Strict) |
| **Frontend** | React 19, TailwindCSS 4, Framer Motion, Lucide Icons |
| **Code Editor** | CodeMirror 6 (`@uiw/react-codemirror`) |
| **Real-time** | WebSocket (`ws` v8) |
| **Database** | TiDB / MySQL 8 (`mysql2/promise`) |
| **AI / LLM** | OpenAI-compatible API (General + Lab dual config) |
| **Web Search** | Tavily API |
| **Coordinate Transform** | proj4 (WGS84 ↔ TM) |
| **Auth & Security** | scrypt (N=16384) + pepper, AES-256-GCM field encryption |
| **Deployment** | PM2 + Nginx reverse proxy |

---

## Project Structure

```
Nadeulhae/
├── README.md
├── docs/                        # Documentation
│   ├── ARCHITECTURE_UML.md      # UML diagrams (English)
│   ├── ARCHITECTURE_UML_KO.md   # UML diagrams (Korean)
│   ├── README_KO.md             # 한국어 README
│   ├── README_JA.md             # 日本語のREADME
│   ├── README_ZH.md             # 中文 README
│   └── ...
├── nadeulhae/
│   ├── server.ts                # Custom HTTP + WebSocket server
│   ├── package.json
│   └── src/
│       ├── proxy.ts             # Rate limiting, security headers
│       ├── app/                 # App Router pages + API routes
│       │   ├── page.tsx         # Home (weather hero + score)
│       │   ├── dashboard/       # AI dashboard chat
│       │   ├── lab/             # Vocab / AI chat / Code share
│       │   ├── code-share/      # Real-time collaborative editor
│       │   ├── jeonju/          # Jeonju briefing + chat
│       │   ├── statistics/      # Statistics calendar
│       │   └── api/             # 50+ REST API endpoints
│       ├── components/          # 40+ React components
│       ├── context/             # AuthContext, LanguageContext
│       ├── lib/                 # 28 modules, 60+ business logic files
│       │   ├── auth/            # Authentication (10 files)
│       │   ├── chat/            # AI chat (7 files)
│       │   ├── lab/             # FSRS spaced repetition (7 files)
│       │   ├── websocket/       # WS server/client (3 files)
│       │   ├── security/        # AES-256-GCM encryption
│       │   └── ...
│       ├── data/                # Translation files, mock data
│       └── services/            # Frontend API service layer
└── scripts/                     # DB bootstrap, test scripts
```

---

## Quick Start

```bash
cd nadeulhae
cp .env.example .env.local    # configure environment variables
npm install
npm run dev                   # http://localhost:3000
```

See `.env.example` for required environment variables.

---

## Deployment

```bash
cd nadeulhae
npm run build
NODE_ENV=production pm2 start npm --name nadeulhae -- run start
```

For Nginx reverse proxy setup and full Ubuntu server deployment, see [docs/ubuntu-server-deploy-auth.md](docs/ubuntu-server-deploy-auth.md).

---

## Documentation

| Document | Description |
|----------|-------------|
| [📘 ARCHITECTURE_UML.md](docs/ARCHITECTURE_UML.md) | Architecture & UML diagrams (English) |
| [📘 ARCHITECTURE_UML_KO.md](docs/ARCHITECTURE_UML_KO.md) | Architecture & UML diagrams (Korean) |
| [📗 README_KO.md](docs/README_KO.md) | 한국어 README |
| [📗 README_JA.md](docs/README_JA.md) | 日本語のREADME |
| [📗 README_ZH.md](docs/README_ZH.md) | 中文 README |
| [📙 ubuntu-server-deploy-auth.md](docs/ubuntu-server-deploy-auth.md) | Ubuntu server deployment guide |

---

## Contributors

| Name | Role | Affiliation |
|------|------|-------------|
| **Hyunmin Kim** | Frontend, backend, UI/UX design, server deployment, DB design, real-time API integration | Jeonbuk National University, Software Engineering '24 |
| **Eunsu Kim** | Public API and location data collection and database population | Jeonbuk National University, Software Engineering '24 |
| **Jaehyeok Lee** | Real-time weather data pipeline development and DB integration | Jeonbuk National University, Software Engineering '24 |

---

## License

MIT License

Copyright (c) 2025 Nadeulhae

Permission is hereby granted, free of charge, to any person obtaining a copy of this software to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software without restriction, subject to the inclusion of the above copyright notice and this permission notice in all copies.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

---

> 📧 Contact: [kim0040@jbnu.ac.kr](mailto:kim0040@jbnu.ac.kr)
