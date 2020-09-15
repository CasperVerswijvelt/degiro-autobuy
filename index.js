const e = require("express");

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.runScript = (_req, res) => {
  res.status(200).send("Script started");
  require("./script")
    .run()
    .catch((reason) => {
      console.err(`Script failed, reason: ${reason}`);
    });
};
