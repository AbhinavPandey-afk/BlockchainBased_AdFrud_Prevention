import React, { useState } from "react";
import { Container, Alert, Form, Button, Card } from "react-bootstrap";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CreateCampaign from "../components/CreateCampaign";

const Advertiser = () => {
  const { contract, account, connect } = useWallet();
  const [campaignId, setCampaignId] = useState("");
  const [fundAmount, setFundAmount] = useState(""); // fund amount in ETH
  const [msg, setMsg] = useState(null);

  const ensure = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const fundCampaign = async () => {
    try {
      await ensure();
      const value = ethers.utils.parseEther(fundAmount || "0");
      const tx = await contract.fundCampaign(campaignId, { value });
      await tx.wait();
      setMsg("Campaign funded successfully");
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const pauseCampaign = async (pause) => {
    try {
      await ensure();
      const tx = await contract.setCampaignPaused(campaignId, pause);
      await tx.wait();
      setMsg(`Campaign ${pause ? "paused" : "resumed"}`);
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <Container className="py-5">
        <h2>Advertiser</h2>

        <CreateCampaign />

        <hr />

        {/* Glass Card for Campaign Management */}
        <Card className="glass-card border-0 h-100 mt-4">
          <Card.Body>
            <Card.Title className="neon-label">⚙ Manage Campaign</Card.Title>

            {msg && (
              <Alert
                variant={msg.startsWith("Error") ? "danger" : "success"}
                className="glass-alert"
              >
                {msg}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Campaign ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter campaign ID"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="neon-input"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Fund Amount (ETH)</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. 0.5"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="neon-input"
              />
              <Button
                className="btn btn-primary w-100 mt-2"
                onClick={fundCampaign}
                disabled={!campaignId || !fundAmount}
              >
                Fund Campaign
              </Button>
            </Form.Group>

            <div className="d-flex gap-2 mt-2">
              <Button
                className="btn btn-warning flex-fill"
                onClick={() => pauseCampaign(true)}
                disabled={!campaignId}
              >
                Pause
              </Button>
              <Button
                className="btn btn-secondary flex-fill"
                onClick={() => pauseCampaign(false)}
                disabled={!campaignId}
              >
                Resume
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Container>
      <Footer />
    </div>
  );
};

export default Advertiser;
