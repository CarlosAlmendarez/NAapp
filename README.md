# Nueva Alianza SLP — Sistema de Captura Electoral

Aplicación interna (no pública) para capturar y administrar casillas
electorales y sus representantes (RC) en San Luis Potosí.

## Stack

- **Next.js 15** (App Router) + TypeScript estricto.
- **PostgreSQL en Neon** + **Prisma** (`prisma@6.19.3` — se fijó esta versión
  estable; Prisma 7 cambió la configuración de datasource a un archivo
  `prisma.config.ts` separado y aún es muy reciente, ver nota al final).
- **Auth.js (NextAuth v5)** con proveedor de Credenciales y **sesiones JWT**
  (ver "Decisiones de seguridad" — Auth.js no admite sesiones de base de
  datos con Credentials; la revocación inmediata se logra con un contador
  `sessionVersion`).
- **Zod** en cada Server Action / Route Handler.
- **Tailwind CSS v4** + componentes propios estilo shadcn/ui, mobile-first.
- **Upstash Redis** (opcional) para rate limiting de login.

## 1. Variables de entorno

Copia `.env.example` a `.env` y llena los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena **pooled** de Neon (host con `-pooler`). Usada en runtime. |
| `DIRECT_URL` | Cadena **directa** de Neon (sin `-pooler`). Usada solo por `prisma migrate`. |
| `AUTH_SECRET` | Genera con `npx auth secret` o `openssl rand -base64 33`. |
| `AUTH_URL` | URL pública de la app (`http://localhost:3000` en local). |
| `AUTH_TRUST_HOST` | `true` (necesario detrás del proxy de Vercel). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Opcionales; sin ellas, el rate limiting de login cae a un modo en memoria **no apto para producción** (ver más abajo). |
| `SEED_ADMIN_NOMBRE` / `SEED_ADMIN_CORREO` / `SEED_ADMIN_PASSWORD` | Datos del primer Administrador general, usados solo por el script de seed. |
| `FIELD_ENCRYPTION_KEY` | Clave AES-256 (base64) para cifrar la clave de elector en reposo. Genera con: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

## 2. Crear el proyecto en Neon

