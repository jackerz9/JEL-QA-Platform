# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Install backend deps
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy backend source
COPY src/ ./src/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create uploads dir
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "src/index.js"]
