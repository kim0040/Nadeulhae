import { CodeShareWorkspace } from "@/components/lab/code-share-workspace"

export default async function PublicCodeSharePage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  return <CodeShareWorkspace initialSessionId={sessionId} showSessionList={false} />
}
