import { signRosToolJWT } from "@/server/portal.js";
import { createDb } from "@/server/db.js";
import { loadConfig } from "./config.js";
import utils from "@transitive-sdk/utils";

type BritInfoWorkMessage = {
  start_time?: string | null;
  json_file_path?: string | null;
  estimated_time?: number | null;
  interruption_count?: number | null;
  interruptions_count?: number | null;
  interruptions_detail?: Array<{
    type?: string;
    new_state?: number;
    time_from_start?: number;
    timestamp?: string;
    return_to_auto?: number;
  }> | null;
  warning_count?: number | null;
  warnings_count?: number | null;
  warnings_detail?: Array<{
    type?: string;
    time_from_start?: number;
    timestamp?: string;
    name?: string;
    message?: string;
    level?: number;
  }> | null;
  total_time?: number | null;
  end_time?: string | null;
};

type BritInfoWorkCacheEntry = BritInfoWorkMessage & {
  persistedKey: string | null;
  workId: string | null;
  creatingWorkPromise: Promise<string> | null;
  persistedInterruptionCount: number;
  persistedWarningCount: number;
};

const workInfoCache: Record<string, BritInfoWorkCacheEntry> = {};
const subscribedDevices = new Set<string>();

const config = loadConfig();
const db = createDb(config.databaseUrl);

function ensureDeviceCache(deviceId: string) {
  if (!workInfoCache[deviceId]) {
    workInfoCache[deviceId] = {
      start_time: null,
      json_file_path: null,
      estimated_time: null,
      interruption_count: null,
      interruptions_count: null,
      interruptions_detail: null,
      warning_count: null,
      warnings_count: null,
      warnings_detail: null,
      total_time: null,
      end_time: null,
      persistedKey: null,
      workId: null,
      creatingWorkPromise: null,
      persistedInterruptionCount: 0,
      persistedWarningCount: 0,
    };
  }

  return workInfoCache[deviceId];
}

function touchCache(deviceId: string) {
  const cache = ensureDeviceCache(deviceId);
  return cache;
}

function normalizeWorkMessage(value: BritInfoWorkMessage): BritInfoWorkMessage {
  const interruptionsCount = value.interruptions_count ?? value.interruption_count ?? null;
  const warningsCount = value.warnings_count ?? value.warning_count ?? null;
  const interruptionsDetail = Array.isArray(value.interruptions_detail) ? value.interruptions_detail : null;
  const warningsDetail = Array.isArray(value.warnings_detail) ? value.warnings_detail : null;

  return {
    start_time: value.start_time ?? null,
    json_file_path: value.json_file_path ?? null,
    estimated_time: value.estimated_time ?? null,
    interruption_count: interruptionsCount,
    interruptions_count: interruptionsCount,
    interruptions_detail: interruptionsDetail,
    warning_count: warningsCount,
    warnings_count: warningsCount,
    warnings_detail: warningsDetail,
    total_time: value.total_time ?? null,
    end_time: value.end_time ?? null,
  };
}

function isCompleteWorkMessage(cache: BritInfoWorkCacheEntry) {
  return Boolean(
    cache.start_time &&
    cache.json_file_path &&
    cache.estimated_time !== null &&
    cache.total_time !== null &&
    cache.end_time
  );
}

function getWorkKey(cache: BritInfoWorkCacheEntry) {
  return [
    cache.start_time,
    cache.json_file_path,
    cache.end_time,
    cache.total_time,
  ].map((value) => value ?? '').join('|');
}

function resetWorkTracking(cache: BritInfoWorkCacheEntry, workKey: string) {
  cache.persistedKey = workKey;
  cache.workId = null;
  cache.creatingWorkPromise = null;
  cache.persistedInterruptionCount = 0;
  cache.persistedWarningCount = 0;
}

async function restorePersistedWork(deviceId: string, cache: BritInfoWorkCacheEntry) {
  const workKey = getWorkKey(cache);
  const existingWorks = await db.getWorksForRobot(deviceId);

  for (let index = existingWorks.length - 1; index >= 0; index -= 1) {
    const work = existingWorks[index];
    const existingKey = [
      work.startTime,
      work.filePath,
      work.endTime,
      work.totalTime,
    ].map((value) => value ?? '').join('|');

    if (existingKey === workKey) {
      cache.persistedKey = workKey;
      cache.workId = work.id;
      cache.persistedInterruptionCount = cache.interruptions_detail?.length ?? 0;
      cache.persistedWarningCount = cache.warnings_detail?.length ?? 0;
      return work.id;
    }
  }

  return null;
}

