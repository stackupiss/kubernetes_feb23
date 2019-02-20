FROM node:latest

ENV APP_DIR=/app APP_PORT=3000

WORKDIR ${APP_DIR}

ADD main.js .
ADD package.json .
ADD package-lock.json .

#ADD angular angular
ADD public public
ADD views views
ADD config config

RUN npm install

HEALTHCHECK --interval=15s --timeout=5s \
	CMD curl -f http://localhost:${APP_PORT}/health || exit 1

ENTRYPOINT [ "node", "main.js" ]

CMD [ "" ]
