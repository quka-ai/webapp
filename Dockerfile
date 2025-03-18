FROM node:18-alpine AS build

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

RUN npm install

COPY . .

# Build the project
RUN npm run build-beta
RUN chmod -R 755 /app/dist

# Use Nginx as the production image
FROM nginx:alpine

# Copy the generated frontend static files to the Nginx default static files directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the custom Nginx configuration file (optional)
# If you have a custom nginx.conf file, you can copy it in here
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose the Nginx port
EXPOSE 80

# Start the Nginx server
CMD ["nginx", "-g", "daemon off;"]