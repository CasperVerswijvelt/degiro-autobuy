const DeGiroModule = require("degiro-api");

const DeGiro = DeGiroModule.default;
const DeGiroEnums = DeGiroModule.DeGiroEnums;

const {
  DeGiroProducTypes,
  PORTFOLIO_POSITIONS_TYPE_ENUM,
  DeGiroActions,
  DeGiroMarketOrderTypes,
} = DeGiroEnums;

// Config values
const minCashInvest = 500;
const cashCurrency = "EUR";
const wantedEtfs = [
  {
    symbol: "EMIM",
    isin: "IE00BKM4GZ66",
    ratio: 12,
    exchangeId: 200, // Euronext Amsterdam
    onlyBuyWhenFree: false,
  },
  {
    symbol: "IWDA",
    isin: "IE00B4L5Y983",
    ratio: 88,
    exchangeId: 200, // Euronext Amsterdam
    onlyBuyWhenFree: true,
  },
  {
    symbol: "VUSA",
    isin: "IE00B3XXRP09",
    ratio: 10,
    exchangeId: 200, // Euronext Amsterdam
    onlyBuyWhenFree: true,
  },
];

// Calculate ratios for wanted etf's
const totalRatio = getTotalValue(wantedEtfs, "ratio");
wantedEtfs.forEach((el) => (el.ratio = el.ratio / totalRatio));

async function runScript() {
  // New Degiro
  const degiro = new DeGiro();

  // Login
  await degiro.login();

  if (!degiro.isLogin()) {
    throw new Error("Invalid credentials");
  }

  // Get cash funds
  const cash = (await degiro.getCashFunds()).filter(
    (type) => type.currencyCode === cashCurrency
  )[0].value;

  // If cash funds is high enough -> continue
  if (cash < minCashInvest) {
    console.log(`Cash in account (${cash}) is less than minimum cash funds.`);
    return;
  }

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
  const totalETFValue = getTotalValue(etfs, "value");

  freeEtfs = [];
  paidEtfs = [];

  // Check order history for open order
  const openOrders = (await degiro.getOrders({ active: true })).orders;
  if (openOrders.length) {
    console.log(`There are currently open orders, doing nothing.`);
    return;
  }

  // Loop over wanted etfs, see if ratio is below wanted ratio
  for (etf of wantedEtfs) {
    // Find current etf in owned etfs
    const matchingOwnedEtfs = etfs.filter(
      (el) =>
        el.productData &&
        el.productData.isin === etf.isin &&
        el.productData.symbol === etf.symbol
    );

    // Calculate owned ratio in relation to total etf value of portfolio
    const ownedEtfValue = getTotalValue(matchingOwnedEtfs, "value");
    const ownedEtfValueRatio = ownedEtfValue / totalETFValue;

    if (ownedEtfValue / totalETFValue >= etf.ratio) {
      console.log(
        `Symbol ${etf.symbol} (${
          etf.isin
        }) exceeds wanted ratio ${etf.ratio.toFixed(
          2
        )} with ${ownedEtfValueRatio.toFixed(2)}, ignoring.`
      );
      continue;
    }

    console.log(
      `Found symbol ${etf.symbol} (${
        etf.isin
      }) with total value ratio ${ownedEtfValueRatio.toFixed(
        2
      )}, lower than wanted ratio ${etf.ratio.toFixed(2)}.`
    );

    // Search product
    const matchingProducts = (
      await degiro.searchProduct({
        type: DeGiroProducTypes.etfs,
        text: etf.isin,
      })
    ).filter((product) => product.exchangeId === etf.exchangeId.toString());
    const product = matchingProducts[0];
    if (!product) {
      console.error(
        `Did not find matching product for symbol ${etf.symbol} (${etf.isin}) on exchange ${etf.exchangeId}`
      );
    }

    // Create order to check transasction fees
    const orderType = {
      buySell: DeGiroActions.BUY,
      productId: product.id,
      orderType: DeGiroMarketOrderTypes.MARKET,
      size: 1, // Doesn't matter, just checking transaction fees
    };
    const order = await degiro.createOrder(orderType);

    if (etf.onlyBuyWhenFree && order.transactionFees) {
      `Symbol ${symbol} (${isin}) on exchange ${exchangeId} has transaction fees but should be free, ignoring.`;
      continue;
    }

    let result = { ...etf, ...order, ...product };

    if (etf.onlyBuyWhenFree) {
      freeEtfs.push(result);
    } else {
      paidEtfs.push(result);
    }
  }

  console.log(
    `Free ETF's eligible for buying: ${freeEtfs
      .map((el) => el.symbol)
      .join(", ")}`
  );
  console.log(
    `Paid ETF's eligible for buying: ${paidEtfs
      .map((el) => el.symbol)
      .join(", ")}`
  );

  // Either select all eligible free etf's for buying, or the first paid one
  if (freeEtfs.length > 0) {
    // Place orders for all free etfs
    const cashPerEtf = cash / freeEtfs.length;
    for (etf of freeEtfs) {
      // Calculate amount
      const amount = Math.floor(cashPerEtf / etf.closePrice);
      await delay(2000);
      let confirmation = await placeOrder({
        buySell: DeGiroActions.BUY,
        productId: etf.id,
        orderType: DeGiroMarketOrderTypes.MARKET,
        size: amount,
      });
      console.log(
        `Succesfully placed market order for ${amount} * ${etf.symbol} (${confirmation})`
      );
    }
  } else {
    // Place order for paid etf if exists
    const etf = paidEtfs[0];

    if (etf) {
      // Calculate amount
      const amount = Math.floor(cash / etf.closePrice);

      await delay(2000);
      await placeOrder({
        buySell: DeGiroActions.BUY,
        productId: etf.id,
        orderType: DeGiroMarketOrderTypes.MARKET,
        size: amount,
      });
    }
  }
}

async function placeOrder(orderType) {
  const order = await degiro.createOrder(orderType);
  const confirmation = await degiro.executeOrder(
    orderType,
    order.confirmationId
  );
  return confirmation;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTotalValue(products, key) {
  let start = {};
  start[key] = 0;
  return products.reduce((a, b) => {
    let res = {};
    res[key] = a[key] + (b[key] ? b[key] : 0);
    return res;
  }, start)[key];
}

exports.run = runScript;
