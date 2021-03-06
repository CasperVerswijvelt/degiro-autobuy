// Each 15th day of the moth at 16:00
const cronExpr = "0 0 16 15 * *";
console.log(
  `Autobuy loop started. Next execution at ${require("cron-parser")
    .parseExpression(cronExpr)
    .next()
    .toString()}`
);
new (require("cron").CronJob)(
  cronExpr,
  () => require("import-fresh")("./start-single"),
  null,
  true,
  "Europe/Brussels"
);
