// Imports and enums and stuff
const DeGiroModule = require("degiro-api");

const DeGiro = DeGiroModule.default;
const DeGiroEnums = DeGiroModule.DeGiroEnums;
const authenticator = require("otplib").authenticator;

const { PORTFOLIO_POSITIONS_TYPE_ENUM } = DeGiroEnums;

async function runScript() {
  // New Degiro
  const secret = process.env['DEGIRO_OTP_SECRET']
  const degiro = new DeGiro({
    oneTimePassword: secret ? authenticator.generate(secret) : undefined
  });

  // Login
  await degiro.login();

  if (!degiro.isLogin()) {
    throw new Error("Invalid credentials");
  }

  // Get portfolio
  const portfolio = (
    await degiro.getPortfolio({
      type: PORTFOLIO_POSITIONS_TYPE_ENUM.ALL,
      getProductDetails: true,
    })
  ).filter((el) => el.positionType === "PRODUCT");

  const closedPositions = portfolio.filter((el) => !el.size);
  const openPositions = portfolio.filter((el) => el.size);

  console.log("------------------");
  console.log("  OPEN POSITIONS  ");
  console.log("------------------");
  logPositions(openPositions);

  function logPositions(positions) {
    positions.forEach((el) => {
      console.log(`  Name          ${el.productData.name}`);
      console.log(`  Symbol        ${el.productData.symbol}`);
      console.log(`  ISIN          ${el.productData.isin}`);
      console.log(`  Currency      ${el.productData.currency}`);
      console.log(`  Price         ${el.price}`);
      console.log(`  Total value   ${el.value}`);
      console.log(`  Breakeven     ${el.breakEvenPrice}`);
      console.log(`-----------------------------`);
    });
  }
}

// Export
exports.run = runScript;
