# Manual de instalación y configuración — SIGE-TdeA

**Versión:** 1.0  
**Fecha:** 4 de noviembre de 2026  
**Repositorio:** https://github.com/AFMG99/SIGE  
**Rama documental:** `docs/manuales-despliegue-sige`

## 1. Propósito

Este manual describe cómo preparar, instalar, configurar, ejecutar y verificar SIGE-TdeA desde un entorno limpio. Está dirigido al personal técnico que mantiene el proyecto y a quien necesite levantar una instancia de desarrollo.

Se distinguen tres escenarios:

1. **Desarrollo local:** Next.js se ejecuta en el equipo del desarrollador y utiliza una base PostgreSQL local o Neon. El motor estadístico Python se ejecuta localmente como CLI cuando se requieren cálculos.
2. **Producción en Vercel:** la aplicación y el motor Python se despliegan como dos servicios Vercel enlazados mediante el binding `LBEN_URL`; PostgreSQL se aloja en Neon.
3. **Ejecución de producción local (prueba):** Next.js se compila y se inicia con `npm run build` y `npm run start`. Este modo no reemplaza el despliegue productivo en Vercel.

> Este procedimiento no requiere instalar Python para navegar por la interfaz o trabajar con los módulos que no invoquen el motor estadístico. Python sí se necesita en desarrollo local para ejecutar los cálculos que usan el motor CLI. En producción, el servicio `engine` se despliega por separado en Vercel y proporciona LBEn, análisis y proyecciones.

## 2. Requisitos de hardware y software

Los valores de hardware son recomendaciones operativas para un entorno de desarrollo; no son límites codificados por la aplicación. Las versiones de bibliotecas Python se expresan como mínimos porque así están declaradas en `python/requirements.txt`.

| Componente | Requisito mínimo | Versión recomendada | Notas |
|---|---|---|---|
| Sistema operativo | Windows 10/11 de 64 bits, Ubuntu Linux o macOS compatible con Node.js | Windows 11 64 bits o Ubuntu 22.04 LTS | No se requieren dispositivos especiales. |
| Hardware | CPU de 2 núcleos, 4 GB RAM y 5 GB libres | CPU de 4 núcleos, 8 GB RAM y 10 GB libres | Recomendación para instalar dependencias, compilar Next.js y ejecutar pruebas. |
| Node.js | 20.x | 22.x LTS | Next.js del proyecto es 14.2.0. El lockfile incluye herramientas de desarrollo que requieren Node 20 o superior. |
| npm | 10.x | npm incluido con Node.js 22 (10.x o superior compatible) | Usar `npm ci` si se desea reproducir exactamente el lockfile; `npm install` si se van a actualizar dependencias. |
| Aplicación web | Next.js 14.2.0, React 18.3.x | Versiones fijadas por `package-lock.json` | No actualizar Next/React de forma aislada sin ejecutar la validación. |
| Base de datos | PostgreSQL 14 o superior | PostgreSQL 16 | También puede usarse Neon PostgreSQL. La conexión se configura mediante `DATABASE_URL`. |
| ORM | Prisma 5.x | Versión resuelta en `package-lock.json` (declaración `^5.12.0`) | `npm run db:generate` y `npm run db:push`. |
| Motor estadístico local | Python 3.12; NumPy ≥1.24, pandas ≥1.5, SciPy ≥1.10, statsmodels ≥0.14 | Python 3.12.x y versiones compatibles instaladas desde `python/requirements.txt` | Solo para cálculos que invocan el motor Python en local. FastAPI ≥0.110 y Uvicorn ≥0.27 se incluyen para el servicio. |
| Git | Git 2.x | Versión estable vigente | Para clonar el repositorio y gestionar ramas. |
| Navegador | Navegador con soporte ES2020 | Chrome o Edge actualizado | También puede utilizarse Firefox actualizado. Se requiere JavaScript y cookies habilitados. |
| Conectividad | Acceso al repositorio, base de datos y proveedores externos requeridos | Conexión estable | La aplicación consulta Neon y, en funciones operativas, Open-Meteo. |

### 2.1. Verificar versiones

En PowerShell, CMD o terminal:

```bash
git --version
node --version
npm --version
python --version
```

Para la base de datos:

```bash
psql --version
```

