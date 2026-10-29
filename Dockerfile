# syntax=docker/dockerfile:1.7
# KI LEGENDS — obraz produkcyjny na własny VPS (Docker / Coolify).
# Dwa obrazy z jednego pliku:
#   target "app" — serwer Node.js 22 (TanStack Start, SSR, funkcje serwera), port 3000
#   target "web" — Caddy: grafiki, dźwięki i paczki gry (Range/206, ETag, kompresja) + proxy do "app", port 80
# Phaser, Three.js i cała gra działają w przeglądarce; serwer tylko podaje pliki i obsługuje /test oraz SSR.

ARG NODE_IMAGE=node:22-bookworm-slim
ARG CADDY_IMAGE=caddy:2-alpine

# ---------- zależności (te same wersje co w CI GitHub: npm ci + package-lock.json) ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV CI=1 NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- budowanie ----------
FROM deps AS build
COPY . .
# Okładka strony głównej i tło /test były dotąd podawane przez hosting Lovable (/__l5e/...).
# Kopie leżą w deploy/overlay i trafiają do public/ pod tym samym adresem — bez zmiany kodu gry.
# Obrazy NIE są generowane w buildzie: muszą leżeć w deploy/overlay/public i mieć sumy z deploy/overlay/SHA256SUMS.
RUN cd deploy/overlay/public 2>/dev/null && sha256sum -c ../SHA256SUMS \
    || (echo "BŁĄD: brak lub zła suma obrazów w deploy/overlay/public (cover.png, test-background.png)." >&2; \
        echo "Skopiuj je z pakietu: ki-legends-source/deploy/overlay/public/ (lista: deploy/overlay/SHA256SUMS)." >&2; exit 1)
RUN cp -r deploy/overlay/public/. public/
# Adres backendu i klucz publiczny są wbudowywane w kod przeglądarki podczas budowania.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID=""
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY} \
    VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID} \
    NITRO_PRESET=node-server \
    NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=4096
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" \
    || (echo "BŁĄD: ustaw build args VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY" >&2; exit 1)
RUN npx vite build \
 && node -e "const p=require('./.output/nitro.json').preset; if(p!=='node-server'){console.error('Zły preset: '+p);process.exit(1)}" \
 && test -f .output/public/__l5e/assets-v1/025eb219-7762-413d-996d-135177dfb346/cover.png \
 && test -f .output/public/__l5e/assets-v1/f594fa76-0e3c-43c4-8313-b7b7ccf85a4c/test-background.png

# ---------- serwer Node.js ----------
FROM ${NODE_IMAGE} AS app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]

# ---------- Caddy (pliki statyczne + proxy) ----------
FROM ${CADDY_IMAGE} AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/.output/public /srv/public
ENV APP_UPSTREAM=app:3000 KI_TEST_PAGE=enabled KI_INDEXING=allow
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
