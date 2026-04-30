# Nadeulhae (나들해) — README

> 🌐 [한국어](../README.md) · [English](README_EN.md) · [中文](README_ZH.md) · [日本語](README_JA.md)

**Weather intelligence + AI dashboard chat + Lab (vocab/code-share) + Jeonju local briefing**

Full-stack Next.js 16 web application. Real-time collaborative code editor, FSRS spaced repetition learning, AI web-search chat, GPS-based weather scoring — all in one service.

---

## Quick Start

```bash
cd nadeulhae
npm install
cp .env.example .env.local   # edit with real keys
npm run build
npm run start                 # production mode (HTTP + WebSocket)
```

## Production

```bash
NODE_ENV=production pm2 start npm --name nadeulhae -- run start
```

## Tech Stack

Next.js 16, React 19, TypeScript, TiDB/MySQL 8, TailwindCSS 4, Framer Motion, CodeMirror 6, WebSocket (ws v8)

## Features

- **Weather**: KMA + AirKorea + APIHub real-time data, 0-100 outdoor score
- **Dashboard**: AI chatbot with weather context, SSE streaming
- **Lab**: FSRS vocab, AI web-search chat, code share
- **Jeonju+**: AI daily briefing, local chat
- **4 Languages**: ko / en / zh / ja

## License

Private project. Contact: kim0040@jbnu.ac.kr