1. Crea un proyecto en [neon.tech](https://neon.tech).
2. En **Connection Details**, copia:
   - La cadena **"Pooled connection"** → `DATABASE_URL`.
   - La cadena **"Direct connection"** → `DIRECT_URL`.
3. (Recomendado, principio de mínimo privilegio) Crea un rol de Postgres
   dedicado a la app con permisos limitados a su propio esquema, en vez de
   usar el rol owner del proyecto de Neon:
   ```sql
   CREATE ROLE nueva_alianza_app WITH LOGIN PASSWORD '...';
   GRANT CONNECT ON DATABASE <tu_db> TO nueva_alianza_app;
   GRANT USAGE, CREATE ON SCHEMA public TO nueva_alianza_app;
   -- Después de correr las migraciones, para que el rol de la app también
   -- pueda leer/escribir las tablas ya creadas:
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nueva_alianza_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nueva_alianza_app;
   ```
   Usa el rol owner (o uno con permiso de `CREATE`/`ALTER TABLE`) solo para
   correr migraciones; usa `nueva_alianza_app` en `DATABASE_URL` de
   producción.

## 3. Instalar dependencias y correr migraciones

```bash
npm install                # también corre `prisma generate` (postinstall)
npm run db:migrate         # crea las tablas contra DIRECT_URL (desarrollo)
```

En producción/CI, usa:

```bash
npm run db:migrate:deploy  # aplica migraciones ya generadas, sin crear nuevas
```

## 4. Catálogo de municipios, casillas y primer Administrador general

`prisma/data/municipios.json` (58 municipios) y `prisma/data/casillas.json`
(3,660 casillas) ya están generados a partir del padrón oficial
`prisma/data/secciones-y-casillas-2024.xlsx` ("SECCIONES Y CASILLAS 2024"),
usando:

```bash
npx tsx scripts/importar-secciones-casillas.ts
```

Vuelve a correr ese comando cuando el INE/el partido publique una versión
actualizada del Excel (por ejemplo, para el siguiente proceso electoral):
sobrescribe `municipios.json` y `casillas.json` con el contenido más
reciente. El importador:

- Toma los nombres de municipio **tal cual** vienen en el Excel (en
  mayúsculas, sin acentos en algunos casos) — no se "corrigen" a mano para
  no arriesgar una transcripción incorrecta del catálogo oficial.
- Resuelve automáticamente filas duplicadas (misma sección + tipo de
  casilla), quedándose con la más completa.
- **Nunca** carga datos de RC (nombre, clave de elector, correo, teléfono)
  aunque el Excel ya los traiga capturados — son datos personales que deben
  entrar cifrados vía la app, no por un script sin cifrar. Si el Excel trae
  filas con eso ya lleno, el importador solo avisa cuántas para revisarlas
  a mano.

Con los JSON ya generados, corre el seed:

```bash
npm run db:seed
```

Esto:
- Carga el catálogo de 58 municipios.
- Crea el primer **Administrador general** a partir de
  `SEED_ADMIN_NOMBRE` / `SEED_ADMIN_CORREO` / `SEED_ADMIN_PASSWORD`
  (por script, **no** por UI — deliberadamente no existe registro público
  en la app).
- Inserta las 3,660 casillas del catálogo real (usa `createMany` con
  `skipDuplicates`, así que es seguro volver a correrlo: nunca duplica ni
  pisa una casilla que un capturador ya haya editado).

**Inicia sesión y cambia esa contraseña de inmediato** desde
"Cambiar contraseña" en el menú de usuario.

Si en algún momento no existe `prisma/data/casillas.json` (por ejemplo, en
un clon nuevo del repo antes de correr el importador), el seed cae de
vuelta a cargar solo un par de casillas de ejemplo desde
`prisma/data/municipios.sample.json`, para poder probar el flujo sin el
archivo real.

## 4.1 Usuarios capturadores por distrito local

El acceso de un Capturador se puede asignar por **municipio** y/o por
**distrito local** (dos dimensiones independientes: un municipio grande
puede estar repartido en varios distritos — San Luis Potosí capital en los
distritos 4 a 8, Soledad de Graciano Sánchez en el 9 y 10 — así que el
sistema filtra las casillas por `OR(municipio asignado, distrito local
asignado)`, nunca asumiendo que un distrito equivale a un conjunto fijo de
municipios).

Para crear un usuario Capturador por cada uno de los 15 distritos locales
(correo `distrito{N}@nuevaalianzaslp.org`, contraseña generada
automáticamente):

```bash
npx tsx scripts/crear-usuarios-por-distrito.ts
```

Es idempotente: si el usuario ya existe no le toca la contraseña ni
duplica su asignación. Las contraseñas nuevas se guardan en
`credenciales-distritos.csv` en la raíz (no se sube a git — ver
`.gitignore`); repártelas por un canal seguro y borra el archivo después.
Cada capturador debe cambiar su contraseña en su primer login.

Para asignar un municipio y/o distrito local a un usuario individual desde
la UI, usa "Usuarios → Nuevo/Editar" — el selector de localidad tiene una
pestaña para municipios y otra para distritos locales; se pueden combinar
ambas para un mismo usuario si hace falta.

## 5. Desarrollo local

```bash
npm run dev
```

## 5.1 Pruebas de responsividad (Playwright)

`tests/responsive.spec.ts` visita las pantallas principales en tres
tamaños (celular 390px, tablet 768px, escritorio 1440px) con los tres
roles (Admin general, Capturador, Representante General) y verifica que:
ninguna página genere scroll horizontal, y que los datos clave (nombre,
correo, rol, localidades, tipo de casilla, distrito, etc.) sigan visibles
en cada tamaño — en vez de quedar ocultos por columnas de tabla que no
caben en una pantalla angosta.

Para correrlas:

```bash
npm run build
npm run start          # deja el server corriendo en :3000 en otra terminal
npm run test:responsive
```

Requiere que ya existan en la base el Administrador general, al menos el
capturador de un distrito (`distrito12@...`) y el usuario RG de prueba
(`npx tsx scripts/crear-usuario-rg-prueba.ts`) — ajusta las credenciales en
`tests/responsive.spec.ts` si tu base tiene otras.

Nota: la primera vez, instala el navegador de Playwright con
`npx playwright install chromium`.

## 6. Primer deploy en Vercel

1. Conecta el repositorio en [vercel.com/new](https://vercel.com/new).
2. En **Environment Variables**, agrega todas las de `.env.example`
   (excepto las `SEED_ADMIN_*`, que solo se usan localmente para el seed).
3. Framework preset: Next.js (detectado automáticamente).
4. Antes del primer deploy exitoso, corre las migraciones contra Neon desde
   tu máquina (o desde un job de CI) apuntando a `DIRECT_URL`:
   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   ```
5. Despliega. `next.config.ts` ya configura los encabezados de seguridad
   (CSP, HSTS, `X-Robots-Tag: noindex`, etc.) — no se requiere configuración
   adicional en Vercel para eso.
6. (Opcional pero recomendado para una herramienta interna) Activa
   **Vercel Password Protection** o **Vercel Access/Trusted IPs** en el
   proyecto (Settings → Deployment Protection) como una capa adicional
   antes del login de la app. Decide con tu equipo si esto es viable dado
   que los capturadores acceden desde el celular en campo (Password
   Protection añade una segunda contraseña compartida; una restricción por
   IP no es realista para captura móvil). Restringir el registro por
   dominio de correo no aplica aquí porque no hay registro público: todas
   las cuentas las crea el Administrador general.

## 7. Backups y restauración (Neon Point-in-Time Restore)

Neon retiene un historial de cambios (ventana según tu plan) que permite
restaurar la base a un momento específico:

1. Panel de Neon → tu proyecto → **Backups / Restore**.
2. Elige la rama (`main`) y la fecha/hora a la que quieres restaurar.
3. Neon crea una **nueva rama** con los datos de ese momento — revisa los
   datos ahí antes de promoverla o de copiar de vuelta lo necesario a la
   rama de producción. No sobrescribe la rama activa automáticamente.

## Estructura relevante

```
prisma/schema.prisma        Modelo de datos
prisma/seed.ts               Seed: municipios + admin general + ejemplos
prisma/data/                 Catálogo de municipios (reemplazar el .sample.json)
src/auth.ts                  Configuración completa de Auth.js (Node.js)
src/auth.config.ts           Configuración "edge-safe" (usada por el middleware)
src/middleware.ts            Verificación gruesa de sesión (redirige a /login)
src/lib/auth-helpers.ts      RBAC real: requireUser/requireRole/requireLocalidadAccess
src/lib/crypto.ts            Cifrado AES-256-GCM de la clave de elector
src/actions/                 Server Actions (mutaciones), todas con Zod + RBAC en servidor
src/app/(app)/               Rutas protegidas (dashboard, casillas, usuarios, estadísticas)
src/app/login/               Login (única puerta de entrada; sin registro público)
```

## Marca

- **Logo**: `public/logo-mark.png` es un recorte cuadrado de
  `assets/branding/logo-original.jpeg` (el archivo tal cual lo entregó el
  partido). Si cambia el logo, reemplaza `logo-original.jpeg` y vuelve a
  recortarlo a la marca cuadrada (o pide que se regenere `logo-mark.png`,
  `src/app/icon.png` y `src/app/favicon.ico`).
- **Colores**: tomados del sitio oficial (nuevaalianzaslp.org, kit de color
  de Elementor) y del logo — ver el comentario al inicio de
  `src/app/globals.css` para el detalle de cada valor y por qué el gris de
  texto y el teal claro de marca **no** se copiaron literalmente (fallan
  contraste de accesibilidad como texto/fondo). El sitio no usa naranja de
  marca, así que se retiró; solo queda un ámbar como color semántico de
  "advertencia", sin relación con la identidad visual.

## Decisiones de seguridad y por qué

- **Prisma sobre Drizzle**: mejor DX (Prisma Studio, migraciones maduras)
  para un equipo que no vive en SQL a diario; funciona bien con el pooled
  connection de Neon en runtime Node.js (las Server Actions/Route Handlers
  de este proyecto corren en Node, no en Edge).
- **Sesiones JWT, no de base de datos**: Auth.js **no admite** sesiones de
  base de datos con el proveedor de Credenciales (es una limitación oficial
  de la librería, no una elección de diseño). Para cumplir igual con
  "cerrar sesión en todos los dispositivos" y que desactivar una cuenta
  surta efecto de inmediato, cada `Usuario` tiene un contador
  `sessionVersion`: se compara contra la BD en **cada** Server Action y
  página protegida (`requireUser()` / `requireUserOrThrow()` en
  `src/lib/auth-helpers.ts`), y se incrementa al desactivar la cuenta, al
  cambiar la contraseña, o al pedir explícitamente "cerrar sesión en todos
  los dispositivos". Esto es más estricto que unas sesiones de BD
  típicas, porque además revalida rol/localidad/estado activo contra la
  BD en cada request (nunca confía en el JWT para eso).
- **RBAC en servidor**: `src/lib/auth-helpers.ts` es el único punto de
  verdad. El middleware (`src/middleware.ts`) solo decide "¿hay sesión?" —
  el rol y la pertenencia de localidad se revalidan siempre contra la base
  de datos dentro de cada Server Action / página, nunca se confía en lo que
  ya filtró la UI.
- **Contraseñas**: `bcryptjs`, 12 rounds. Política mínima: 10+ caracteres,
  mayúscula, minúscula y número (`src/lib/validations/auth.ts`).
- **Rate limiting de login**: 5 intentos **fallidos** / 15 min por
  IP+correo (`src/lib/rate-limit.ts`) — se cuenta solo lo fallido a
  propósito, para no bloquear a alguien que entra y sale de sesión varias
  veces seguidas con la contraseña correcta. Usa Upstash Redis si está
  configurado (compartido entre todas las instancias serverless de
  Vercel). **Sin Upstash configurado, cae a un limitador en memoria de un
  solo proceso — no protege nada en producción con múltiples instancias
  serverless.** Configura Upstash antes de ir a producción.
- **Enumeración de cuentas**: el login siempre responde con el mismo
  mensaje genérico y compara contra un hash "señuelo" cuando el correo no
  existe, para que el tiempo de respuesta no delate si una cuenta existe.
- **Cifrado en reposo de la clave de elector**: AES-256-GCM
  (`src/lib/crypto.ts`), clave en `FIELD_ENCRYPTION_KEY`. Al editar un RC o
  asistente hay que volver a capturar la clave de elector completa (no se
  reenvía la anterior descifrada al formulario), para no exponerla nunca al
  cliente fuera del momento de captura.
- **Auditoría**: `AuditLog` registra quién hizo qué (login, creación,
  edición, desactivación, reseteo de contraseña, cierre forzado de
  sesiones) con IP y timestamp.
- **App no indexable**: `next.config.ts` fuerza `X-Robots-Tag: noindex`
  globalmente y `src/app/robots.ts` bloquea todo rastreo.
- **Encabezados de seguridad**: CSP, `X-Frame-Options: DENY`, HSTS,
  `Referrer-Policy`, `Permissions-Policy` — configurados en
  `next.config.ts`, sin dependencias externas (la CSP no permite CDNs).

## Pendientes que debes configurar tú manualmente

1. ~~Crear el proyecto en Neon y obtener `DATABASE_URL` / `DIRECT_URL`~~ —
   hecho: conectado a `neondb` en Neon, migraciones aplicadas.
2. Crear el rol de Postgres de mínimo privilegio para producción (sección 2,
   opcional pero recomendado) — la app sigue usando el rol owner de Neon
   por ahora.
3. Conectar el repositorio a Vercel y cargar las variables de entorno
   (el repo ya está en GitHub: `CarlosAlmendarez/NAapp`, rama `main`).
4. Crear la base de Upstash Redis y cargar `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN` (recomendado antes de ir a producción; sin
   esto el rate limiting de login no es confiable con múltiples instancias
   serverless).
5. ~~Reemplazar el catálogo de ejemplo por el oficial~~ — hecho: 58
   municipios y 3,660 casillas reales cargados desde
   `SECCIONES Y CASILLAS 2024.xlsx` (ver sección 4).
6. ~~Correr `npm run db:seed`~~ — hecho: primer Administrador general
   creado (`admin@nuevaalianzaslp.org`). **Inicia sesión y cambia esa
   contraseña de inmediato.**
7. ~~Subir el logo oficial~~ — hecho: `public/logo-mark.png` (recorte de
   `assets/branding/logo-original.jpeg`), integrado en el header y el login.
8. Decidir si además se activa Vercel Password Protection u otra capa de
   acceso adicional (sección 6, punto 6) — es una decisión de producto, no
   algo que se pueda preconfigurar sin tu decisión.
9. Activar Dependabot / `npm audit` en CI (por ejemplo, GitHub → Settings →
   Security → Dependabot alerts) — el repo ya está limpio de
   vulnerabilidades conocidas al momento de entregarlo (`npm audit`: 0).

## Nota sobre Prisma 7

Al generar este proyecto, `prisma@latest` resolvía a una versión **7 release
candidate** que mueve `url`/`directUrl` del `schema.prisma` a un archivo
`prisma.config.ts` aparte y requiere pasar un `adapter` al `PrismaClient`.
Por ser un cambio de arquitectura muy reciente y aún no estable, este
proyecto se fijó a **Prisma 6.19.3** (última versión estable con el patrón
de `schema.prisma` documentado y usado en este README). Cuando Prisma 7
salga de RC, migrar implica: mover `datasource.url`/`directUrl` a
`prisma.config.ts`, y pasar un `@prisma/adapter-pg` (o `@prisma/adapter-neon`)
al construir `PrismaClient` en `src/lib/prisma.ts`.
