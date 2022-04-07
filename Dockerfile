FROM node:17.7.2-alpine3.15
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
ADD ./src /usr/src/app

CMD [ "npm", "start" ]
EXPOSE 5008
