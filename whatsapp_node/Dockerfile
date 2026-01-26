# Version 1.0.1
ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM $BUILD_FROM

# Install Node.js and build tools (ensure git is present)
RUN apk add --no-cache nodejs npm python3 make g++ git

WORKDIR /app

# Copy package files
COPY package.json .
COPY tsconfig.json .

# Install dependencies
RUN npm install

# Copy source
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose ports
EXPOSE 5002

# Start script
CMD ["npm", "start"]
