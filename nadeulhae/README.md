# Nadeulhae App Workspace

앱 실행/개발은 이 디렉토리에서 진행합니다.

- 통합 운영 문서(아키텍처/다이어그램/배포/트러블슈팅):
  - [`/Users/gimhyeonmin/test/Nadeulhae/README.md`](/Users/gimhyeonmin/test/Nadeulhae/README.md)

## Quick Start

```bash
cd /Users/gimhyeonmin/test/Nadeulhae/nadeulhae
npm install
npm run dev
```

## Production-like run (WebSocket 포함)

```bash
npm run build
NODE_ENV=production PORT=3000 npm run start
```

## Verification Commands

```bash
npm run lint
npm run build
npm run test:lab
```

Code-share realtime integration test:

```bash
# terminal 1
NODE_ENV=production PORT=3101 npm run start

# terminal 2
npm run test:code-share
```

## Key Paths

- Custom server: [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/server.ts`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/server.ts)
- Code-share workspace UI: [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/components/lab/code-share-workspace.tsx`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/components/lab/code-share-workspace.tsx)
- Code-share APIs: [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/api/code-share/sessions/route.ts`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/api/code-share/sessions/route.ts), [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/api/code-share/sessions/[sessionId]/route.ts`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/app/api/code-share/sessions/[sessionId]/route.ts)
- WebSocket server: [`/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/lib/websocket/server.ts`](/Users/gimhyeonmin/test/Nadeulhae/nadeulhae/src/lib/websocket/server.ts)
