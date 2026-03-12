// src/server/portal.ts
import jwt from 'jsonwebtoken';

export function signPortalApiJWT(opts: {
  jwtSecret: string;
  transitiveUser: string;
  userId?: string; // si lo quieres fijo o configurable
  validitySeconds?: number;
}) {
  const {
    jwtSecret,
    transitiveUser,
    userId = 'phenomenonrobotics',
    validitySeconds = 60,
  } = opts;

  return jwt.sign(
    {
      userId: userId,
      api: 1,
      id: transitiveUser,
      validity: validitySeconds,
    },
    jwtSecret
  );
}

export function signRosToolJWT(opts: {
  jwtSecret: string;
  transitiveUser: string;
  deviceId: string;
  userId?: string;
  validitySeconds?: number;
}) {
  const {
    jwtSecret,
    transitiveUser,
    deviceId,
    userId = 'phenomenonrobotics',
    validitySeconds = 86400,
  } = opts;

  return jwt.sign(
    {
      id: transitiveUser,
      device: deviceId,
      capability: '@transitive-robotics/ros-tool',
      userId,
      validity: validitySeconds,
    },
    jwtSecret
  );
}

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