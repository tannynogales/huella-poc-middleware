// server.js
const express = require("express");
const { UareU } = require("uareu-node");
const WebSocket = require("ws");

const app = express();
const port = 4000;
const wss = new WebSocket.Server({ port: 4001 });

app.get("/status", (_, res) => res.send("Middleware OK"));

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");
  const reader = new UareU();

  reader
    .open()
    .then(() => {
      console.log("Scanner ready, waiting for fingerprint...");
      return reader.capture();
    })
    .then((img) => {
      console.log("Fingerprint captured");
      ws.send(
        JSON.stringify({
          event: "finger-captured",
          data: img.toString("base64"), // Send as base64 for easy display
        })
      );
    })
    .catch((err) => {
      ws.send(JSON.stringify({ event: "error", message: err.message }));
    })
    .finally(() => reader.close());
});

app.listen(port, () => {
  console.log(`Middleware running at http://localhost:${port}`);
  console.log(`WebSocket server at ws://localhost:4001`);
});
