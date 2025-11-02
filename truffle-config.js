require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    sepolia: {
      provider: () => new HDWalletProvider({
        privateKeys: [process.env.PRIVATE_KEY],
        providerOrUrl: process.env.SEPOLIA_RPC_URL,
        numberOfAddresses: 1,
        shareNonce: true
      }),
      network_id: 11155111,
      chain_id: 11155111,
      gas: 8000000,            // Use a much lower gas than block limit
      gasPrice: 8000000000,    // 8 gwei
      confirmations: 1,
      timeoutBlocks: 50000,
      networkCheckTimeout: 1000000,
      skipDryRun: true,
      websocket: false
    }
  },
  
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 1
        },
        viaIR: true
      }
    }
  }
};
