const migrateBatchExchange = require("../src/migration/PoC_dfusion")
const argv = require("yargs")
  .option("onlyMigrateSnappAuction", {
    describe: "Allows to restrict the migration only to SnappAuction",
  })
  .help(false)
  .version(false).argv

module.exports = async function(deployer, network, accounts, web3) {
  if (!argv.onlyMigrateSnappAuction) {
    return migrateBatchExchange({
      artifacts,
      deployer,
      network,
      account: accounts[0],
      web3,
    })
  } else {
    return
  }
}