Python y PostgreSQL pueden omitirse en el equipo del desarrollador si se usa Neon y no se ejecutan cálculos estadísticos locales. En cambio, el entorno de producción debe contar con el servicio `engine` declarado en `vercel.json`.

## 3. Obtener el código fuente

Instale Git y clone el repositorio:

```bash
git clone https://github.com/AFMG99/SIGE.git
cd SIGE
```

Para trabajar sobre la rama de integración del equipo:

```bash
git checkout develop
git pull origin develop
```

Si el equipo define otra rama de trabajo, utilice la rama aprobada por el responsable del repositorio. No desarrolle directamente sobre `main`.

## 4. Preparar la base de datos PostgreSQL

SIGE utiliza PostgreSQL con Prisma ORM. Se puede usar PostgreSQL local o una instancia Neon.

### 4.1. Opción A: PostgreSQL local

1. Instale PostgreSQL 14 o superior (se recomienda PostgreSQL 16).
2. Durante la instalación defina una contraseña segura para el usuario administrador.
3. Cree una base de datos vacía, por ejemplo `sige`.
4. Conserve el host, puerto, nombre de base de datos, usuario y contraseña para construir la cadena de conexión.

Ejemplo de cadena local:

```dotenv
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/sige?schema=public"
```

Sustituya `TU_PASSWORD` por la contraseña real. No incluya esta cadena en commits, capturas públicas ni documentos compartidos.

### 4.2. Opción B: Neon PostgreSQL

1. Cree o seleccione un proyecto PostgreSQL en Neon.
2. Cree una base de datos y un usuario con permisos para crear y modificar el esquema.
3. Copie la cadena de conexión PostgreSQL desde el panel de Neon.
4. Si Neon ofrece una cadena pooled y otra directa, use la que corresponda al entorno y a las operaciones Prisma. Mantenga la cadena proporcionada por Neon y no invente parámetros.
5. Pegue la cadena como valor de `DATABASE_URL` en el archivo local `.env` y en las variables de entorno de Vercel.

La versión exacta del servidor Neon depende de la instancia/proyecto administrado; el repositorio no fija una versión de servidor Neon en el código.

## 5. Configurar las variables de entorno

En la raíz del proyecto existe `.env.example`. Cree una copia local:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Linux/macOS**

```bash
cp .env.example .env
```

Abra `.env` y configure los valores reales:

```dotenv
# PostgreSQL local o Neon
DATABASE_URL="postgresql://USUARIO:CONTRASENA@HOST:5432/BASE_DATOS?schema=public"

# Autenticación
JWT_SECRET="REEMPLAZAR_POR_UN_SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES"
JWT_EXPIRES_IN="7d"

# URL local de la aplicación
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Cifrado de secretos TOTP (32 bytes codificados en Base64)
TOTP_ENCRYPTION_KEY="REEMPLAZAR_POR_32_BYTES_EN_BASE64"

# Secreto del motor Python; en local se utiliza con la configuración que invoque el motor.
LBEN_SECRET="SECRETO_INTERNO_LOCAL"
```

### 5.1. Generar secretos

Generar un JWT secret aleatorio (Node.js):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Generar la clave TOTP AES-256-GCM (32 bytes codificados en Base64), tal como indica `.env.example`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copie cada salida en su variable correspondiente. No reutilice el ejemplo textual ni comparta los valores generados.

### 5.2. Descripción de variables

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL. |
| `JWT_SECRET` | Sí | Secreto de firma/verificación JWT; usar al menos 32 caracteres aleatorios. |
| `JWT_EXPIRES_IN` | No | Vigencia del token; por defecto `7d`. |
| `TOTP_ENCRYPTION_KEY` | Sí para producción/2FA | Clave Base64 que representa exactamente 32 bytes para AES-256-GCM. |
| `NEXT_PUBLIC_APP_URL` | Recomendada | URL base de la aplicación; local `http://localhost:3000`. |
| `NODE_ENV` | Gestionada por el entorno | Usar `development` local; Vercel establece el entorno de despliegue. |
| `LBEN_SECRET` | Sí para motor protegido | Secreto compartido entre `app` y `engine`; debe coincidir en ambos servicios. |
| `LBEN_URL` | Automática en Vercel Services | URL interna que Vercel inyecta mediante el binding declarado en `vercel.json`. No se debe inventar ni exponer al navegador. |
| `PYTHON` | Opcional, solo si el código local lo admite | Ruta al ejecutable Python si el entorno local necesita seleccionarlo explícitamente. Verificar el controlador que invoca el CLI. |

