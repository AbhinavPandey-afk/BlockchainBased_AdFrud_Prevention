// src/utils/contract.js
import { ethers } from "ethers";
import contractABI from "../contracts/AdFraudPBFT.json"; // ABI from build

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "0x38db58950052da0C028900f8386d2DBBABa0a031";

const getContract = () => {
  if (!window.ethereum) throw new Error("MetaMask not detected");

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = provider.getSigner();
  return new ethers.Contract(
    CONTRACT_ADDRESS,
    contractABI.abi,
    signer
  );
};

export default getContract;
