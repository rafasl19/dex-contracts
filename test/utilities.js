const { sha256 } = require("ethereumjs-util")
const memoize = require("fast-memoize")
const { MerkleTree } = require("merkletreejs")
const BN = require("bn.js")

const { decodeOrders } = require("../src/encoding")

/**
 * funds accounts with specified value for Mintable Token
 * The object consists of:
 * 1.) minter/owner of token (i.e. minter)
 * 2.) list of accounts
 * 3.) ERC20Mintable token
 * 4.) amount to be funded
 */
const fundAccounts = async function(minter, accounts, token, amount) {
  for (let i = 0; i < accounts.length; i++) {
    await token.mint(accounts[i], amount, { from: minter })
  }
}

/**
 * approves contract for spending on behalf of accounts for specific token
 * The object consists of:
 * 1.) contract to be approved
 * 2.) list of accounts
 * 3.) ERC20Mintable token
 * 4.) amount to be approved
 */
const approveContract = async function(contract, accounts, token, value) {
  for (let i = 0; i < accounts.length; i++) {
    await token.approve(contract.address, value, { from: accounts[i] })
  }
}

/**
 * Opens accounts at their index + 1 on contract
 * The object consists of:
 * 1.) contract to register account
 * 2.) list of accounts
 */
const openAccounts = async function(contract, accounts) {
  for (let i = 0; i < accounts.length; i++) {
    await contract.openAccount(i, { from: accounts[i] })
  }
}

/**
 * Deploys and registers tokens on contract
 * The object consists of:
 * 1.) contract to register account
 * 2.) owner of contract
 * 3.) number of tokens to be registered
 */
const registerTokens = async function(token_artifact, contract, token_owner, numTokens) {
  const res = []
  const owner = await contract.owner()
  for (let i = 0; i < numTokens; i++) {
    const token = await token_artifact.new({ from: token_owner })
    res.push(token)
    await contract.addToken(token.address, { from: owner })
  }
  return res
}

/**
 * Deploys tokens, funds opens accounts, approves contract for transfer and opens accounts
 * The object consists of:
 * 1.) BatchAuction Contract
 * 2.) desired token owner (ideally not contract owner)
 * 3.) accounts to be funded and registered
 * 4.) number of tokens to be registered
 * @returns {Array} tokens
 */
const setupEnvironment = async function(token_artifact, contract, token_owner, accounts, numTokens) {
  const tokens = await registerTokens(token_artifact, contract, token_owner, numTokens)
  const amount = "300000000000000000000"
  for (let i = 0; i < tokens.length; i++) {
    await fundAccounts(token_owner, accounts, tokens[i], amount)
    await approveContract(contract, accounts, tokens[i], amount)
  }
  await openAccounts(contract, accounts)
  return tokens
}

/**
 * Dev tool to register the multiCaller contract on the dFusion exchange.
 * Note: assumes tokens are registered.
 * @param snappInstance: dFusion - base contract address
 * @param tokenOwner: Someone who can mint requested token (to fund account)
 * @param tokens: tokens that multiCaller will have balance in
 * @param multiCaller: contract address
 */
const setupMultiCaller = async function(snappInstance, tokenOwner, tokens, multiCaller) {
  const amount = "300000000000000000000"
  for (let i = 0; i < tokens.length; i++) {
    await fundAccounts(tokenOwner, [multiCaller.address], tokens[i], amount)

    const approveCalldata = tokens[i].contract.methods.approve(snappInstance.address, amount).encodeABI()
    await multiCaller.executeWithCalldata(tokens[i].address, 1, approveCalldata)
  }
  const openAccountCallData = snappInstance.contract.methods.openAccount(11).encodeABI()
  await multiCaller.executeWithCalldata(snappInstance.address, 1, openAccountCallData)
}

const jsonrpc = "2.0"
const id = 0
const send = function(method, params, web3Provider) {
  return new Promise(function(resolve, reject) {
    web3Provider.currentProvider.send({ id, jsonrpc, method, params }, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve(result)
      }
    })
  })
}

// Wait for n blocks to pass
/**
 * Wait for n (evm) seconds to pass
 * @param seconds: int
 * @param web3Provider: potentially different in contract tests and system end-to-end testing.
 */
const waitForNSeconds = async function(seconds, web3Provider = web3) {
  await send("evm_increaseTime", [seconds], web3Provider)
  await send("evm_mine", [], web3Provider)
}

const toHex = function(buffer) {
  buffer = buffer.toString("hex")
  if (buffer.substring(0, 2) == "0x") return buffer
  return "0x" + buffer.toString("hex")
}

const countDuplicates = function(obj, num) {
  obj[num] = ++obj[num] || 1
  return obj
}

/**
 * Given a sequence of index1, elements1, ..., indexN elementN this function returns
 * the corresponding MerkleTree of height 7.
 */
const _generateMerkleTree = function(...args) {
  const txs = Array(2 ** 7).fill(sha256(0x0))
  for (let i = 0; i < args.length; i += 2) {
    txs[args[i]] = args[i + 1]
  }
  return new MerkleTree(txs, sha256)
}
const generateMerkleTree = memoize(_generateMerkleTree, {
  strategy: memoize.strategies.variadic,
})

const sendTxAndGetReturnValue = async function(method, ...args) {
  const result = await method.call(...args)
  await method(...args)
  return result
}

/**
 * Partitions array into chunks of size spacing
 * @param input: Array
 * @param spacing: int
 * @returns {Array}
 */
function partitionArray(input, spacing) {
  const output = []
  for (let i = 0; i < input.length; i += spacing) {
    output[output.length] = input.slice(i, i + spacing)
  }
  return output
}

function decodeAuctionElements(bytes) {
  return decodeOrders(bytes).map(e => ({
    user: e.user,
    sellTokenBalance: new BN(e.sellTokenBalance),
    buyToken: parseInt(e.buyToken),
    sellToken: parseInt(e.sellToken),
    validFrom: parseInt(e.validFrom),
    validUntil: parseInt(e.validUntil),
    priceNumerator: new BN(e.priceNumerator),
    priceDenominator: new BN(e.priceDenominator),
    remainingAmount: new BN(e.remainingAmount),
  }))
}

module.exports = {
  waitForNSeconds,
  fundAccounts,
  approveContract,
  openAccounts,
  registerTokens,
  setupEnvironment,
  toHex,
  countDuplicates,
  generateMerkleTree,
  partitionArray,
  setupMultiCaller,
  sendTxAndGetReturnValue,
  decodeAuctionElements,
}
