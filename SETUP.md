# Qubia Craft — Guía de instalación

## Requisitos
- Node.js 18+
- Una GROQ_API_KEY (console.groq.com)

## Instalación local

```bash
# 1. Entra en la carpeta
cd qubia-craft

# 2. Instala dependencias
npm install

# 3. Crea tu archivo de variables de entorno
cp .env.example .env
# Edita .env y añade tu GROQ_API_KEY (tu clave nunca se sube al repositorio, .env está en .gitignore)

# 4. Arranca en modo desarrollo
npm run dev
```

Abre http://localhost:5173 en el navegador.

## Instalar como app de escritorio (PWA)

1. Abre http://localhost:5173 en Chrome o Edge
2. En la barra de direcciones verás un icono de instalación (⊕ o pantalla con flecha)
3. Haz clic en "Instalar Qubia Craft"
4. La app se abre como ventana independiente sin barra del navegador

## Variables de entorno (.env)

| Variable | Descripción |
|----------|-------------|
| GROQ_API_KEY | API key de Groq (obligatoria) |
| GROQ_VISION_MODEL | Modelo de visión de Groq (por defecto `qwen/qwen3.8-27b`) |
| POLLINATIONS_API_KEY | API key de Pollinations.AI (opcional, para generar imágenes) |
| INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET | App de Meta con "Instagram API with Instagram Login" |
| PUBLIC_URL | URL pública del backend (callback de Instagram e imágenes para Meta) |
| JWT_SECRET | Clave de las sesiones. Obligatoria en producción |
| ALLOW_SIGNUP | `true` / `false`: permitir crear cuentas nuevas |
| INVITE_CODE | Si tiene valor, hace falta para registrarse |
| DATABASE_URL | PostgreSQL en producción. Vacía en local → PGlite (sin instalar nada) |
| PORT | Puerto del servidor (por defecto: 3001) |

## Cuentas de usuario

Cada persona entra con su email y contraseña y tiene **su propio** perfil de
marca, historial, voz aprendida y conexión de Instagram. Nadie ve ni publica
en la cuenta de otra persona.

- La primera cuenta que se crea hereda los datos de la versión anterior
  (perfil, historial y conexión de Instagram guardados en archivos JSON).
  Esos archivos se renombran a `*.migrated`; no se borra nada.
- Mientras la app de Meta esté en modo desarrollo, solo pueden conectar su
  Instagram las cuentas añadidas como evaluadoras en Meta for Developers.

## Adaptar la app a cualquier negocio

Desde **⚙️ Perfil de marca** dentro de la app puedes configurar:

- Nombre, sector, tipo de negocio, ciudad y usuario de Instagram
- Productos o servicios principales
- Tono de comunicación y CTA habitual
- Hashtags propios

Qubia Craft usa el **tipo de negocio** para adaptar el estilo de los captions (inmobiliaria, restaurante, retail, salud/belleza, servicios profesionales, educación, etc.) y aprende de tus ediciones con el tiempo (sección "Voz aprendida"). No hace falta tocar código para reutilizar la app en un negocio distinto: basta con cambiar el perfil de marca.

## Deploy en la nube (Railway)

1. Crea cuenta en railway.app
2. Conecta tu repositorio de GitHub
3. Railway detecta automáticamente Node.js
4. Añade un servicio PostgreSQL y las variables de entorno en el panel de Railway (DATABASE_URL, JWT_SECRET, GROQ_API_KEY…; nunca las subas al repositorio)
5. Ejecuta `npm run build` como build command y `npm start` como start command

La URL de Railway sirve tanto el frontend como la API.
