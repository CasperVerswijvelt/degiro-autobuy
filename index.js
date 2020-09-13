const DeGiroModule = require("degiro-api");
const { DeGiroSort } = require("degiro-api/dist/enums");

const DeGiro = DeGiroModule.default;
const DeGiroEnums = DeGiroModule.DeGiroEnums;
const DeGiroTypes = DeGiroModule.DeGiroTypes;

const {
  DeGiroProducTypes,
  PORTFOLIO_POSITIONS_TYPE_ENUM,
  DeGiroActions,
  DeGiroMarketOrderTypes,
  DeGiroTimeTypes,
} = DeGiroEnums;

// Degiro init
const degiro = new DeGiro();

const minCashInvest = 1;
const maxCashInvest = 1000;
const cashCurrency = "EUR";
const ratios = [
  {
    symbol: "EMIM",
    isin: "IE00BKM4GZ66",
    ratio: 12 / 100,
    exchangeId: 200,
    onlyBuyWhenFree: false,
  },
  {
    symbol: "IWDA",
    isin: "IE00B4L5Y983",
    ratio: 88 / 100,
    exchangeId: 200,
    onlyBuyWhenFree: true,
  },
];
const preferredExchange = "EAM";

async function start() {
  // Login
  const accountData = await degiro.login();

  // Get cash funds
  const cash = (await degiro.getCashFunds()).filter(
    (type) => type.currencyCode === cashCurrency
  )[0].value;

  // If cash funds is high enough -> continue
  if (cash >= minCashInvest) {
    // Get portfolio
    portfolio = await degiro.getPortfolio({
      type: PORTFOLIO_POSITIONS_TYPE_ENUM.ALL,
      getProductDetails: true,
    });

    // Filter ETF's
    const etfs = portfolio.filter(
      (el) =>
        el.positionType === "PRODUCT" &&
        el.productData &&
        el.productData.productTypeId === DeGiroProducTypes.etfs
    );

    // Get total value of all ETF's in portfolio
    const totalETFValue = getTotalValue(etfs);

    // Loop over wanted etfs, see if ratio is below wanted ratio
    for (let i = 0; i < ratios.length; i++) {
      const symbol = ratios[i].symbol;
      const isin = ratios[i].isin;
      const ratio = ratios[i].ratio;
      const exchangeId = ratios[i].exchangeId;
      const onlyBuyWhenFree = !!ratios[i].onlyBuyWhenFree;

      const currentRatio = 0;

      const matchingOwnedEtfs = etfs.filter(
        (etf) =>
          etf.productData &&
          etf.productData.isin === isin &&
          etf.productData.symbol === symbol
      );
      const ownedEtfValue = getTotalValue(matchingOwnedEtfs);
      const ownedEtfValueRatio = ownedEtfValue / totalETFValue;
      if (ownedEtfValue / totalETFValue < ratio) {
        console.log(
          `Found symbol ${symbol} (${isin}) with total value ratio ${ownedEtfValueRatio.toFixed(
            2
          )}, lower than wanted ratio  ${ratio.toFixed(2)}.`
        );

        const matchingProducts = (
          await degiro.searchProduct({
            type: DeGiroProducTypes.etfs,
            text: isin,
          })
        ).filter((product) => product.exchangeId === exchangeId.toString());
        const product = matchingProducts[0];
        if (!product) {
          console.error(
            `Did not find matching product for symbol ${symbol} (${isin}) on exchange ${exchangeId}`
          );
        }

        const size = Math.round(cash / product.closePrice);

        // Create order
        const orderType = {
          buySell: DeGiroActions.BUY,
          productId: product.id,
          orderType: DeGiroMarketOrderTypes.MARKET,
          size: size,
        };
        const order = await degiro.createOrder(orderType);

        if (!onlyBuyWhenFree || !order.transactionFees) {
          console.log(
            `Executing order for for symbol ${symbol} (${isin}) on exchange ${exchangeId}. Amount: ${size}.`
          );
          degiro.executeOrder(orderType, order.confirmationId);
        } else {
          console.error(
            `Cancel order for for symbol ${symbol} (${isin}) on exchange ${exchangeId}, order should be free but was not.`
          );
        }

        // TODO: Handle order executing outside of loop, and if nothing was found inside the loop, take first element?
        // TODO: check order history or an order is already open for this tracker or if last order was long enough ago
        break;
      }
    }
  }
}

function getTotalValue(products) {
  return products.reduce(
    (a, b) => ({
      value: a.value + (b.value ? b.value : 0),
    }),
    {
      value: 0,
    }
  ).value;
}

start();
