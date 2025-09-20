import React, { createContext, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import ContractJSON from "../contracts/AdFraudPBFT.json";

const WalletContext = createContext(null);

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [chainId, setChainId] = useState(null);
  const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;

  // Connect to MetaMask
  const connect = async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");
    try {
      const ethProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
      await ethProvider.send("eth_requestAccounts", []);
      const ethSigner = ethProvider.getSigner();
      const addr = await ethSigner.getAddress();
      const network = await ethProvider.getNetwork();
      setProvider(ethProvider);
      setSigner(ethSigner);
      setAccount(addr);
      setChainId(network.chainId);

      // create contract instance with signer
      const contractInstance = new ethers.Contract(contractAddress, ContractJSON.abi, ethSigner);
      setContract(contractInstance);
    } catch (err) {
      console.error("connect error", err);
      throw err;
    }
  };

  // Disconnect (local only)
  const disconnect = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
    setChainId(null);
  };

  // handle account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccounts = (accounts) => {
      if (accounts.length === 0) disconnect();
      else setAccount(accounts[0]);
    };
    const handleChain = (chainIdHex) => {
      setChainId(Number(chainIdHex));
    };

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccounts);
        window.ethereum.removeListener("chainChanged", handleChain);
      }
    };
    // eslint-disable-next-line
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        provider,
        signer,
        contract,
        chainId,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
