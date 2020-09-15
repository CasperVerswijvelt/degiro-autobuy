/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.runScript = (req, res) => {
  res.status(200).send("Script started");
  require("./script")
    .run()
    .then(() => (scriptIsRunning = false))
    .catch((reason) => {
      console.log(`Script failed, reason: ${reason}`);
      scriptIsRunning = false;
    });
};
