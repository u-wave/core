FROM node:14-buster
ENV SERVER /usr/src/u-wave
WORKDIR $SERVER/
COPY package.json $SERVER/
RUN yarn
COPY index.js $SERVER/
