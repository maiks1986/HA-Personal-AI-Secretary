FROM node:20-alpine

# Install build tools and git (needed for some npm packages)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Expose the API port
EXPOSE 5002

# Run the compiled code
CMD ["npm", "start"]