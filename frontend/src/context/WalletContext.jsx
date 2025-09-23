// import React, { createContext, useContext, useEffect, useState } from "react";
// import { ethers } from "ethers";
// import ContractJSON from "../contracts/AdFraudPBFT.json";

// const WalletContext = createContext(null);

// export const useWallet = () => useContext(WalletContext);

// export const WalletProvider = ({ children }) => {
//   const [account, setAccount] = useState(null);
//   const [provider, setProvider] = useState(null);
//   const [signer, setSigner] = useState(null);
//   const [contract, setContract] = useState(null);
//   const [chainId, setChainId] = useState(null);
//   const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;

//   // Connect to MetaMask
//   const connect = async () => {
//     if (!window.ethereum) throw new Error("MetaMask not found");
//     try {
//       const ethProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
//       await ethProvider.send("eth_requestAccounts", []);
//       const ethSigner = ethProvider.getSigner();
//       const addr = await ethSigner.getAddress();
//       const network = await ethProvider.getNetwork();
//       setProvider(ethProvider);
//       setSigner(ethSigner);
//       setAccount(addr);
//       setChainId(network.chainId);

//       // create contract instance with signer
//       const contractInstance = new ethers.Contract(contractAddress, ContractJSON.abi, ethSigner);
//       setContract(contractInstance);
//     } catch (err) {
//       console.error("connect error", err);
//       throw err;
//     }
//   };

//   // Disconnect (local only)
//   const disconnect = () => {
//     setAccount(null);
//     setProvider(null);
//     setSigner(null);
//     setContract(null);
//     setChainId(null);
//   };

//   // handle account / chain changes
//   useEffect(() => {
//     if (!window.ethereum) return;
//     const handleAccounts = (accounts) => {
//       if (accounts.length === 0) disconnect();
//       else setAccount(accounts[0]);
//     };
//     const handleChain = (chainIdHex) => {
//       setChainId(Number(chainIdHex));
//     };

//     window.ethereum.on("accountsChanged", handleAccounts);
//     window.ethereum.on("chainChanged", handleChain);
//     return () => {
//       if (window.ethereum.removeListener) {
//         window.ethereum.removeListener("accountsChanged", handleAccounts);
//         window.ethereum.removeListener("chainChanged", handleChain);
//       }
//     };
//     // eslint-disable-next-line
//   }, []);

//   return (
//     <WalletContext.Provider
//       value={{
//         account,
//         provider,
//         signer,
//         contract,
//         chainId,
//         connect,
//         disconnect,
//       }}
//     >
//       {children}
//     </WalletContext.Provider>
//   );
// };
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

  // New campaign-related state
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

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

      // Create contract instance with signer
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
    setCampaigns([]);
  };

  // Fetch campaigns from blockchain
  const fetchCampaigns = async () => {
    if (!contract) return;
    
    setCampaignsLoading(true);
    try {
      const campaignIds = await contract.getCampaignIds();
      const campaignList = [];

      for (let id of campaignIds) {
        try {
          const campaignData = await contract.getCampaign(id);
          campaignList.push({
            id: id.toString(),
            advertiser: campaignData[0],
            cpcWei: campaignData[1].toString(),
            budgetWei: campaignData[2].toString(),
            paused: campaignData[3],
            meta: campaignData[4],
          });
        } catch (error) {
          console.error(`Failed to fetch campaign ${id}:`, error);
        }
      }

      setCampaigns(campaignList);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setCampaignsLoading(false);
    }
  };

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (!contract) return;

    const setupEventListeners = () => {
      // Listen for new campaigns
      const campaignCreatedFilter = contract.filters.CampaignCreated();
      
      contract.on(campaignCreatedFilter, (campaignId, advertiser, cpcWei, initialBudget, meta) => {
        console.log("New campaign created:", campaignId.toString());
        
        const newCampaign = {
          id: campaignId.toString(),
          advertiser,
          cpcWei: cpcWei.toString(),
          budgetWei: initialBudget.toString(),
          paused: false,
          meta,
        };
        
        setCampaigns(prev => {
          // Check if campaign already exists
          if (prev.find(c => c.id === newCampaign.id)) return prev;
          return [...prev, newCampaign];
        });
      });

      // Listen for campaign funding
      contract.on("CampaignFunded", (campaignId, amount, newBudget) => {
        setCampaigns(prev => prev.map(c => 
          c.id === campaignId.toString() 
            ? { ...c, budgetWei: newBudget.toString() }
            : c
        ));
      });

      // Listen for campaign pause/resume
      contract.on("CampaignPaused", (campaignId, paused) => {
        setCampaigns(prev => prev.map(c => 
          c.id === campaignId.toString() 
            ? { ...c, paused }
            : c
        ));
      });
    };

    setupEventListeners();

    // Initial fetch
    if (campaigns.length === 0) {
      fetchCampaigns();
    }

    // Cleanup listeners on unmount
    return () => {
      contract.removeAllListeners();
    };
  }, [contract]);

  // Handle account / chain changes
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
        // New campaign-related values
        campaigns,
        campaignsLoading,
        fetchCampaigns,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
