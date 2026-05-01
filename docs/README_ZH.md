# 나들해 (Nadeulhae)

> 🌐 [English](../README.md) · [한국어](README_KO.md) · [中文](README_ZH.md) · [日本語](README_JA.md)

> **天气智能评分 + AI仪表板聊天 + 实验室(词汇/代码共享) + 全州地区简报**

基于 Next.js 16 的全栈 Web 应用。集实时协作代码编辑器、FSRS 间隔重复学习、AI 网络搜索聊天、GPS 天气评分于一体。

---

## 目录

- [功能](#功能)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [生产部署](#生产部署)
- [文档](#文档)
- [贡献者](#贡献者)
- [许可证](#许可证)

---

## 功能

| 功能 | 说明 |
|------|------|
| **🌤️ 天气智能** | 整合气象厅(KMA)、AirKorea、APIHub 实时数据，计算 0-100 户外活动评分。提供卫星/雷达图像、逐时预报和山火信息 |
| **🤖 仪表板 AI 聊天** | 注入天气上下文的 AI 聊天机器人。SSE 流式响应、跨会话用户记忆、自动上下文压缩 |
| **📚 实验室** | 基于 FSRS v5 算法的词汇记忆卡片、AI 自动生成卡片组、网络搜索集成 AI 聊天 |
| **💻 代码共享** | 基于 CodeMirror 6 的实时协作编辑器。WebSocket 在线状态、输入提示、乐观并发控制 |
| **📍 全州每日简报** | AI 每日生成全州定制简报。本地聊天和安全信息 |
| **📊 统计日历** | 历史天气档案和月度户外活动评分趋势 |
| **🌐 四语支持** | 한국어, English, 中文, 日本語 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **框架** | Next.js 16 (App Router) |
| **语言** | TypeScript 6 (严格模式) |
| **前端** | React 19, TailwindCSS 4, Framer Motion, Lucide Icons |
| **代码编辑器** | CodeMirror 6 (`@uiw/react-codemirror`) |
| **实时通信** | WebSocket (`ws` v8) |
| **数据库** | TiDB / MySQL 8 (`mysql2/promise`) |
| **AI / LLM** | OpenAI 兼容 API（通用 + 实验室双配置） |
| **网络搜索** | Tavily API |
| **坐标转换** | proj4 (WGS84 ↔ TM) |
| **认证与安全** | scrypt (N=16384) + 密钥加密, AES-256-GCM 字段级加密 |
| **部署** | PM2 + Nginx 反向代理 |

---

## 项目结构

```
Nadeulhae/
├── README.md
├── docs/                        # 文档
│   ├── ARCHITECTURE_UML.md      # UML 图 (英文)
│   ├── ARCHITECTURE_UML_KO.md   # UML 图 (韩文)
│   ├── README_EN.md             # README (英文)
│   ├── README_JA.md             # README (日文)
│   ├── README_ZH.md             # README (中文)
│   └── ...
├── nadeulhae/
│   ├── server.ts                # 自定义 HTTP + WebSocket 服务器
│   ├── package.json
│   └── src/
│       ├── proxy.ts             # 速率限制、安全标头
│       ├── app/                 # App Router 页面 + API 路由
│       │   ├── page.tsx         # 首页 (天气英雄 + 评分)
│       │   ├── dashboard/       # AI 仪表板聊天
│       │   ├── lab/             # 词汇 / AI聊天 / 代码共享
│       │   ├── code-share/      # 实时协作编辑器
│       │   ├── jeonju/          # 全州简报 + 聊天
│       │   └── api/             # 50+ REST API 端点
│       ├── components/          # 40+ React 组件
│       ├── context/             # AuthContext, LanguageContext
│       ├── lib/                 # 28 个模块, 60+ 业务逻辑文件
│       │   ├── auth/            # 认证 (10 个文件)
│       │   ├── chat/            # AI 聊天 (7 个文件)
│       │   ├── lab/             # FSRS 间隔重复 (7 个文件)
│       │   ├── websocket/       # WS 服务器/客户端 (3 个文件)
│       │   ├── security/        # AES-256-GCM 加密
│       │   └── ...
│       ├── data/                # 翻译文件、模拟数据
│       └── services/            # 前端 API 服务层
└── scripts/                     # 数据库初始化、测试脚本
```

---

## 快速开始

```bash
cd nadeulhae
cp .env.example .env.local    # 配置环境变量
npm install
npm run dev                   # http://localhost:3000
```

请参阅 `.env.example` 文件了解所需的环境变量。

---

## 生产部署

```bash
cd nadeulhae
npm run build
NODE_ENV=production pm2 start npm --name nadeulhae -- run start
```

Nginx 反向代理配置及完整 Ubuntu 服务器部署指南，请参阅 [docs/ubuntu-server-deploy-auth.md](docs/ubuntu-server-deploy-auth.md)。

---

## 文档

| 文档 | 说明 |
|------|------|
| [📘 ARCHITECTURE_UML.md](docs/ARCHITECTURE_UML.md) | 架构与 UML 图 (英文) |
| [📘 ARCHITECTURE_UML_KO.md](docs/ARCHITECTURE_UML_KO.md) | 架构与 UML 图 (韩文) |
| [📗 README_EN.md](docs/README_EN.md) | README (英文) |
| [📗 README_JA.md](docs/README_JA.md) | README (日文) |
| [📗 README_ZH.md](docs/README_ZH.md) | README (中文) |
| [📙 ubuntu-server-deploy-auth.md](docs/ubuntu-server-deploy-auth.md) | Ubuntu 服务器部署指南 |
| [📙 CODE_REVIEW_REPORT.md](docs/CODE_REVIEW_REPORT.md) | 代码审查报告 |

---

## 贡献者

| 姓名 | 职责 | 所属 |
|------|------|------|
| **金贤民** | 前端、后端、UI/UX 设计、服务器搭建、数据库设计、实时 API 集成 | 全北大学 软件工程系 24级 |
| **金恩秀** | 公共 API 与位置数据采集及数据库填充 | 全北大学 软件工程系 24级 |
| **李在赫** | 实时天气数据管道开发与数据库集成 | 全北大学 软件工程系 24级 |

---

## 许可证

MIT License

Copyright (c) 2025 Nadeulhae

特此授权任何获得本软件副本的人，可无限制地使用、复制、修改、合并、发布、分发、再许可和/或出售本软件，但须在所有副本中包含上述版权声明和本许可声明。

本软件按"原样"提供，不提供任何形式的明示或默示保证，包括但不限于适销性和特定用途适用性的保证。

---

> 📧 联系方式: [kim0040@jbnu.ac.kr](mailto:kim0040@jbnu.ac.kr)
