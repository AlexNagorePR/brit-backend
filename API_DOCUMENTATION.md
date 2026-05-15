# Documentación de API - BRIT Backend

**Versión:** 1.0  
**Última actualización:** 2026-05-15

---

## Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Usuario (General)](#usuario-general)
3. [Administración de Usuarios](#administración-de-usuarios)
4. [Administración de Clientes](#administración-de-clientes)
5. [Administración de Robots](#administración-de-robots)
6. [Administración de Baterías](#administración-de-baterías)
7. [Dispositivos y Datos](#dispositivos-y-datos)
8. [Robots (Usuario Regular)](#robots-usuario-regular)
9. [Comandos](#comandos)
10. [Health Check](#health-check)

---

## Autenticación

### GET /auth/login
**Descripción:** Inicia el flujo de autenticación OIDC con Cognito.

**Autenticación requerida:** No

**Respuesta:** Redirige al servidor de autenticación Cognito

**Ejemplo:**
```
GET /auth/login
```

---

### GET /auth/callback
**Descripción:** Callback de OIDC después de la autenticación en Cognito. Valida el token y establece la sesión.

**Autenticación requerida:** No

**Parámetros de query:**
- `code` (string): Código de autorización de Cognito
- `state` (string): Estado para validación CSRF
- `error` (string, opcional): Error de OIDC si la autenticación falla

**Respuesta:** Redirige a la URL de postLogin (configurada en .env)

**Ejemplo:**
```
GET /auth/callback?code=abc123&state=xyz789
```

**Nota:** Si el usuario no está en el grupo "allowed" de Cognito, se rechaza la solicitud.

---

### GET /auth/logout
**Descripción:** Cierra la sesión del usuario y redirige al logout de Cognito.

**Autenticación requerida:** Sí (sesión activa)

**Respuesta:** Redirige al logout de Cognito

**Ejemplo:**
```
GET /auth/logout
```

---

## Usuario (General)

### GET /api/user
**Descripción:** Obtiene la información del usuario autenticado actualmente.

**Autenticación requerida:** No (pero devuelve null si no está autenticado)

**Respuesta:**
```json
{
  "isAuthenticated": true,
  "userInfo": {
    "_id": "user-email@example.com",
    "email": "user-email@example.com",
    "admin": false,
    "verified": true,
    "created": "2026-01-15T10:30:00Z"
  }
}
```

O si no está autenticado:
```json
{
  "isAuthenticated": false,
  "userInfo": null
}
```

---

### POST /api/getJWT
**Descripción:** Genera un JWT token para el usuario actual. Se utiliza para comunicación con otros servicios.

**Autenticación requerida:** Sí

**Body (JSON):**
```json
{
  "capability": "ignore"
}
```

**Respuesta (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errores:**
- `400`: Si capability termina con `_robot-agent` (no se firman tokens de agente)
- `401`: Sin autenticación

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/getJWT \
  -H "Content-Type: application/json" \
  -d '{"capability": "ignore"}'
```

---

## Administración de Usuarios

### GET /admin/users
**Descripción:** Obtiene todos los usuarios de Cognito y la base de datos. Sincroniza automáticamente usuarios de Cognito con la BD.

**Autenticación requerida:** Sí (solo admin)

**Respuesta:**
```json
{
  "cognitoUsers": [
    {
      "username": "user@example.com",
      "attributes": {
        "email": "user@example.com",
        "given_name": "John",
        "family_name": "Doe"
      },
      "enabled": true,
      "groups": ["allowed"]
    }
  ],
  "dbUsers": [
    {
      "id": "user@example.com",
      "email": "user@example.com",
      "clientId": "client-123",
      "created": "2026-01-15T10:30:00Z"
    }
  ],
  "synced": true
}
```

---

### GET /admin/users/db-users
**Descripción:** Obtiene solo los usuarios de la base de datos local.

**Autenticación requerida:** Sí (solo admin)

**Respuesta:**
```json
{
  "count": 5,
  "users": [
    {
      "id": "user@example.com",
      "email": "user@example.com",
      "clientId": "client-123",
      "created": "2026-01-15T10:30:00Z"
    }
  ]
}
```

---

### POST /admin/users/sync
**Descripción:** Sincroniza manualmente todos los usuarios de Cognito con la base de datos.

**Autenticación requerida:** Sí (solo admin)

**Respuesta:**
```json
{
  "ok": true,
  "count": 5,
  "users": [
    {
      "id": "user@example.com",
      "email": "user@example.com",
      "clientId": null,
      "created": "2026-01-15T10:30:00Z"
    }
  ]
}
```

---

### POST /admin/users
**Descripción:** Crea un nuevo usuario en Cognito y en la base de datos.

**Autenticación requerida:** Sí (solo admin)

**Body (JSON):**
```json
{
  "email": "newuser@example.com",
  "givenName": "John",
  "familyName": "Doe",
  "groups": ["allowed"],
  "temporaryPassword": "TempPass123!",
  "clientId": "client-123"
}
```

**Respuesta (201):**
```json
{
  "username": "newuser@example.com",
  "attributes": {
    "email": "newuser@example.com",
    "given_name": "John",
    "family_name": "Doe"
  },
  "enabled": true,
  "groups": ["allowed"]
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "givenName": "John",
    "familyName": "Doe",
    "groups": ["allowed"],
    "clientId": "client-123"
  }'
```

---

### GET /admin/users/:username
**Descripción:** Obtiene la información de un usuario específico de Cognito.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `username` (string, path): Email o ID del usuario

**Respuesta:**
```json
{
  "username": "user@example.com",
  "attributes": {
    "email": "user@example.com",
    "given_name": "John",
    "family_name": "Doe"
  },
  "enabled": true,
  "groups": ["allowed"]
}
```

**Errores:**
- `404`: Usuario no encontrado

---

### POST /admin/users/:username/groups
**Descripción:** Establece los grupos de un usuario (reemplaza todos los grupos actuales).

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `username` (string, path): Email del usuario

**Body (JSON):**
```json
{
  "groups": ["allowed", "admin"]
}
```

**Respuesta:**
```json
{
  "username": "user@example.com",
  "attributes": { /* ... */ },
  "groups": ["allowed", "admin"],
  "clientId": null,
  "clientName": null
}
```

**Nota:** Los grupos válidos son: `allowed` y `admin`

---

### POST /admin/users/:username/enable
**Descripción:** Activa un usuario desactivado.

**Autenticación requerida:** Sí (solo admin)

**Respuesta:**
```json
{
  "ok": true,
  "username": "user@example.com",
  "enabled": true
}
```

---

### POST /admin/users/:username/disable
**Descripción:** Desactiva un usuario.

**Autenticación requerida:** Sí (solo admin)

**Respuesta:**
```json
{
  "ok": true,
  "username": "user@example.com",
  "enabled": false
}
```

---

### PATCH /admin/users/:username/client
**Descripción:** Asigna o desasigna un cliente a un usuario.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `username` (string, path): Email del usuario

**Body (JSON):**
```json
{
  "clientId": "client-123"
}
```

O para desasignar:
```json
{
  "clientId": null
}
```

**Respuesta:**
```json
{
  "ok": true,
  "username": "user@example.com",
  "userId": "user@example.com",
  "email": "user@example.com",
  "clientId": "client-123",
  "clientName": null
}
```

**Errores:**
- `404`: Usuario no encontrado en la BD
- `400`: clientId debe ser string o null

---

### GET /admin/users/by-client/:clientName
**Descripción:** Obtiene todos los usuarios asignados a un cliente específico.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `clientName` (string, path): Nombre del cliente

**Respuesta:**
```json
{
  "clientId": "client-123",
  "clientName": "Acme Corp",
  "users": [
    {
      "id": "user@example.com",
      "email": "user@example.com",
      "clientId": "client-123",
      "created": "2026-01-15T10:30:00Z"
    }
  ]
}
```

**Errores:**
- `404`: Cliente no encontrado

---

### DELETE /admin/users/:username
**Descripción:** Elimina un usuario de Cognito y de la base de datos.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `username` (string, path): Email del usuario

**Respuesta:**
```json
{
  "ok": true,
  "username": "user@example.com"
}
```

**Errores:**
- `400`: No puedes eliminar tu propia cuenta

---

## Administración de Clientes

### GET /admin/clients
**Descripción:** Obtiene la lista de todos los clientes.

**Autenticación requerida:** Sí (solo admin)

**Respuesta:**
```json
[
  {
    "id": "client-123",
    "name": "Acme Corp",
    "created": "2026-01-15T10:30:00Z"
  },
  {
    "id": "client-456",
    "name": "Tech Industries",
    "created": "2026-02-20T14:15:00Z"
  }
]
```

---

### POST /admin/clients
**Descripción:** Crea un nuevo cliente.

**Autenticación requerida:** Sí (solo admin)

**Body (JSON):**
```json
{
  "name": "Nueva Empresa"
}
```

**Respuesta (201):**
```json
{
  "ok": true,
  "id": "client-789",
  "name": "Nueva Empresa",
  "created": "2026-05-15T10:30:00Z"
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/admin/clients \
  -H "Content-Type: application/json" \
  -d '{"name": "Nueva Empresa"}'
```

---

### GET /admin/clients/:id
**Descripción:** Obtiene los detalles de un cliente específico.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `id` (string, path): ID del cliente

**Respuesta:**
```json
{
  "id": "client-123",
  "name": "Acme Corp",
  "created": "2026-01-15T10:30:00Z"
}
```

**Errores:**
- `404`: Cliente no encontrado

---

### DELETE /admin/clients/:id
**Descripción:** Elimina un cliente.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `id` (string, path): ID del cliente

**Respuesta:**
```json
{
  "ok": true,
  "id": "client-123",
  "name": "Acme Corp"
}
```

**Errores:**
- `404`: Cliente no encontrado

---

## Administración de Robots

### POST /admin/robots/sync
**Descripción:** Sincroniza todos los robots disponibles desde el Portal API con la base de datos local.

**Autenticación requerida:** Sí (solo admin)

**Respuesta:**
```json
{
  "ok": true,
  "count": 3,
  "robots": [
    {
      "id": "robot-001",
      "name": "Robot Alpha",
      "clientId": "client-123",
      "created": "2026-01-15T10:30:00Z"
    }
  ]
}
```

**Errores:**
- `502`: Error en conexión con Portal API

---

### GET /admin/robots
**Descripción:** Obtiene la lista de todos los robots.

**Autenticación requerida:** Sí (solo admin)

**Respuesta:**
```json
[
  {
    "id": "robot-001",
    "name": "Robot Alpha",
    "clientId": "client-123",
    "created": "2026-01-15T10:30:00Z"
  },
  {
    "id": "robot-002",
    "name": "Robot Beta",
    "clientId": "client-456",
    "created": "2026-02-10T09:20:00Z"
  }
]
```

---

### GET /admin/robots/:robotId
**Descripción:** Obtiene los detalles de un robot específico.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `robotId` (string, path): ID del robot

**Respuesta:**
```json
{
  "id": "robot-001",
  "name": "Robot Alpha",
  "clientId": "client-123",
  "created": "2026-01-15T10:30:00Z"
}
```

**Errores:**
- `404`: Robot no encontrado

---

### GET /admin/robots/:robotId/users
**Descripción:** Obtiene los usuarios asignados a un robot.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `robotId` (string, path): ID del robot

**Respuesta:**
```json
{
  "robotId": "robot-001",
  "userIds": [
    "user1@example.com",
    "user2@example.com"
  ]
}
```

---

### PUT /admin/robots/:robotId/users
**Descripción:** Asigna usuarios a un robot (reemplaza la lista actual).

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `robotId` (string, path): ID del robot

**Body (JSON):**
```json
{
  "userIds": [
    "user1@example.com",
    "user2@example.com"
  ]
}
```

**Respuesta:**
```json
{
  "ok": true,
  "robotId": "robot-001",
  "userIds": [
    "user1@example.com",
    "user2@example.com"
  ]
}
```

---

### PATCH /admin/robots/:robotId/client
**Descripción:** Asigna un cliente a un robot por nombre de cliente.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `robotId` (string, path): ID del robot

**Body (JSON):**
```json
{
  "clientName": "Acme Corp"
}
```

O para desasignar:
```json
{
  "clientName": null
}
```

**Respuesta:**
```json
{
  "ok": true,
  "id": "robot-001",
  "name": "Robot Alpha",
  "clientId": "client-123",
  "clientName": "Acme Corp",
  "created": "2026-01-15T10:30:00Z"
}
```

**Errores:**
- `404`: Cliente no encontrado

---

## Administración de Baterías

### GET /admin/batteries
**Descripción:** Obtiene las baterías de un cliente específico.

**Autenticación requerida:** Sí (solo admin)

**Parámetros de query:**
- `clientId` (string): ID del cliente

**Respuesta:**
```json
[
  {
    "id": "battery-001",
    "serialNumber": "SN-12345",
    "stateOfHealth": 95,
    "clientId": "client-123",
    "created": "2026-01-15T10:30:00Z"
  }
]
```

---

### POST /admin/batteries
**Descripción:** Crea una nueva batería.

**Autenticación requerida:** Sí (solo admin)

**Body (JSON):**
```json
{
  "clientId": "client-123",
  "serialNumber": "SN-12345",
  "stateOfHealth": 95
}
```

**Respuesta (201):**
```json
{
  "ok": true,
  "id": "battery-001",
  "serialNumber": "SN-12345",
  "stateOfHealth": 95,
  "clientId": "client-123",
  "created": "2026-05-15T10:30:00Z"
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/admin/batteries \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client-123",
    "serialNumber": "SN-12345",
    "stateOfHealth": 95
  }'
```

---

### GET /admin/batteries/:id
**Descripción:** Obtiene los detalles de una batería específica.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `id` (string, path): ID de la batería

**Respuesta:**
```json
{
  "id": "battery-001",
  "serialNumber": "SN-12345",
  "stateOfHealth": 95,
  "clientId": "client-123",
  "created": "2026-01-15T10:30:00Z"
}
```

**Errores:**
- `404`: Batería no encontrada

---

### PUT /admin/batteries/:id
**Descripción:** Actualiza el número de serie de una batería.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `id` (string, path): ID de la batería

**Body (JSON):**
```json
{
  "serialNumber": "SN-67890"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "id": "battery-001",
  "serialNumber": "SN-67890",
  "stateOfHealth": 95,
  "clientId": "client-123",
  "created": "2026-01-15T10:30:00Z"
}
```

---

### DELETE /admin/batteries/:id
**Descripción:** Elimina una batería.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `id` (string, path): ID de la batería

**Respuesta:**
```json
{
  "ok": true,
  "id": "battery-001",
  "serialNumber": "SN-12345",
  "stateOfHealth": 95,
  "clientId": "client-123",
  "created": "2026-01-15T10:30:00Z"
}
```

---

### GET /admin/batteries/:id/users
**Descripción:** Obtiene los usuarios asignados a una batería.

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `id` (string, path): ID de la batería

**Respuesta:**
```json
[
  {
    "id": "user1@example.com",
    "email": "user1@example.com"
  }
]
```

---

### PUT /admin/batteries/:id/users
**Descripción:** Asigna usuarios a una batería (reemplaza la lista actual).

**Autenticación requerida:** Sí (solo admin)

**Parámetros:**
- `id` (string, path): ID de la batería

**Body (JSON):**
```json
{
  "userIds": [
    "user1@example.com",
    "user2@example.com"
  ]
}
```

**Respuesta:**
```json
{
  "ok": true,
  "id": "battery-001",
  "userIds": [
    "user1@example.com",
    "user2@example.com"
  ]
}
```

---

## Dispositivos y Datos

### GET /api/devices
**Descripción:** Obtiene todos los dispositivos disponibles para el usuario actual desde Portal API.

**Autenticación requerida:** Sí

**Respuesta:**
```json
[
  {
    "id": "device-001",
    "name": "Robot Arm A",
    "status": "online",
    "hasRosTool": true,
    "connected": true
  },
  {
    "id": "device-002",
    "name": "Robot Arm B",
    "status": "offline",
    "hasRosTool": false,
    "connected": false
  }
]
```

**Errores:**
- `500`: Error en la base de datos
- `502`: Error en Portal API

---

### GET /api/data/:deviceId
**Descripción:** Obtiene datos de telemetría para un dispositivo específico.

**Autenticación requerida:** Sí

**Parámetros:**
- `deviceId` (string, path): ID del dispositivo

**Respuesta:**
```json
{
  "deviceId": "device-001",
  "telemetry": {
    "battery": 85,
    "temperature": 42.5,
    "lastUpdate": "2026-05-15T14:30:00Z"
  }
}
```

**Nota:** Los datos de telemetría se almacenan en memoria. El contenido depende de lo que haya sido publicado recientemente.

---

## Robots (Usuario Regular)

### GET /api/robots
**Descripción:** Obtiene todos los robots asignados al usuario actual desde la base de datos.

**Autenticación requerida:** Sí

**Respuesta:**
```json
[
  {
    "id": "robot-001",
    "name": "Robot Alpha",
    "clientId": "client-123",
    "created": "2026-01-15T10:30:00Z"
  },
  {
    "id": "robot-002",
    "name": "Robot Beta",
    "clientId": "client-123",
    "created": "2026-02-10T09:20:00Z"
  }
]
```

**Errores:**
- `500`: Error en la base de datos

---

### PATCH /api/robots/:robotId/rename
**Descripción:** Cambia el nombre de un robot. Solo admins o usuarios con acceso al robot pueden renombrarlo.

**Autenticación requerida:** Sí

**Parámetros:**
- `robotId` (string, path): ID del robot

**Body (JSON):**
```json
{
  "name": "Mi Robot Personalizado"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "robotId": "robot-001",
  "name": "Mi Robot Personalizado"
}
```

**Errores:**
- `400`: Nombre vacío o inválido
- `403`: Acceso denegado (robot no encontrado para el usuario)
- `404`: Validación de robot fallida

**Ejemplo:**
```bash
curl -X PATCH http://localhost:3000/api/robots/robot-001/rename \
  -H "Content-Type: application/json" \
  -d '{"name": "Mi Robot Personalizado"}'
```

---

## Comandos

### POST /api/commands/:deviceId
**Descripción:** Publica un comando a un dispositivo. Solo admins o usuarios con acceso al dispositivo pueden publicar comandos.

**Autenticación requerida:** Sí

**Parámetros:**
- `deviceId` (string, path): ID del dispositivo

**Body (JSON):**
```json
{
  "topic": "/robot/command/movement",
  "message": {
    "action": "move_forward",
    "distance": 10,
    "speed": 0.5
  }
}
```

**Respuesta:**
```json
{
  "ok": true,
  "deviceId": "device-001",
  "topic": "/robot/command/movement",
  "message": {
    "action": "move_forward",
    "distance": 10,
    "speed": 0.5
  }
}
```

**Errores:**
- `400`: topic o message faltante o inválido; error en publicación de comando
- `403`: Acceso denegado (dispositivo no encontrado para el usuario)

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/commands/device-001 \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "/robot/command/movement",
    "message": {
      "action": "move_forward",
      "distance": 10
    }
  }'
```

---

## Health Check

### GET /api/health
**Descripción:** Verifica el estado de salud de la API.

**Autenticación requerida:** No

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-15T14:35:20.123Z"
}
```

---

### GET /
**Descripción:** Endpoint raíz de la API.

**Autenticación requerida:** No

**Respuesta:**
```json
{
  "service": "transact-backend",
  "status": "running",
  "timestamp": "2026-05-15T14:35:20.123Z"
}
```

---

## Códigos de Error Comunes

| Código | Significado |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado exitosamente |
| 400 | Bad Request - Parámetros inválidos |
| 401 | Unauthorized - Autenticación requerida |
| 403 | Forbidden - Acceso denegado (no tienes permiso) |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |
| 502 | Bad Gateway - Error en servicio externo |

---

## Notas de Autenticación

- **Sesión**: La mayoría de endpoints requieren que el usuario esté autenticado mediante OIDC/Cognito
- **Admin**: Algunos endpoints (como `/admin/*`) requieren que el usuario tenga el grupo `admin` en Cognito
- **Acceso basado en usuario**: Algunos endpoints como `/api/robots` y `/api/devices` devuelven solo los recursos asignados al usuario actual

---

## Cambios Recientes

- **v1.0** (2026-05-15): Documentación inicial completa con todos los endpoints
