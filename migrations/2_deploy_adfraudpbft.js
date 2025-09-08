// migrations/2_deploy_adfraudpbft.js
const AdFraudPBFT = artifacts.require("AdFraudPBFT");

module.exports = async function (deployer, network, accounts) {
  // Use the first Ganache account as the treasury for convenience.
  const treasury = accounts[0];
  await deployer.deploy(AdFraudPBFT, treasury);
};
