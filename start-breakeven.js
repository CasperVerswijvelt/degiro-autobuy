require("./src/breakeven")
  .run()
  .catch((reason) => {
    console.error(`Breakeven script failed, reason: ${reason}`);
  });
