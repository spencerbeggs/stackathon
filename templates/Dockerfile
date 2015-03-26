# Pull base image.
FROM dockerfile/nodejs

# Define working directory
WORKDIR /home/{{adminUsername}}/webapp

# Add project files
ADD webapp /home/{{adminUsername}}/webapp

# Set NODE_ENV to production
ENV NODE_ENV production

# Install required modules
RUN NODE_ENV=development npm install

# Expose the port for incoming connections
EXPOSE 80

# Define default command.
CMD [ "npm", "start" ]
