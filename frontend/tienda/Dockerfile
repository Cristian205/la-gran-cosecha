# La tienda publica: Next.js con render en servidor.
#
# Tres etapas para que la imagen final no lleve ni el codigo fuente ni las
# dependencias de compilacion. La anterior se servia con nginx porque era una
# SPA estatica; esta tiene que ejecutar node en cada visita, que es justo lo que
# hace que el rastreador reciba el catalogo dentro del HTML.

# --- 1. dependencias ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` y no `install`: respeta el lockfile, asi la imagen que se despliega
# lleva exactamente las versiones que se probaron.
RUN npm ci

# --- 2. compilacion ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Solo lo que Next necesita en tiempo de compilacion. La URL del backend y la
# clave del servidor se leen en cada peticion, no se incrustan.
ARG NEXT_PUBLIC_MEDIA_HOST=""
ENV NEXT_PUBLIC_MEDIA_HOST=$NEXT_PUBLIC_MEDIA_HOST
ENV NEXT_TELEMETRY_DISABLED=1
# La salida `standalone` es de esta imagen y de ninguna otra: es lo que copian
# las lineas de abajo. Ver el comentario en `next.config.ts`.
ENV SALIDA_STANDALONE=1
RUN npm run build

# --- 3. lo que se despliega ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Sin privilegios: si alguien encuentra una via de ejecucion, la encuentra
# siendo nadie.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
