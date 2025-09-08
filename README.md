# AdFraudPBFT Smart Contract (Truffle + Ganache)

This project demonstrates how to compile, deploy, and interact with the **AdFraudPBFT** smart contract using [Truffle](https://trufflesuite.com) and [Ganache GUI](https://trufflesuite.com/ganache/).

---

## 📂 Project Structure

your-project/
├─ contracts/
│ └─ AdFraudPBFT.sol
├─ migrations/
│ └─ 1_initial_migration.js
│ └─ 2_deploy_adfraudpbft.js
├─ test/
├─ truffle-config.js
├─ package.json
└─ node_modules/

yaml
Copy code

---

## ⚡ Prerequisites

- **Node.js (LTS)** – [Download here](https://nodejs.org/)
- **Truffle** (global install):
  ```bash
  npm install -g truffle
Ganache GUI (Windows 11 users → install Ganache-2.7.1-win-x64-setup.exe)

🛠️ Setup Instructions
Clone / Create Project

bash
Copy code
mkdir adfraudpbft-truffle
cd adfraudpbft-truffle
truffle init
Install OpenZeppelin Contracts

bash
Copy code
npm init -y
npm install @openzeppelin/contracts@4.9.3
Copy Contract
Place your updated contract into ./contracts/AdFraudPBFT.sol.

Configure Truffle
Use this truffle-config.js:

js
Copy code
module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    }
  },
  compilers: {
    solc: {
      version: "0.8.19",
      settings: { optimizer: { enabled: true, runs: 200 } }
    }
  }
};
Migration Script
In migrations/2_deploy_adfraudpbft.js:

js
Copy code
const AdFraudPBFT = artifacts.require("AdFraudPBFT");

module.exports = async function (deployer, network, accounts) {
  const treasury = accounts[0];
  await deployer.deploy(AdFraudPBFT, treasury);
};
🚀 Compile & Deploy
Start Ganache GUI → Quickstart (default: 127.0.0.1:7545, network id 5777).

In terminal:

bash
Copy code
truffle compile
truffle migrate --network development
Use --reset to redeploy after changes:

bash
Copy code
truffle migrate --network development --reset
📊 View Logs & Transactions
Open Ganache GUI → Transactions tab.

Select a transaction → Logs tab → decoded events appear (e.g., TreasuryChanged, CampaignCreated, ClickRecorded).
