# Nadeulhae (나들해) — README

> 🌐 [한국어](README.md) · [English](README.en.md) · [中文](README.zh.md)

**天気インテリジェンス + AIダッシュボードチャット + ラボ(単語/コード共有) + 全州地域ブリーフィング**

Next.js 16フルスタックWebアプリ。リアルタイム共同コードエディタ、FSRS間隔反復学習、AI Web検索チャット、GPS天気スコアリング — すべて一つのサービスに統合。

---

## クイックスタート

```bash
cd nadeulhae
npm install
cp .env.example .env.local   # 実際のキーを入力
npm run build
npm run start                 # 本番モード (HTTP + WebSocket)
```

## 本番デプロイ

```bash
NODE_ENV=production pm2 start npm --name nadeulhae -- run start
```

## 技術スタック

Next.js 16, React 19, TypeScript, TiDB/MySQL 8, TailwindCSS 4, Framer Motion, CodeMirror 6, WebSocket (ws v8)

## 機能

- **天気**: KMA + AirKorea + APIHub リアルタイムデータ、0-100お出かけスコア
- **ダッシュボード**: AIチャットボット、天気コンテキスト、SSEストリーミング
- **ラボ**: FSRS単語暗記、AI Web検索チャット、コード共有
- **全州+**: AIデイリーブリーフィング、ローカルチャット
- **4言語**: 한국어 / English / 中文 / 日本語

## ライセンス

プライベートプロジェクト。連絡先: kim0040@jbnu.ac.kr
