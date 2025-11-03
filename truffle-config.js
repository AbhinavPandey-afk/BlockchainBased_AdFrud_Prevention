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
      provider: () =>
        new HDWalletProvider({
          privateKeys: [process.env.PRIVATE_KEY],
          providerOrUrl: process.env.SEPOLIA_RPC_URL, // must be HTTPS
          numberOfAddresses: 1,
          shareNonce: true,
          pollingInterval: 8000, // slow down polling to reduce provider load
        }),
      network_id: 11155111,
      chain_id: 11155111,

      // Transaction params
      gas: 8000000,           // keep moderate deployment gas
      gasPrice: 8e9,          // 8 gwei

      // Reliability/timing
      confirmations: 1,
      timeoutBlocks: 500,     // fewer blocks needed before timeout
      networkCheckTimeout: 200000, // 200s network checks
      skipDryRun: true,
      websocket: false,

      // Truffle extra (some versions honor these)
      // httpHeaders: { Connection: "keep-alive" },
    },
  },

  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 1,
        },
        viaIR: true,
      },
    },
  },
};
