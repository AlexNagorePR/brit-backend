import { signRosToolJWT } from '@/server/portal.js';
import utils from '@transitive-sdk/utils';
import {
  BRIT_STATE_MAP,
  INK_LEVEL_MAP,
  ESTACION_STATUS_MAP,
  ESTACION_MAP,
  FEEDBACK_MAP,
  WARNING_MAP,
  MOTOR_ERROR_MAP,
  FALL_SENSOR_BITS,
} from './data-stream-constants.js';

const telemetryCache: Record<string, any> = {};
const subscribedDevices = new Set<string>();

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
      blueprintFeedback: null,

      topconStatus: null,
      leicaStatus: null,
      topconBattery: null,
      leicaBattery: null,
      topconPosition: null,
      estacion: null,

      progress: null,
      leftTime: null,
      printedElement: null,
      deletedElement: null,

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
    
    // Servicio InfoBrit
    rosTool.subscribe(2, '/odomety/global')
    rosTool.subscribe(2, '/battery');
    rosTool.subscribe(2, '/ink_level');
    rosTool.subscribe(2, '/state');
    rosTool.subscribe(2, '/alarm');
    rosTool.subscribe(2, '/version');
    rosTool.subscribe(2, '/warning');
    rosTool.subscribe(2, '/blueprint_feedback');

    // Servicio InfoTopcon/Leica
    rosTool.subscribe(2, '/topcon_status'); 
    rosTool.subscribe(2, '/leica_status');
    rosTool.subscribe(2, '/topcon_battery');
    rosTool.subscribe(2, '/leica_battery_percentage');
    rosTool.subscribe(2, '/topcon_position');
    
    // Servicio InfoWork
    rosTool.subscribe(2, '/progress');
    rosTool.subscribe(2, '/left_time');
    rosTool.subscribe(2, '/item_id');
    rosTool.subscribe(2, '/id_deleted');

    // Procesamiento de datos
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
      console.log('ink_level structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.inkLevel = value;
    }, 'ros/2/messages/ink_level');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.state;
      if (value == null) return;
      console.log('state structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.state = value;
    }, 'ros/2/messages/state');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.alarm;
      if (!value) return;
      const next = touchCache(opts.deviceId);
      
      const decoded = decodeAlarm(value);
      next.alarm = {
        alarmType: decoded.alarmType,
        message: decoded.message,
        severity: decoded.severity,
        details: decoded.details,
        timestamp: new Date().toISOString(),
      };
      
      // Log alarms based on severity
      if (decoded.severity === 'error') {
        console.error(`[ALARM ERROR] Device ${opts.deviceId}: ${decoded.message}`);
      } else if (decoded.severity === 'warning' && decoded.alarmType !== 0) {
        console.warn(`[ALARM WARNING] Device ${opts.deviceId}: ${decoded.message}`);
      }
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
      
      // Format: [ID, Info_warning]
      // ID: 0=No warning, 1=Tinta bajo, 2=Prisma perdido, etc.
      const warningId = Array.isArray(value.data) ? value.data[0] : value;
      
      const warningDetail = WARNING_MAP[warningId] || { message: 'Warning desconocido', severity: 'warning' };
      
      next.warning = {
        id: warningId,
        message: warningDetail.message,
        severity: warningDetail.severity,
      };
    }, 'ros/2/messages/warning');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.blueprint_feedback;
      if (!value) return;
      const next = touchCache(opts.deviceId);
      
      // Format: [Info_feedback, ID]
      // Info_feedback: 0=OK, 1=Error en forjado, 2=Error al procesar elemento
      // ID: id del elemento con problema (solo si hay error)
      const feedback = Array.isArray(value.data) ? value.data[0] : value;
      const elementId = Array.isArray(value.data) && value.data.length > 1 ? value.data[1] : null;
      
      const feedbackMessage = FEEDBACK_MAP[feedback] || 'Feedback desconocido';
      
      next.blueprintFeedback = {
        status: feedback,
        message: feedbackMessage,
        elementId: elementId,
      };
    }, 'ros/2/messages/blueprint_feedback');


    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.topcon_status;
      if (value == null) return;
      console.log('topcon_status structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.topconStatus = value;
    }, 'ros/2/messages/topcon_status');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.leica_status;
      if (value == null) return;
      console.log('leica_status structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.leicaStatus = value;
    }, 'ros/2/messages/leica_status');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.topcon_battery;
      if (value == null) return;
      console.log('topcon_battery structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.topconBattery = value;
    }, 'ros/2/messages/topcon_battery');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.leica_battery_percentage;
      if (value == null) return;
      const next = touchCache(opts.deviceId);
      next.leicaBattery = batteryPercentToLevel(value);
    }, 'ros/2/messages/leica_battery_percentage');

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
      const value = rosTool.deviceData?.ros?.[2]?.messages?.progress;
      if (value == null) return;
      console.log('progress structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.progress = value;
    }, 'ros/2/messages/progress');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.left_time;
      if (value == null) return;
      console.log('left_time structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.leftTime = value;
    }, 'ros/2/messages/left_time');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.item_id;
      if (value == null) return;
      console.log('item_id structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.printedElement = value;
    }, 'ros/2/messages/item_id');

    rosTool.onData(() => {
      const value = rosTool.deviceData?.ros?.[2]?.messages?.id_deleted;
      if (value == null) return;
      console.log('id_deleted structure:', JSON.stringify(value, null, 2));
      const next = touchCache(opts.deviceId);
      next.deletedElement = value;
    }, 'ros/2/messages/id_deleted');

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
    blueprintFeedback: t.blueprintFeedback ?? null,

    topconStatus: ESTACION_STATUS_MAP[t.topconStatus?.data] ?? null,
    leicaStatus: ESTACION_STATUS_MAP[t.leicaStatus?.data] ?? null,
    topconBattery: t.topconBattery?.data ?? null,
    leicaBattery: t.leicaBattery ?? null,
    topconPosition: t.topconPosition ?? null,
    estacion: ESTACION_MAP[calculateEstacion(t.topconStatus?.data, t.leicaStatus?.data)] ?? null,

    progress: t.progress?.data ?? null,
    leftTime: t.leftTime ?? null,
    printedElement: t.printedElement ?? null,
    deletedElement: t.deletedElement ?? null,

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

