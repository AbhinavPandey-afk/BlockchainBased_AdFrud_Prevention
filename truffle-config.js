require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const https = require("https");

// A keep-alive agent reduces socket churn/timeouts behind corporate or ISP proxies
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 120000, // 120s idle socket timeout
});

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
          providerOrUrl: process.env.SEPOLIA_RPC_URL, // HTTPS Alchemy/Infura
          // HDWalletProvider options
          numberOfAddresses: 1,
          shareNonce: true,
          pollingInterval: 15000, // slow polling to reduce 429s/timeouts
          chainId: 11155111,
          // web3-request options (passed through to request lib used by HDWalletProvider/web3)
          // These headers/agent mitigate ECONNRESET/ESOCKETTIMEDOUT
          httpHeaders: { Connection: "keep-alive" },
          // agent only used by node-fetch/axios paths; some stacks honor it:
          httpsAgent,
        }),
      network_id: 11155111,
      chain_id: 11155111,

      // Gas controls
      gas: 7_000_000,              // a bit lower than before; let node estimate if you omit
      gasPrice: 10e9,              // 10 gwei; adjust if underpriced

      // Reliability/timing
      confirmations: 1,
      timeoutBlocks: 2000,         // give more headroom on slow RPCs
      networkCheckTimeout: 300000, // 300s for slow starts
      skipDryRun: true,
      websocket: false,
    },
  },

  mocha: {
    timeout: 120000,
  },

  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        viaIR: false, // disable viaIR to shrink bytecode and reduce compile/deploy friction
      },
    },
  },

  db: {
    enabled: false,
  },
};
