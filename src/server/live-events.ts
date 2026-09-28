// The admin live feed was removed; generation still reports events here as no-ops.
export function emitLiveEvent(_event: Record<string, unknown>): Promise<void> {
  return Promise.resolve();
}

export function requestOrigin(_request: Request): Record<string, never> {
  return {};
}
