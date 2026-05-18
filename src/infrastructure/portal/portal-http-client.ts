export async function fetchPortalApi<T = any>(
  token: string,
  url: string,
  opts: { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 14000 } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Portal API error ${response.status}: ${text.slice(0, 200)}`);
    }

    return (await response.json()) as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Portal API timeout');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
