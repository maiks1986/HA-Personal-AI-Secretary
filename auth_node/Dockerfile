# Stage 1: Build Frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend

# Copy backend shared schemas (needed for frontend prebuild script)
WORKDIR /app
COPY src/shared_schemas.ts ./src/shared_schemas.ts

WORKDIR /app/frontend
# Copy frontend config
COPY frontend/package.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts ./
COPY frontend/tailwind.config.js frontend/postcss.config.js ./
COPY frontend/index.html ./

# Copy src
COPY frontend/src ./src

# Install and Build
RUN npm install
RUN npm run build

# Stage 2: Build Backend & Final Image
FROM node:20-alpine
RUN apk add --no-cache python3 make g++ git

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Copy frontend build to where backend expects it
# Backend index.ts expects: path.join(__dirname, '../frontend/dist')
# If backend is at /app/dist, then it looks at /app/frontend/dist
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
EXPOSE 5006
CMD ["npm", "start"]
