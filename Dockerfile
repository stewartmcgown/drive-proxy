FROM node:alpine

RUN yarn

RUN yarn build

CMD ["node build/src/main.js"]