**Importante sobre `LBEN_URL`:** no se debe escribir una URL pública manualmente para el despliegue Vercel. El archivo `vercel.json` declara el binding del servicio `engine` con nombre de variable `LBEN_URL`. `LBEN_SECRET` sí debe configurarse como secreto en los dos servicios con el mismo valor.

El archivo `.env` está excluido del control de versiones. Nunca lo suba a GitHub.

## 6. Instalar dependencias de Node.js

Desde la raíz del repositorio:

```bash
npm ci
```

`npm ci` utiliza el `package-lock.json` y reproduce las versiones resueltas. Si el lockfile no existe o se modificó intencionalmente, utilice `npm install`.

El script `postinstall` del proyecto ejecuta `prisma generate`; posteriormente se puede ejecutar de forma explícita:

```bash
npm run db:generate
```

## 7. Sincronizar el esquema de la base de datos

Asegúrese de que `DATABASE_URL` apunta a la base correcta. Luego ejecute:

```bash
npm run db:push
```

Este comando sincroniza el esquema declarado en `prisma/schema.prisma` con PostgreSQL. El proyecto utiliza el flujo `db push`; no se debe asumir que existen migraciones Prisma administradas con `prisma migrate deploy`.

Regenerar Prisma Client:

```bash
npm run db:generate
```

Para inspeccionar el esquema y los registros:

```bash
npm run db:studio
```

Prisma Studio abre una interfaz de administración local. Úsela con precaución: modificar o borrar registros puede afectar cálculos y relaciones.

## 8. Instalar el motor Python para desarrollo local (opcional)

Este paso es necesario si se ejecutarán localmente las operaciones que llaman al motor estadístico. En producción Vercel despliega el servicio `engine` por separado.

Compruebe que Python 3.12 está instalado:

```bash
python --version
```

Cree un entorno virtual desde la raíz del repositorio:

**Windows PowerShell**

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r python/requirements.txt
```

**Linux/macOS**

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r python/requirements.txt
```

Las dependencias declaradas en `python/requirements.txt` incluyen:

- NumPy ≥ 1.24.0
- pandas ≥ 1.5.0
- SciPy ≥ 1.10.0
- statsmodels ≥ 0.14.0
- FastAPI ≥ 0.110
- Uvicorn ≥ 0.27

La aplicación local utiliza el motor CLI de Python según la configuración de los controladores. No es necesario iniciar Uvicorn para el flujo CLI local. No ejecute el archivo `python/main.py` como si fuera una interfaz de usuario: es el entrypoint HTTP FastAPI del servicio desplegado en Vercel.

## 9. Carga inicial de datos y usuarios

### 9.1. Esquema inicial

El primer paso es `npm run db:push`; esto crea/actualiza las tablas del esquema Prisma, pero **no crea automáticamente edificaciones, facturas ni inventarios institucionales**.

### 9.2. Usuarios iniciales

El repositorio contiene el script `npm run seed:users`, que lee un archivo local `test-users.txt` con líneas en el formato:

```text
correo@dominio.edu.co|ContrasenaSegura|ROL|Nombre Apellido
```

Roles válidos:

- `ADMIN_TI`
- `GESTOR_ENERGETICO`
- `COORD_INFRAESTRUCTURA`
- `DIRECTIVO`
- `COMUNIDAD_UNIVERSITARIA`

El archivo `test-users.txt` está gitignored y no debe publicarse. El script está descrito como cargador temporal de usuarios de prueba; úselo únicamente en una base controlada y con credenciales institucionales autorizadas. No asuma que es el mecanismo de alta de usuarios productivo. Para producción, utilice el proceso de administración de usuarios autorizado por el administrador TI.

El comando es:

```bash
npm run seed:users
```

### 9.3. Catálogos y datos energéticos

Después de crear el usuario autorizado e iniciar sesión:

1. Registre las edificaciones institucionales.
2. Registre los bloques asociados a cada edificación.
3. Registre espacios cuando aplique.
4. Importe las facturas históricas desde archivos institucionales CSV/XLSX.
5. Importe el inventario de equipos eléctricos.
6. Importe las variables operativas por bloque y periodo.
7. Configure la ubicación y calendario operativo, eventos y horarios.
8. Registre los ajustes energéticos pertinentes.
9. Ejecute cálculos de uso y líneas base cuando los datos de entrada estén completos.

