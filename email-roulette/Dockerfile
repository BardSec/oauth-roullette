# syntax=docker/dockerfile:1
FROM node:22-alpine

# Create a non-root user for security
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json ./
RUN npm install --omit=dev

# Copy application code
COPY src/ ./src/
COPY public/ ./public/

# Own files by the app user
RUN chown -R app:app /app
USER app

EXPOSE 3000

CMD ["node", "src/server.js"]
