# ⚡ QUICK REFERENCE: GUÍA RÁPIDA

**Cheat sheet para tareas comunes**  
*Para cuando tienes prisa y necesitas respuestas rápidas*

---

## 🚀 INICIO RÁPIDO

### Setup
```bash
npm install                  # Instalar dependencias
cp .env.example .env        # Copiar variables
# Editar .env con tus valores
npm run dev                 # Arranca en localhost:3000
curl http://localhost:3000/health  # Verifica que funciona
```

### Arrancadores
```bash
npm run dev        # Desarrollo (hot reload)
npm start          # Producción
npm test           # Tests
npm run test:watch # Tests en watch
npm run lint       # Linting
```

---

## 🧬 ESTRUCTURA RÁPIDA

```
src/
├── domain/models/         ← Lógica pura, sin dependencias
├── application/
│   ├── ports/            ← Interfaces
│   └── use-cases/        ← Casos de uso
├── infrastructure/
│   ├── db/              ← Acceso a datos
│   ├── auth/            ← Autenticación
│   ├── portal/          ← API externa
│   └── transitive/      ← MQTT/ROS
└── server/
    ├── routes/          ← HTTP endpoints
    ├── composition.ts   ← Inyección de dependencias
    ├── auth.ts          ← Middleware
    └── config.ts        ← Variables de entorno
```

---

## 📝 AGREGAR UN ENDPOINT (5 min)

### 1️⃣ BD Query
```typescript
// src/infrastructure/db/postgres/robots.ts
async getRobotStatus(robotId: string) {
  const { rows } = await pool.query(
    `SELECT * FROM robots WHERE id = $1`,
    [robotId]
  );
  return rows[0];
}
```

### 2️⃣ Use Case
```typescript
// src/application/use-cases/robots/get-robot-status.ts
export class GetRobotStatus {
  constructor(private repo: RobotRepository) {}
  
  async execute(robotId: string) {
    const robot = await this.repo.findById(robotId);
    if (!robot) throw new Error('Not found');
    return robot.getStatus();
  }
}
```

### 3️⃣ Puerto (si no existe)
```typescript
// src/application/ports/robot-repository.ts
export interface RobotRepository {
  // ... otros métodos
  getStatus(robotId: string): Promise<string>;
}
```

### 4️⃣ Implementar Puerto
```typescript
// src/infrastructure/db/robot-repository.ts
async getStatus(robotId: string) {
  return db.getRobotStatus(robotId);
}
```

### 5️⃣ Inyectar en Composition
```typescript
// src/server/composition.ts
robots: {
  // ...
  getStatus: new GetRobotStatus(robotRepository),
}
```

### 6️⃣ Ruta HTTP
```typescript
// src/server/routes/api.ts
router.get('/robots/:robotId/status', requireLogin, async (req, res) => {
  try {
    const status = await deps.getStatus.execute(req.params.robotId);
    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});
```

---

## 🔍 ENCONTRAR COSAS

### Buscar endpoint
```bash
grep -r "GET /api/robots" src/  # Buscar endpoint
grep -r "listRobots" src/       # Buscar use case
grep -r "ListRobots" test/      # Encontrar tests
```

### Seguir una request
```
1. Endpoint en src/server/routes/*.ts
2. Use case en src/application/use-cases/*/
3. Puerto en src/application/ports/
4. Implementación en src/infrastructure/db/
5. Tests en test/*.test.ts
```

### Encontrar errors
```bash
grep -r "throw new " src/application/use-cases/  # Ver qué errores lanza
grep -r "RobotNotFoundError" test/                # Buscar tests de error
```

---

## 🐛 DEBUGGING RÁPIDO

### Ver logs
```bash
npm run dev 2>&1 | grep -i error  # Solo errores
DEBUG=brit:* npm run dev          # Logs verbosos
```

### Verificar BD
```bash
psql -d brit-db                   # Conectar a BD
\dt                               # Ver tablas
SELECT * FROM robots;             # Ver datos
\q                                # Salir
```

### Testear endpoint
```bash
# Con curl
curl -H "Cookie: SESSIONID=xxx" http://localhost:3000/api/robots
curl -X POST http://localhost:3000/admin/robots/sync -H "Cookie: SESSIONID=xxx"

# Con Postman
1. Abrir Postman
2. GET http://localhost:3000/auth/login
3. Copiar SESSIONID de response
4. Usarlo en otros requests
```

