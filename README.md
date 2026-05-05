
# brit-backend
#### Servicio de rastreo de trabajos de robots y recolección de telemetría

Un servicio backend Node.js/TypeScript para recopilar y persistir información de trabajos de robots, telemetría y datos de monitoreo de salud desde dispositivos de Transitive Robotics.

## Descripción General

brit-backend es un servicio recolector que:

1. **Se suscribe a tópicos ROS** a través de la capacidad Transitive ROS Tool para recibir datos del robot en tiempo real
2. **Persiste información de trabajos** incluyendo interrupciones y alarmas en PostgreSQL
3. **Recopila telemetría** (batería, voltaje, estado, estado de alarma, niveles de tinta, progreso)
4. **Monitorea la salud del dispositivo** a través de la capacidad de Monitoreo de Salud
5. **Proporciona APIs REST** para consultar historial de trabajos, estado del dispositivo y diagnósticos de salud

### Características Principales

- **Rastreo de Trabajos**: Registra ciclos de trabajo completos con tiempos de inicio/fin, rutas de archivos y tiempos de ejecución
- **Registro de Interrupciones**: Captura cambios de estado e interrupciones durante ciclos de trabajo con marcas de tiempo precisas
- **Seguimiento de Alarmas**: Registra advertencias y alarmas con niveles de severidad y detalles de eventos
- **Deduplicación**: Maneja inteligentemente actualizaciones incompletas del tópico ROS, persistiendo datos solo cuando están completos
- **Telemetría en Tiempo Real**: Se suscribe a flujos de telemetría del robot (batería, estado, alarmas, etc.)
- **Diagnósticos de Salud**: Agrega diagnósticos y alertas a nivel de dispositivo


## Configuración

### Requisitos Previos

- Node.js 18+
- npm o yarn
- Base de datos PostgreSQL
- Cuenta de Transitive Robotics con al menos un dispositivo conectado

### Instalación

1. Clonar el repositorio:
```bash
git clone git@github.com:transitiverobotics/brit-backend.git
cd brit-backend
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno copiando `.env.sample` a `.env`:
```bash
cp .env.sample .env
```

4. Editar `.env` con tus credenciales de Transitive y conexión a la base de datos:
```env
# Transitive Robotics
TRANSITIVE_USER=tu-usuario-transitive
JWT_SECRET=tu-jwt-secret-del-portal

# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/brit-db

# Servidor
PORT=3000
NODE_ENV=development