No se recomienda ejecutar `npm run db:historico` en producción como carga inicial: el script genera datos sintéticos deterministas para pruebas de cobertura histórica y no representa facturas reales de EPM. Solo debe utilizarse en entornos de prueba autorizados.

## 10. Ejecutar SIGE localmente

Con PostgreSQL accesible, variables configuradas y dependencias instaladas:

```bash
npm run dev
```

Abra en el navegador:

```text
http://localhost:3000
```

Inicie sesión con una cuenta creada por el proceso autorizado. Los roles Administrador TI y Gestor Energético requieren 2FA conforme a la política implementada.

Para detener el servidor, regrese a la terminal y presione `Ctrl + C`.

### 10.1. Ejecutar como build de producción local

```bash
npm run build
npm run start
```

La aplicación se inicia con Next.js en modo producción (por defecto, puerto 3000). Este procedimiento valida el build de la aplicación; no despliega automáticamente los servicios Vercel ni reemplaza la configuración del servicio Python.

## 11. Despliegue en Vercel (producción)

La configuración del repositorio define dos servicios dentro de `vercel.json`:

- `app`: aplicación Next.js, raíz `.`.
- `engine`: servicio Python/FastAPI, raíz `python`, entrypoint `main:app`.

El binding del servicio `engine` expone su URL interna a `app` mediante `LBEN_URL`. El motor valida el encabezado interno `x-lben-key` contra `LBEN_SECRET`.

### 11.1. Preparar Neon

1. Cree/seleccione la base PostgreSQL de producción en Neon.
2. Configure una cadena de conexión válida para `DATABASE_URL`.
3. Haga una copia de seguridad antes de sincronizar cambios de esquema.
4. Confirme que la base corresponde al entorno productivo y no a pruebas.

### 11.2. Conectar GitHub con Vercel

1. Ingrese a Vercel con una cuenta autorizada.
2. Importe el repositorio `AFMG99/SIGE` desde GitHub.
3. Compruebe que el proyecto detecte el archivo `vercel.json` y la configuración de los servicios.
4. Mantenga la raíz de `app` en `.` y la raíz de `engine` en `python`, tal como se declara en el repositorio.
5. No cree un segundo proyecto independiente para el motor si se está utilizando la configuración Vercel Services declarada por el proyecto.
6. Seleccione la rama de producción aprobada por el equipo.

La disponibilidad y las opciones exactas de Vercel Services dependen del plan y de la configuración vigente de la cuenta. Si Vercel no reconoce el bloque `services`, no sustituya silenciosamente la arquitectura: revise la compatibilidad del proyecto/plan y la configuración de plataforma antes de publicar.

### 11.3. Variables en Vercel

Configure en el panel de variables de entorno:

**Servicio app**
- `DATABASE_URL`
- `JWT_SECRET`
- `TOTP_ENCRYPTION_KEY`
- `JWT_EXPIRES_IN` (opcional)
- `LBEN_SECRET`
- Otras variables efectivamente leídas por el código en el entorno desplegado.

**Servicio engine**
- `LBEN_SECRET` con exactamente el mismo valor configurado para `app`.

**Binding**
- `LBEN_URL` debe ser generado por el binding de servicio declarado en `vercel.json`; no copiarlo desde una URL pública ni exponerlo al cliente.

Utilice valores diferentes para desarrollo, preview y producción. No copie secretos de producción en equipos de desarrollo.

### 11.4. Sincronizar esquema en producción

Antes de publicar una versión que modifica Prisma:

1. Revise el diff de `prisma/schema.prisma`.
2. Realice respaldo de la base.
3. Ejecute el procedimiento aprobado para sincronizar el esquema contra la base de producción:

```bash
npm run db:push
```

Ejecute este comando desde un entorno seguro con `DATABASE_URL` apuntando a producción. No lo ejecute contra una base distinta por error. Después regenere y valide el cliente en el proceso de build.

### 11.5. Desplegar y verificar