function decodeAlarm(data: any) {
  if (!data || !Array.isArray(data.data) || data.data.length < 2) {
    return { alarmType: 0, message: 'No alarma', severity: 'info', details: {} };
  }

  const alarmId = data.data[0];
  const infoError = data.data[1];

  if (alarmId === 0) {
    return { alarmType: 0, message: 'No alarma', severity: 'info', details: {} };
  }

  if (alarmId === 1) {
    // Motor error
    const motorError = MOTOR_ERROR_MAP[infoError] || `Unknown motor error (${infoError})`;
    return {
      alarmType: 1,
      message: `Motor alarm: ${motorError}`,
      severity: 'error',
      details: { motorErrorCode: infoError, motorErrorMessage: motorError },
    };
  }

  if (alarmId === 2) {
    // Fall sensors - check bits
    const sensors: string[] = [];
    for (let bit = 0; bit < 4; bit++) {
      if ((infoError & (1 << bit)) !== 0) {
        sensors.push(FALL_SENSOR_BITS[bit as keyof typeof FALL_SENSOR_BITS]);
      }
    }
    return {
      alarmType: 2,
      message: `Sensores de caída: ${sensors.join(', ') || 'todos OK'}`,
      severity: sensors.length > 0 ? 'error' : 'info',
      details: { affectedSensors: sensors },
    };
  }

  if (alarmId === 3) {
    // Linear actuator
    return {
      alarmType: 3,
      message: `Actuador lineal alarm: ID ${infoError}`,
      severity: 'error',
      details: { actuatorId: infoError },
    };
  }

  if (alarmId === 4) {
    // Nearby obstacle
    return {
      alarmType: 4,
      message: `Obstáculo cercano a ${infoError}°`,
      severity: 'warning',
      details: { angleInDegrees: infoError },
    };
  }

  if (alarmId === 5) {
    // Fix heading failed
    return {
      alarmType: 5,
      message: 'Fix heading fallido. Pedir al usuario que vuelva a modo manual y regresar con el joystick',
      severity: 'error',
      details: { requiresManualReset: true },
    };
  }

  return {
    alarmType: alarmId,
    message: `Alarma desconocida ID ${alarmId}`,
    severity: 'warning',
    details: { rawInfo: infoError },
  };
}