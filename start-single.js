require("./src/autobuy")
  .run()
  .catch((reason) => {
    console.error(`Autobuy script failed, reason: ${reason}`);
  });
