import { signRosToolJWT } from '@/server/portal.js';
import { createDb } from '@/server/db.js';
import { loadConfig } from './config.js';
import utils from '@transitive-sdk/utils';

type RobotInfoField =
  | 'fecha_ultima_limpieza'
  | 'fecha_ultimo_trabajo'
  | 'num_trabajos'
  | 'tiempo_total_encendido'
  | 'tiempo_total_trabajando';

const subscribedDevices = new Set<string>();

const config = loadConfig();
const db = createDb(config.databaseUrl);

const TOPICS: Array<{ field: RobotInfoField; topic: string }> = [
  { field: 'fecha_ultima_limpieza', topic: '/info_robot/fecha_ultima_limpieza' },
  { field: 'fecha_ultimo_trabajo', topic: '/info_robot/fecha_ultimo_trabajo' },
  { field: 'num_trabajos', topic: '/info_robot/num_trabajos' },
  { field: 'tiempo_total_encendido', topic: '/info_robot/tiempo_total_encendido' },
  { field: 'tiempo_total_trabajando', topic: '/info_robot/tiempo_total_trabajando' },
];

function unwrapRosValue(value: any) {
  if (value && typeof value === 'object' && 'data' in value) {
    return value.data;
  }

  return value;
}

function normalizeStringValue(value: any) {
  const data = unwrapRosValue(value);
  if (data == null) return null;

  const text = String(data).trim();
  return text || null;
}

function normalizeNumberValue(value: any) {
  const data = unwrapRosValue(value);
  if (data == null || data === '') return null;

  const number = Number(data);
  return Number.isFinite(number) ? number : null;
}

function getTopicValue(deviceData: any, field: RobotInfoField) {
  const messages = deviceData?.ros?.[2]?.messages;
  if (!messages) return undefined;

  return messages.info_robot?.[field] ?? messages[`info_robot/${field}`] ?? messages[field];
}

async function saveRobotInfo(deviceId: string, field: RobotInfoField, value: any) {
  switch (field) {
    case 'fecha_ultima_limpieza': {
      const next = normalizeStringValue(value);
      await db.updateRobotInfo(deviceId, { lastClean: next ?? undefined });
      break;
    }
    case 'fecha_ultimo_trabajo': {
      const next = normalizeStringValue(value);
      await db.updateRobotInfo(deviceId, { lastWork: next ?? undefined });
      break;
    }
    case 'num_trabajos': {
      const next = normalizeNumberValue(value);
      await db.updateRobotInfo(deviceId, { works: next ?? undefined });
      break;
    }
    case 'tiempo_total_encendido': {
      console.log('Received tiempo_total_encendido for device', deviceId, 'value:', value);
      const next = normalizeNumberValue(value);
      await db.updateRobotInfo(deviceId, { timeOn: next ?? undefined });
      break;
    }
    case 'tiempo_total_trabajando': {
      const next = normalizeNumberValue(value);
      await db.updateRobotInfo(deviceId, { timeWork: next ?? undefined });
      break;
    }
  }
}

export async function subscribeRobotInfo(opts: {
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

    for (const { topic } of TOPICS) {
      rosTool.subscribe(2, topic);
    }

    for (const { field } of TOPICS) {
      rosTool.onData(async () => {
        const value = getTopicValue(rosTool.deviceData, field);
        if (value == null) return;

        try {
          await saveRobotInfo(opts.deviceId, field, value);
        } catch (error) {
          console.error('Failed to process brit_info_robot for device', opts.deviceId, field, error);
        }
      }, `ros/2/messages/info_robot/${field}`);
    }

    return rosTool;
  } catch (error) {
    subscribedDevices.delete(opts.deviceId);
    throw error;
  }
}

export function hasRobotInfoSubscription(deviceId: string) {
  return subscribedDevices.has(deviceId);
}

export const subscribeBritInfoRobot = subscribeRobotInfo;
