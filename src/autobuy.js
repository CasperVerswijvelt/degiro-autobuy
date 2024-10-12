// Imports and enums and stuff
const DeGiroModule = require("degiro-api");
const fs = require("fs");
const authenticator = require("otplib").authenticator;
const util = require("./util.js");
const UserAgent = require("user-agents");

const DeGiro = DeGiroModule.default;
const DeGiroEnums = DeGiroModule.DeGiroEnums;

const {
  DeGiroProducTypes,
  PORTFOLIO_POSITIONS_TYPE_ENUM,
  DeGiroActions,
  DeGiroMarketOrderTypes,
  DeGiroTimeTypes
} = DeGiroEnums;

async function runScript() {
  console.log(
    `Started degiro-autobuy script at ${new Intl.DateTimeFormat("be-nl", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).format(new Date())}`
  );

  let config;

  // Read config file
  try {
    const raw = fs.readFileSync("config.json", "utf8");
    config = JSON.parse(raw);
  } catch (e) {
    console.log(`Error while reading config file: ${e}`);
    return;
  }
  // TODO: Validate required properties

  // Process some things from config: Calculate ratios for desired portfolio
  const totalRatio = util.getTotalValue(config.desiredPortfolio, "ratio");
  config.desiredPortfolio.forEach((el) => (el.ratio = el.ratio / totalRatio));

  console.log(
    `Desired portfolio: ${config.desiredPortfolio
      .map((etf) => `${etf.symbol} (${(etf.ratio * 100).toFixed(2)}%)`)
      .join(", ")}`
  );

  // New Degiro
  const secret = process.env['DEGIRO_OTP_SECRET']
  const degiro = new DeGiro({
    oneTimePassword: secret ? authenticator.generate(secret) : undefined,
    userAgent: new UserAgent().toString()
  });

  console.log(`User agent: ${degiro.userAgent}`)

  // Login
  console.log("Logging in ...");
  await degiro.login();

  if (!degiro.isLogin()) {
    console.error("Invalid credentials");
    return;
  }

  console.log();

  // Get cash funds
  const cash = (await degiro.getCashFunds()).filter(
    (type) => type.currencyCode === config.cashCurrency
  )[0].value;

  // If cash funds is high enough -> continue
  if (cash < config.minCashInvest && !config.useMargin) {
    console.log(
      `Cash in account (${cash}) is less than minimum cash funds (${config.minCashInvest}).`
    );
    return;
  }

  const maxInvestableCash = Math.min(config.maxCashInvest, cash);

  const investableCash = config.useMargin
    ? Math.max(config.minCashInvest, maxInvestableCash)
    : maxInvestableCash;

  console.log(
    `Cash in account: ${config.cashCurrency} ${cash}, limiting investment to ${config.cashCurrency} ${investableCash}`
  );

  // Get portfolio
  const portfolio = await degiro.getPortfolio({
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
  const totalETFValue = util.getTotalValue(etfs, "value");

  coreEtfs = [];
  paidEtfs = [];

  // Check order history for open order if open orders are not allowed
  if (!config.allowOpenOrders) {
    const openOrders = (await degiro.getOrders({ active: true })).orders;
    if (openOrders.length) {
      console.log(`There are currently open orders, doing nothing.`);
      return;
    }
  }

  // Loop over wanted etfs, see if ratio is below wanted ratio
  for (etf of config.desiredPortfolio) {
    // Find current etf in owned etfs
    const matchingOwnedEtfs = etfs.filter(
      (el) =>
        el.productData &&
        el.productData.isin === etf.isin &&
        el.productData.symbol === etf.symbol
    );

    // Calculate owned ratio in relation to total etf value of portfolio
    const ownedEtfValue = util.getTotalValue(matchingOwnedEtfs, "value");
    const ownedEtfValueRatio = ownedEtfValue / (totalETFValue + investableCash);

    if (ownedEtfValueRatio >= etf.ratio) {
      console.log(
        `Symbol ${etf.symbol} (${
          etf.isin
        }): actual ratio ${ownedEtfValueRatio.toFixed(2)} > ${etf.ratio.toFixed(
          2
        )} wanted ratio, ignoring.`
      );
      continue;
    }

    console.log(
      `Symbol ${etf.symbol} (${
        etf.isin
      }): actual ratio ${ownedEtfValueRatio.toFixed(2)} < ${etf.ratio.toFixed(
        2
      )} wanted ratio, adding to buy list.`
    );
    etf.ratioDifference = etf.ratio - ownedEtfValue;

    // Search product
    const matchingProducts = (
      await degiro.searchProduct({
        type: DeGiroProducTypes.etfs,
        text: etf.isin,
      })
    ).filter((product) => {
      return (
        etf.isin.toLowerCase() === product.isin.toLowerCase() &&
        product.exchangeId === etf.exchangeId.toString()
      );
    });
    const product = matchingProducts[0];
    if (!product) {
      console.error(
        `Did not find matching product for symbol ${etf.symbol} (${etf.isin}) on exchange ${etf.exchangeId}`
      );
      continue;
    }

    // Create order to check transasction fees
    const orderType = {
      buySell: DeGiroActions.BUY,
      productId: product.id,
      orderType: DeGiroMarketOrderTypes.MARKET,
      size: 1, // Doesn't matter, just checking transaction fees
    };
    const order = await degiro.createOrder(orderType);

    if (etf.degiroCore && order.transactionFees) {
      console.log(
        `Symbol ${etf.symbol} (${etf.isin}) on exchange ${product.exchangeId} is in DeGiro core selection but has transaction fees, ignoring.`
      );
      continue;
    }

    let result = { ...etf, ...order, ...product };

    if (etf.degiroCore) {
      coreEtfs.push(result);
    } else {
      paidEtfs.push(result);
    }
  }

  console.log();
  console.log(
    `Free ETF's eligible for buying: ${coreEtfs
      .map((el) => el.symbol)
      .join(", ")}`
  );
  console.log(
    `Paid ETF's eligible for buying: ${paidEtfs
      .map((el) => el.symbol)
      .join(", ")}`
  );
  console.log();

  // Either select all eligible free etf's for buying, or the first paid one
  if (coreEtfs.length > 0) {
    // Place orders for all free etfs

    console.log(
      `Choosing to buy free ETF's (DeGiro Core selection), dividing available cash ${
        config.divideEqually ? "equally" : "by wanted ratio"
      }`
    );

    // Determine amounts
    while (true) {
      const cashPerEtf = investableCash / coreEtfs.length;
      const coreEtfsTotalNeededRatio = util.getTotalValue(
        coreEtfs,
        "ratioDifference"
      );
      let ready = true;

      for (etf of coreEtfs) {
        const ratio = etf.ratioDifference / coreEtfsTotalNeededRatio;
        const amount = Math.floor(
          config.divideEqually
            ? cashPerEtf / etf.closePrice
            : (ratio * investableCash) / etf.closePrice
        );

        if (amount > 0) {
          etf.amountToBuy = amount;
        } else {
          ready = false;
          console.log(
            `Cancel order for ${amount} * ${etf.symbol}, amount is 0`
          );
          coreEtfs.splice(coreEtfs.indexOf(etf), 1);
          break;
        }
      }
      if (ready) break;
    }

    for (etf of coreEtfs) {
      // Calculate amount
      if (etf.amountToBuy < 1) {
        continue;
      }

      await util.delay(1000);

      let confirmation = await placeOrder({
        buySell: DeGiroActions.BUY,
        productId: etf.id,
        orderType: DeGiroMarketOrderTypes.MARKET,
        size: etf.amountToBuy,
        timeType: DeGiroTimeTypes.PERMANENT
      });
      console.log(
        `Succesfully placed market order for ${etf.amountToBuy} * ${etf.symbol} for ${(etf.closePrice * etf.amountToBuy).toFixed(2)} ${etf.currency} (${confirmation})`
      );
    }
  } else {

    // Place order for paid etf if exists
    const etf = paidEtfs[0];

    if (etf) {

      console.log(`Choosing to buy a single paid ETF: ${etf.symbol}`);

      // Calculate amount
      const amount = Math.floor(investableCash / etf.closePrice);

      await util.delay(2000);
      let confirmation = await placeOrder({
        buySell: DeGiroActions.BUY,
        productId: etf.id,
        orderType: DeGiroMarketOrderTypes.MARKET,
        size: amount,
      });
      console.log(
        `Succesfully placed market order for ${amount} * ${etf.symbol} (${confirmation})`
      );
    } else {

      console.log(`No Paid ETF to buy either`);
    }
  }

  async function placeOrder(orderType) {

    if (config.demo === true) return 'demo'

    const order = await degiro.createOrder(orderType);
    const confirmation = await degiro.executeOrder(
      orderType,
      order.confirmationId
    );
    return confirmation;
  }
}

// Export
exports.run = runScript;
