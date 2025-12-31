# AstroShrine Backend - Railway Deployment
# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY src ./src
COPY assets ./assets
COPY tsconfig.json ./
COPY swagger_output.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine as runner

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/swagger_output.json ./

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

# Set environment
ENV NODE_ENV=production
ENV PORT=5050
ENV GOOGLE_APPLICATION_CREDENTIALS=serviceAccKey.json

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5050/health-check || exit 1

# Start command (uses startup script to create Firebase credentials file)
CMD ["./start.sh"]
