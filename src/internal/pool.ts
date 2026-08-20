/**
 * Bounded-concurrency map. Results keep input order; at most `limit` tasks are in flight.
 *
 * Deliberately tiny and dependency-free. The point is to cap pressure on an API that sits
 * behind bot protection, not to be a general scheduler.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const cap = Math.max(1, Math.floor(limit));
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await task(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(cap, items.length) }, worker));
  return results;
}
