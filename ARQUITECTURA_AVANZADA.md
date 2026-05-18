# 🔧 GUÍA AVANZADA: ARQUITECTURA Y DEBUGGING

**Documento complementario al Manual Completo**  
*Información técnica detallada para arquitectos y senior developers*

---

## TABLA DE CONTENIDOS

1. [Arquitectura en Profundidad](#1-arquitectura-en-profundidad)
2. [Patrones de Diseño Utilizados](#2-patrones-de-diseño-utilizados)
3. [Flujos de Datos Detallados](#3-flujos-de-datos-detallados)
4. [Estrategias de Error Handling](#4-estrategias-de-error-handling)
5. [Performance y Optimización](#5-performance-y-optimización)
6. [Decisiones Arquitectónicas](#6-decisiones-arquitectónicas)
7. [Escalabilidad Futura](#7-escalabilidad-futura)

---

## 1. ARQUITECTURA EN PROFUNDIDAD

### 1.1 Capas y Responsabilidades Exactas

```
┌─────────────────────────────────────────────────────────┐
│ DELIVERY LAYER (server/routes/)                         │
│ - Maneja HTTP requests/responses                        │
│ - Convierte solicitudes HTTP en comandos de dominio     │
│ - NO contiene lógica de negocio                         │
├─────────────────────────────────────────────────────────┤
│ APPLICATION LAYER (application/)                        │
│ - Orquesta use cases                                    │
│ - Implementa workflows de negocio                       │
│ - NO tiene detalles de infraestructura                  │
│ - Depende de PORTS (interfaces)                         │
├─────────────────────────────────────────────────────────┤
│ DOMAIN LAYER (domain/)                                  │
│ - Lógica pura del negocio                               │
│ - Validaciones                                          │
│ - Sin dependencias externas                             │
│ - Idempotente y determinista                            │
├─────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE LAYER (infrastructure/)                  │
│ - Implementación de puertos                             │
│ - Integración con librerías externas                    │
│ - DB, Auth, APIs, etc                                   │
├─────────────────────────────────────────────────────────┤
│ EXTERNAL LAYER                                          │
│ - PostgreSQL, Cognito, Portal API, MQTT                 │
│ - Servicios de terceros                                 │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Inversión de Dependencias

**Principio**: Las capas externas dependen de las internas, nunca al revés.

```
CORRECTO (Dependency Inversion):
═════════════════════════════════
UseCase (Application)
    ↑
    │ depends on (interface)
    │
Repository (Port)
    ↑
    │ implements
    │
DbRobotRepository (Infrastructure)
    ↑
    │ uses
    │
PostgreSQL


INCORRECTO (Violación de inversión):
════════════════════════════════════
UseCase
    ↓ imports directly
    ↓
PostgreSQL  ❌ ACOPLAMIENTO FUERTE
```

### 1.3 Flujo de Composición

```typescript
// server/composition.ts

export function composeApp(config, infrastructureDeps) {
  // 1. Preparar infraestructura de BD
  const db = infrastructureDeps.db;  // Pool PostgreSQL
  
  // 2. Crear repositorios (implementan puertos)
  const robotRepository = createDbRobotRepository(db);
  const userRepository = createDbUserRepository(db);
  const batteryRepository = createDbBatteryRepository(db);
  
  // 3. Crear proveedores de autenticación
  const oidcAuthProvider = new OidcAuthenticationProvider(
    config.oidc
  );
  
  // 4. Crear use cases (inyectar dependencias)
  const getRobot = new GetRobot(robotRepository);
  const listRobots = new ListRobots(robotRepository);
  const setRobotUsers = new SetRobotUsers(
    robotRepository,
    userRepository
  );
  
  const createUser = new CreateUser(userRepository);
  
  // 5. Crear servicios complejos
  const collector = new Collector(
    portalApi,
    robotRepository,
    deviceInfoSubscriber,
    ...
  );
  
  // 6. Crear routers Express y inyectar use cases
  const robotsRouter = createAdminRobotsRouter({
    getRobot,
    listRobots,
    setRobotUsers,
    ...
  });
  
  const usersRouter = createAdminUsersRouter({
    createUser,
    ...
  });
  
  // 7. Retornar aplicación completa
  return {
    app,
    collector,
    ...
  };
}
```

---

## 2. PATRONES DE DISEÑO UTILIZADOS

### 2.1 Repository Pattern

**Propósito**: Abstraer acceso a datos detrás de una interfaz.

**Implementación**:

```typescript
// Puerto (interfaz)
// application/ports/robot-repository.ts
export interface RobotRepository {
  findById(id: string): Promise<Robot | null>;
  syncSnapshot(robots: Robot[]): Promise<void>;
  setUsers(robotId: string, userEmails: string[]): Promise<void>;
}

// Adaptador (implementación)
// infrastructure/db/robot-repository.ts
export function createDbRobotRepository(db: Db): RobotRepository {
  return {
    async findById(id: string) {
      const data = await db.getRobotById(id);
      if (!data) return null;
      return reconstructRobot(data);  // Transformar a modelo
    },
    
    async syncSnapshot(robots: Robot[]) {
      // Implementación concreta
    },
    
    async setUsers(robotId: string, userEmails: string[]) {
      // Implementación concreta
    }
  };
}

// Uso en use case
// application/use-cases/robots/get-robot.ts
export class GetRobot {
  constructor(private repo: RobotRepository) {}
  
  async execute(id: string) {
    const robot = await this.repo.findById(id);  // Usar interfaz
    if (!robot) throw new RobotNotFoundError(id);
    return robot;
  }
}
```

**Ventajas**:
- ✅ Testing: Mockear interfaz es trivial
- ✅ Extensibilidad: Cambiar BD sin tocar use cases
- ✅ Desacoplamiento: Use cases no conocen PostgreSQL

### 2.2 Use Case Pattern (Interactor)

**Propósito**: Encapsular una unidad de negocio atómica.

**Estructura**:

```typescript
export type MyUseCaseCommand = {
  input1: string;
  input2: number;
};

export type MyUseCaseResult = {
  output1: string;
  output2: boolean;
};

export class MyUseCase {
  constructor(
    private readonly repo1: Repository1,
    private readonly repo2: Repository2,
  ) {}

  async execute(command: MyUseCaseCommand): Promise<MyUseCaseResult> {
    // 1. VALIDAR input
    if (!command.input1) {
      throw new ValidationError('input1 required');
    }

    // 2. OBTENER estado actual
    const entity = await this.repo1.findById(command.input1);
    if (!entity) {
      throw new NotFoundError('Entity not found');
    }

    // 3. APLICAR lógica de negocio
    entity.doSomething(command.input2);

    // 4. PERSISTIR cambios
    await this.repo1.update(entity);

    // 5. RETORNAR resultado
    return {
      output1: entity.getName(),
      output2: true,
    };
  }
}
```

**Reglas**:
- ✅ Un use case = un caso de uso
- ✅ Recibe Command, retorna Result
- ✅ Inyecta dependencias en constructor
- ✅ Método `execute()` es el punto de entrada

### 2.3 Factory Pattern

**Propósito**: Crear instancias complejas de forma legible.

**Ejemplos en el proyecto**:

```typescript
// database/index.ts
export function createDb(config: DbConfig) {
  const pool = new Pool(config);
  return {
    ...createRobotOps(pool),
    ...createUserOps(pool),
    ...createBatteryOps(pool),
    ...createClientOps(pool),
    ...createWorkOps(pool),
  };
}

// routes/admin/robots.ts
export function createAdminRobotsRouter(deps: AdminRobotsRouterDeps) {
  const router = Router();
  
  router.get('/...', (req, res) => {
    // Usar deps
  });
  
  return router;
}
```

### 2.4 Strategy Pattern

**Propósito**: Implementación del flujo OIDC para autenticación.

```typescript
// Interfaz port (application/ports/authentication-provider.ts)
export interface AuthenticationProvider {
  createLoginChallenge(): AuthLoginChallenge;
  createAuthorizationUrl(challenge: AuthLoginChallenge): string;
  readCallbackParams(request: unknown): AuthCallbackParams;
  completeCallback(input: {...}): Promise<AuthenticatedIdentity>;
  createLogoutUrl(): string;
}

// Implementación OIDC (infrastructure/auth/oidc-authentication-provider.ts)
export function createOidcAuthenticationProvider(
  config: OidcAuthenticationProviderConfig,
  oidcClient?: OidcClientLike
): AuthenticationProvider {
  // Implementa todos los métodos de la interfaz
  // utilizando openid-client para el flujo OIDC con Cognito
}

// Se configura en composition.ts
const authenticationProvider = createOidcAuthenticationProvider(config, deps.oidcClient);
```

### 2.5 Adapter Pattern

**Propósito**: Convertir interfaz de terceros a la nuestra.

```typescript
// Portal API retorna diferente formato
type PortalRobotDto = {
  robotId: string;
  hostName: string;
  model: string;
};

// Nuestro modelo
type Robot = {
  id: string;
  hostName: string;
  robotName: string;
};

// Adaptador
function adaptPortalRobotToOurModel(dto: PortalRobotDto): Robot {
  return {
    id: dto.robotId,
    hostName: dto.hostName,
    robotName: dto.model,  // Mapeamos diferente campo
  };
}
```

---

## 3. FLUJOS DE DATOS DETALLADOS

### 3.1 Ciclo Completo: POST /admin/robots/sync

```
┌─ CLIENT REQUEST
│  POST /admin/robots/sync
│  Headers: { Cookie: SESSIONID, Authorization: ... }
│  Body: (empty)
│
├─ EXPRESS MIDDLEWARE
│  ├─ sessionMiddleware: Recupera req.session del store
│  ├─ corsMiddleware: Valida CORS
│  └─ Pasa a router
│
├─ ROUTER MATCHING
│  └─ server/routes/admin/robots.ts
│     router.post('/sync', requireAdmin, async (req, res) => {
│
├─ AUTHENTICATION
│  └─ requireAdmin middleware
│     ├─ Verifica req.session?.user existe
│     ├─ Verifica req.session.user.admin === true
│     └─ Si OK → next(), si no → 403 Forbidden
│
├─ CONTROLLER LOGIC
│  └─ res → await deps.syncRobotsFromPortal.execute()
│
├─ USE CASE: SyncRobotsFromPortal
│  └─ application/use-cases/robots/sync-robots-from-portal.ts
│     constructor(portalApi, robotRepository)
│     
│     async execute() {
│       // 1. FETCH from external API
│       const robotsFromPortal = await this.portalApi.listRobotInfo();
│       // → HTTP GET https://portal.transitive/api/robots
│       // ← [{id, hostName, robotName, clientId}, ...]
│
├─ TRANSFORM DATA
│  └─ Convertir PortalRobotDto → Robot domain model
│     robot = Robot.create(id, hostName, robotName, clientId)
│     // Valida datos en constructor
│     // Throws RobotValidationError si inválido
│
├─ REPOSITORY: syncSnapshot
│  └─ robotRepository.syncSnapshot(robots)
│     └─ infrastructure/db/robot-repository.ts
│        async syncSnapshot(robots: Robot[]) {
│          db.syncRobotsSnapshot(
│            robots.map(r => ({
│              id: r.getId(),
│              clientId: r.getClientId(),
│              hostName: r.getHostName(),
│              robotName: r.getRobotName(),
│            }))
│          )
│        }
│
├─ DATABASE OPERATIONS
│  └─ infrastructure/db/postgres/robot.ts
│     async syncRobotsSnapshot(robots: RobotSnapshot[]) {
│       const client = await pool.connect();
│       try {
│         await client.query('BEGIN');
│         
│         // Strategy: Complete replacement (snapshot)
│         // 1. DELETE robots not in new list
│         await client.query(
│           `DELETE FROM robots
│            WHERE id NOT IN (${robots.map((_, i) => `$${i+1}}`).join(',')})`,
│           robots.map(r => r.id)
│         );
│         
│         // 2. UPSERT (INSERT or UPDATE) new robots
│         await client.query(
│           `INSERT INTO robots (...) VALUES (...)
│            ON CONFLICT (id) DO UPDATE SET ...`,
│           [...]
│         );
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
├─ DATABASE RESULTS
│  └─ ✅ PostgreSQL confirmó cambios
│
├─ RETURN TO USE CASE
│  └─ Todos los robots persistidos
│     async execute() {
│       ...
│       await this.robotRepository.syncSnapshot(robots);
│       
│       return {
│         count: robots.length,
│         robots: robots.map(r => toRobotInfo(r))
│       };
│     }
│
├─ RETURN TO CONTROLLER
│  └─ res.json({
│       ok: true,
│       count: 10,
│       robots: [...]
│     });
│
├─ HTTP RESPONSE
│  └─ Status: 200 OK
│     Content-Type: application/json
│     Body: { ok: true, count: 10, robots: [...] }
│
└─ CLIENT RECEIVES RESPONSE ✅
   Frontend actualiza lista de robots
```

### 3.2 Error Propagation

```
┌─ Database error occurs
│  └─ PostgreSQL: "Unique violation on robots.id"
│
├─ Pool throws PgError
│  └─ Caught in robot.ts catch block
│     await client.query('ROLLBACK');
│     throw error;  ← Re-throws as PgError
│
├─ Propagates to use case
│  └─ syncSnapshot() throws uncaught PgError
│
├─ NOT caught in use case
│  └─ SyncRobotsFromPortal doesn't catch generic errors
│
├─ Propagates to controller
│  └─ res.json() called from catch block
│
├─ CAUGHT BY EXPRESS ERROR HANDLER
│  └─ catch (err: any) {
│       if (err instanceof SomeSpecificError) {
│         return res.status(400).json(...)
│       }
│       
│       log.error('Robot sync failed', err);  ← Logs error
│       return res.status(502).json({
│         error: 'Robot sync failed'
│       });
│     }
│
└─ HTTP 502 BAD GATEWAY sent
   Body: { error: 'Robot sync failed' }
   Details logged server-side for debugging
```

---

## 4. ESTRATEGIAS DE ERROR HANDLING

### 4.1 Errores por Dominio

```typescript
// application/use-cases/robots/errors.ts
export class RobotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RobotValidationError';
  }
}

export class RobotNotFoundError extends Error {
  constructor(readonly id: string) {
    super('Robot not found');
    this.name = 'RobotNotFoundError';
  }
}

// application/use-cases/batteries/errors.ts
export class BatteryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatteryValidationError';
  }
}

export class BatteryNotFoundError extends Error {
  constructor(readonly id: string) {
    super('Battery not found');
    this.name = 'BatteryNotFoundError';
  }
}

// Cada dominio (robots, batteries, users, clients) tiene sus errores específicos
```

### 4.2 Manejo en Controladores

```typescript
// server/routes/admin/robots.ts
router.get('/:robotId', requireAdmin, async (req, res) => {
  try {
    const robot = await deps.getRobot.execute(req.params.robotId);
    return res.json(robot);
  } catch (err) {
    if (err instanceof RobotNotFoundError) {
      return res.status(404).json({ error: err.message });
    }

    log.error('Get robot failed', { robotId, error: err });
    return res.status(500).json({ error: 'Get robot failed' });
  }
});

router.patch('/:robotId/users', requireAdmin, async (req, res) => {
  const { userIds } = req.body || {};

  try {
    const result = await deps.setRobotUsers.execute({ robotId, userIds });
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    if (err instanceof RobotValidationError) {
      return res.status(400).json({ error: err.message });
    }

    log.error('Set robot users failed', err);
    return res.status(500).json({ error: 'Set robot users failed' });
  }
});
```

### 4.3 Validación en Capas

```typescript
// LAYER 1: HTTP Input Validation (Express controllers)
if (typeof command.name !== 'string' || !command.name.trim()) {
  throw new RobotValidationError('name is required');
}

// LAYER 2: Type Validation en Use Cases
if (!Array.isArray(command.userIds)) {
  throw new RobotValidationError('userIds must be an array');
}

// LAYER 3: Domain Model Validation
Robot.create(id, hostName, robotName);  // Throws if invalid
// Robot.create() valida:
// - hostName no vacío
// - robotName no vacío
// - Normaliza emails
```

---

## 5. PERFORMANCE Y OPTIMIZACIÓN

### 5.1 Database Query Optimization

**Patrón de queries optimizadas**:
```sql
-- ❌ LENTA (N+1)
SELECT * FROM robots;  
-- Para cada robot, query los usuarios separadamente

-- ✅ RÁPIDA (JOIN)
SELECT r.*, COUNT(ur.user_id) as user_count 
FROM robots r
LEFT JOIN user_robot ur ON r.id = ur.robot_id
WHERE r.client_id = $1
GROUP BY r.id;
```

**Connection Pool**:
```typescript
// src/infrastructure/db/postgres/index.ts
const pool = new Pool({ 
  connectionString: databaseUrl, 
  ssl: sslConfig 
});

// Las conexiones se reutilizan automáticamente
// Pool by-default maneja reconexiones
```

### 5.2 Telemetry Caching

```typescript
// src/infrastructure/transitive/device-data-stream.ts
const telemetryCache: Record<string, any> = {};

export class DeviceDataStream {
  onTelemetry(deviceId: string, data: any) {
    // Store latest telemetry in-memory
    telemetryCache[deviceId] = data;
  }
  
  getData(deviceId: string) {
    // Instant access, no DB query
    return telemetryCache[deviceId];
  }
}

// Used in API
router.get('/api/devices/:deviceId/telemetry', (req, res) => {
  const telemetry = deps.telemetryStream.getData(req.params.deviceId);
  return res.json(telemetry);
});
```

### 5.3 Lazy Loading Pattern

```typescript
// El patrón natural del codebase: cargar solo lo necesario

// ✅ API retorna solo lo básico
GET /api/robots
→ { id, name, clientId, hostName }

// ✅ Endpoints separados para datos relacionados
GET /api/robots/:robotId/users
→ { userIds: [...] }

GET /api/robots/:robotId/telemetry  
→ { battery, temperature, ... }
```

---

## 6. DECISIONES ARQUITECTÓNICAS

### 6.1 Por qué Clean Architecture

**Alternativas consideradas**:

| Alternativa | Ventajas | Desventajas | Veredicto |
|------------|----------|------------|----------|
| Clean Arch (actual) | Testeable, mantenible, escalable | Más archivos al inicio | ✅ Elegida |
| Layered (3 capas) | Más simple al inicio | Acoplamiento, difícil de testear | ❌ Insuficiente |
| Microservicios | Escalable, independiente | Complejo, overhead, network | ❌ Overkill |
| MVC monolítico | Rápido de empezar | No escala, difícil testear | ❌ Insuficiente |

### 6.2 Por qué Inyección Manual

**Alternativas**:

```typescript
// ACTUAL: Composición manual
const repo = new DbRobotRepository(db);
const useCase = new GetRobot(repo);

// ALTERNATIVA: Contenedor IoC
const container = new Container();
container.register(RobotRepository, DbRobotRepository);
container.register(GetRobot);
const useCase = container.resolve(GetRobot);
```

**Decisión**: Manual porque:
- ✅ 100% type-safe (sin reflection)
- ✅ Explícito y rastreable
- ✅ Funciona mejor con TypeScript
- ✅ No hay "magia" oculta
- ✅ Error messages claros

### 6.3 Por qué PostgreSQL

**Comparación**:

| DB | Ventajas | Desventajas | Fit |
|----|----------|------------|-----|
| PostgreSQL (actual) | ACID, transacciones, relaciones | Overhead para datos simples | ✅ Perfecto |
| MongoDB | Flexible schema, JSON nativo | Sin transacciones ACID | ❌ Insuficiente |
| MySQL | Rápido, simple | Menos robusto que PG | ⚠️ Alternativa |
| DynamoDB | Serverless, escalable | Caro, vendor lock-in | ❌ No apropiado |

### 6.4 Por qué Express

**Comparación**:

| Framework | Ventajas | Desventajas | Fit |
|-----------|----------|------------|-----|
| Express | Maduro, eco enorme, simple | Bajo nivel | ✅ Perfecto |
| NestJS | Batteries included, structure | Opinionado, overhead | ⚠️ Alternativa |
| Fastify | Rápido, moderno | Menos maduro | ⚠️ Alternativa |
| Hapi | Robusto, enterprise | Más overhead | ❌ Overkill |

---

## 📚 REFERENCIAS

### Libros Recomendados
- Clean Architecture - Robert C. Martin
- Domain-Driven Design - Eric Evans
- The Pragmatic Programmer - Hunt & Thomas

### Artículos
- [The Dependency Inversion Principle](https://martinfowler.com/articles/dipendenciesandDesign.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Domain-Driven Design in Practice](https://vaughnvernon.com/)

### Herramientas de Debugging
- pgAdmin (PostgreSQL GUI)
- DBeaver (SQL IDE)
- Postman (API testing)
- Chrome DevTools (Frontend)
- node --inspect (Node debugging)

---

**Última actualización**: Mayo 18, 2026
