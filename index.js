/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.runScript = async () => {
  await require("./src/autobuy")
    .run()
    .catch((reason) => {
      console.error(`Autobuy script failed, reason: ${JSON.stringify(reason)}`);
    });
};
