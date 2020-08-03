FROM node:alpine

RUN yarn

RUN yard build

CMD ["node build/src/main.js"]