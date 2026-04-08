import { recordDailyUsageEventSafely } from "@/lib/analytics/repository"

type RouteHandler<TRequest extends Request = Request, TContext = unknown> = (
  request: TRequest,
  context: TContext
) => Promise<Response>

export function withApiAnalytics<TRequest extends Request = Request, TContext = unknown>(
  handler: RouteHandler<TRequest, TContext>
) {
  return async (request: TRequest, context: TContext) => {
    const startedAt = Date.now()

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
