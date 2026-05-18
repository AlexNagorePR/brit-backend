# 📚 ÍNDICE MAESTRO: DOCUMENTACIÓN COMPLETA

**Guía de navegación para toda la documentación del proyecto BRIT-Backend**

---

## 🎯 ¿POR DÓNDE EMPIEZO?

### Para Empezar Rápido ⚡
1. Lee: [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (5 min)
   - Setup inicial
   - Tareas comunes
   - Emergency fixes

2. Ejecuta:
   ```bash
   npm install && npm run dev
   curl http://localhost:3000/health
   ```

3. Explora el código:
   - Abre [src/server/main.ts](src/server/main.ts) - Punto de entrada
   - Abre [src/server/composition.ts](src/server/composition.ts) - Inyección de dependencias
   - Echa vistazo a [src/server/routes/api.ts](src/server/routes/api.ts) - Endpoints

---

## 📖 DOCUMENTACIÓN DISPONIBLE

### 1. **MANUAL_COMPLETO.md** (Lectura Obligatoria)
La guía exhaustiva de transferencia de conocimiento.

**Secciones principales**:
- Visión general del proyecto
- Arquitectura y patrones
- Estructura de carpetas (con descripción de cada archivo)
- Flujos principales (Auth, Telemetría, Request HTTP)
- Relaciones entre módulos
- **Guía completa de desarrollo** (agregar endpoints paso a paso)
- Base de datos (esquema completo + queries comunes)
- APIs y endpoints
- Testing
- Troubleshooting
- Checklist para nuevas funcionalidades

**Tiempo de lectura**: ~1-2 horas  
**Cuándo leer**: En tu primer día  
**Por qué**: Entenderás el proyecto completo

---

### 2. **ARQUITECTURA_AVANZADA.md** (Lectura Recomendada)
Información técnica profunda para arquitectos y developers senior.

**Secciones principales**:
- Arquitectura en profundidad (capas, inversión de dependencias)
- Patrones de diseño (Repository, Use Case, Factory, Strategy, Adapter)
- Flujos de datos detallados (con diagramas)
- Estrategias de error handling
- Performance y optimización
- **Debugging avanzado**
- Decisiones arquitectónicas (por qué cada tecnología)
- Escalabilidad futura

**Tiempo de lectura**: ~1 hora  
**Cuándo leer**: Cuando necesites modificar arquitectura o hacer optimizaciones  
**Por qué**: Entenderás las decisiones detrás del código

---

### 3. **QUICK_REFERENCE.md** (Tu Mejor Amigo)
Cheat sheet con respuestas rápidas para tareas comunes.

**Secciones principales**:
- Comandos de inicio rápido
- Estructura visual comprimida
- Agregar endpoint (5 min)
- Encontrar cosas rápido
- Debugging rápido
- Tests rápidos
- Queries SQL comunes
- Checklist de commits
- Emergency fixes
- Tabla de "dónde buscar"

**Tiempo de referencia**: 30 segundos - 5 minutos  
**Cuándo usar**: Constantemente durante desarrollo  
**Por qué**: Acceso rápido sin leer documentos largos

---

## 🗺️ NAVEGACIÓN POR TÓPICO

### Si quiero...

#### Entender el Proyecto
- Lee: [MANUAL_COMPLETO.md - Visión General](MANUAL_COMPLETO.md#1-visión-general-del-proyecto)
- Ver: [MANUAL_COMPLETO.md - Arquitectura](MANUAL_COMPLETO.md#2-arquitectura-y-patrones)
- Profundizar: [ARQUITECTURA_AVANZADA.md](ARQUITECTURA_AVANZADA.md)

#### Agregar una Nueva Funcionalidad
- Paso a paso: [MANUAL_COMPLETO.md - Guía de Desarrollo](MANUAL_COMPLETO.md#6-guía-de-desarrollo)
- Ejemplo completo: [MANUAL_COMPLETO.md - Agregar Endpoint](MANUAL_COMPLETO.md#62-agregar-un-nuevo-endpoint)
- Checklist: [MANUAL_COMPLETO.md - Checklist](MANUAL_COMPLETO.md#11-checklist-para-nuevas-funcionalidades)
- Rápido: [QUICK_REFERENCE.md - Agregar Endpoint](QUICK_REFERENCE.md#-agregar-un-endpoint-5-min)

#### Hacer Debugging
- Problemas comunes: [MANUAL_COMPLETO.md - Troubleshooting](MANUAL_COMPLETO.md#10-troubleshooting)
- Debugging avanzado: [ARQUITECTURA_AVANZADA.md - Debugging](ARQUITECTURA_AVANZADA.md#6-debugging-avanzado)
- Rápido: [QUICK_REFERENCE.md - Debugging](QUICK_REFERENCE.md#-debugging-rápido)

#### Escribir Tests
- Estrategia: [MANUAL_COMPLETO.md - Testing](MANUAL_COMPLETO.md#9-testing)
- Ejemplos: [MANUAL_COMPLETO.md - Testing](MANUAL_COMPLETO.md#93-escribir-tests)
- Comandos: [QUICK_REFERENCE.md - Tests](QUICK_REFERENCE.md#-tests-rápidos)

#### Entender la BD
- Esquema: [MANUAL_COMPLETO.md - BD](MANUAL_COMPLETO.md#7-base-de-datos)
- Queries: [MANUAL_COMPLETO.md - Operaciones BD](MANUAL_COMPLETO.md#72-operaciones-comunes)
- Rápido: [QUICK_REFERENCE.md - Queries](QUICK_REFERENCE.md#-queries-comunes)

#### Entender la Autenticación
- Flujo: [MANUAL_COMPLETO.md - Auth](MANUAL_COMPLETO.md#41-flujo-de-autenticación-oidccognito)
- Implementación: [MANUAL_COMPLETO.md - Rutas](MANUAL_COMPLETO.md#81-resumen-de-endpoints)
- Quick: [QUICK_REFERENCE.md - Auth](QUICK_REFERENCE.md#-autenticación)

#### Entender Flujos de Datos
- Telemetría: [MANUAL_COMPLETO.md - Flujo Telemetría](MANUAL_COMPLETO.md#42-flujo-de-recolección-de-telemetría-collector)
- Request HTTP: [MANUAL_COMPLETO.md - Flujo HTTP](MANUAL_COMPLETO.md#43-flujo-de-request-http-típico)
- Detallado: [ARQUITECTURA_AVANZADA.md - Flujos](ARQUITECTURA_AVANZADA.md#3-flujos-de-datos-detallados)

#### Optimizar Performance
- Estrategias: [ARQUITECTURA_AVANZADA.md - Performance](ARQUITECTURA_AVANZADA.md#5-performance-y-optimización)
- BD indexing: [ARQUITECTURA_AVANZADA.md - DB Optimization](ARQUITECTURA_AVANZADA.md#51-database-query-optimization)
- Caching: [ARQUITECTURA_AVANZADA.md - Caching](ARQUITECTURA_AVANZADA.md#52-caching-strategy)

#### Preparar para Escalar
- Escalabilidad futura: [ARQUITECTURA_AVANZADA.md - Escalabilidad](ARQUITECTURA_AVANZADA.md#8-escalabilidad-futura)
- Migraciones: [ARQUITECTURA_AVANZADA.md - Migraciones](ARQUITECTURA_AVANZADA.md#81-migraciones-de-bd)
- Replicas: [ARQUITECTURA_AVANZADA.md - Replicas](ARQUITECTURA_AVANZADA.md#82-replicas-de-bd)
- Redis: [ARQUITECTURA_AVANZADA.md - Redis](ARQUITECTURA_AVANZADA.md#83-cache-distribuido-redis)
- Message Queues: [ARQUITECTURA_AVANZADA.md - Queues](ARQUITECTURA_AVANZADA.md#84-message-queue-para-jobs-async)

#### Arreglar Algo Roto
- Emergencias: [QUICK_REFERENCE.md - Emergency](QUICK_REFERENCE.md#-emergency-fixes)
- Troubleshooting: [MANUAL_COMPLETO.md - Troubleshooting](MANUAL_COMPLETO.md#10-troubleshooting)
- Errores comunes: [QUICK_REFERENCE.md - Errores](QUICK_REFERENCE.md#-errores-comunes)

---

## 📂 ESTRUCTURA DE DOCUMENTACIÓN

```
brit-backend/
├── MANUAL_COMPLETO.md          ← Lectura obligatoria (exhaustivo)
├── ARQUITECTURA_AVANZADA.md    ← Información técnica profunda
├── QUICK_REFERENCE.md          ← Cheat sheet (rápido)
├── DOCUMENTACION_INDICE.md     ← Este archivo
│
├── src/                         ← Código (autoexplicativo)
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── server/
│
├── test/                        ← Tests (ejemplos de uso)
│
└── README.md                    ← Información básica (opcional)
```

---

## 🎓 TABLA DE APRENDIZAJE RECOMENDADA

### Día 1 (Setup + Conceptos)
```
1. Leer README.md (15 min)
2. Ejecutar npm install + npm run dev (10 min)
3. Leer QUICK_REFERENCE.md - Inicio Rápido (10 min)
4. Explorar carpetas (30 min)
5. Leer MANUAL_COMPLETO.md - Secciones 1-2 (45 min)
   → Total: ~2 horas
```

### Día 2 (Arquitectura)
```
1. Leer MANUAL_COMPLETO.md - Secciones 3-5 (90 min)
2. Seguir un request de punta a punta (30 min)
3. Entender composition.ts (30 min)
   → Total: ~3 horas
```

### Día 3 (Código Práctico)
```
1. Ejecutar tests: npm test (15 min)
2. Leer un test completo (30 min)
3. Modificar un endpoint existente (45 min)
4. Crear un endpoint nuevo (90 min)
5. Escribir tests para tu endpoint (45 min)
   → Total: ~4 horas
```

### Semana 1+ (Profundización)
```
- Leer ARQUITECTURA_AVANZADA.md
- Entender patrones de diseño
- Explorar casos de uso específicos
- Optimizar queries
- Mejorar tests
```

---

## 🔍 ÍNDICE DE CONCEPTOS CLAVE

### Arquitectura
- [Clean Architecture](MANUAL_COMPLETO.md#2-arquitectura-y-patrones)
- [Inversión de Dependencias](ARQUITECTURA_AVANZADA.md#12-inversión-de-dependencias)
- [Puertos y Adaptadores](MANUAL_COMPLETO.md#-patrón-puertos-y-adaptadores)

### Patrones
- [Repository Pattern](ARQUITECTURA_AVANZADA.md#21-repository-pattern)
- [Use Case Pattern](ARQUITECTURA_AVANZADA.md#22-use-case-pattern-interactor)
- [Factory Pattern](ARQUITECTURA_AVANZADA.md#23-factory-pattern)
- [Strategy Pattern](ARQUITECTURA_AVANZADA.md#24-strategy-pattern)
- [Adapter Pattern](ARQUITECTURA_AVANZADA.md#25-adapter-pattern)

### Conceptos de Datos
- [Base de Datos](MANUAL_COMPLETO.md#7-base-de-datos)
- [Modelo de Datos](MANUAL_COMPLETO.md#71-esquema-postgresql)
- [Operaciones Transaccionales](ARQUITECTURA_AVANZADA.md#43-transactional-error-handling)

### Conceptos de Auth
- [Flujo OIDC/Cognito](MANUAL_COMPLETO.md#41-flujo-de-autenticación-oidccognito)
- [Session Management](MANUAL_COMPLETO.md#41-flujo-de-autenticación-oidccognito)
- [Middleware de Auth](MANUAL_COMPLETO.md#-middleware-de-autenticación)

### Conceptos de Testing
- [Testing Strategy](MANUAL_COMPLETO.md#81-estrategia-de-testing)
- [Unit Tests](MANUAL_COMPLETO.md#92-ejecutar-tests)
- [Integration Tests](MANUAL_COMPLETO.md#92-ejecutar-tests)

---

## 🧭 NAVEGACIÓN POR NIVEL

### Level 1: Principiante (Tu primer día)
```
QUICK_REFERENCE.md → MANUAL_COMPLETO.md (Secciones 1-2) → Explorar código
```

### Level 2: Intermedio (Después de una semana)
```
MANUAL_COMPLETO.md (completo) → Agregar features → ARQUITECTURA_AVANZADA.md
```

### Level 3: Avanzado (Después de un mes)
```
ARQUITECTURA_AVANZADA.md → Optimizar código → Escalabilidad futura
```

### Level 4: Expert (Cuándo contribuyas a mejorar arquitectura)
```
Decisiones Arquitectónicas → Propuestas → Code Review
```

---

## 💾 REFERENCIA RÁPIDA POR ARCHIVO

### Archivos Clave a Leer Pronto

| Archivo | Propósito | Prioridad |
|---------|-----------|----------|
| [src/server/main.ts](src/server/main.ts) | Punto de entrada | ⭐⭐⭐⭐⭐ |
| [src/server/composition.ts](src/server/composition.ts) | Inyección de deps | ⭐⭐⭐⭐⭐ |
| [src/server/app.ts](src/server/app.ts) | Config Express | ⭐⭐⭐⭐ |
| [src/server/routes/api.ts](src/server/routes/api.ts) | Endpoints públicos | ⭐⭐⭐⭐ |
| [src/server/routes/admin/robots.ts](src/server/routes/admin/robots.ts) | Admin endpoints | ⭐⭐⭐ |
| [src/application/use-cases/robots/](src/application/use-cases/robots/) | Casos de uso | ⭐⭐⭐⭐ |
| [src/infrastructure/db/postgres/](src/infrastructure/db/postgres/) | Database layer | ⭐⭐⭐⭐ |
| [src/domain/models/](src/domain/models/) | Domain logic | ⭐⭐⭐⭐ |

---

## 🎯 METAS PROGRESIVAS

### Semana 1
- [ ] Entiendo cómo arranca el servidor
- [ ] Puedo navegar el código sin perderse
- [ ] Ejecuto tests y entiendo qué hacen
- [ ] Puedo modificar un endpoint existente
- [ ] Entiendo la arquitectura en alto nivel

### Semana 2
- [ ] Puedo agregar un endpoint nuevo (guía step-by-step)
- [ ] Escribo tests para mis cambios
- [ ] Entiendo flujos de datos principales
- [ ] Puedo debuguear errores básicos
- [ ] Conozco la BD

### Semana 3
- [ ] Agrego features sin guía
- [ ] Optimizo queries
- [ ] Entiendo patrones de diseño
- [ ] Hago code review a otros
- [ ] Sugiero mejoras de arquitectura

### Mes 1
- [ ] Soy productivo haciendo changes grandes
- [ ] Entiendo todos los flujos
- [ ] Puedo explicar la arquitectura a otros
- [ ] He hecho al menos 3 features nuevas
- [ ] Tengo ideas para escalar el proyecto

---

## 🚀 QUICK LINKS

### Documentación
- [MANUAL_COMPLETO.md](MANUAL_COMPLETO.md) - Lectura completa
- [ARQUITECTURA_AVANZADA.md](ARQUITECTURA_AVANZADA.md) - Técnico profundo
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Cheat sheet
- [README.md](README.md) - Info básica

### Código Importante
- [src/server/main.ts](src/server/main.ts) - Inicio
- [src/server/composition.ts](src/server/composition.ts) - Composición
- [src/domain/models/robot.ts](src/domain/models/robot.ts) - Modelo ejemplo
- [src/application/use-cases/robots/get-robot.ts](src/application/use-cases/robots/get-robot.ts) - Use case ejemplo
- [src/infrastructure/db/robot-repository.ts](src/infrastructure/db/robot-repository.ts) - Repository ejemplo

### Tests
- [test/robot-use-cases.test.ts](test/robot-use-cases.test.ts) - Tests de use cases
- [test/admin-robots.test.ts](test/admin-robots.test.ts) - Tests de endpoints
- [test/robot-domain.test.ts](test/robot-domain.test.ts) - Tests de dominio

---

## ❓ FAQ

**P: ¿Por dónde empiezo?**  
R: QUICK_REFERENCE.md, luego MANUAL_COMPLETO.md

**P: ¿Cuánto tarda en entender el proyecto?**  
R: 1 semana para lo básico, 1 mes para experticia

**P: ¿Dónde está la lógica de autenticación?**  
R: [MANUAL_COMPLETO.md - Auth](MANUAL_COMPLETO.md#41-flujo-de-autenticación-oidccognito)

**P: ¿Cómo agreg un endpoint?**  
R: [MANUAL_COMPLETO.md - Agregar endpoint](MANUAL_COMPLETO.md#62-agregar-un-nuevo-endpoint) o [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-agregar-un-endpoint-5-min)

**P: ¿Dónde están los tests?**  
R: Carpeta `test/` - Ver [MANUAL_COMPLETO.md - Testing](MANUAL_COMPLETO.md#9-testing)

**P: ¿Cómo debuguear?**  
R: [QUICK_REFERENCE.md - Debugging](QUICK_REFERENCE.md#-debugging-rápido) o [ARQUITECTURA_AVANZADA.md - Debugging](ARQUITECTURA_AVANZADA.md#6-debugging-avanzado)

---

## 📞 SOPORTE

### Si tienes dudas sobre...
- **Código**: Busca en [MANUAL_COMPLETO.md](MANUAL_COMPLETO.md)
- **Arquitectura**: Ve a [ARQUITECTURA_AVANZADA.md](ARQUITECTURA_AVANZADA.md)
- **Tareas rápidas**: Consulta [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Errores**: Ve a [MANUAL_COMPLETO.md - Troubleshooting](MANUAL_COMPLETO.md#10-troubleshooting)

---

## 📝 NOTAS IMPORTANTES

1. **Este es el punto de partida**: Lee este índice cuando llegues nuevo
2. **Documentación viva**: Se puede mejorar, sugiere cambios
3. **Mantén actualizada**: Cuando agregues features, documenta
4. **Pasa el conocimiento**: Cuando alguien nuevo llegue, comparte estos docs
5. **Todos somos guardianes**: La documentación es responsabilidad colectiva

---

**Última actualización**: Mayo 18, 2026  
**Documento creado por**: Equipo anterior (transición de conocimiento)  
**Para**: Siguientes desarrolladores del proyecto
