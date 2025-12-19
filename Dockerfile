FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy .env.local if it exists (optional, since we set ENV below)
COPY . .

# Set the environment variable for the build and runtime
ENV NEXT_PUBLIC_BASE_PATH=/wfh-timein

# Build the app
RUN npm run build

EXPOSE 3002

CMD ["npm", "run", "start", "--", "-p", "3002"]