---

## 🧪 TESTS RÁPIDOS

### Run específico
```bash
npm test -- robot-use-cases.test.ts              # Un archivo
npm test -- robot-use-cases.test.ts -t "lists"  # Un test específico
```

### Escribir test rápido
```typescript
it('does something', async () => {
  const repo = { findById: vi.fn().mockResolvedValue({ id: 'x' }) };
  const useCase = new MyUseCase(repo);
  const result = await useCase.execute('x');
  expect(result.ok).toBe(true);
});
```

### Debug test
```bash
npm test -- --no-coverage  # Más rápido
npm test -- robot.test.ts --reporter=verbose
```

---

## 📊 QUERIES COMUNES

### Robots de un usuario
```sql
SELECT DISTINCT r.* FROM robots r
JOIN user_robot ur ON r.id = ur.robot_id
JOIN "user" u ON u.id = ur.user_id
WHERE u.email = 'user@example.com';
```

### Usuarios de un robot
```sql
SELECT u.* FROM "user" u
JOIN user_robot ur ON u.id = ur.user_id
WHERE ur.robot_id = 'robot-1';
```

### Asignar usuario a robot
```sql
BEGIN;
DELETE FROM user_robot WHERE robot_id = 'robot-1';
INSERT INTO user_robot (user_id, robot_id)
SELECT id, 'robot-1' FROM "user" WHERE email = 'user@ex.com';
COMMIT;
```

### Robots sin usuario
```sql
SELECT r.* FROM robots r
WHERE r.id NOT IN (SELECT DISTINCT robot_id FROM user_robot);
```

---

## 🔐 AUTENTICACIÓN

### Flujo OAuth
```
1. Usuario → GET /auth/login
2. Redirige a Cognito
3. Usuario loguea en Cognito
4. Cognito redirige a GET /auth/callback?code=XXX
5. Backend intercambia código por token
6. Backend crea sesión
7. ✅ Logueado
```

### Verificar sesión
```typescript
// En rutas
requireLogin   // Usuario autenticado
requireAdmin   // Usuario es admin

// En controlador
const user = req.session?.user;
const email = user?.email;
const isAdmin = user?.admin;
```

### Agregar usuario
```typescript
// Use case: CreateUser
await createUser.execute({
  id: 'u1',
  email: 'user@example.com',
  clientId: 'c1'
});
```

---

## 🤔 ERRORES COMUNES

### ❌ "user_robot table doesn't exist"
```
Solución: Ejecutar migrations/creación de BD
psql -d brit-db -f schema.sql
```

### ❌ "Cannot find module '@/application'"
```
Solución: Verificar tsconfig.json tiene paths:
"@/*": ["./src/*"]
```

### ❌ "SESSIONID is undefined"
```
Solución: Asegúrate que:
1. TRANSACT_SESSION_SECRET está en .env
2. middleware de session está antes de rutas en app.ts
3. Cookie está siendo enviada (check DevTools)
```

### ❌ "Connection timeout"
```
Solución: Verificar DATABASE_URL en .env
psql -d <DATABASE_URL>  # Test conexión
```

### ❌ "User not found"
```
Solución: Usuario no existe en BD
SELECT * FROM "user" WHERE email = 'user@ex.com';
# Si no existe:
INSERT INTO "user" (id, email) VALUES ('u1', 'user@ex.com');
```

---

## 📦 DEPENDENCIAS PRINCIPALES

| Paquete | Para Qué | Versión |
|---------|----------|---------|
| express | Servidor HTTP | ^4.21 |
| pg | PostgreSQL | ^8.20 |
| openid-client | OIDC/Cognito | ^5.7 |
| vitest | Testing | latest |
| supertest | HTTP testing | latest |
| tsx | TypeScript runner | ^4.3 |

---

## 🔗 CONECTAR DATOS

### Relaciones en BD
```sql
-- Uno-a-Muchos: clients -> robots
robots.client_id → clients.id

-- Muchos-a-Muchos: users <-> robots
user_robot (user_id, robot_id)

-- Uno-a-Uno: (implied) robot -> work
works.robot_id → robots.id
```

