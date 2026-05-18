import jwt from 'jsonwebtoken';

export function signRosToolJWT(opts: {
  jwtSecret: string;
  transitiveUser: string;
  deviceId: string;
  userId?: string;
  validitySeconds?: number;
}) {
  return signDeviceCapabilityJWT({
    ...opts,
    capability: '@transitive-robotics/ros-tool',
  });
}

export function signHealthMonitoringJWT(opts: {
  jwtSecret: string;
  transitiveUser: string;
  deviceId: string;
  userId?: string;
  validitySeconds?: number;
}) {
  return signDeviceCapabilityJWT({
    ...opts,
    capability: '@transitive-robotics/health-monitoring',
  });
}

function signDeviceCapabilityJWT(opts: {
  jwtSecret: string;
  transitiveUser: string;
  deviceId: string;
  capability: string;
  userId?: string;
  validitySeconds?: number;
}) {
  const {
    jwtSecret,
    transitiveUser,
    deviceId,
    capability,
    userId = 'phenomenonrobotics',
    validitySeconds = 86400,
  } = opts;

  return jwt.sign(
    {
      id: transitiveUser,
      device: deviceId,
      capability,
      userId,
      validity: validitySeconds,
    },
    jwtSecret
  );
}
