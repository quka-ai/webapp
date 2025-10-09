# syntax=docker/dockerfile:1
# Multi-architecture build support for AMD64 and ARM64

FROM --platform=$BUILDPLATFORM node:18-alpine AS build

# Build arguments for multi-architecture support
ARG BUILDPLATFORM
ARG TARGETPLATFORM
ARG BUILDARCH
ARG TARGETARCH

# Build arguments for environment variables
ARG VITE_APP_NAME
ARG VITE_BASE_URL

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies first
RUN npm ci

# Copy source code and environment files
COPY . .

# Install all dependencies for build
RUN npm ci

# Build the project
RUN npm run build-beta && \
    chmod -R 755 /app/dist

# Production stage - Use multi-arch nginx image
FROM --platform=$TARGETPLATFORM nginx:alpine

# Add labels for better image management
LABEL org.opencontainers.image.title="Quka Web Frontend"
LABEL org.opencontainers.image.description="Multi-architecture React web application"
LABEL org.opencontainers.image.vendor="Quka"

# Copy the generated frontend static files to the Nginx default static files directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
#COPY nginx.conf /etc/nginx/nginx.conf

# Configure nginx user for security
# nginx user already exists in nginx:alpine, just modify permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose the Nginx port
EXPOSE 8080

# Health check
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start the Nginx server
CMD ["nginx", "-g", "daemon off;"]