FROM node:17.2.0-alpine3.12
LABEL maintainer "Henok G. Alemayehu henok@medic.org"

# is this timezone change required? How come it's set for Addis_Ababa?
ENV TIME_ZONE=Africa/Addis_Ababa

RUN apk --update add tzdata && \
    cp /usr/share/zoneinfo/Africa/Addis_Ababa /etc/localtime && \
    echo "Africa/Addis_Ababa" > /etc/timezone && \
    apk del tzdata

WORKDIR /usr/src/app
COPY package.json .

# please always use npm ci to make sure we don't end up with different dependencies in production
RUN npm install
ADD . /usr/src/app

RUN npm run compile
CMD [ "npm", "start" ]
EXPOSE 5008
