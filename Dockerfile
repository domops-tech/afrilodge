# syntax=docker/dockerfile:1
#
# Image de production pour Afrilodge (Next.js 16 standalone + Prisma 7).
# Voir vd-platform/templates/app/Dockerfile.next pour le gabarit générique
# dont ce fichier est dérivé, et docs/agile/decisions/0001-tech-stack.md
# pour les contraintes propres à Prisma 7 (client sans moteur binaire côté
# requêtes, via @prisma/adapter-pg — voir .agents/skills/prisma-upgrade-v7/).
#
# Un seul tag sert deux usages, distingués par la commande du service
# compose : "app" lance server.js, "migrate" lance `prisma migrate deploy`.
# D'où la présence du CLI `prisma` (habituellement une devDependency, donc
# absente d'un standalone build) dans l'étage `runner` — voir plus bas.
#
# La même image sert aussi, hors compose, les trois tâches planifiées du
# README (verifications:expire, bookings:expire-holds, storage:setup) : ce
# sont des scripts `tsx scripts/*.ts` qui importent le client Prisma généré
# et des modules de src/lib/ par CHEMIN RELATIF (../src/...), pas par le
# bundle Next.js standalone — output: "standalone" ne trace que ce que
# next/server importe, pas ces scripts, exécutés en dehors de tout contexte
# Next. D'où tsx en plus de prisma, et src/ + scripts/ copiés en plus du
# strict nécessaire au serveur lui-même.

ARG NODE_VERSION=24-alpine

# ---------------------------------------------------------------------------
# deps — dépendances complètes (dev incluses), pour générer le client Prisma
# et construire l'application.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — génère le client Prisma puis construit Next.js en mode
# standalone. Next.js fige les variables NEXT_PUBLIC_* à la compilation :
# NEXT_PUBLIC_IMAGES_CDN_URL doit donc être un ARG de build, pas une
# variable d'exécution (voir next.config.ts et
# src/lib/storage/public-url.ts).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_IMAGES_CDN_URL
ENV NEXT_PUBLIC_IMAGES_CDN_URL=${NEXT_PUBLIC_IMAGES_CDN_URL}
# DATABASE_URL n'a besoin d'être que syntaxiquement valide ici : `prisma
# generate` ne se connecte pas à la base, il lit seulement le schéma.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# runner — image de production. Reçoit les fichiers tracés par
# `output: "standalone"`, plus le nécessaire à `prisma migrate deploy` et
# aux trois scripts `tsx` du README (verifications:expire,
# bookings:expire-holds, storage:setup) : tsx et prisma eux-mêmes
# (devDependencies, absentes du traçage standalone), le schéma/les
# migrations, et src/ + scripts/ (2,4 Mo — TypeScript source, sans
# node_modules).
#
# Une première version installait seulement tsx+prisma via `npm install
# <pkg>` dans un répertoire isolé — insuffisant : ces scripts importent
# src/lib/storage/client.ts par CHEMIN RELATIF, en dehors de tout bundle
# Next.js, et ce fichier utilise @aws-sdk/s3-request-presigner, absent du
# traçage standalone (l'app elle-même s'en sort : Next l'inline dans le
# chunk compilé de la route qui l'appelle — un require() Node brut, lui,
# ne trouve rien). Deviner au cas par cas quelle dépendance transitive
# manque à chaque script est un jeu perdu d'avance : on copie donc
# directement le node_modules COMPLET de l'étage `deps` (npm ci avec
# devDependencies, versions verrouillées par package-lock.json — la même
# arborescence qui a servi à `next build` et `prisma generate`) dans
# /opt/tools, exposé en repli via NODE_PATH/PATH sans toucher à
# /app/node_modules, qui reste la version allégée servie par server.js.
# Coût : l'image gagne l'équivalent d'un node_modules complet (disque
# uniquement — un serveur à 66 Go de disque et 3,7 Go de RAM sans swap a
# largement la marge disque, pas la marge mémoire, et rien ici n'est
# chargé en RAM tant qu'un script ne s'exécute pas).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NODE_PATH=/opt/tools/node_modules
ENV PATH="/opt/tools/node_modules/.bin:${PATH}"

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

RUN mkdir -p /opt/tools
COPY --from=deps /app/node_modules /opt/tools/node_modules

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/messages ./messages

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
