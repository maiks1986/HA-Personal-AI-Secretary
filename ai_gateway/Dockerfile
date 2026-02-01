# Stage 1: Build Frontend (Placeholder - will be implemented soon)
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
# For now, we'll just create a dummy index.html in dist/public
RUN mkdir -p /app/dist/public && echo "<h1>AI Gateway Dashboard</h1>" > /app/dist/public/index.html

# Stage 2: Build Backend
FROM node:20-alpine
RUN apk add --no-cache python3 make g++ git

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Copy dummy frontend (will be replaced by real build later)
COPY --from=build-frontend /app/dist/public ./dist/public

ENV NODE_ENV=production
EXPOSE 5005
CMD ["npm", "start"]
