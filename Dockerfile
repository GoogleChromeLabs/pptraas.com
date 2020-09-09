FROM agoneastus2.azurecr.io/puppeteer:5.2.1

# Copy the app
RUN mkdir /app
COPY . /app/
#COPY local.conf /etc/fonts/local.conf
WORKDIR app
RUN npm i


# Run everything after as non-privileged user.
USER pptruser

EXPOSE 8080
CMD ["npm", "run", "start"]