async function persistWorkDetails(deviceId: string, cache: BritInfoWorkCacheEntry) {
  if (!cache.workId) {
    return false;
  }

  let insertedAny = false;

  const interruptions = cache.interruptions_detail ?? [];
  for (let index = cache.persistedInterruptionCount; index < interruptions.length; index += 1) {
    const item = interruptions[index];
    if (!item || item.type !== 'state_change') {
      cache.persistedInterruptionCount = index + 1;
      continue;
    }

    await db.createInterruption(
      cache.workId,
      item.new_state ?? 0,
      item.time_from_start,
      item.return_to_auto
    );
    cache.persistedInterruptionCount = index + 1;
    insertedAny = true;
  }

  const warnings = cache.warnings_detail ?? [];
  for (let index = cache.persistedWarningCount; index < warnings.length; index += 1) {
    const item = warnings[index];
    if (!item || item.type !== 'warning') {
      cache.persistedWarningCount = index + 1;
      continue;
    }

    await db.createWarning(
      cache.workId,
      item.level ?? 0,
      item.time_from_start
    );
    cache.persistedWarningCount = index + 1;
    insertedAny = true;
  }

  if (insertedAny) {
    console.log('Persisted brit_info_work details for device', deviceId, {
      workId: cache.workId,
      interruptions: cache.persistedInterruptionCount,
      warnings: cache.persistedWarningCount,
    });
  }

  return insertedAny;
}

async function persistCompletedWork(deviceId: string, cache: BritInfoWorkCacheEntry) {
  if (cache.creatingWorkPromise) {
    return cache.creatingWorkPromise;
  }

  if (!isCompleteWorkMessage(cache)) {
    return null;
  }

  const workKey = getWorkKey(cache);
  if (cache.workId && cache.persistedKey === workKey) {
    await persistWorkDetails(deviceId, cache);
    return cache.workId;
  }

  if (cache.persistedKey !== workKey) {
    resetWorkTracking(cache, workKey);
  }

  if (!cache.workId) {
    const restoredWorkId = await restorePersistedWork(deviceId, cache);
    if (restoredWorkId) {
      await persistWorkDetails(deviceId, cache);
      return restoredWorkId;
    }
  }

  cache.creatingWorkPromise = (async () => {
    const workId = await db.createWork(deviceId, {
      startTime: cache.start_time ?? undefined,
      endTime: cache.end_time ?? undefined,
      estimatedTime: cache.estimated_time ?? undefined,
      totalTime: cache.total_time ?? undefined,
      interruptions: cache.interruption_count ?? cache.interruptions_count ?? 0,
      alarms: cache.warning_count ?? cache.warnings_count ?? 0,
      filePath: cache.json_file_path ?? undefined,
    });

    cache.workId = workId;
    await persistWorkDetails(deviceId, cache);
    return workId;
  })();

  try {
    return await cache.creatingWorkPromise;
  } finally {
    cache.creatingWorkPromise = null;
  }
}

export async function subscribeWorkInfo(opts: {
  jwtSecret: string;
  transitiveUser: string;
  deviceId: string;
}) {
  if (subscribedDevices.has(opts.deviceId)) {
    return;
  }

  subscribedDevices.add(opts.deviceId);

  try {
    const { importCapability } = utils as any;

    const token = signRosToolJWT({
      jwtSecret: opts.jwtSecret,
      transitiveUser: opts.transitiveUser,
      deviceId: opts.deviceId,
    });

    const rosTool = await importCapability({ jwt: token });

    rosTool.subscribe(2, '/brit_info_work');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.brit_info_work;
      if (!value) return;

      const next = touchCache(opts.deviceId);

      Object.assign(next, normalizeWorkMessage(value));

      void persistCompletedWork(opts.deviceId, next).catch((error) => {
        next.persistedKey = null;
        next.workId = null;
        console.error('Failed to persist brit_info_work data for device', opts.deviceId, error);
      });
    }, 'ros/2/messages/brit_info_work');

    return rosTool;
  } catch (error) {
    subscribedDevices.delete(opts.deviceId);
    throw error;
  }
}

export function getWorkInfo(deviceId: string) {
  const cache = workInfoCache[deviceId];
  if (!cache) return null;

  return {
    start_time: cache.start_time,
    json_file_path: cache.json_file_path,
    estimated_time: cache.estimated_time,
    interruption_count: cache.interruption_count,
    interruptions_count: cache.interruptions_count,
    interruptions_detail: cache.interruptions_detail,
    warning_count: cache.warning_count,
    warnings_count: cache.warnings_count,
    warnings_detail: cache.warnings_detail,
    total_time: cache.total_time,
    end_time: cache.end_time,
  };
}

export function hasWorkInfoSubscription(deviceId: string) {
  return subscribedDevices.has(deviceId);
}

export const subscribeBritInfoWork = subscribeWorkInfo;
export const getBritInfoWorkCache = getWorkInfo;