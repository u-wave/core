# This Dockerfile relies on Redis and MongoDB servers being available.
# Environment variables must be provided from the outside, eg. using docker-compose.
# Do `docker container run $THIS_IMAGE --help` to see the list.

FROM node:14-alpine

WORKDIR /u-wave-core

COPY package.json /u-wave-core
RUN npm install --prod

ENV NODE_ENV=production
COPY . /u-wave-core

CMD ["node", "bin/u-wave-core"]
