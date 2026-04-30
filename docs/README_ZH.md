# Nadeulhae (나들해) — README

> 🌐 [한국어](../README.md) · [English](README_EN.md) · [中文](README_ZH.md) · [日本語](README_JA.md)

**天气智能 + AI仪表板聊天 + 实验室(单词/代码共享) + 全州地区简报**

基于 Next.js 16 的全栈 Web 应用。实时协作代码编辑器、FSRS 间隔重复学习、AI 网络搜索聊天、GPS 天气评分 — 集于一体。

---

## 快速开始

```bash
cd nadeulhae
npm install
cp .env.example .env.local   # 填入真实密钥
npm run build
npm run start                 # 生产模式 (HTTP + WebSocket)
```

## 生产部署

```bash
NODE_ENV=production pm2 start npm --name nadeulhae -- run start
```

## 技术栈

Next.js 16, React 19, TypeScript, TiDB/MySQL 8, TailwindCSS 4, Framer Motion, CodeMirror 6, WebSocket (ws v8)

## 功能

- **天气**: KMA + AirKorea + APIHub 实时数据，0-100 户外活动评分
- **仪表板**: AI 聊天机器人，天气上下文，SSE 流式传输
- **实验室**: FSRS 单词记忆，AI 网络搜索聊天，代码共享
- **全州+**: AI 每日简报，本地聊天
- **4种语言**: 한국어 / English / 中文 / 日本語

## 许可证

私人项目。联系方式: kim0040@jbnu.ac.kr
