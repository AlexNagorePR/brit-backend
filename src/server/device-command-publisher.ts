import { signRosToolJWT } from '@/server/portal.js';
import utils from '@transitive-sdk/utils';

const rosToolConnections: Record<string, any> = {};
const publishedDevices = new Set<string>();

const log = utils.getLogger('device-command-publisher');

// Mapping of ROS topics to their message types
const TOPIC_TYPE_MAP: Record<string, string> = {
  '/ink_level': 'std_msgs/UInt16',
  // Add more topics and their types as needed
};

export async function initializeCommandPublisher(opts: {
  jwtSecret: string;
  transitiveUser: string;
  deviceId: string;
}) {
  if (publishedDevices.has(opts.deviceId)) {
    return rosToolConnections[opts.deviceId].rosTool;
  }

  publishedDevices.add(opts.deviceId);

  try {
    const { importCapability } = utils as any;

    const token = signRosToolJWT({
      jwtSecret: opts.jwtSecret,
      transitiveUser: opts.transitiveUser,
      deviceId: opts.deviceId,
    });

    const rosTool = await importCapability({ jwt: token });
    
    rosToolConnections[opts.deviceId] = {
      rosTool,
      createdAt: new Date().toISOString(),
    };

    log.debug(`Command publisher initialized for device ${opts.deviceId}`);

    return rosTool;
  } catch (err) {
    publishedDevices.delete(opts.deviceId);
    log.error(`Failed to initialize command publisher for device ${opts.deviceId}:`, err);
    throw err;
  }
}

export function getCommandPublisher(deviceId: string) {
  const connection = rosToolConnections[deviceId];
  if (!connection) return null;
  return connection.rosTool;
}

export async function publishCommand(
  deviceId: string,
  topic: string,
  message: any
) {
  const rosTool = getCommandPublisher(deviceId);
  if (!rosTool) {
    log.warn(`No command publisher for device ${deviceId}`);
    throw new Error(`No command publisher initialized for device ${deviceId}`);
  }

  const type = TOPIC_TYPE_MAP[topic];
  if (!type) {
    throw new Error(`Unknown topic: ${topic}. No message type mapping found.`);
  }

  try {
    // Validate topic and message format based on topic
    validateCommandMessage(topic, message);

    rosTool.publish(2, topic, type, message);
    log.debug(`Command published for device ${deviceId} on topic ${topic}:`, message);
  } catch (err) {
    log.error(`Failed to publish command for device ${deviceId} on topic ${topic}:`, err);
    throw err;
  }
}

export function validateCommandMessage(topic: string, message: any) {
  switch (topic) {
    case '/ink_level':
      if (typeof message.data !== 'number' || ![0, 1, 2].includes(message.data)) {
        throw new Error(`Invalid ink_level: must be 0 (Bajo), 1 (OK), or 2 (Max), got ${message.data}`);
      }
      break;
    // Add more validations for other topics as needed
    default:
      log.warn(`No validation rules for topic ${topic}`);
  }
}
