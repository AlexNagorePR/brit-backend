import { signRosToolJWT } from '@/server/portal.js';
import utils from '@transitive-sdk/utils';
import { warn } from 'node:console';
import { version } from 'node:os';

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

const ESTACION_STATUS_MAP: Record<number, string> = {
  0: 'Desconectado',
  1: 'Conectado/Manual',
  2: 'Conectado/Buscando',
  3: 'Conectado/Fijo',
};

const ESTACION_MAP: Record<number, string> = {
  0: 'Ninguna',
  1: 'Topcon',
  2: 'Leica',
};

function ensureDeviceCache(deviceId: string) {
  if (!telemetryCache[deviceId]) {
    telemetryCache[deviceId] = {
      prismaPosition: null,
      prismaOrientation: null,
      battery: null,
      voltage: null,
      inkLevel: null,
      state: null,
      alarm: null,
      version: null,
      warning: null,

      topconStatus: null,
      topconBattery: null,
      topconPosition: null,
      leicaStatus: null,
      leicaBattery: null,
      estacion: null,

      progress: null,
      leftTime: null,

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

    rosTool.subscribe(2, '/odomety/global')
    rosTool.subscribe(2, '/battery');
    rosTool.subscribe(2, '/state');
    rosTool.subscribe(2, '/alarm');
    rosTool.subscribe(2, '/version');
    rosTool.subscribe(2, '/warning');
    rosTool.subscribe(2, '/ink_level');

    rosTool.subscribe(2, '/topcon_status');
    rosTool.subscribe(2, '/topcon_battery');
    rosTool.subscribe(2, '/topcon_position');
    rosTool.subscribe(2, '/leica_status');
    rosTool.subscribe(2, '/leica_battery_percentage');
    
    rosTool.subscribe(2, '/progress');
    rosTool.subscribe(2, '/left_time');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.odomety?.global;
      console.log('Received odometry data for device', opts.deviceId, value);
      if (!value) return;
      const next = touchCache(opts.deviceId);
      next.prismaPosition[0] = value.pose.pose.position.x;
      next.prismaPosition[1] = value.pose.pose.position.y;
      next.prismaOrientation = calculateYawDegreesFromQuaternion(
        value.pose.pose.orientation.x,
        value.pose.pose.orientation.y,
        value.pose.pose.orientation.z,
        value.pose.pose.orientation.w
      );
    }, 'ros/2/messages/odomety/global');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.battery;
      if (!value) return;
      const next = touchCache(opts.deviceId);
      next.battery = value.percentage * 100;
      next.voltage = value.voltage;
    }, 'ros/2/messages/battery');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.ink_level;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.inkLevel = value;
    }, 'ros/2/messages/ink_level');

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
      const value = rosTool.deviceData?.ros?.[2]?.messages?.version;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.version = value;
    }, 'ros/2/messages/version');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.warning;
      if (!value) return;
      const next = touchCache(opts.deviceId);
      next.warning = value;
    }, 'ros/2/messages/warning');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.topcon_status;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.topconStatus = value;
    }, 'ros/2/messages/topcon_status');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.topcon_battery;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.topconBattery = value;
    }, 'ros/2/messages/topcon_battery');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.topcon_position;
      if (!value) return;
      const next = touchCache(opts.deviceId);
      next.topconPosition = {
        x: value.data[0],
        y: value.data[1],
      };
    }, 'ros/2/messages/topcon_position');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.leica_status;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.leicaStatus = value;
    }, 'ros/2/messages/leica_status');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.leica_battery_percentage;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.leicaBattery = batteryPercentToLevel(value);
    }, 'ros/2/messages/leica_battery_percentage');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.progress;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.progress = value;
    }, 'ros/2/messages/progress');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.left_time;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.leftTime = value;
    }, 'ros/2/messages/left_time');

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
    prismaPosition: t.prismaPosition ?? null,
    prismaOrientation: t.prismaOrientation ?? null,
    battery: t.battery ?? null,
    voltage: t.voltage ?? null,
    inkLevel: INK_LEVEL_MAP[t.inkLevel?.data] ?? null,
    state: BRIT_STATE_MAP[t.state?.data] ?? null,
    alarm: t.alarm?.data ?? null,
    version: t.version ?? null,
    warning: t.warning?.data ?? null,
    topconStatus: ESTACION_STATUS_MAP[t.topconStatus?.data] ?? null,
    topconBattery: t.topconBattery?.data ?? null,
    topconPosition: t.topconPosition ?? null,
    leicaStatus: ESTACION_STATUS_MAP[t.leicaStatus?.data] ?? null,
    leicaBattery: t.leicaBattery ?? null,
    estacion: calculateEstacion(t.topconStatus?.data, t.leicaStatus?.data),
    progress: t.progress?.data ?? null,
    leftTime: t.leftTime ?? null,
    lastUpdateAt: t.lastUpdateAt ?? null,
  };
}

export function hasTelemetrySubscription(deviceId: string) {
  return subscribedDevices.has(deviceId);
}

function quaternionToEuler(x: number, y: number, z: number, w: number) {
  const sinrCosp = 2 * (w * x + y * z);
  const cosrCosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (w * y - z * x);
  let pitch: number;

  if (Math.abs(sinp) >= 1) {
    pitch = Math.sign(sinp) * Math.PI / 2;
  } else {
    pitch = Math.asin(sinp);
  }

  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return { roll, pitch, yaw };
}

function calculateYawDegreesFromQuaternion(
  x: number,
  y: number,
  z: number,
  w: number
): number {
  const { yaw } = quaternionToEuler(x, y, z, w);

  let orientation = Math.trunc(yaw * 180 / Math.PI);

  if (orientation < 0) {
    orientation += 360;
  }

  return orientation;
}

function calculateEstacion(topconStatus: number = 0, leicaStatus: number = 0): number {
  if (topconStatus === 0 && leicaStatus !== 0) {
    return 2; // Leica
  }

  if (leicaStatus === 0 && topconStatus !== 0) {
    return 1; // Topcon
  }

  if (topconStatus === 0 && leicaStatus === 0) {
    return 0; // Ninguna
  }

  const aux = Math.min(topconStatus, leicaStatus);

  if (aux === topconStatus) {
    return 1; // Topcon
  }

  if (aux === leicaStatus) {
    return 2; // Leica
  }

  return 0;
}

function batteryPercentToLevel(percent: number): number {
  if (percent <= 0) return 0;
  if (percent >= 100) return 5;

  return Math.ceil(percent / 20);
}