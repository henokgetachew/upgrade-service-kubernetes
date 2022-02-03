FROM node:lts-alpine
LABEL maintainer "Henok G. Alemayehu henok@medic.org"

ENV TIME_ZONE=Etc/UTC

RUN apk --update add tzdata && \
    cp /usr/share/zoneinfo/Etc/UTC /etc/localtime && \
    echo "Etc/UTC" > /etc/timezone && \
    apk del tzdata

WORKDIR /usr/src/app
COPY package.json .
COPY package-lock.json .

RUN npm ci
ADD . /usr/src/app

RUN npm run compile
CMD [ "npm", "start" ]
EXPOSE 5008
