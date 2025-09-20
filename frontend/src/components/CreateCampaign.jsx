import React, { useState } from "react";
import { Form, Button, Alert, Card } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";

const CreateCampaign = () => {
  const { contract, account, connect } = useWallet();
  const [campaignId, setCampaignId] = useState("");
  const [cpcEth, setCpcEth] = useState("");
  const [initialBudget, setInitialBudget] = useState("");
  const [meta, setMeta] = useState("");
  const [msg, setMsg] = useState(null);

  const ensure = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const createCampaign = async () => {
    try {
      await ensure();

      const id = parseInt(campaignId);
      const cpcWei = ethers.utils.parseEther(cpcEth || "0");
      const initialBudgetWei = ethers.utils.parseEther(initialBudget || "0");

      if (isNaN(id)) {
        setMsg("❌ Campaign ID must be a number");
        return;
      }
      if (cpcWei.lte(0)) {
        setMsg("❌ CPC must be greater than 0");
        return;
      }
      if (initialBudgetWei.lte(0)) {
        setMsg("❌ Initial budget must be greater than 0");
        return;
      }

      const tx = await contract.createCampaign(
        id,
        cpcWei,
        meta,
        { value: initialBudgetWei }
      );

      await tx.wait();

      setMsg("✅ Campaign created successfully!");
      setCampaignId("");
      setCpcEth("");
      setInitialBudget("");
      setMeta("");
    } catch (e) {
      setMsg("❌ Error: " + (e.message || e));
    }
  };

  return (
    <Card className="glass-card border-0 h-100 mt-4">
      <Card.Body>
        <Card.Title className="neon-label">📢 Create Campaign</Card.Title>

        {msg && (
          <Alert
            variant={msg.startsWith("❌") ? "danger" : "success"}
            className="glass-alert"
          >
            {msg}
          </Alert>
        )}

        <Form.Group className="mb-3">
          <Form.Label className="neon-label">Campaign ID (unique)</Form.Label>
          <Form.Control
            className="neon-input"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="e.g. 1001"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label className="neon-label">CPC (ETH)</Form.Label>
          <Form.Control
            className="neon-input"
            value={cpcEth}
            onChange={(e) => setCpcEth(e.target.value)}
            placeholder="e.g. 0.001"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label className="neon-label">Initial Budget (ETH)</Form.Label>
          <Form.Control
            className="neon-input"
            value={initialBudget}
            onChange={(e) => setInitialBudget(e.target.value)}
            placeholder="e.g. 1.0"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label className="neon-label">Meta (IPFS CID / details)</Form.Label>
          <Form.Control
            className="neon-input"
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder="Campaign details or IPFS link"
          />
        </Form.Group>

        <Button
          className="btn btn-primary w-100"
          onClick={createCampaign}
          disabled={!campaignId || !cpcEth || !initialBudget}
        >
          🚀 Create Campaign
        </Button>
      </Card.Body>
    </Card>
  );
};

export default CreateCampaign;
