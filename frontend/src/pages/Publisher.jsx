import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert, Row, Col } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CampaignCard from "../components/CampaignCard";

const Publisher = () => {
  const { contract, account, connect } = useWallet();
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState(null);
  const [balance, setBalance] = useState("0");
  const [campaigns, setCampaigns] = useState([]);

  // --- Withdraw ---
  const withdraw = async () => {
    try {
      if (!account) await connect();
      const valueInWei = ethers.utils.parseEther(amount || "0"); // ETH → wei
      const tx = await contract.withdrawPublisher(valueInWei);
      await tx.wait();
      setMsg("✅ Withdrawn successfully");
      setAmount("");
      fetchBalance();
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    }
  };

  // --- Balance fetch ---
  const fetchBalance = async () => {
    if (!contract || !account) return;
    try {
      const bal = await contract.publisherBalance(account);
      setBalance(bal.toString());
    } catch (e) {
      setMsg("❌ Error fetching balance: " + e.message);
    }
  };

  // --- Campaigns fetch ---
  const fetchCampaigns = async () => {
    if (!contract) return;
    try {
      const ids = await contract.getCampaignIds();
      const campList = [];
      for (let id of ids) {
        const camp = await contract.getCampaign(id);
        campList.push({
          id: id.toString(),
          advertiser: camp[0],
          cpcWei: camp[1].toString(),
          budgetWei: camp[2].toString(),
          paused: camp[3],
          meta: camp[4],
        });
      }
      setCampaigns(campList);
    } catch (e) {
      setMsg("❌ Error fetching campaigns: " + e.message);
    }
  };

  // --- Event listener for new campaigns ---
  useEffect(() => {
    if (!contract) return;

    const handleCampaignCreated = (id, advertiser, cpcWei, initialBudget, meta) => {
      setCampaigns((prev) => [
        ...prev,
        {
          id: id.toString(),
          advertiser,
          cpcWei: cpcWei.toString(),
          budgetWei: initialBudget.toString(),
          paused: false,
          meta,
        },
      ]);
    };

    contract.on("CampaignCreated", handleCampaignCreated);
    return () => {
      contract.off("CampaignCreated", handleCampaignCreated);
    };
  }, [contract]);

  // --- Load on mount ---
  useEffect(() => {
    if (contract && account) {
      fetchBalance();
      fetchCampaigns();
    }
  }, [contract, account]);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <Container className="py-5 flex-grow-1">
        <h2>Publisher</h2>
        <p>Your Balance: {ethers.utils.formatEther(balance)} ETH</p>
        {msg && <Alert variant="info">{msg}</Alert>}

        <Form.Group className="mb-3">
          <Form.Label>Withdraw Amount (ETH)</Form.Label>
          <Form.Control
            type="text"
            placeholder="e.g. 0.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button className="mt-2" onClick={withdraw} disabled={!amount}>
            Withdraw
          </Button>
        </Form.Group>

        <h3>All Campaigns</h3>
        <Row>
          {campaigns.map((c) => (
            <Col md={12} key={c.id} className="mb-3">
              <CampaignCard campaign={c} />
            </Col>
          ))}
        </Row>
      </Container>
      <Footer />
    </div>
  );
};

export default Publisher;
