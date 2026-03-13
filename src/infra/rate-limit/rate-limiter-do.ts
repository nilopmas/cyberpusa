export class RateLimiterDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: unknown
  ) {}

  async fetch(_request: Request): Promise<Response> {
    // TODO: implement token bucket / sliding window algorithm.
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Rate limiter Durable Object placeholder.'
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  }
}
