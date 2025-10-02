# Purpose: runtime image. Git is required by Shopify CLI; ts-node runs TS directly.
FROM node:bookworm
WORKDIR /workspace
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates wget && rm -rf /var/lib/apt/lists/*

# Install Litestream
RUN wget -qO- https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz | tar xz -C /usr/local/bin litestream

RUN npm install -g --no-audit --no-fund ts-node
ENV NODE_ENV=production