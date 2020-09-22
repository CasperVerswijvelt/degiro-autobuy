require("./src/searchproduct")
  .run()
  .catch((reason) => {
    console.error(`Product search script failed, reason: ${reason}`);
  });
