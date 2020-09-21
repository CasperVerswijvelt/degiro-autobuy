/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
module.exports.runScript = () => {
  require("./src/autobuy")
    .run()
    .catch((reason) => {
      console.error(`Autobuy script failed, reason: ${reason}`);
    });
};

module.exports.searchProduct = () => {
  require("./src/searchproduct")
    .run()
    .catch((reason) => {
      console.error(`Product search script failed, reason: ${reason}`);
    });
};
