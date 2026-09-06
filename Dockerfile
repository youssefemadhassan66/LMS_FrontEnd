FROM node:alpine3.24 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_API_BASE=https://localhost:3000
ENV VITE_SOCKET_URL=https://localhost:3000
RUN npm run build


# ---- Serve stage ----
FROM nginx:alpine3.24
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
