# Stage 1: Build the React Application
FROM --platform=linux/amd64 node:22-alpine AS build-stage

WORKDIR /app

# Accept API URL at build time so Vite can bake it into the bundle
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve compiled static files with Nginx
FROM --platform=linux/amd64 nginx:alpine

# Copy built files from build-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy custom Nginx config with SPA routing + API proxy support
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose Nginx port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
