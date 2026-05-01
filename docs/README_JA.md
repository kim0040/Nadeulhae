# なでるへ (나들해 / Nadeulhae)

> 🌐 [English](../README.md) · [한국어](README_KO.md) · [中文](README_ZH.md) · [日本語](README_JA.md)

> **天気ベースのお出かけスコア + AIダッシュボードチャット + ラボ(単語/コード共有) + 全州地域ブリーフィング**

Next.js 16 フルスタックWebアプリケーション。リアルタイム共同コードエディタ、FSRS間隔反復学習、AIウェブ検索チャット、GPS天気スコアリング — すべて一つのサービスに統合。

---

## 目次

- [機能](#機能)
- [技術スタック](#技術スタック)
- [プロジェクト構造](#プロジェクト構造)
- [クイックスタート](#クイックスタート)
- [本番デプロイ](#本番デプロイ)
- [ドキュメント](#ドキュメント)
- [貢献者](#貢献者)
- [ライセンス](#ライセンス)

---

## 機能

| 機能 | 説明 |
|------|------|
| **🌤️ 天気インテリジェンス** | 気象庁(KMA)、AirKorea、APIHubのリアルタイムデータを組み合わせて0-100のお出かけスコアを算出。衛星/レーダー画像、時間別予報、山火事情報を提供 |
| **🤖 ダッシュボードAIチャット** | 天気コンテキストを注入したAIチャットボット。SSEストリーミング応答、セッション間ユーザーメモリ、自動コンテキスト圧縮 |
| **📚 ラボ** | FSRS v5アルゴリズムベースの単語暗記カード、AIデッキ自動生成、Web検索連携AIチャット |
| **💻 コード共有** | CodeMirror 6ベースのリアルタイム共同エディタ。WebSocketプレゼンス、タイピング表示、楽観的同時実行制御 |
| **📍 全州デイリーブリーフィング** | AIが毎日生成する全州カスタマイズブリーフィング。ローカルチャット、安全情報 |
| **📊 統計カレンダー** | 過去の天気アーカイブ、月別お出かけスコア推移 |
| **🌐 4言語** | 한국어, English, 中文, 日本語 |

---

## 技術スタック

| 階層 | 技術 |
|------|------|
| **フレームワーク** | Next.js 16 (App Router) |
| **言語** | TypeScript 6 (Strict) |
| **フロントエンド** | React 19, TailwindCSS 4, Framer Motion, Lucide Icons |
| **コードエディタ** | CodeMirror 6 (`@uiw/react-codemirror`) |
| **リアルタイム通信** | WebSocket (`ws` v8) |
| **データベース** | TiDB / MySQL 8 (`mysql2/promise`) |
| **AI / LLM** | OpenAI互換API（汎用 + ラボの二重構成） |
| **Web検索** | Tavily API |
| **座標変換** | proj4 (WGS84 ↔ TM) |
| **認証・セキュリティ** | scrypt (N=16384) + ペッパー, AES-256-GCM フィールド暗号化 |
| **デプロイ** | PM2 + Nginx リバースプロキシ |

---

## プロジェクト構造

```
Nadeulhae/
├── README.md
├── docs/                        # ドキュメント
│   ├── ARCHITECTURE_UML.md      # UML図 (英語)
│   ├── ARCHITECTURE_UML_KO.md   # UML図 (韓国語)
│   ├── README_EN.md             # README (英語)
│   ├── README_JA.md             # README (日本語)
│   ├── README_ZH.md             # README (中国語)
│   └── ...
├── nadeulhae/
│   ├── server.ts                # カスタムHTTP + WebSocketサーバー
│   ├── package.json
│   └── src/
│       ├── proxy.ts             # レート制限、セキュリティヘッダー
│       ├── app/                 # App Router ページ + APIルート
│       │   ├── page.tsx         # ホーム (天気ヒーロー + スコア)
│       │   ├── dashboard/       # AIダッシュボードチャット
│       │   ├── lab/             # 単語暗記 / AIチャット / コード共有
│       │   ├── code-share/      # リアルタイム共同エディタ
│       │   ├── jeonju/          # 全州ブリーフィング + チャット
│       │   └── api/             # 50以上のREST APIエンドポイント
│       ├── components/          # 40以上のReactコンポーネント
│       ├── context/             # AuthContext, LanguageContext
│       ├── lib/                 # 28モジュール, 60以上のビジネスロジックファイル
│       │   ├── auth/            # 認証 (10ファイル)
│       │   ├── chat/            # AIチャット (7ファイル)
│       │   ├── lab/             # FSRS間隔反復 (7ファイル)
│       │   ├── websocket/       # WSサーバー/クライアント (3ファイル)
│       │   ├── security/        # AES-256-GCM暗号化
│       │   └── ...
│       ├── data/                # 翻訳ファイル、モックデータ
│       └── services/            # フロントエンドAPIサービスレイヤー
└── scripts/                     # DBブートストラップ、テストスクリプト
```

---

## クイックスタート

```bash
cd nadeulhae
cp .env.example .env.local    # 環境変数を設定
npm install
npm run dev                   # http://localhost:3000
```

必要な環境変数は `.env.example` ファイルを参照してください。

---

## 本番デプロイ

```bash
cd nadeulhae
npm run build
NODE_ENV=production pm2 start npm --name nadeulhae -- run start
```

Nginxリバースプロキシの設定とUbuntuサーバーデプロイガイドは [docs/ubuntu-server-deploy-auth.md](docs/ubuntu-server-deploy-auth.md) を参照してください。

---

## ドキュメント

| ドキュメント | 説明 |
|--------------|------|
| [📘 ARCHITECTURE_UML.md](docs/ARCHITECTURE_UML.md) | アーキテクチャとUML図 (英語) |
| [📘 ARCHITECTURE_UML_KO.md](docs/ARCHITECTURE_UML_KO.md) | アーキテクチャとUML図 (韓国語) |
| [📗 README_EN.md](docs/README_EN.md) | README (英語) |
| [📗 README_JA.md](docs/README_JA.md) | README (日本語) |
| [📗 README_ZH.md](docs/README_ZH.md) | README (中国語) |
| [📙 ubuntu-server-deploy-auth.md](docs/ubuntu-server-deploy-auth.md) | Ubuntuサーバーデプロイガイド |
| [📙 CODE_REVIEW_REPORT.md](docs/CODE_REVIEW_REPORT.md) | コードレビューレポート |

---

## 貢献者

| 名前 | 役割 | 所属 |
|------|------|------|
| **キム・ヒョンミン** | フロントエンド、バックエンド、UI/UXデザイン、サーバー構築、DB設計、リアルタイムAPI連携 | 全北大学校 ソフトウェア工学科 24学番 |
| **キム・ウンス** | 公共APIと位置データの収集およびデータベース格納 | 全北大学校 ソフトウェア工学科 24学番 |
| **イ・ジェヒョク** | リアルタイム天気データパイプライン構築およびDB連携 | 全北大学校 ソフトウェア工学科 24学番 |

---

## ライセンス

MIT License

Copyright (c) 2025 Nadeulhae

本ソフトウェアの使用、複製、改変、統合、公開、配布、サブライセンス、販売を制限なく許可します。ただし、すべての複製物に上記の著作権表示と本許諾文を含める必要があります。

本ソフトウェアは「現状のまま」提供され、商品性や特定目的への適合性に関する保証を含む、いかなる明示的または黙示的保証も行いません。

---

> 📧 お問い合わせ: [kim0040@jbnu.ac.kr](mailto:kim0040@jbnu.ac.kr)