# Cognito (si usas autenticación OIDC)
COGNITO_CLIENT_ID=tu-client-id
COGNITO_CLIENT_SECRET=tu-client-secret
COGNITO_DOMAIN=tu-dominio.auth.region.amazoncognito.com
COGNITO_REGION=region
COGNITO_USER_POOL_ID=region_poolid
```

5. Inicializar la base de datos:
```bash
npm run migrate
```

### Desarrollo

Ejecutar el servidor de desarrollo con recarga en caliente:
```bash
npm run dev
```

El servidor se iniciará en el PUERTO configurado (por defecto: 3000).

### Producción

Compile e inicie el servidor de producción:
```bash
npm run build
npm start
```


## Documentación de Endpoints API

Todos los endpoints requieren autenticación OIDC a través de sesión, excepto los de autenticación y health check.

### 🔐 Autenticación

#### `GET /auth/login`
Inicia el flujo de autenticación OIDC.
- **Autenticación**: No requerida
- **Respuesta**: Redirección al proveedor OIDC (Cognito)
- **Códigos de estado**: 302 (Redirección), 500 (OIDC no inicializado)

#### `GET /auth/callback`
Callback de OIDC tras autenticarse en el proveedor.
- **Autenticación**: No requerida
- **Parámetros de Query**: `code`, `state`
- **Respuesta**: Redirección al dashboard si autenticación es exitosa
- **Códigos de estado**: 302 (Redirección), 400 (Error de OIDC), 500 (Error interno)

#### `GET /auth/logout`
Cierra la sesión actual.
- **Autenticación**: Requerida
- **Respuesta**: Redirección a página de logout de Cognito
- **Códigos de estado**: 302 (Redirección)

### 👤 Usuario

#### `GET /api/user`
Obtiene información del usuario autenticado.
- **Autenticación**: No requerida (retorna datos del usuario si está autenticado)
- **Respuesta**:
```json
{
  "isAuthenticated": boolean,
  "userInfo": {
    "_id": "string",
    "email": "string",
    "admin": boolean,
    "verified": boolean,
    "created": "ISO8601"
  }
}
```
- **Códigos de estado**: 200 (OK)

#### `POST /api/getJWT`
Obtiene un token JWT para acceder a capacidades de Transitive.
- **Autenticación**: Requerida (login)
- **Cuerpo de solicitud**:
```json
{
  "capability": "string"  // Ej: "ros-tool"
}
```
- **Respuesta**:
```json
{
  "token": "JWT signed token"
}
```
- **Códigos de estado**: 200 (OK), 400 (Capacidad no permitida)

### 🏥 Salud y Monitoreo

#### `GET /api/health`
Health check del servicio.
- **Autenticación**: No requerida
- **Respuesta**:
```json
{
  "status": "ok",
  "timestamp": "ISO8601"
}
```
- **Códigos de estado**: 200 (OK)

### 🤖 Dispositivos y Robots

#### `GET /api/devices`
Lista dispositivos de robots conectados del usuario.
- **Autenticación**: Requerida (login)
- **Respuesta**: Array de robots con telemetría
```json
[
  {
    "id": "device-id",
    "name": "robot-name",
    "online": true,
    "hasRosTool": boolean,
    "@transitive-robotics": { /* datos de portal */ }
  }
]
```
- **Códigos de estado**: 200 (OK), 500 (Error BD), 502 (Error API Portal)

#### `GET /api/data/:deviceId`
Obtiene telemetría actual de un dispositivo.
- **Autenticación**: Requerida (login)
- **Parámetros de ruta**: `deviceId` (string)
- **Respuesta**:
```json
{
  "deviceId": "string",
  "telemetry": {
    "battery": number,
    "voltage": number,
    "state": "string",
    "alarm": number,
    "inkLevel": "string",
    "topconBattery": number,
    "leicaBatteryPercentage": number,
    "progress": number,
    "lastUpdateAt": "ISO8601"
  }
}
```
- **Códigos de estado**: 200 (OK)

#### `GET /api/robots`
Lista robots accesibles por el usuario actual.
- **Autenticación**: Requerida (login)
- **Respuesta**: Array de robots
```json
[
  {
    "id": "string",
    "clientId": "string",
    "hostName": "string",
    "robotName": "string",
    "userEmails": ["string"],
    "deliveryDate": "ISO8601",
    "lastMaint": "ISO8601",
    "lastClean": "ISO8601",
    "lastWork": "ISO8601",
    "works": number,
    "timeOn": number,
    "timeWork": number
  }
]
```
- **Códigos de estado**: 200 (OK), 500 (Error BD)

#### `PATCH /api/robots/:robotId/rename`
Renombra un robot.
- **Autenticación**: Requerida (login o admin)
- **Parámetros de ruta**: `robotId` (string)
- **Cuerpo de solicitud**:
```json
{
  "name": "nuevo-nombre"
}
```
- **Respuesta**:
```json
{
  "ok": true,
  "robotId": "string",
  "name": "string"
}
```
- **Códigos de estado**: 200 (OK), 400 (Validación), 403 (No autorizado), 500 (Error)

### 👨‍💼 Administración de Usuarios (requiere `admin`)

#### `GET /admin/users`
Lista usuarios de Cognito y sincroniza con BD.
- **Autenticación**: Requerida (admin)
- **Respuesta**:
```json
{
  "cognitoUsers": [ /* usuarios de Cognito */ ],
  "dbUsers": [ /* usuarios de BD */ ],
  "synced": true
}
```
- **Códigos de estado**: 200 (OK), 502 (Error Cognito)

#### `GET /admin/db-users`
Lista todos los usuarios de la base de datos.
- **Autenticación**: Requerida (admin)
- **Respuesta**:
```json
{
  "count": number,
  "users": [
    {
      "id": "string",
      "email": "string",
      "clientId": "string"
    }
  ]
}
```
- **Códigos de estado**: 200 (OK), 500 (Error)

#### `POST /admin/users/sync`
Sincroniza usuarios de Cognito a la BD manualmente.
- **Autenticación**: Requerida (admin)
- **Cuerpo**: Vacío
- **Respuesta**:
```json
{
  "ok": true,
  "count": number,
  "users": [ /* usuarios sincronizados */ ]
}
```
- **Códigos de estado**: 200 (OK), 502 (Error sincronización)

#### `POST /admin/users`
Crea un nuevo usuario en Cognito.
- **Autenticación**: Requerida (admin)
- **Cuerpo de solicitud**:
```json
{
  "email": "user@example.com",
  "givenName": "John",
  "familyName": "Doe",
  "temporaryPassword": "TempPass123!",
  "groups": ["allowed", "admin"],
  "clientId": "client-id"
}
```
- **Respuesta**: Objeto de usuario creado
- **Códigos de estado**: 201 (Creado), 400 (Validación), 502 (Error Cognito)

#### `GET /admin/users/:username`
Obtiene información de un usuario específico.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `username` (string)
- **Respuesta**: Objeto de usuario de Cognito
- **Códigos de estado**: 200 (OK), 404 (No encontrado), 502 (Error Cognito)

#### `POST /admin/users/:username/groups`
Actualiza los grupos de un usuario.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `username` (string)
- **Cuerpo de solicitud**:
```json
{
  "groups": ["allowed", "admin"]
}
```
- **Respuesta**: Usuario actualizado
- **Códigos de estado**: 200 (OK), 400 (Validación), 502 (Error Cognito)

#### `POST /admin/users/:username/disable`
Deshabilita un usuario.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `username` (string)
- **Respuesta**:
```json
{
  "ok": true,
  "username": "string",
  "enabled": false
}
```
- **Códigos de estado**: 200 (OK), 404 (No encontrado), 502 (Error Cognito)

#### `POST /admin/users/:username/enable`
Habilita un usuario.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `username` (string)
- **Respuesta**:
```json
{
  "ok": true,
  "username": "string",
  "enabled": true
}
```
- **Códigos de estado**: 200 (OK), 404 (No encontrado), 502 (Error Cognito)

#### `PATCH /admin/users/:username/client`
Asigna un cliente a un usuario.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `username` (string)
- **Cuerpo de solicitud**:
```json
{
  "clientName": "client-name"  // O null para remover
}
```
- **Respuesta**:
```json
{
  "ok": true,
  "username": "string",
  "userId": "string",
  "email": "string",
  "clientId": "string",
  "clientName": "string"
}
```
- **Códigos de estado**: 200 (OK), 400 (Validación), 404 (No encontrado), 500 (Error)

#### `DELETE /admin/users/:username`
Elimina un usuario (de Cognito y BD).
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `username` (string)
- **Respuesta**:
```json
{
  "ok": true,
  "username": "string"
}
```
- **Códigos de estado**: 200 (OK), 400 (No puede eliminarse a sí mismo), 502 (Error Cognito)

#### `GET /admin/users/:clientName`
Obtiene usuarios de un cliente específico.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `clientName` (string)
- **Respuesta**:
```json
{
  "clientId": "string",
  "clientName": "string",
  "users": [ /* usuarios del cliente */ ]
}
```
- **Códigos de estado**: 200 (OK), 404 (Cliente no encontrado), 500 (Error)

### 🤖 Administración de Robots (requiere `admin`)

#### `POST /admin/robots/sync`
Sincroniza robots del Portal de Transitive a la BD.
- **Autenticación**: Requerida (admin)
- **Cuerpo**: Vacío
- **Respuesta**:
```json
{
  "ok": true,
  "count": number,
  "robots": [ /* robots sincronizados */ ]
}
```
- **Códigos de estado**: 200 (OK), 502 (Error Portal API)

#### `GET /admin/robots`
Lista todos los robots en la BD.
- **Autenticación**: Requerida (admin)
- **Respuesta**: Array de robots
- **Códigos de estado**: 200 (OK), 500 (Error)

#### `GET /admin/robots/:robotId`
Obtiene información detallada de un robot específico (incluye trabajos, limpiezas, interrupciones y advertencias).
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `robotId` (string)
- **Respuesta**:
```json
{
  "id": "string",
  "clientId": "string",
  "clientName": "string",
  "hostName": "string",
  "robotName": "string",
  "userEmails": ["string"],
  "works": [
    {
      "id": "string",
      "robotId": "string",
      "startTime": "ISO8601",
      "endTime": "ISO8601",
      "estimatedTime": number,
      "totalTime": number,
      "filePath": "string",
      "interruptions": [
        { "id": "string", "workId": "string", "stateCode": number, "eventTime": number, "returnToAuto": number }
      ],
      "warnings": [
        { "id": "string", "workId": "string", "alarmCode": number, "eventTime": number }
      ]
    }
  ],
  "cleans": [ { "id": "string", "robotId": "string", "date": "ISO8601", "event": "Start|End" } ]
}
```
- **Códigos de estado**: 200 (OK), 404 (No encontrado), 500 (Error)

#### `GET /admin/robots/:robotId/users`
Obtiene usuarios asignados a un robot.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `robotId` (string)
- **Respuesta**:
```json
{
  "robotId": "string",
  "userIds": ["string"]
}
```
- **Códigos de estado**: 200 (OK), 500 (Error)

#### `PUT /admin/robots/:robotId/users`
Asigna usuarios a un robot.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `robotId` (string)
- **Cuerpo de solicitud**:
```json
{
  "userIds": ["user-id-1", "user-id-2"]
}
```
- **Respuesta**:
```json
{
  "ok": true,
  "robotId": "string",
  "userIds": ["string"]
}
```
- **Códigos de estado**: 200 (OK), 400 (Validación), 500 (Error)

#### `PATCH /admin/robots/:robotId/client`
Asigna un cliente a un robot.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `robotId` (string)
- **Cuerpo de solicitud**:
```json
{
  "clientName": "client-name"  // O null para remover
}
```
- **Respuesta**:
```json
{
  "ok": true,
  "robotId": "string",
  "clientId": "string",
  "clientName": "string"
}
```
- **Códigos de estado**: 200 (OK), 400 (Validación), 404 (No encontrado), 500 (Error)

### 🏢 Administración de Clientes (requiere `admin`)

#### `GET /admin/clients`
Lista todos los clientes.
- **Autenticación**: Requerida (admin)
- **Respuesta**:
```json
[
  {
    "id": "string",
    "name": "string"
  }
]
```
- **Códigos de estado**: 200 (OK), 500 (Error)

#### `POST /admin/clients`
Crea un nuevo cliente.
- **Autenticación**: Requerida (admin)
- **Cuerpo de solicitud**:
```json
{
  "name": "nombre-cliente"
}
```
- **Respuesta**:
```json
{
  "ok": true,
  "id": "string",
  "name": "string"
}
```
- **Códigos de estado**: 201 (Creado), 400 (Validación), 500 (Error)

#### `GET /admin/clients/:id`
Obtiene información de un cliente específico.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `id` (string)
- **Respuesta**:
```json
{
  "id": "string",
  "name": "string"
}
```
- **Códigos de estado**: 200 (OK), 404 (No encontrado), 500 (Error)

#### `DELETE /admin/clients/:id`
Elimina un cliente.
- **Autenticación**: Requerida (admin)
- **Parámetros de ruta**: `id` (string)
- **Respuesta**:
```json
{
  "ok": true,
  "id": "string"
}
```
- **Códigos de estado**: 200 (OK), 404 (No encontrado), 500 (Error)

### 📊 Utilidad

#### `GET /`
Endpoint raíz - información del servicio.
- **Autenticación**: No requerida
- **Respuesta**:
```json
{
  "service": "transact-backend",
  "status": "running",
  "timestamp": "ISO8601"
}
```
- **Códigos de estado**: 200 (OK)

### Pruebas

Ejecutar la suite de pruebas:
```bash
npm test              # Ejecutar todas las pruebas una vez
npm run test:watch   # Ejecutar pruebas en modo watch
```

## Arquitectura

### Estructura del Proyecto

```
src/
├── server/
│   ├── app.ts                 # Configuración de la aplicación Express
│   ├── main.ts                # Punto de entrada
│   ├── auth.ts                # Middleware de autenticación
│   ├── config.ts              # Gestión de configuración
│   ├── db.ts                  # Cliente de base de datos y consultas
│   ├── brit-info-work.ts      # Controlador de suscripción de info de trabajo
│   ├── telemetry.ts           # Recopilación de telemetría
│   ├── collector.ts           # Servicio principal recolector
│   ├── portal.ts              # API de Transitive Portal
│   └── cognito-admin.ts       # Operaciones admin de Cognito
└── lib/
    └── utils.ts               # Funciones utilitarias

