# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install deps
COPY package*.json ./
RUN npm install --frozen-lockfile

# Copy source
COPY tsconfig*.json ./
COPY src ./src

# Build
RUN npm run build

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

# Copy package files for production deps only
COPY package*.json ./
RUN npm install --production --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3001

# Run the app
CMD ["node", "dist/main.js"]
