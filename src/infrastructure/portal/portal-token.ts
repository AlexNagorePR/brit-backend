import jwt from 'jsonwebtoken';

export function signPortalApiJWT(opts: {
  jwtSecret: string;
  transitiveUser: string;
  userId?: string;
  validitySeconds?: number;
}) {
  const {
    jwtSecret,
    transitiveUser,
    userId = 'phenomenonrobotics',
    validitySeconds = 60,
  } = opts;

  return jwt.sign(
    {
      userId,
      api: 1,
      id: transitiveUser,
      validity: validitySeconds,
    },
    jwtSecret
  );
}
