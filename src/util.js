exports.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.getTotalValue = (products, key) => {
  let start = {};
  start[key] = 0;
  return products.reduce((a, b) => {
    let res = {};
    res[key] = a[key] + (b[key] ? b[key] : 0);
    return res;
  }, start)[key];
};
