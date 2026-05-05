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

type BritInfoWorkCacheEntry = BritInfoWorkMessage;
type WorkTimestamp = string | Date | null | undefined;

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

function normalizeWorkTimestamp(value: WorkTimestamp) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const isoLike = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const date = new Date(hasTimeZone ? isoLike : `${isoLike}Z`);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function saveInterruptions(workId: string, interruptions: BritInfoWorkMessage['interruptions_detail']) {
  const details = interruptions ?? [];
  
  for (let index = 0; index < details.length; index += 1) {
    const item = details[index];
    if (!item || item.type !== 'state_change') {
      continue;
    }

    await db.createInterruption(
      workId,
      item.new_state ?? 0,
      item.time_from_start,
      item.return_to_auto
    );
  }
}

async function saveWarnings(workId: string, warnings: BritInfoWorkMessage['warnings_detail']) {
  const details = warnings ?? [];
  
  for (let index = 0; index < details.length; index += 1) {
    const item = details[index];
    if (!item || item.type !== 'warning') {
      continue;
    }

    await db.createWarning(
      workId,
      item.level ?? 0,
      item.time_from_start
    );
  }
}

async function saveWork(deviceId: string, cache: BritInfoWorkCacheEntry) {
  if (!isCompleteWorkMessage(cache)) {
    return null;
  }

  const startTime = normalizeWorkTimestamp(cache.start_time) ?? undefined;
  const endTime = normalizeWorkTimestamp(cache.end_time) ?? undefined;

  // Check if work already exists before creating
  const existingWorks = await db.getWorksForRobot(deviceId);

  const existingWork = existingWorks.find(w => {
    const startTimeMatch = normalizeWorkTimestamp(w.startTime) === startTime;
    const endTimeMatch = normalizeWorkTimestamp(w.endTime) === endTime;
    const filePathMatch = w.filePath === cache.json_file_path;

    return startTimeMatch && endTimeMatch && filePathMatch;
  });

  if (existingWork) {
    return existingWork.id;
  }

  // Work is new, create it and save related records
  const workId = await db.createWork(deviceId, {
    startTime,
    endTime,
    estimatedTime: cache.estimated_time ?? undefined,
    totalTime: cache.total_time ?? undefined,
    interruptions: cache.interruption_count ?? cache.interruptions_count ?? 0,
    alarms: cache.warning_count ?? cache.warnings_count ?? 0,
    filePath: cache.json_file_path ?? undefined,
  });

  // Save interruptions and warnings only for newly created work
  await saveInterruptions(workId, cache.interruptions_detail);
  await saveWarnings(workId, cache.warnings_detail);

  console.log('Saved brit_info_work for device', deviceId, {
    workId,
    interruptions: (cache.interruptions_detail ?? []).length,
    warnings: (cache.warnings_detail ?? []).length,
  });

  return workId;
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

    rosTool.onData(async () => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.brit_info_work;
      if (!value) return;

      const cache = touchCache(opts.deviceId);
      Object.assign(cache, normalizeWorkMessage(value));

      // Only process if work is complete
      if (!isCompleteWorkMessage(cache)) {
        return;
      }

      try {
        // saveWork handles deduplication by checking if work already exists
        await saveWork(opts.deviceId, cache);
      } catch (error) {
        console.error('Failed to process brit_info_work for device', opts.deviceId, error);
      }
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