test/
├── brit-info-work.test.ts
├── brit-info-work-persistence.test.ts
└── ... otras pruebas
```

### Flujo de Datos

1. **Suscripción**: El recolector se suscribe a tópicos ROS en dispositivos conectados
2. **Recepción de Mensajes**: Los mensajes de Brit Info Work llegan incrementalmente en el tópico `/brit_info_work`
3. **Acumulación**: Los mensajes se acumulan en caché hasta que el snapshot de trabajo esté completo
4. **Persistencia**: Una vez completo (con end_time y todos los campos requeridos), el trabajo se inserta en la BD
5. **Registros Hijo**: Las interrupciones y advertencias se analizan e insertan como filas separadas
6. **Deduplicación**: Las actualizaciones repetidas del tópico con la misma clave de trabajo no crean registros de BD duplicados

### Esquema de Base de Datos

Tablas principales:
- `work` - Ciclos de trabajo de robots con tiempos de inicio/fin, duraciones, rutas de archivos
- `interruption` - Cambios de estado e interrupciones de trabajo con marcas de tiempo
- `warning` - Alarmas y advertencias con niveles de severidad
- `robot` - Dispositivos de robots conectados
- `battery` - Información de batería para dispositivos rastreados

### Mapeo de Datos de Brit Info Work

Los mensajes del tópico ROS `/brit_info_work` se mapean a registros de base de datos:

| Campo del Tópico | Tabla BD | Columna | Notas |
|-------------|----------|--------|-------|
| `start_time` | work | start_time | Marca de tiempo ISO |
| `end_time` | work | end_time | Indica finalización del trabajo |
| `json_file_path` | work | file_path | Ruta al archivo de datos del trabajo |
| `estimated_time` | work | estimated_time | Segundos |
| `total_time` | work | total_time | Tiempo de ejecución real |
| `interruptions_count` / `interruption_count` | work | interruptions | Nombre de campo normalizado |
| `warnings_count` / `warnings_count` | work | alarms | Asignado a columna de alarmas |
| `interruptions_detail[].new_state` | interruption | state_code | Código de transición de estado |
| `interruptions_detail[].time_from_start` | interruption | event_time | Tiempo relativo desde el inicio |
| `warnings_detail[].level` | warning | alarm_code | Nivel de severidad de alarma |
| `warnings_detail[].time_from_start` | warning | event_time | Tiempo relativo desde el inicio |

**Nota**: Los mensajes del tópico llegan incrementalmente. El controlador acumula campos hasta que todos los campos requeridos (`start_time`, `json_file_path`, `estimated_time`, `total_time`, `end_time`) estén presentes, luego inserta un único registro de trabajo y todas las interrupciones/advertencias asociadas.

## Desarrollo

### Ejecutar Pruebas

```bash
npm test                                    # Ejecutar todas las pruebas
npm test -- --run test/brit-info-work.test.ts  # Ejecutar archivo de prueba específico
npm run test:watch                          # Modo watch
```

### Estilo de Código

Este proyecto utiliza ESLint y TypeScript. Formatea y lint tu código:

```bash
npx eslint src/
npx tsc --noEmit
```

### Servicios Principales

- **Collector**: Servicio principal que orquesta todas las suscripciones y recopilación de datos
- **BritInfoWork Handler**: Gestiona suscripciones de tópico ROS `/brit_info_work`
- **Telemetry**: Recopila telemetría de robots en tiempo real
- **HealthMonitoring**: Se suscribe a diagnósticos de salud de dispositivos desde MQTT
- **Database**: Capa de persistencia PostgreSQL

