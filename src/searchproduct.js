// Imports and enums and stuff
const DeGiroModule = require("degiro-api");
const inquirer = require("inquirer");
const authenticator = require("otplib").authenticator;

const DeGiro = DeGiroModule.default;
const DeGiroEnums = DeGiroModule.DeGiroEnums;

const { DeGiroProducTypes } = DeGiroEnums;

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

  const productTypes = Object.keys(DeGiroProducTypes).filter((type) =>
    isNaN(type)
  );
  productTypes.splice(0, 0, "all types");

  do {
    const chosenProductType = (
      await inquirer.prompt([
        {
          type: "list",
          message: "What products do you want to search",
          name: "productType",
          choices: productTypes,
        },
      ])
    ).productType;

    let productTypeId = DeGiroProducTypes[chosenProductType];

    const searchText = (
      await inquirer.prompt([
        {
          type: "input",
          message: `Product search term?`,
          name: "searchText",
        },
      ])
    ).searchText;

    const results = await degiro.searchProduct({
      type: productTypeId,
      text: searchText,
    });

    if (results && results.length) {
      let chosenResult = (
        await inquirer.prompt([
          {
            type: "list",
            message: `${results.length} products found, choose one.`,
            name: "chosenResult",
            choices: results.map((result) => {
              return {
                name: `${result.currency.padEnd(4)} ${result.symbol.padEnd(
                  7
                )} (${result.isin}): ${result.name}`,
                value: result,
                short: `${result.symbol} (${result.isin}): ${result.name}`,
              };
            }),
          },
        ])
      ).chosenResult;

      console.log();
      console.log(`  Name          ${chosenResult.name}`);
      console.log(`  Symbol        ${chosenResult.symbol}`);
      console.log(`  ISIN          ${chosenResult.isin}`);
      console.log(`  Product type  ${chosenResult.productType}`);
      console.log(`  Currency      ${chosenResult.currency}`);
      console.log(`  Exchange ID   ${chosenResult.exchangeId}`);
    } else {
      console.log("  No search results");
    }
    console.log();
  } while (
    (
      await inquirer.prompt([
        {
          type: "confirm",
          message: "Search for another product?",
          name: "searchAgain",
        },
      ])
    ).searchAgain
  );
}

// Export
exports.run = runScript;
