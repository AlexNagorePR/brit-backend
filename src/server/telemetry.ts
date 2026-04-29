import { signRosToolJWT } from '@/server/portal.js';
import utils from '@transitive-sdk/utils';

const telemetryCache: Record<string, any> = {};
const subscribedDevices = new Set<string>();

const BRIT_STATE_MAP: Record<number, string> = {
  0: 'Alarm stop',
  1: 'Waiting',
  2: 'Fix Heading',
  3: 'Avoid Obstacle',
  4: 'Automatic',
  5: 'Manual',
  6: 'Free',
};

const INK_LEVEL_MAP: Record<number, string> = {
  0: 'Bajo',
  1: 'OK',
  2: 'Max',
};

function ensureDeviceCache(deviceId: string) {
  if (!telemetryCache[deviceId]) {
    telemetryCache[deviceId] = {
      battery: null,
      voltage: null,
      state: null,
      alarm: null,
      inkLevel: null,
      topconBattery: null,
      leicaBatteryPercentage: null,
      progress: null,
      lastUpdateAt: null,
    };
  }

  return telemetryCache[deviceId];
}

function touchCache(deviceId: string) {
  const cache = ensureDeviceCache(deviceId);
  cache.lastUpdateAt = new Date().toISOString();
  return cache;
}

export async function subscribeTelemetry(opts: {
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
    const cache = ensureDeviceCache(opts.deviceId);

    rosTool.subscribe(2, '/battery');
    rosTool.subscribe(2, '/state');
    rosTool.subscribe(2, '/alarm');
    rosTool.subscribe(2, '/ink_level');
    rosTool.subscribe(2, '/topcon_battery');
    rosTool.subscribe(2, '/leica_battery_percentage');
    rosTool.subscribe(2, '/progress');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.battery;
      if (!value) return;
      const next = touchCache(opts.deviceId);
      next.battery = value.percentage * 100;
      next.voltage = value.voltage;
    }, 'ros/2/messages/battery');

    rosTool.onData(() => {
      console.log('Received state data for device', opts.deviceId);
      const value = rosTool.deviceData?.ros?.[2]?.messages?.state;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.state = value;
    }, 'ros/2/messages/state');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.alarm;
      if (!value) return;
      const next = touchCache(opts.deviceId);
      next.alarm = value;
    }, 'ros/2/messages/alarm');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.ink_level;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.inkLevel = value;
    }, 'ros/2/messages/ink_level');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.topcon_battery;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.topconBattery = value;
    }, 'ros/2/messages/topcon_battery');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.leica_battery_percentage;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.leicaBatteryPercentage = value;
    }, 'ros/2/messages/leica_battery_percentage');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.progress;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.progress = value;
    }, 'ros/2/messages/progress');

    return rosTool;
  } catch (err) {
    subscribedDevices.delete(opts.deviceId);
    throw err;
  }
}

export function getTelemetryData(deviceId: string) {
  const t = telemetryCache[deviceId];
  if (!t) return null;

  return {
    battery: t.battery ?? null,
    voltage: t.voltage ?? null,
    state: BRIT_STATE_MAP[t.state?.data] ?? null,
    alarm: t.alarm?.data ?? null,
    inkLevel: INK_LEVEL_MAP[t.inkLevel?.data] ?? null,
    topconBattery: t.topconBattery?.data ?? null,
    leicaBatteryPercentage: t.leicaBatteryPercentage?.data ?? null,
    progress: t.progress?.data ?? null,
    lastUpdateAt: t.lastUpdateAt ?? null,
  };
}

export function hasTelemetrySubscription(deviceId: string) {
  return subscribedDevices.has(deviceId);
}