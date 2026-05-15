/**
 * Telemetry data mappings and constants for device telemetry processing
 */

export const BRIT_STATE_MAP: Record<number, string> = {
  0: 'Alarm/Stop',
  1: 'Waiting',
  2: 'Fix Heading',
  3: 'Avoid Obstacle',
  4: 'Automatic',
  5: 'Manual',
  6: 'Free',
};

export const INK_LEVEL_MAP: Record<number, string> = {
  0: 'Bajo',
  1: 'OK',
  2: 'Max',
};

export const ESTACION_STATUS_MAP: Record<number, string> = {
  0: 'Desconectado',
  1: 'Conectado/Manual',
  2: 'Conectado/Buscando',
  3: 'Conectado/Fijo',
};

export const ESTACION_MAP: Record<number, string> = {
  0: 'Ninguna',
  1: 'Topcon',
  2: 'Leica',
};

export const FEEDBACK_MAP: Record<string, string> = {
  0: 'Plano procesado correctamente',
  1: 'Error en el forjado',
  2: 'Error al procesar un elemento',
};

export const WARNING_MAP: Record<number, { message: string; severity: 'info' | 'warning' | 'error' }> = {
  0: { message: 'No warning', severity: 'info' },
  1: { message: 'Nivel tinta bajo', severity: 'warning' },
  2: { message: 'Prisma perdido', severity: 'error' },
  3: { message: 'Error al procesar el plano', severity: 'error' },
  4: { message: 'Robot fuera del forjado: Llévalo dentro o vuelve a enviar el plano', severity: 'error' },
  5: { message: 'Error al interpretar los limites', severity: 'error' },
  6: { message: 'Limites mal definidos. Se ha recalculado un limite aproximado. Puede haberse reducido su tamaño', severity: 'warning' },
  7: { message: 'Todos los elementos a pintar están fuera de los limites', severity: 'warning' },
};

// Motor error codes (ID 1)
export const MOTOR_ERROR_MAP: Record<number, string> = {
  0: 'No error',
  1: 'Over voltaje',
  2: 'Under voltaje',
  4: 'Over current',
  8: 'Over load',
  16: 'Current out of tolerance',
  32: 'Encoder out of tolerance',
  64: 'Velocity out of tolerance',
  128: 'Reference voltaje error',
  256: 'EEPROM error',
  512: 'Hall error',
  1024: 'Motor temperature over temperature',
};

// Fall sensors error codes (ID 2) - binary bits 0-3
export const FALL_SENSOR_BITS = {
  0: 'FR (Front Right)',
  1: 'BL (Back Left)',
  2: 'BR (Back Right)',
  3: 'FL (Front Left)',
};
