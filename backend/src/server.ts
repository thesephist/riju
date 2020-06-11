"use strict";

import * as fs from "fs";
import * as https from "https";

import * as appRoot from "app-root-path";
import * as express from "express";
import { Request } from "express";
import * as ws from "express-ws";

import * as api from "./api";
import { langs } from "./langs";

const host = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT) || 6119;
const useTLS = process.env.TLS ? true : false;

const app = ws(express()).app;

app.set("query parser", (qs: string) => new URLSearchParams(qs));
app.set("view engine", "ejs");

function getQueryParams(req: Request): URLSearchParams {
  // This is safe because we set the query parser for Express to
  // return URLSearchParams objects.
  return (req.query as unknown) as URLSearchParams;
}

app.use((req, res, next) => {
  if (useTLS && req.headers["x-forwarded-proto"] !== "https") {
    res.redirect(301, "https://" + req.hostname + req.originalUrl);
  } else {
    next();
  }
});
app.get("/", (_, res) => {
  res.render(appRoot.path + "/frontend/pages/index", { langs });
});
app.get("/:lang", (req, res) => {
  if (langs[req.params.lang]) {
    res.render(appRoot.path + "/frontend/pages/app", {
      name: langs[req.params.lang].name,
    });
  } else {
    res.send(`No such language: ${req.params.lang}`);
  }
});
app.use("/css", express.static(appRoot.path + "/frontend/styles"));
app.use("/js", express.static(appRoot.path + "/frontend/out"));
app.ws("/api/v1/ws", (ws, req) => {
  const lang = getQueryParams(req).get("lang");
  if (!lang) {
    ws.send(
      JSON.stringify({ event: "error", errorMessage: "No language specified" })
    );
    ws.close();
  } else if (!langs[lang]) {
    ws.send(
      JSON.stringify({
        event: "error",
        errorMessage: `No such language: ${lang}`,
      })
    );
    ws.close();
  } else {
    new api.Session(ws, getQueryParams(req).get("lang"));
  }
});

const secureApp = useTLS
  ? https.createServer(
      {
        key: Buffer.from(process.env.TLS_PRIVATE_KEY, "base64").toString(
          "ascii"
        ),
        cert: Buffer.from(process.env.TLS_CERTIFICATE, "base64").toString(
          "ascii"
        ),
      },
      app
    )
  : app;

secureApp.listen(port, host, () =>
  console.log(`Listening on http://${host}:${port}`)
);
