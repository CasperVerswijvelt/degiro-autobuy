const script = require("./script");

const express = require("express");

const app = express();
const port = process.env.PORT ? process.env.PORT : 8080;

let scriptIsRunning = false;

// Express routes
app.get("/", (req, res) => {
  let html = `<a href ="/run">Run</a>`;
  if (scriptIsRunning) html += `<p>Script is running</p>`;
  res.send(html);
});

app.get("/run", (req, res) => {
  if (!scriptIsRunning) {
    scriptIsRunning = true;
    script
      .run()
      .then(() => (scriptIsRunning = false))
      .catch((reason) => {
        console.log(`Script failed, reason: ${reason}`);
        scriptIsRunning = false;
      });
    res.send(`<a href ="/run">Run</a> <p>Script started</p>`);
  } else {
    res.send(`<a href ="/run">Run</a> <p>Script was already running</p>`);
  }
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
