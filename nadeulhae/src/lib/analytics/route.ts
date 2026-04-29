/**
 * Higher-order wrapper for Next.js API routes that adds lightweight observability.
 *
 * Each wrapped route automatically gains three concerns:
 * 1. **Duration tracking** — records the wall-clock time spent inside the handler.
 * 2. **Usage event recording** — writes a daily-usage event (safely, best-effort)
 *    with the route path, HTTP method, status code, and measured duration.
 * 3. **Retention sweep** — fires a non-blocking retention-cleanup check at the
 *    start of every request so stale user data is periodically purged.
 *
 * The retention sweep is deliberately fire-and-forget (`void …Safely()`) so it
 * never adds latency to the response.
 */
import { recordDailyUsageEventSafely } from "@/lib/analytics/repository"
import { runRetentionSweepIfNeededSafely } from "@/lib/privacy/retention"

type RouteHandler<TRequest extends Request = Request, TContext = unknown> = (
  request: TRequest,
  context: TContext
) => Promise<Response>

/**
 * Wraps a Next.js route handler with duration tracking, usage recording, and a
 * retention sweep.
 *
 * ## How it works with Next.js route handlers
 *
 * The wrapper conforms to the standard Next.js App Router signature
 * `(request: Request, context: TContext) => Promise<Response>`. You use it as
 * a direct replacement for the handler:
 *
 * ```ts
 * // app/api/hello/route.ts
 * export const GET = withApiAnalytics(async (request) => {
 *   return Response.json({ ok: true })
 * })
 * ```
 *
 * The returned function is itself a valid Next.js route handler, so no
 * additional adapter or middleware is required.
 *
 * ## `routePath` convention
 *
 * The analytics event's `routePath` is derived from `new URL(request.url).pathname`.
 * This yields the **actual request pathname** (e.g. `/api/hello`), which serves
 * as the grouping key for per-endpoint analytics. There is no hard-coded
 * `routePath` parameter — the wrapper automatically extracts it from the
 * incoming request.
 *
 * @param handler - The original route handler to wrap.
 * @returns A new route handler that records analytics before returning.
 */
export function withApiAnalytics<TRequest extends Request = Request, TContext = unknown>(
  handler: RouteHandler<TRequest, TContext>
) {
  return async (request: TRequest, context: TContext) => {
    const startedAt = Date.now()
    void runRetentionSweepIfNeededSafely()

    try {
      const response = await handler(request, context)

      await recordDailyUsageEventSafely({
        request,
        routeKind: "api",
        routePath: new URL(request.url).pathname,
        method: request.method,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      })

      return response
    } catch (error) {
      await recordDailyUsageEventSafely({
        request,
        routeKind: "api",
        routePath: new URL(request.url).pathname,
        method: request.method,
        statusCode: 500,
        durationMs: Date.now() - startedAt,
      })

      throw error
    }
  }
}
