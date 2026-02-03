# Stage 1: Build Frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
COPY src/shared_schemas.ts ../src/
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine
RUN apk add --no-cache python3 make g++ git

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Copy real built frontend
COPY --from=build-frontend /app/dist/public ./dist/public

ENV NODE_ENV=production
EXPOSE 5005
CMD ["npm", "start"]