### En Use Cases
```typescript
// Obtener robot
const robot = await robotRepository.findById(robotId);

// Obtener usuarios del robot
const userIds = await robotRepository.listUsers(robotId);

// Asignar usuarios
await robotRepository.setUsers(robotId, ['user1@ex.com']);
```

---

## 🔄 FLUJOS TÍPICOS

### Sincronizar Robots
```
POST /admin/robots/sync
→ SyncRobotsFromPortal use case
→ portalApi.listRobotInfo() [HTTP]
→ robotRepository.syncSnapshot() [BD]
→ DELETE robots no en lista + UPSERT nuevos
✅ Respuesta
```

### Asignar Usuario a Robot
```
PUT /admin/robots/{id}/users
→ SetRobotUsers use case
→ Validar usuarios existen
→ robotRepository.setUsers() [BD]
→ DELETE previos + INSERT nuevos (transacción)
✅ Respuesta
```

### Consultar Datos de Usuario
```
GET /api/user
→ autenticado (session)
→ return req.session.user
✅ Datos del usuario
```

---

## 📋 CHECKLIST: Antes de Commit

- [ ] Tests pasan: `npm test`
- [ ] Lint clean: `npm run lint`
- [ ] Compilación TypeScript ok: `npx tsc --noEmit`
- [ ] Probado en navegador/Postman
- [ ] Sin console.log (usar log.* en su lugar)
- [ ] Código sigue convenciones del proyecto
- [ ] Nueva funcionalidad tiene tests
- [ ] Documentación actualizada si es necesario

---

## 🚨 EMERGENCY FIXES

### Rollback rápido
```bash
git revert HEAD              # Deshacer último commit
git checkout -- src/        # Descartar cambios locales
npm test -- --no-coverage  # Tests rápido
```

### Resetear BD
```bash
dropdb brit-db
createdb brit-db
psql -d brit-db -f schema.sql
npm run seed  # Si existe
```

### Limpiar cache/node_modules
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 📞 SOS - WHERE TO LOOK

| Problema | Archivo |
|----------|---------|
| Error 404 en ruta | `src/server/routes/` |
| Error 401/403 | `src/server/auth.ts` |
| Error 500 (BD) | `src/infrastructure/db/postgres/` |
| Error de negocio | `src/application/use-cases/` |
| Error de modelo | `src/domain/models/` |
| Error de test | `test/*.test.ts` |
| Error de configuración | `src/server/config.ts` + `.env` |
| Error OIDC | `src/infrastructure/auth/` |

---

## 🎯 ESTO ESTÁ FUNCIONANDO BIEN, NO TOQUES

```typescript
// ✅ Evitar cambiar
src/infrastructure/db/postgres/index.ts     // Pool config
src/server/composition.ts                   # Inyección
src/server/auth.ts                          # Middleware
tests/setup.ts                              # Test setup

// ✅ Seguro modificar (hay tests)
src/application/use-cases/                  # Agregar casos
src/server/routes/                          # Agregar endpoints
src/domain/models/                          # Mejorar modelos
```

---

## 🚀 DEPLOY CHECKLIST

- [ ] Todos los tests pasan
- [ ] `.env` configurado en producción
- [ ] BD migrada a la versión correcta
- [ ] Cache limpiado (Redis si existe)
- [ ] Logs chequeados (buscar errors)
- [ ] Health check funciona: `/health`
- [ ] Autenticación funciona
- [ ] API endpoints responden

---

## 💡 TIPS Y TRICKS

### Hot reload en desarrollo
```bash
npm run dev  # Detecta cambios automáticamente
```

### Tests en modo watch
```bash
npm test:watch
# Corre tests relativos a cambios
```

### Buscar TODO/FIXME
```bash
grep -r "TODO\|FIXME" src/
```

### Ver dependencias circulares
```bash
npm install --save-dev madge
madge --circular src/
```

### Analizar performance
```bash
node --prof src/server/main.ts
node --prof-process isolate-*.log > profile.txt
```

---

**Quick Reference v1.0 - Mayo 2026**

Para información detallada, ver `MANUAL_COMPLETO.md` o `ARQUITECTURA_AVANZADA.md`
