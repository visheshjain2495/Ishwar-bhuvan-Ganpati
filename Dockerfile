# Use official Node.js LTS image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy app source including firebase-service-key.json
COPY . .

# Expose port
EXPOSE 8080

# Start the app
CMD ["node", "index.js"]