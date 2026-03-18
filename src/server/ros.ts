// src/server/ros.ts
import { signRosToolJWT } from '@/server/portal.js';
import utils from '@transitive-sdk/utils';
import { pathToFileURL } from 'node:url';

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
}

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
    };
  }

  return telemetryCache[deviceId];
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
            cache.battery = value.percentage*100;
            cache.voltage = value.voltage
        }, 'ros/2/messages/battery');

        rosTool.onData(() => {
            const value = rosTool.deviceData?.ros?.[2]?.messages?.state;
            if (value == null) return;
            cache.state = value;
        }, 'ros/2/messages/state');

        rosTool.onData(() => {
            const value = rosTool.deviceData?.ros?.[2]?.messages?.alarm;
            if (!value) return;
            cache.alarm = value;
        }, 'ros/2/messages/alarm');

        rosTool.onData(() => {
            const value = rosTool.deviceData?.ros?.[2]?.messages?.ink_level;
            if (value == null) return;
            cache.inkLevel = value;
            console.log("Device:", opts.deviceId, "Ink_level:", value);
        }, 'ros/2/messages/ink_level');

        rosTool.onData(() => {
            const value = rosTool.deviceData?.ros?.[2]?.messages?.topcon_battery;
            if (value == null) return;
            cache.topconBattery = value;
        }, 'ros/2/messages/topcon_battery');

        rosTool.onData(() => {
            const value = rosTool.deviceData?.ros?.[2]?.messages?.leica_battery_percentage;
            if (value == null) return;
            cache.leicaBatteryPercentage = value;
        }, 'ros/2/messages/leica_battery_percentage');

        rosTool.onData(() => {
            const value = rosTool.deviceData?.ros?.[2]?.messages?.progress;
            if (value == null) return;
            cache.progress = value;
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

    //console.log("Device:", deviceId, "\nTelemetria:", t);

    return {
        battery: t.battery ?? null,
        voltage: t.voltage ?? null,
        state: BRIT_STATE_MAP[t.state?.data] ?? null,
        alarm: t.alarm?.data ?? null,
        inkLevel: INK_LEVEL_MAP[t.inkLevel?.data] ?? null,
        topconBattery: t.topconBattery?.data ?? null,
        leicaBatteryPercentage: t.leicaBatteryPercentage?.data ?? null,
        progress: t.progress?.data ?? null,
    };
}