1. Envíe los cambios a la rama aprobada.
2. Verifique que CI complete lint, typecheck, pruebas y build.
3. Revise el despliegue generado por Vercel.
4. Compruebe que la URL pública de la aplicación carga por HTTPS.
5. Inicie sesión con un usuario autorizado.
6. Verifique una consulta de datos que lea PostgreSQL.
7. Verifique una operación que invoque el motor Python (por ejemplo, cálculo LBEn) con datos de prueba controlados.
8. Revise los logs de `app` y `engine` en Vercel si una operación falla.
9. Confirme que los secretos no aparecen en logs ni respuestas del navegador.

El workflow CD del repositorio se documenta como preparado con placeholders para Vercel; por ello, no debe asumirse que GitHub Actions publica producción automáticamente sin comprobar los secretos y la integración real de Vercel.

## 12. Validación técnica

Antes de integrar cambios o publicar:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run build-storybook
```

También puede ejecutarse el comando agregado:

```bash
npm run validate
```

Para comprobar que Python puede importar sus dependencias desde la raíz del proyecto:

```bash
python -c "import numpy, pandas, scipy, statsmodels, fastapi; print('Motor Python: dependencias disponibles')"
```

No se debe afirmar que el despliegue está validado solo porque la compilación local termina correctamente. También debe probarse la comunicación real entre `app`, `engine` y PostgreSQL en el entorno de destino.

## 13. Problemas frecuentes

| Problema | Causa probable | Solución |
|---|---|---|
| `Can't reach database server` | URL incorrecta, base pausada o conectividad | Verifique `DATABASE_URL`, host, credenciales y estado de Neon/PostgreSQL. |
| Prisma indica columna inexistente | Esquema de BD desactualizado | Revise el schema y ejecute `npm run db:push` contra la base correcta. |
| Prisma Client no está generado | No se ejecutó postinstall o cambió schema | Ejecute `npm run db:generate`. |
| Error al instalar paquetes Node | Versión de Node incompatible o lockfile alterado | Use Node 20 o superior; pruebe `npm ci`. |
| Error importando NumPy/pandas | Entorno virtual no activado o dependencias ausentes | Active `.venv` e instale `python/requirements.txt`. |
| Falla el cálculo Python en local | Python no está instalado o el ejecutable no está disponible para el proceso Node | Instale Python 3.12, active/configure el entorno según el controlador y revise PATH. |
| Engine devuelve 503 | `LBEN_SECRET` no está configurado en el servicio | Configure el secreto en el servicio engine. |
| Engine devuelve 403 | `x-lben-key` no coincide con `LBEN_SECRET` | Configure el mismo secreto en app y engine; no lo exponga al navegador. |
| `LBEN_URL` no existe | Binding Vercel Services no aplicado | Revise `vercel.json` y la configuración de servicios del proyecto. |
| Login no funciona tras desplegar | JWT secret ausente/inconsistente o datos de usuario no creados | Revise `JWT_SECRET`, base de datos y proceso autorizado de creación de usuario. |
| 2FA falla | Clave de cifrado no válida o dispositivo fuera de sincronización | Verifique `TOTP_ENCRYPTION_KEY` y el reloj del dispositivo; escale recuperación al administrador. |

## 14. Seguridad y mantenimiento

- No subir `.env`, archivos de contraseñas ni secretos al repositorio.
- No reutilizar claves entre local, preview y producción.
- Restringir los permisos de Neon y Vercel a responsables autorizados.
- Respaldar la base de datos antes de cambios de esquema o cargas masivas.
- No usar datos sintéticos como datos institucionales reales.
- Mantener actualizados Node.js, dependencias y runtimes conforme a la compatibilidad comprobada.
- No exponer el servicio interno `engine` ni el encabezado `x-lben-key` en el navegador.
- Ejecutar pruebas y revisión de logs después de cada despliegue.

## 15. Archivos de referencia

- [README.md](../README.md)
- [package.json](../package.json)
- [package-lock.json](../package-lock.json)
- [.env.example](../.env.example)
- [vercel.json](../vercel.json)
- [prisma/schema.prisma](../prisma/schema.prisma)
- [python/requirements.txt](../python/requirements.txt)
- [python/main.py](../python/main.py)
- [scripts/seed-users.mjs](../scripts/seed-users.mjs)
- [scripts/llenar-historico.mjs](../scripts/llenar-historico.mjs)
- [Diagrama de despliegue](./diagrama_despliegue_sige.md)

---
**Fin del manual de instalación.**
