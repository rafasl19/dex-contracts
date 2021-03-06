/**
 * dex-contracts
 *
 * This NPM package provides smart contract artifacts used in the dFusion
 * protocol. Additional tools for interacting with the dFusion contracts and
 * performing migrations are also provided.
 */

module.exports = {
  BatchExchange: require("../build/contracts/BatchExchange.json"),
  SnappAuction: require("../build/contracts/SnappAuction.json"),
  ...require("./encoding.js"),
}
