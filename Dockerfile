# Build stage
FROM node:22 as builder
WORKDIR /build
COPY package*.json .
RUN npm install
COPY src src
COPY assets assets
COPY process.yml process.yml
COPY tsconfig.json tsconfig.json
COPY swagger_output.json swagger_output.json
COPY serviceAccKey.json serviceAccKey.json
RUN npm run build

# Production stage
FROM node:22-slim as runner
WORKDIR /app

# Copy built files
COPY --from=builder build/package*.json .
COPY --from=builder build/node_modules node_modules/
COPY --from=builder build/dist dist/
COPY --from=builder build/assets assets/
COPY --from=builder build/serviceAccKey.json serviceAccKey.json

# Environment variables will be set in Railway dashboard (not hardcoded here)
ENV NODE_ENV=production
ENV PORT=5050

EXPOSE 5050
CMD ["npm", "start"]
