import mqtt, { type MqttClient } from 'mqtt';
import jwt from 'jsonwebtoken';
import utils from '@transitive-sdk/utils';

import { signHealthMonitoringJWT } from '@/server/portal.js';

const log = utils.getLogger('health-monitoring');
log.setLevel('debug');

const { MqttSync, versionCompare, topicToPath } = utils as any;

type HMCacheEntry = {
  deviceId: string;
  transitiveUser: string;
  lastUpdateAt: string | null;
  flat: Record<string, any>;
};

type HealthMonitoringDiagnostic = {
  level?: number;
  message?: string;
  hardwareId?: string;
  values: Record<string, any>;
};

type HealthMonitoringSnapshot = {
  deviceId: string;
  version: string | null;
  lastUpdateAt: string | null;
  diagnostics: Record<string, HealthMonitoringDiagnostic>;
};

const cache: Record<string, HMCacheEntry> = {};
const subscribed = new Set<string>();

function ensureCache(deviceId: string, transitiveUser: string): HMCacheEntry {
  if (!cache[deviceId]) {
    cache[deviceId] = {
      deviceId,
      transitiveUser,
      lastUpdateAt: null,
      flat: {},
    };
  }

  return cache[deviceId];
}

function decodeJwtPayload(token: string) {
  return jwt.decode(token);
}

function createCloudMqttClient(opts: {
  jwt: string;
  transitiveUser: string;
  host?: string;
  ssl?: boolean;
}): MqttClient {
  const host = opts.host || 'transitiverobotics.com';
  const ssl = opts.ssl ?? true;

  const mqttUrl = `${ssl ? 'wss' : 'ws'}://mqtt.${host}`;
  const payload = decodeJwtPayload(opts.jwt);

  const client = mqtt.connect(mqttUrl, {
    username: JSON.stringify({
      id: opts.transitiveUser,
      payload,
    }),
    password: opts.jwt,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    log.info('Connected to Transitive MQTT cloud');
  });

  client.on('reconnect', () => {
    log.info('Reconnecting MQTT...');
  });

  client.on('error', (err) => {
    log.error('MQTT error', err);
  });

  return client;
}

export async function subscribeHealthMonitoringCloud(opts: {
  jwtSecret: string;
  transitiveUser: string;
  deviceId: string;
}) {
  if (subscribed.has(opts.deviceId)) {
    return;
  }

  subscribed.add(opts.deviceId);

  try {
    const token = signHealthMonitoringJWT({
      jwtSecret: opts.jwtSecret,
      transitiveUser: opts.transitiveUser,
      deviceId: opts.deviceId,
    });

    const mqttClient = createCloudMqttClient({
      jwt: token,
      transitiveUser: opts.transitiveUser,
      host: 'transitiverobotics.com',
      ssl: true,
    });

    const mqttSync = new MqttSync({
      mqttClient,
      ignoreRetain: true,
      onHeartbeatGranted: () => {
        log.info('Health monitoring MQTT heartbeat granted');
      },
    });

    const entry = ensureCache(opts.deviceId, opts.transitiveUser);

    const topicPrefix =
      `/${opts.transitiveUser}/${opts.deviceId}/@transitive-robotics/health-monitoring`;

    mqttSync.data.subscribePathFlat(
      `${topicPrefix}/#`,
      (value: any, key: string) => {
        entry.lastUpdateAt = new Date().toISOString();
        entry.flat[key] = value;

        //log.debug('HM update', { key, value });
      }
    );

    mqttSync.subscribe(`${topicPrefix}/#`, (err: any) => {
      if (err) {
        log.error('Health monitoring subscribe failed', err);
      } else {
        log.info('Subscribed to health monitoring', { topicPrefix });
      }
    });

    return mqttSync;
  } catch (err) {
    subscribed.delete(opts.deviceId);
    throw err;
  }
}

export function getHealthMonitoringCloudData(deviceId: string) {
  return cache[deviceId] ?? null;
}

function getLatestHealthMonitoringVersion(
  flat: Record<string, any>,
  transitiveUser: string,
  deviceId: string
) {
  const prefix =
    `/${transitiveUser}/${deviceId}/@transitive-robotics/health-monitoring/`;

  const versions = new Set<string>();

  for (const key of Object.keys(flat)) {
    if (!key.startsWith(prefix)) continue;

    const rest = key.slice(prefix.length);
    const version = rest.split('/')[0];

    if (version) {
      versions.add(version);
    }
  }

  if (versions.size === 0) {
    return null;
  }

  return [...versions].sort((a, b) => versionCompare(a, b)).at(-1) ?? null;
}

export function getHealthMonitoringSnapshot(deviceId: string): HealthMonitoringSnapshot | null {
  const entry = cache[deviceId];
  if (!entry) return null;

  const version = getLatestHealthMonitoringVersion(
    entry.flat,
    entry.transitiveUser,
    deviceId
  );

  if (!version) {
    return {
      deviceId,
      version: null,
      lastUpdateAt: entry.lastUpdateAt,
      diagnostics: {},
    };
  }

  const diagnosticsPrefix =
    `/${entry.transitiveUser}/${deviceId}/@transitive-robotics/health-monitoring/${version}/diagnostics/`;

  const diagnostics: Record<string, HealthMonitoringDiagnostic> = {};

  for (const [key, value] of Object.entries(entry.flat)) {
    if (!key.startsWith(diagnosticsPrefix)) continue;

    const rest = key.slice(diagnosticsPrefix.length);
    const parts = topicToPath(rest);

    if (parts.length < 2) continue;

    const diagnosticName = decodeURIComponent(parts[0]);
    const field = parts[1];

    diagnostics[diagnosticName] ||= {
      values: {},
    };

    const target = diagnostics[diagnosticName];

    if (field === 'level') {
      target.level = value as number;
      continue;
    }

    if (field === 'message') {
      target.message = value as string;
      continue;
    }

    if (field === 'hardware_id') {
      target.hardwareId = value as string;
      continue;
    }

    if (field === 'values' && parts.length >= 3) {
      const valueKey = decodeURIComponent(parts[2]);
      target.values[valueKey] = value;
    }
  }

  return {
    deviceId,
    version,
    lastUpdateAt: entry.lastUpdateAt,
    diagnostics,
  };
}