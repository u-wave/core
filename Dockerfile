# This Dockerfile relies on Redis and SQLite databases being available.
# Environment variables must be provided from the outside, eg. using docker-compose.
# Do `docker container run $THIS_IMAGE --help` to see the list.

FROM node:24-alpine

WORKDIR /u-wave-core

COPY package.json /u-wave-core
RUN npm install --omit=dev

ENV NODE_ENV=production
COPY . /u-wave-core

EXPOSE 6042
CMD ["node", "bin/u-wave-core"]
