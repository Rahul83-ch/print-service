# Multi-stage build process for the React frontend dashboard
# Stage 1: Fast Node production builder
FROM node:20-alpine AS build
WORKDIR /app

# Copy package and package-lock files
COPY package*.json ./

# Install pristine dependencies 
RUN npm ci

# Copy TS resources, bundler assets and styling structures
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ src/
COPY assets/ assets/

# Trigger Vite distribution compiler (produces optimized bundle in /app/dist)
RUN npm run build

# Stage 2: Serve using enterprise-grade Nginx Web Server
FROM nginx:alpine

# Copy our custom server rules to facilitate SPA dynamic routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Mount compiled assets onto Nginx standard deployment folder
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]