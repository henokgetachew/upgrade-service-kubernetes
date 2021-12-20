FROM node:17.2.0-alpine3.12
LABEL maintainer "Henok G. Alemayehu henok@medic.org"

ENV TIME_ZONE=Africa/Addis_Ababa

RUN apk --update add tzdata && \
    cp /usr/share/zoneinfo/Africa/Addis_Ababa /etc/localtime && \
    echo "Africa/Addis_Ababa" > /etc/timezone && \
    apk del tzdata

WORKDIR /usr/src/app
COPY package.json .

RUN npm install
ADD . /usr/src/app

RUN npm run compile
CMD [ "npm", "start" ]
EXPOSE 5008
