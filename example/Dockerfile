FROM node:12-stretch
ENV SERVER /usr/src/u-wave
WORKDIR $SERVER/
COPY package.json $SERVER/
RUN yarn
COPY index.js $SERVER/