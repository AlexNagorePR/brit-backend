# 📖 MANUAL EXHAUSTIVO: BRIT-BACKEND

**Documento de transición para nuevos desarrolladores**  
*Creado: Mayo 2026*  
*Propósito: Documentación completa del proyecto para transferencia de conocimiento*

---

## 📋 TABLA DE CONTENIDOS

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Arquitectura y Patrones](#2-arquitectura-y-patrones)
3. [Estructura de Carpetas](#3-estructura-de-carpetas)
4. [Flujos Principales](#4-flujos-principales)
5. [Relaciones entre Módulos](#5-relaciones-entre-módulos)
6. [Guía de Desarrollo](#6-guía-de-desarrollo)
7. [Base de Datos](#7-base-de-datos)
8. [APIs y Endpoints](#8-apis-y-endpoints)
9. [Testing](#9-testing)
10. [Troubleshooting](#10-troubleshooting)
11. [Checklist para Nuevas Funcionalidades](#11-checklist-para-nuevas-funcionalidades)

---

## 1. VISIÓN GENERAL DEL PROYECTO

### 🎯 ¿Qué es BRIT-Backend?

**BRIT-Backend** es un servicio Node.js/TypeScript que actúa como **intermediario central de datos para robots autónomos**:

- **Recolecta telemetría en tiempo real**: Batería, estado, diagnósticos de robots
- **Persiste datos históricos**: Trabajos realizados, interrupciones, advertencias
- **Gestiona usuarios y acceso**: Autenticación OIDC/Cognito, roles de administrador
- **Sincroniza información**: Robots, clientes, baterías
- **Expone APIs REST**: Para consultas, estadísticas y comandos
- **Maneja suscripciones ROS**: Conexión en tiempo real a tópicos MQTT de dispositivos

### 🏭 Casos de Uso Principales

```
┌───────────────────────────────────────────────────┐
│                    FRONTEND/PORTAL                │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────┐
│                  BRIT-BACKEND (this)              │
│                                                   │
│  ┌────────────────┐  ┌─────────────────┐          │
│  │  REST API      │  │  Real-time Data │          │
│  │  - Robots      │  │  - Telemetry    │          │
│  │  - Users       │  │  - Status       │          │
│  │  - Admin       │  │  - Warnings     │          │
│  └────────────────┘  └─────────────────┘          │
│                                                   │
│  • Autenticación (OIDC/Cognito)                   │
│  • Sincronización con Portal API                  │
│  • Persistencia en PostgreSQL                     │
│  • Recolección de datos de dispositivos           │
└──────────────────────┬────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   PostgreSQL    Cognito/OIDC   Portal API & Devices
   (Database)    (Auth)         (Transitive)
```

### 🔑 Componentes Clave

| Componente | Función | Ubicación |
|-----------|---------|-----------|
| **Collector** | Sincroniza robots y recolecta datos | `application/services/collector.ts` |
| **Device Stream** | Suscripción a telemetría en tiempo real | `infrastructure/transitive/device-data-stream.ts` |
| **Use Cases** | Lógica de negocio (41+ casos de uso) | `application/use-cases/` |
| **Repositories** | Acceso a datos (patrón DAO) | `infrastructure/db/` |
| **Routes** | Endpoints HTTP REST | `server/routes/` |
| **Auth** | OIDC/Cognito integration | `infrastructure/auth/` |

---

## 2. ARQUITECTURA Y PATRONES

### 🏗️ Arquitectura Limpia (Clean Architecture)

Este proyecto implementa **Clean Architecture** combinado con **Domain-Driven Design (DDD)**.

**Principio fundamental**: Las dependencias apuntan siempre hacia el centro (hacia Domain).

```
                    ┌─────────────────────┐
                    │   DOMAIN LAYER      │
                    │  (Lógica pura)      │
                    │  - Modelos          │
                    │  - Validaciones     │
                    │  - Reglas de negocio│
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  INFRASTRUCTURE  │  │  INFRASTRUCTURE  │  │  INFRASTRUCTURE  │
│  (Concrete impl) │  │  (Concrete impl) │  │  (Concrete impl) │
│                  │  │                  │  │                  │
│  - Database      │  │  - Auth          │  │  - Portal API    │
│  - Repositories  │  │  - Providers     │  │  - Device Stream │
│  - Adapters      │  │  - HTTP Clients  │  │  - Services      │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │  APPLICATION LAYER   │
                    │  (Orchestration)     │
                    │  - Use Cases         │
                    │  - Ports (Interfaces)│
                    │  - Services          │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │   DELIVERY LAYER     │
                    │  (HTTP Controllers)  │
                    │  - Express Routes    │
                    │  - Middleware        │
                    └──────────────────────┘
```

### 🔌 Patrón Puertos y Adaptadores

Los "puertos" son interfaces que definen el contrato entre capas:

```typescript
// PUERTO (Interfaz - application/ports/)
export interface RobotRepository {
  findById(robotId: string): Promise<Robot>;
  syncSnapshot(robots: Robot[]): Promise<void>;
  setUsers(robotId: string, userEmails: string[]): Promise<void>;
  // ... más métodos
}

// ADAPTADOR (Implementación - infrastructure/db/)
export function createDbRobotRepository(db: RobotDb): RobotRepository {
  return {
    async findById(robotId: string) {
      const data = await db.getRobotById(robotId);
      return reconstructRobot(data);
    },
    // ... implementación de otros métodos
  };
}
```

**Ventajas**:
- ✅ Bajo acoplamiento entre capas
- ✅ Fácil de testear (mockear interfaces)
- ✅ Fácil cambiar implementaciones (ej: PostgreSQL → MongoDB)
- ✅ Claridad en responsabilidades

### 📦 Inyección de Dependencias Manual

Usa composición manual en un archivo central:

```typescript
// server/composition.ts
export function composeApp(config, infrastructureDeps) {
  const robotRepository = createDbRobotRepository(db);
  const userRepository = createDbUserRepository(db);
  
  const getRobot = new GetRobot(robotRepository);
  const listRobots = new ListRobots(robotRepository);
  
  // ... resto de composición
  
  return router; // Express router con todas las rutas wired
}
```

**Por qué manual y no automático**:
- ✅ 100% type-safe (sin reflection)
- ✅ Explícito y rastreable
- ✅ Funciona mejor en TypeScript
- ✅ No hay "magia" oculta

---

## 3. ESTRUCTURA DE CARPETAS

### 📁 Organización Completa

```
brit-backend/
│
├── src/                           # Código fuente
│   ├── domain/                    # CAPA DE DOMINIO (puro negocio)
│   │   └── models/
│   │       ├── robot.ts           # Entidad Robot con lógica de dominio
│   │       ├── battery.ts         # Entidad Battery
│   │       ├── client.ts          # Entidad Client
│   │       ├── user.ts            # Entidad User
│   │       └── work.ts            # Entidad Work
│   │
│   ├── application/               # CAPA DE APLICACIÓN (orquestación)
│   │   ├── ports/                 # INTERFACES/CONTRATOS
│   │   │   ├── robot-repository.ts
│   │   │   ├── user-repository.ts
│   │   │   ├── battery-repository.ts
│   │   │   ├── client-repository.ts
│   │   │   ├── authentication-provider.ts
│   │   │   ├── user-identity-provider.ts
│   │   │   ├── portal-api.ts
│   │   │   ├── device-telemetry-stream.ts
│   │   │   ├── device-info-subscriber.ts
│   │   │   ├── device-command-publisher.ts
│   │   │   └── (más puertos...)
│   │   │
│   │   ├── use-cases/             # CASOS DE USO (lógica de negocio)
│   │   │   ├── auth/              # Autenticación (5 casos)
│   │   │   │   ├── authenticated-account.ts
│   │   │   │   ├── build-auth-logout-url.ts
│   │   │   │   ├── complete-auth-callback.ts
│   │   │   │   ├── get-auth-login-url.ts
│   │   │   │   └── errors.ts
│   │   │   │
│   │   │   ├── robots/            # Robots (13 casos)
│   │   │   │   ├── get-robot.ts
│   │   │   │   ├── list-robots.ts
│   │   │   │   ├── list-robots-for-user.ts
│   │   │   │   ├── list-robot-users.ts
│   │   │   │   ├── set-robot-users.ts
│   │   │   │   ├── update-robot-client.ts
│   │   │   │   ├── update-robot-name.ts
│   │   │   │   ├── sync-robots-from-portal.ts
│   │   │   │   ├── sync-robots-snapshot.ts
│   │   │   │   └── errors.ts
│   │   │   │
│   │   │   ├── users/             # Usuarios (8 casos)
│   │   │   │   ├── create-user.ts
│   │   │   │   ├── list-users.ts
│   │   │   │   ├── find-user-by-id.ts
│   │   │   │   ├── find-user-by-email.ts
│   │   │   │   ├── update-user-client.ts
│   │   │   │   ├── delete-user.ts
│   │   │   │   ├── sync-identity-users.ts
│   │   │   │   └── errors.ts
│   │   │   │
│   │   │   ├── clients/           # Clientes (5 casos)
│   │   │   ├── batteries/         # Baterías (4 casos)
│   │   │   ├── devices/           # Dispositivos (3 casos)
│   │   │   └── portal/            # Portal API (2 casos)
│   │   │
│   │   └── services/              # SERVICIOS (orquestación compleja)
│   │       └── collector.ts       # Servicio principal de recolección
│   │
│   ├── infrastructure/            # CAPA DE INFRAESTRUCTURA
│   │   ├── auth/                  # Autenticación (OIDC/Cognito)
│   │   │   ├── oidc-authentication-provider.ts
│   │   │   ├── oidc-client.ts
│   │   │   ├── cognito-user-identity-provider.ts
│   │   │   └── (más adaptadores de auth)
│   │   │
│   │   ├── db/                    # Base de Datos
│   │   │   ├── robot-repository.ts         # Implementación del puerto
│   │   │   ├── user-repository.ts
│   │   │   ├── battery-repository.ts
│   │   │   ├── client-repository.ts
│   │   │   ├── postgres/                   # Implementación PostgreSQL
│   │   │   │   ├── index.ts                # Pool de conexión y orquestación
│   │   │   │   ├── robot.ts                # Queries de robots
│   │   │   │   ├── user.ts                 # Queries de usuarios
│   │   │   │   ├── battery.ts              # Queries de baterías
│   │   │   │   ├── client.ts               # Queries de clientes
│   │   │   │   ├── work.ts                 # Queries de trabajos
│   │   │   │   └── data.ts                 # Queries complejas
│   │   │   └── (esquema de DB documentado más abajo)
│   │   │
│   │   ├── portal/                # Portal API de Transitive
│   │   │   ├── portal-api.ts      # Cliente HTTP al Portal API
│   │   │   ├── portal-http-client.ts
│   │   │   └── portal-token.ts    # Gestión de tokens
│   │   │
│   │   └── transitive/            # SDK de Transitive Robotics
│   │       ├── device-data-stream.ts      # Suscripción a telemetría MQTT
│   │       ├── device-command-publisher.ts # Publicación de comandos
│   │       ├── brit-info-robot.ts         # Estructura de datos de robot
│   │       ├── brit-info-work.ts          # Estructura de datos de trabajo
│   │       └── data-stream-constants.ts   # Constantes MQTT
│   │
│   └── server/                    # CAPA DE ENTREGA (HTTP)
│       ├── main.ts                # PUNTO DE ENTRADA
│       │                           # 1. Carga config
│       │                           # 2. Conecta a BD
│       │                           # 3. Compone app
│       │                           # 4. Inicia servidor
│       │
│       ├── app.ts                 # Configuración de Express
│       │                           # Middleware (cors, session, etc)
│       │                           # Rutas
│       │                           # Error handling
│       │
│       ├── config.ts              # Carga de variables de entorno
│       │                           # Validación de config
│       │
│       ├── composition.ts         # INYECCIÓN DE DEPENDENCIAS
│       │                           # Crea todas las instancias
│       │                           # Wiring de dependencias
│       │
│       ├── auth.ts                # Middleware de autenticación
│       │                           # requireLogin
│       │                           # requireAdmin
│       │
│       ├── swagger.ts             # Documentación OpenAPI
│       │
│       ├── types.d.ts             # Type augmentation
│       │                           # Extensión de tipos (Express, etc)
│       │
│       └── routes/                # CONTROLADORES HTTP
│           ├── api.ts             # Rutas públicas (autenticadas)
│           │                       # GET /api/robots
│           │                       # GET /api/user
│           │                       # GET /devices/{id}/telemetry
│           │                       # (más rutas...)
│           │
│           ├── auth.ts            # Rutas de autenticación
│           │                       # GET /auth/login
│           │                       # GET /auth/callback
│           │                       # GET /auth/logout
│           │
│           └── admin/             # Rutas de administración
│               ├── robots.ts      # Admin robot management
│               │                   # POST /admin/robots/sync
│               │                   # GET /admin/robots
│               │                   # PUT /admin/robots/{id}/users
│               │                   # (más rutas...)
│               │
│               ├── clients.ts      # Admin client management
│               ├── batteries.ts    # Admin battery management
│               └── users.ts        # Admin user management
│
├── test/                          # TESTS (Vitest)
│   ├── setup.ts                   # Setup global de tests
│   ├── helpers/
│   │   └── create-test-app.ts     # Factory para crear app en tests
│   │
│   ├── robot-use-cases.test.ts    # Tests de casos de uso de robots
│   ├── user-use-cases.test.ts     # Tests de casos de uso de usuarios
│   ├── auth-use-cases.test.ts     # Tests de autenticación
│   ├── admin-robots.test.ts       # Tests de endpoints admin robots
│   ├── admin-users.test.ts        # Tests de endpoints admin usuarios
│   ├── (más de 15 archivos de test)
│   │
│   ├── robot-domain.test.ts       # Tests del modelo Robot
│   ├── battery-domain.test.ts     # Tests del modelo Battery
│   ├── (tests de dominio...)
│
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # Configuración TypeScript
├── vitest.config.ts              # Configuración de tests
├── eslint.config.js              # Linting
├── MANUAL_COMPLETO.md            # ← ESTE DOCUMENTO
└── README.md                      # Información básica
```

### 🔍 Qué Significa Cada Carpeta

| Carpeta | Rol | Reglas |
|---------|-----|--------|
| **domain/** | Lógica pura de negocio | ❌ No imports de infrastructure<br>❌ No acceso a BD<br>✅ Solo tipos y validaciones |
| **application/ports/** | Contratos entre capas | ✅ Define interfaces<br>❌ No implementa |
| **application/use-cases/** | Orquestación de negocio | ✅ Usa ports (inyectados)<br>✅ Llama a repositorios<br>❌ No acceso directo a BD |
| **infrastructure/db/** | Acceso a datos | ✅ Implementa ports<br>✅ SQL queries<br>✅ Transformación de datos |
| **infrastructure/auth/** | Autenticación | ✅ Implementa ports<br>✅ Integración OIDC/Cognito |
| **infrastructure/portal/** | Portal API | ✅ HTTP client<br>✅ Consumo de Portal API |
| **server/routes/** | HTTP endpoints | ✅ Recibe requests<br>✅ Llama use cases<br>✅ Retorna responses |
| **test/** | Pruebas | ✅ Mocks de dependencias<br>✅ Validación de comportamiento |

---

## 4. FLUJOS PRINCIPALES

### 4.1 FLUJO DE AUTENTICACIÓN (OIDC/Cognito)

**Propósito**: Verificar identidad del usuario mediante proveedor externo (Cognito o OIDC genérico).

**Actors**:
- Cliente web (frontend)
- Servidor brit-backend
- Proveedor OIDC (Cognito, Auth0, etc.)

**Secuencia**:

```
1. Usuario hace clic en "Login"
   └─> Frontend -> GET /auth/login
       
2. Backend genera URL de autorización
   └─> GetAuthLoginUrl.execute()
       └─> OidcAuthenticationProvider.getAuthorizationUrl()
           └─> Retorna: https://cognito.../authorize?client_id=X&...
   
3. Frontend redirige a URL de Cognito
   └─> Browser -> Cognito login page
   
4. Usuario ingresa credenciales en Cognito
   
5. Cognito redirige con código de autorización
   └─> Browser -> GET /auth/callback?code=XXXXX&state=XXXXX
   
6. Backend intercambia código por tokens
   └─> CompleteAuthCallback.execute(code, state)
       └─> OidcAuthenticationProvider.exchangeCodeForToken(code)
           └─> HTTP POST a Cognito
               └─> Retorna: ID Token + Access Token + Refresh Token
   
7. Backend crea sesión de usuario
   └─> Session guardada en:
       ├─> req.session.user (en memoria/store)
       ├─> Cookie SESSIONID enviada al cliente
       └─> Datos de usuario:
           ├─> _id (user ID)
           ├─> email
           ├─> name
           ├─> admin (boolean)
           └─> ...

8. Backend redirige a app
   └─> GET /auth/callback -> Redirect to POST_LOGIN_REDIRECT_URL
       └─> Frontend logueado ✅
```

**Archivos clave**:
- [src/server/routes/auth.ts](src/server/routes/auth.ts) - Endpoints de auth
- [src/application/use-cases/auth/](src/application/use-cases/auth/) - Use cases
- [src/infrastructure/auth/oidc-authentication-provider.ts](src/infrastructure/auth/oidc-authentication-provider.ts) - Proveedor OIDC
- [src/server/auth.ts](src/server/auth.ts) - Middleware de autenticación

**Código relevante**:

```typescript
// Verificar autenticación en middleware
export function requireLogin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Verificar permisos de admin
export function requireAdmin(req, res, next) {
  if (!req.session?.user?.admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

### 4.2 FLUJO DE RECOLECCIÓN DE TELEMETRÍA (Collector)

**Propósito**: Sincronizar información de robots del Portal y suscribirse a telemetría en tiempo real.

**Actors**:
- Servidor brit-backend (este)
- Portal API de Transitive
- Dispositivos (a través de MQTT/ROS)

**Secuencia**:

```
INICIALIZACIÓN (al arrancar)
═════════════════════════════

1. main.ts arranca el servidor
   └─> createAppComposition(config, deps)
   
2. Se crea CollectorService
   └─> new Collector(
         portalApi,
         robotRepository,
         deviceInfoSubscriber,
         deviceTelemetryStream,
         ...
       )
   
3. Se llama collector.start()
   ├─> Paso 1: Sincronizar robots del Portal
   │   └─> portalApi.listRobotInfo()
   │       └─> HTTP GET https://portal.transitive.../api/robots
   │           └─> Retorna:
   │               [
   │                 {
   │                   id: "robot-1",
   │                   hostName: "host-1",
   │                   robotName: "Robot One",
   │                   clientId: "client-1"
   │                 },
   │                 ...
   │               ]
   │   
   │   └─> robotRepository.syncSnapshot(robots)
   │       └─> PostgreSQL:
   │           - DELETE robots que no estén en la lista (snapshot)
   │           - INSERT nuevos robots
   │           - UPDATE robots existentes
   │           └─> Resultado: BD sincronizada con Portal ✅
   │
   ├─> Paso 2: Suscribirse a info de robots (cambios de estado)
   │   └─> deviceInfoSubscriber.subscribe(robotIds)
   │       └─> MQTT suscripción a:
   │           - /device/{id}/status
   │           - /device/{id}/diagnostics
   │           - Actualiza cache en memoria ✅
   │
   └─> Paso 3: Suscribirse a telemetría en tiempo real
       └─> deviceTelemetryStream.subscribe(robotIds)
           └─> MQTT suscripción a:
               - /device/{id}/battery
               - /device/{id}/work
               - /device/{id}/alarms
               - Almacena datos en cache
               └─> Datos disponibles via API GET /api/devices/{id}/telemetry ✅


FLUJO DURANTE OPERACIÓN
════════════════════════

1. Dispositivo envía telemetría (cada 5 segundos)
   └─> MQTT -> /device/{id}/battery
       {
         voltage: 48.5,
         current: -2.3,
         percentage: 85.3,
         ...
       }

2. DeviceTelemetryStream recibe datos
   └─> Parsea y valida datos
   └─> Almacena en cache:
       deviceTelemetryCache[deviceId] = data
   └─> Actualiza timestamp

3. Frontend hace polling
   └─> GET /api/devices/{id}/telemetry
       └─> DeviceController.getTelemetry(id)
           └─> telemetryStream.getData(id)
               └─> Retorna cache actualizado
                   {
                     timestamp: 1234567890,
                     battery: { ... },
                     status: { ... },
                     ...
                   }
               └─> Response 200 ✅

4. Cuando hay un trabajo
   └─> Dispositivo publica en /device/{id}/work
       {
         workId: "work-123",
         status: "completed",
         startTime: 1234567890,
         endTime: 1234567950,
         cleanedArea: 1250,
         ...
       }
   
   └─> DeviceDataStream.onWorkData() es llamado
       └─> Transforma datos al modelo Work
       └─> workRepository.createOrUpdate(work)
           └─> PostgreSQL INSERT/UPDATE
           └─> Trabajo persistido ✅


FLUJO DE COMANDOS
═════════════════

1. Frontend quiere que robot haga algo
   └─> POST /api/devices/{id}/command
       {
         type: "dock",     // dock, clean, etc
         params: { ... }
       }

2. Backend publica comando
   └─> DeviceCommandPublisher.publishCommand(id, command)
       └─> MQTT PUBLISH a /device/{id}/command
           {
             cmd: "dock",
             id: "cmd-xxx",
             timestamp: ...
           }
       └─> Dispositivo recibe y ejecuta ✅
```

**Archivos clave**:
- [src/application/services/collector.ts](src/application/services/collector.ts) - Orquestación
- [src/infrastructure/transitive/device-data-stream.ts](src/infrastructure/transitive/device-data-stream.ts) - Telemetría
- [src/infrastructure/portal/portal-api.ts](src/infrastructure/portal/portal-api.ts) - Cliente Portal API

### 4.3 FLUJO DE REQUEST HTTP TÍPICO

**Ejemplo**: `GET /api/robots` (listar robots del usuario autenticado)

```
1. CLIENTE HTTP
   └─> GET /api/robots
       Headers: { Cookie: "SESSIONID=xxx" }

2. SERVIDOR RECIBE REQUEST (Express)
   └─> app.use(sessionMiddleware) ✓ Session recuperada
   └─> app.use(corsMiddleware)    ✓ CORS permitido
   └─> Router /api/robots manejado

3. MIDDLEWARE DE AUTENTICACIÓN
   └─> requireLogin(req, res, next)
       └─> if (!req.session?.user) return 401
       └─> Session válida → continúa
   
4. ENTRA AL CONTROLADOR
   └─> server/routes/api.ts
       router.get('/robots', requireLogin, async (req, res) => {
         const email = req.session.user.email;  // Obtenido de sesión

5. LLAMA USE CASE
   └─> deps.listRobotsForUser.execute(email)
       
6. USE CASE EJECUTA LÓGICA
   └─> ListRobotsForUser (application/use-cases/robots/)
       ├─> Validar input (email válido)
       ├─> Llamar repositorio
       └─> return result

7. REPOSITORIO ACCEDE A BASE DE DATOS
   └─> robotRepository.listForUser(email)
       └─> Infrastructure/db/robot-repository.ts
           └─> Implementación de puerto
           └─> Llama: db.getRobotIdsForUser(email)

8. QUERY A POSTGRESQL
   └─> src/infrastructure/db/postgres/robot.ts
       └─> SQL Query:
           ```sql
           SELECT r.id, r.host_name, r.robot_name, r.client_id
           FROM user_robot ur
           JOIN robot r ON r.id = ur.robot_id
           JOIN "user" u ON u.id = ur.user_id
           WHERE u.email = $1
           ```
       └─> Retorna: [{ id: "r1", hostName: "h1", ... }, ...]

9. TRANSFORMACIÓN DE DATOS
   └─> Desde formato DB hacia Domain Model
       └─> reconstructRobot(dbRow)
           └─> Crea instancia de Robot(id, name, ...)
       └─> toRobotInfo(robot)
           └─> Serializa a JSON

10. RESPUESTA ASCIENDE CAPAS
    └─> Use Case retorna resultado ✓
    └─> Controlador recibe resultado ✓

11. CONTROLLER DEVUELVE HTTP RESPONSE
    └─> res.status(200).json(robots)
        {
          "robots": [
            {
              "id": "r1",
              "robotName": "Robot One",
              "hostName": "host-1",
              "clientId": "c1",
              "userEmails": ["user@example.com"]
            },
            ...
          ]
        }

12. EXPRESS ENVÍA RESPONSE
    └─> HTTP 200 OK
    └─> Body: JSON serializado
    └─> Headers: { Content-Type: application/json }

13. CLIENTE RECIBE RESPONSE ✅
    └─> Frontend procesa datos
    └─> Actualiza UI
```

**Puntos clave**:
1. **Autenticación**: Siempre verifica sesión en middleware
2. **Layering**: Request pasa por todas las capas (entrega → aplicación → dominio)
3. **Manejo de errores**: Cada capa puede lanzar excepciones específicas
4. **Validación**: Ocurre en dominio (modelos) y puertos

---

## 5. RELACIONES ENTRE MÓDULOS

### 5.1 Cómo Se Conectan los Módulos

**Diagrama de dependencias**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Express Routes                          │
│         (server/routes/api.ts, auth.ts, admin/*.ts)         │
└────────────────────────┬────────────────────────────────────┘
                         │ Inyecta deps
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Composition.ts                           │
│              (Inyección de dependencias)                    │
│  Ensambla todas las instancias y las "inyecta" en rutas     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐    ┌────────────┐
    │Use Cases│    │Ports     │    │Repositories│
    └─────────┘    └──────────┘    └────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
             Implementan interfaces
                         │
         ┌───────────────┼───────────────┬──────────────┐
         │               │               │              │
         ▼               ▼               ▼              ▼
  ┌────────────┐   ┌──────────┐    ┌───────────┐  ┌──────────┐
  │ DB         │   │Auth      │    │Portal API │  │Transitive│
  │(PostgreSQL)│   |(OIDC)    │    │(HTTP)     │  │(MQTT)    │
  └────────────┘   └──────────┘    └───────────┘  └──────────┘
         │               │               │              │
         └───────────────┼───────────────┴──────────────┘
                         │
              Externa Services / APIs
```

### 5.2 Ejemplo: Agregar un Robot a un Usuario

**Flujo completo**: `PUT /admin/robots/{robotId}/users`

```
ENDPOINT HTTP
├─ server/routes/admin/robots.ts
│  └─ router.put('/:robotId/users', requireAdmin, async (req, res) => {
│     // req.body = { userIds: ['user1@ex.com', 'user2@ex.com'] }
│     
│     const result = await deps.setRobotUsers.execute({
│        robotId: req.params.robotId,
│        userIds: req.body.userIds
│     });
│     
│     res.json({ ok: true, ...result });
│  })
│
├─ USE CASE: SetRobotUsers
│  └─ application/use-cases/robots/set-robot-users.ts
│     async execute(command: SetRobotUsersCommand) {
│       
│       // 1. VALIDAR INPUT
│       if (!Array.isArray(command.userIds)) {
│         throw new RobotValidationError('userIds must be an array');
│       }
│       
│       // 2. NORMALIZAR (lowercase, trim, deduplicate)
│       const userIds = [...new Set(
│         command.userIds
│           .filter(id => typeof id === 'string' && id.trim().length > 0)
│           .map(id => id.trim().toLowerCase())
│       )];
│       
│       // 3. VALIDAR USUARIOS EXISTEN
│       for (const email of userIds) {
│         const user = await this.userRepository.findByEmail(email);
│         if (!user) {
│           throw new RobotValidationError(`User not found: ${email}`);
│         }
│       }
│       
│       // 4. DELEGAR A REPOSITORIO
│       await this.robotRepository.setUsers(command.robotId, userIds);
│       
│       return { robotId: command.robotId, userIds };
│     }
│
├─ REPOSITORIO (Puerto implementado)
│  └─ infrastructure/db/robot-repository.ts
│     setUsers(robotId: string, userEmails: string[]) {
│       return db.setUsersForRobot(robotId, userEmails);
│     }
│
├─ DB OPERATIONS (Queries PostgreSQL)
│  └─ infrastructure/db/postgres/robot.ts
│     async setUsersForRobot(robotId, userEmails) {
│
│       const client = await pool.connect();
│       try {
│         await client.query('BEGIN');
│         
│         // 1. DELETE usuarios anteriores de este robot
│         await client.query(
│           `DELETE FROM user_robot WHERE robot_id = $1`,
│           [robotId]
│         );
│         
│         // 2. INSERT nuevas relaciones
│         for (const email of userEmails) {
│           await client.query(
│             `INSERT INTO user_robot (user_id, robot_id)
│              SELECT id, $2 FROM "user" WHERE email = $1
│              ON CONFLICT (user_id, robot_id) DO NOTHING`,
│             [email, robotId]
│           );
│         }
│         
│         await client.query('COMMIT');
│       } catch (error) {
│         await client.query('ROLLBACK');
│         throw error;
│       } finally {
│         client.release();
│       }
│     }
│
└─ RESPUESTA
   HTTP 200
   {
     "ok": true,
     "robotId": "robot-1",
     "userIds": ["user1@example.com", "user2@example.com"]
   }
```

**Puntos importantes**:
1. ✅ **Validación en capas**: INPUT → USE CASE → DOMAIN → DB
2. ✅ **Error handling**: Si usuario no existe, lanza error antes de BD
3. ✅ **Transacciones**: DELETE + INSERT son atómicas (BEGIN/COMMIT)
4. ✅ **Testeable**: Cada capa mockeable

---

## 6. GUÍA DE DESARROLLO

### 6.1 Setup Inicial

**Requisitos**:
- Node.js 18+
- PostgreSQL 12+
- (Opcional) Docker para PostgreSQL

**Pasos**:

```bash
# 1. Clonar y dependencias
git clone <repo>
cd brit-backend
npm install

# 2. Crear archivo .env con variables necesarias
cp .env.example .env
# Editar .env con tus valores

# 3. Crear/migrar base de datos
npm run migrate  # Si existe script
# o manualmente: psql -U user -d brit-db -f schema.sql

# 4. Arranca servidor en desarrollo
npm run dev

# 5. Verifica que funcione
curl http://localhost:3000/health
```

### 6.2 Agregar un Nuevo Endpoint (Ejemplo Educativo)

**NOTA**: Este ejemplo es educativo. El endpoint `GET /api/robots/{id}/maintenance-history` NO está implementado en el codebase actual.

**Caso de uso**: Cómo agregar un endpoint similar (ejemplo ilustrativo)

**Pasos**:

#### Paso 1: Agregar query a BD

Archivo: `src/infrastructure/db/postgres/robot.ts`

```typescript
async getRobotMaintenanceHistory(robotId: string) {
  const { rows } = await pool.query(
    `SELECT date, type, description, technician
     FROM robot_maintenance
     WHERE robot_id = $1
     ORDER BY date DESC`,
    [robotId]
  );
  return rows;
}
```

Actualizar interfaz: `src/infrastructure/db/postgres/index.ts`

```typescript
export type Db = {
  // ... otros métodos
  getRobotMaintenanceHistory: (id: string) => Promise<MaintenanceRecord[]>;
};
```

#### Paso 2: Crear Use Case

Archivo: `src/application/use-cases/robots/get-robot-maintenance-history.ts`

```typescript
import type { RobotRepository } from '@/application/ports/robot-repository.js';

export type GetRobotMaintenanceHistoryCommand = {
  robotId: string;
};

export type MaintenanceRecord = {
  date: Date;
  type: string;
  description: string;
  technician: string;
};

export class GetRobotMaintenanceHistory {
  constructor(private readonly robotRepository: RobotRepository) {}

  async execute(
    command: GetRobotMaintenanceHistoryCommand
  ): Promise<MaintenanceRecord[]> {
    if (!command.robotId) {
      throw new Error('robotId is required');
    }

    // Verificar que el robot existe
    const robot = await this.robotRepository.findById(command.robotId);
    if (!robot) {
      throw new RobotNotFoundError(command.robotId);
    }

    return await this.robotRepository.getMaintenanceHistory(command.robotId);
  }
}
```

#### Paso 3: Actualizar Puerto

Archivo: `src/application/ports/robot-repository.ts`

```typescript
export interface RobotRepository {
  // ... métodos existentes
  getMaintenanceHistory(robotId: string): Promise<MaintenanceRecord[]>;
}
```

#### Paso 4: Implementar en Repositorio

Archivo: `src/infrastructure/db/robot-repository.ts`

```typescript
async getMaintenanceHistory(robotId: string) {
  return db.getRobotMaintenanceHistory(robotId);
}
```

#### Paso 5: Inyectar en Composition

Archivo: `src/server/composition.ts`

```typescript
robots: {
  // ... otros
  getMaintenanceHistory: new GetRobotMaintenanceHistory(robotRepository),
}
```

#### Paso 6: Crear Endpoint

Archivo: `src/server/routes/api.ts`

```typescript
router.get(
  '/robots/:robotId/maintenance-history',
  requireLogin,
  async (req, res) => {
    /**
     * @swagger
     * /api/robots/{robotId}/maintenance-history:
     *   get:
     *     summary: Get maintenance history for a robot
     *     tags:
     *       - Robots
     *     parameters:
     *       - name: robotId
     *         in: path
     *         required: true
     *     responses:
     *       200:
     *         description: Maintenance history
     *       401:
     *         description: Not authenticated
     *       404:
     *         description: Robot not found
     */
    const robotId = req.params.robotId;

    try {
      const history = await deps.getMaintenanceHistory.execute({
        robotId,
      });

      return res.json(history);
    } catch (err) {
      if (err instanceof RobotNotFoundError) {
        return res.status(404).json({ error: err.message });
      }

      log.error('Get maintenance history failed', err);
      return res.status(500).json({ error: 'Get maintenance history failed' });
    }
  }
);
```

#### Paso 7: Agregar Tests

Archivo: `test/robot-use-cases.test.ts`

```typescript
it('gets robot maintenance history', async () => {
  const repository = createRepository({
    findById: vi.fn().mockResolvedValue({ id: 'robot-1' }),
    getMaintenanceHistory: vi.fn().mockResolvedValue([
      {
        date: new Date('2026-05-01'),
        type: 'oil_change',
        description: 'Regular maintenance',
        technician: 'John',
      },
    ]),
  });

  const useCase = new GetRobotMaintenanceHistory(repository as any);

  const result = await useCase.execute({ robotId: 'robot-1' });

  expect(result).toHaveLength(1);
  expect(result[0].type).toBe('oil_change');
});
```

**Checklist**:
- ✅ DB query funcionando
- ✅ Use case creado y validado
- ✅ Puerto actualizado
- ✅ Repositorio implementa puerto
- ✅ Inyectado en composition
- ✅ Endpoint HTTP creado
- ✅ Swagger documentation añadida
- ✅ Tests creados

### 6.3 Convenciones de Código

**Nombrado**:
```typescript
// ✅ CORRECTO
class ListRobots { }  // Use cases: verbo infinitivo
interface RobotRepository { }  // Puertos: -Repository, -Provider
function createDbRobotRepository() { }  // Factories: create-
function toRobotInfo(robot) { }  // Transformers: to-

// ❌ INCORRECTO
class RobotLister { }
interface Robot_Repo { }
function RobotRepository() { }
```

**Estructura de archivos**:
```typescript
// Siempre en este orden:
// 1. Imports
// 2. Types/Interfaces
// 3. Main class/function
// 4. Helpers

import type { Repository } from '...';

export type MyCommand = { ... };
export type MyResult = { ... };

export class MyUseCase {
  constructor(...) { }
  async execute(...) { }
}
```

**Error handling**:
```typescript
// ✅ CORRECTO - Errores específicos del dominio
throw new RobotNotFoundError(robotId);
throw new RobotValidationError('Name too long');

// ❌ INCORRECTO - Error genérico
throw new Error('Something went wrong');
```

---

## 7. BASE DE DATOS

### 7.1 Esquema PostgreSQL

```sql
-- CLIENTES (organizaciones)
CREATE TABLE clients (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- USUARIOS
CREATE TABLE "user" (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  client_id VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ROBOTS (dispositivos)
CREATE TABLE robots (
  id VARCHAR(255) PRIMARY KEY,
  host_name VARCHAR(255),
  robot_name VARCHAR(255),
  client_id VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL,
  delivery_date DATE,
  last_maintenance_date DATE,
  last_clean_date DATE,
  last_work_date DATE,
  works_performed INT DEFAULT 0,
  time_in_operation INT DEFAULT 0,  -- segundos
  time_working INT DEFAULT 0,         -- segundos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RELACIÓN USUARIOS-ROBOTS (many-to-many)
CREATE TABLE user_robot (
  user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE CASCADE,
  robot_id VARCHAR(255) REFERENCES robots(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, robot_id)
);

-- BATERÍAS
CREATE TABLE batteries (
  id VARCHAR(255) PRIMARY KEY,
  client_id VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL,
  serial_number VARCHAR(255) NOT NULL UNIQUE,
  state_of_health INT,  -- percentage
  created_at TIMESTAMP DEFAULT NOW()
);

-- TRABAJOS COMPLETADOS
CREATE TABLE works (
  id VARCHAR(255) PRIMARY KEY,
  robot_id VARCHAR(255) NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  status VARCHAR(50),  -- 'completed', 'interrupted', etc
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  cleaned_area INT,  -- m²
  run_time INT,  -- segundos
  idle_time INT,
  charging_time INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- INTERRUPCIONES EN TRABAJOS
CREATE TABLE interruptions (
  id VARCHAR(255) PRIMARY KEY,
  work_id VARCHAR(255) REFERENCES works(id) ON DELETE CASCADE,
  robot_id VARCHAR(255) REFERENCES robots(id) ON DELETE CASCADE,
  timestamp TIMESTAMP,
  reason VARCHAR(255),  -- 'bump', 'stuck', 'manual_stop', etc
  duration INT,  -- segundos
  resumed BOOLEAN
);

-- ALARMAS/WARNINGS
CREATE TABLE warnings (
  id VARCHAR(255) PRIMARY KEY,
  robot_id VARCHAR(255) REFERENCES robots(id) ON DELETE CASCADE,
  timestamp TIMESTAMP,
  level VARCHAR(50),  -- 'info', 'warning', 'error', 'critical'
  message TEXT,
  code VARCHAR(50),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP
);

-- ÍNDICES IMPORTANTES
CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_robot_client ON robots(client_id);
CREATE INDEX idx_user_robot ON user_robot(user_id, robot_id);
CREATE INDEX idx_works_robot ON works(robot_id);
CREATE INDEX idx_works_start_time ON works(start_time DESC);
CREATE INDEX idx_warnings_robot ON warnings(robot_id, timestamp DESC);
```

### 7.2 Operaciones Comunes

**Consultar robots de un usuario**:
```sql
SELECT DISTINCT r.* FROM robots r
JOIN user_robot ur ON r.id = ur.robot_id
JOIN "user" u ON u.id = ur.user_id
WHERE u.email = 'user@example.com';
```

**Sincronizar robots desde Portal** (snapshot):
```sql
-- 1. Eliminar robots que no estén en la lista (snapshot)
DELETE FROM robots WHERE id NOT IN (
  SELECT id FROM (
    VALUES ('r1'), ('r2'), ('r3')
  ) AS new_robots(id)
);

-- 2. Insertar o actualizar
INSERT INTO robots (id, host_name, robot_name, client_id)
VALUES ('r1', 'host1', 'Robot 1', 'c1'),
       ('r2', 'host2', 'Robot 2', 'c1')
ON CONFLICT (id) DO UPDATE SET
  host_name = EXCLUDED.host_name,
  robot_name = EXCLUDED.robot_name;
```

**Asignar usuarios a robot**:
```sql
-- Atómico con transacción
BEGIN;

-- Eliminar usuarios previos
DELETE FROM user_robot WHERE robot_id = 'robot-1';

-- Insertar nuevos
INSERT INTO user_robot (user_id, robot_id)
SELECT id, 'robot-1' FROM "user"
WHERE email IN ('user1@ex.com', 'user2@ex.com');

COMMIT;
```

---

## 8. APIs Y ENDPOINTS

### 8.1 Resumen de Endpoints

```
AUTENTICACIÓN
  GET    /auth/login          # Inicia flujo OIDC
  GET    /auth/callback       # Callback de OIDC (redirigido por proveedor)
  GET    /auth/logout         # Cierra sesión

API PÚBLICA (requiere autenticación)
  GET    /api/user            # Info del usuario autenticado
  GET    /api/robots          # Lista todos los robots del usuario
  GET    /api/robots/:id      # Detalles de un robot
  GET    /api/devices/:id/telemetry    # Telemetría en tiempo real
  POST   /api/devices/:id/command      # Enviar comando a dispositivo
  GET    /api/batteries       # Baterías asignadas al usuario

ADMIN (requiere autenticación + admin=true)
  # ROBOTS
  POST   /admin/robots/sync   # Sincroniza con Portal API
  GET    /admin/robots        # Todos los robots
  GET    /admin/robots/:id    # Detalles de robot
  GET    /admin/robots/:id/users      # Usuarios del robot
  PUT    /admin/robots/:id/users      # Asigna usuarios al robot
  PATCH  /admin/robots/:id/name       # Renombra robot
  PATCH  /admin/robots/:id/client     # Asigna cliente a robot

  # USUARIOS
  GET    /admin/users         # Todos los usuarios
  POST   /admin/users         # Crea usuario
  GET    /admin/users/:id     # Detalles de usuario
  DELETE /admin/users/:id     # Elimina usuario
  PATCH  /admin/users/:id/client      # Asigna cliente a usuario

  # CLIENTES
  GET    /admin/clients       # Todos los clientes
  POST   /admin/clients       # Crea cliente
  GET    /admin/clients/:id   # Detalles de cliente
  DELETE /admin/clients/:id   # Elimina cliente

  # BATERÍAS
  GET    /admin/batteries     # Todas las baterías
  POST   /admin/batteries     # Crea batería
  GET    /admin/batteries/:id # Detalles de batería
  DELETE /admin/batteries/:id # Elimina batería
```

### 8.2 Ejemplos de Requests/Responses

#### Login

```http
GET /auth/login HTTP/1.1

< HTTP/1.1 302 Found
< Location: https://cognito.../authorize?client_id=...&redirect_uri=...
```

#### Get User

```http
GET /api/user HTTP/1.1
Cookie: SESSIONID=abc123def456

< HTTP/1.1 200 OK
< Content-Type: application/json

{
  "id": "user-1",
  "email": "user@example.com",
  "name": "John Doe",
  "admin": false,
  "clientId": "client-1"
}
```

#### List Robots

```http
GET /api/robots HTTP/1.1
Cookie: SESSIONID=abc123def456

< HTTP/1.1 200 OK

{
  "robots": [
    {
      "id": "robot-1",
      "robotName": "Robot One",
      "hostName": "host-1",
      "clientId": "client-1",
      "userEmails": ["user@example.com"],
      "lastWorkDate": "2026-05-18T10:30:00Z",
      "timeWorking": 3600,
      "worksPerformed": 5
    }
  ]
}
```

#### Get Robot Telemetry

```http
GET /api/devices/robot-1/telemetry HTTP/1.1
Cookie: SESSIONID=abc123def456

< HTTP/1.1 200 OK

{
  "deviceId": "robot-1",
  "timestamp": 1716033600,
  "battery": {
    "voltage": 48.5,
    "current": -2.3,
    "percentage": 85.3,
    "temperature": 32.1,
    "health": 95
  },
  "status": {
    "state": "working",
    "position": { "x": 10.5, "y": 20.3 },
    "heading": 45.2
  },
  "alarms": [
    {
      "code": "LOW_BATTERY",
      "level": "warning",
      "timestamp": 1716033500
    }
  ]
}
```

#### Assign Users to Robot (Admin)

```http
PUT /admin/robots/robot-1/users HTTP/1.1
Cookie: SESSIONID=admin123
Content-Type: application/json

{
  "userIds": ["user1@example.com", "user2@example.com"]
}

< HTTP/1.1 200 OK

{
  "ok": true,
  "robotId": "robot-1",
  "userIds": ["user1@example.com", "user2@example.com"]
}
```

---

## 9. TESTING

### 9.1 Estrategia de Testing

**Niveles**:
1. **Unit Tests**: Pruebas de clases/funciones individuales
2. **Integration Tests**: Pruebas de endpoints HTTP completos
3. **Domain Tests**: Pruebas de modelos de dominio

**Framework**: Vitest + Supertest

### 9.2 Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests en modo watch
npm run test:watch

# Tests específicos
npm test -- robot-use-cases.test.ts

# Con cobertura
npm test -- --coverage
```

### 9.3 Escribir Tests

**Estructura básica**:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyUseCase', () => {
  it('should do something', async () => {
    // ARRANGE: Preparar datos y mocks
    const mockRepository = {
      findById: vi.fn().mockResolvedValue({ id: 'x' }),
    };
    const useCase = new MyUseCase(mockRepository);

    // ACT: Ejecutar
    const result = await useCase.execute({ id: 'x' });

    // ASSERT: Verificar
    expect(result.ok).toBe(true);
    expect(mockRepository.findById).toHaveBeenCalledWith('x');
  });
});
```

**Testing de endpoints HTTP**:

```typescript
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';

describe('Admin Robots', () => {
  it('PUT /admin/robots/:id/users assigns users', async () => {
    const app = createTestApp({
      oidcClient: { authorizationUrl: () => 'http://...' },
    });

    const res = await request(app)
      .put('/admin/robots/robot-1/users')
      .send({
        userIds: ['user@example.com'],
      })
      .expect(200);

    expect(res.body.ok).toBe(true);
  });
});
```

### 9.4 Área de Problema Actual

**Problema**: `PUT /admin/robots/:id/users` no crea entrada en tabla `user_robot` si el usuario no existe en tabla `user`.

**Root cause**: La query SQL falla silenciosamente:
```sql
INSERT INTO user_robot (user_id, robot_id)
SELECT id, $2 FROM "user" WHERE email = $1
-- Si no hay user con ese email, 0 filas insertadas (sin error)
```

**Solución**: Validar usuarios antes de insertar (ver [Guía de Desarrollo](#61-setup-inicial)).

---

## 10. TROUBLESHOOTING

### 10.1 Problemas Comunes

#### ❌ "User not found in database"

**Síntoma**: Al asignar usuarios a un robot, retorna error 404.

**Causa**: Usuario no existe en tabla `user`.

**Solución**:
1. Verificar que usuario está sincronizado: `SELECT * FROM "user" WHERE email = '...';`
2. Si no existe, sincronizar desde Cognito/OIDC
3. O crear manualmente: `INSERT INTO "user" (id, email) VALUES ('u1', 'user@ex.com');`

#### ❌ "SESSIONID cookie not set"

**Síntoma**: Login completo pero cookie no se envía.

**Causa**: Middleware de sesión no configurado correctamente.

**Solución**:
1. Verificar `TRANSACT_SESSION_SECRET` en `.env`
2. Verificar que `express-session` middleware está en `app.ts` ANTES de las rutas
3. Verificar configuración de cookies (domain, secure, sameSite)

#### ❌ "Cannot find robots from Portal API"

**Síntoma**: `POST /admin/robots/sync` no sincroniza.

**Causa**: Error en Portal API o credenciales inválidas.

**Solución**:
1. Verificar `TRANSITIVE_USER` y `JWT_SECRET` en `.env`
2. Verificar Portal API está accesible: `curl https://portal.transitive.../api/robots`
3. Revisar logs: `npm run dev` muestra errores de HTTP
4. Verificar token JWT no expirado

#### ❌ "Telemetry data is null"

**Síntoma**: `GET /api/devices/{id}/telemetry` retorna null.

**Causa**: Dispositivo no está suscrito o no envía datos.

**Solución**:
1. Verificar MQTT conectado: Mirar logs en `collector.start()`
2. Verificar dispositivo tiene tópicos configurados
3. Verificar datos llegan a `device-data-stream.ts`
4. Incrementar timeout de polling frontend

#### ❌ "Transaction deadlock"

**Síntoma**: Errores aleatorios de "deadlock" en operaciones concurrentes.

**Causa**: Múltiples requests tocando las mismas filas.

**Solución**:
1. Agregar índices apropiados (ver [BD](#7-base-de-datos))
2. Usar transacciones con nivel de aislamiento explícito
3. Usar `SELECT ... FOR UPDATE` si es necesario

### 10.2 Debugging

**Enable verbose logging**:
```bash
DEBUG=brit:* npm run dev
```

**PostgreSQL logging**:
```sql
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();
```

**Network debugging (MQTT/HTTP)**:
```bash
# Monitorear MQTT
mosquitto_sub -t '#' -v

# Monitorear HTTP (si tienes Wireshark)
wireshark
```

---

## 11. CHECKLIST PARA NUEVAS FUNCIONALIDADES

### Antes de Implementar

- [ ] ¿Entiendes el caso de uso completamente?
- [ ] ¿Necesitas una nueva tabla BD o cambio de esquema?
- [ ] ¿Necesitas un nuevo puerto (interfaz)?
- [ ] ¿Necesitas un nuevo use case?
- [ ] ¿Es un endpoint público o admin?
- [ ] ¿Qué errores pueden ocurrir?

### Durante la Implementación

- [ ] Crear/actualizar query de BD
- [ ] Crear modelo de dominio si es complejo
- [ ] Crear use case (con validación)
- [ ] Crear/actualizar puerto
- [ ] Implementar en repositorio
- [ ] Inyectar en `composition.ts`
- [ ] Crear endpoint HTTP
- [ ] Agregar Swagger documentation
- [ ] Agregar error handling
- [ ] Agregar autenticación (requireLogin/requireAdmin)

### Después de Implementar

- [ ] Tests unitarios del use case
- [ ] Tests del endpoint HTTP
- [ ] Tests de dominio si es necesario
- [ ] Ejecutar `npm test` - todo pasa
- [ ] Ejecutar `npm run lint` - sin errores
- [ ] Verificar manualmente en `npm run dev`
- [ ] Documentar en este manual
- [ ] Actualizar README si aplica
- [ ] Commit con mensaje claro

### Merge Checklist

- [ ] PR description explica cambios
- [ ] Tests pasan localmente
- [ ] No hay regresiones en tests existentes
- [ ] Code review aprobado
- [ ] Branch actualizado con main
- [ ] Rebase limpio (sin merge commits)

---

## 📞 CONTACTO Y PREGUNTAS

Si tienes preguntas sobre:

- **Arquitectura**: Ver sección [Arquitectura y Patrones](#2-arquitectura-y-patrones)
- **Flujos**: Ver sección [Flujos Principales](#4-flujos-principales)
- **Agregar features**: Ver [Guía de Desarrollo](#6-guía-de-desarrollo)
- **Tests**: Ver [Testing](#9-testing)
- **Errores**: Ver [Troubleshooting](#10-troubleshooting)

---

## 📝 HISTORIA DE CAMBIOS

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | 2026-05-18 | Equipo Anterior | Documento inicial |

---

**Última actualización**: Mayo 18, 2026  
**Próxima revisión recomendada**: Cuando se agreguen 5+ nuevas funcionalidades
