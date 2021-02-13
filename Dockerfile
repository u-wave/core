# This Dockerfile relies on Redis and MongoDB servers being available.
# Environment variables must be provided from the outside, eg. using docker-compose.
# Do `docker container run $THIS_IMAGE --help` to see the list.

FROM node:current-alpine
ADD . /u-wave-core
WORKDIR /u-wave-core
RUN npm install --prod
ENV NODE_ENV=production
CMD ["node", "bin/u-wave-core"]
