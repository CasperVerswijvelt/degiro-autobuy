/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.runScript = async () => {
  await require("./src/autobuy")
    .run()
    .catch((error) => {
      console.error(`Autobuy script failed`, error);
      throw error;
    });
};
