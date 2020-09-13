import DeGiro from "degiro-api";

console.log(DeGiro);
// Degiro init
const degiro = new DeGiro.default({
  username: "",
  pwd: "",
});

const minCashInvest = 1;
const cashCurrency = "EUR";
const ratios = [
  {
    symbol: "IWDA",
    ratio: 88 / 100,
  },
];

async function start() {
  const accountData = await degiro.login();
  const cash = (await degiro.getCashFunds()).filter(
    (type) => type.currencyCode === cashCurrency
  )[0].value;

  if (cash >= minCashInvest) {
    portfolio = await degiro.getPortfolio({
      type: PORTFOLIO_POSITIONS_TYPE_ENUM.ALL,
      getProductDetails: true,
    });
    console.log(portfolio);
  }
}

start();
