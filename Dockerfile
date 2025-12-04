ARG NODE_VERSION=24.11.0

FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /usr/src/app

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
ARG BASE_HREF=/
ENV BASE_HREF=${BASE_HREF}
RUN npm run build -- --base-href=${BASE_HREF}

FROM nginx:stable-alpine AS runtime

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /usr/src/app/dist/log-chaos-visualizer/browser /usr/share/nginx/html

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
