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
  const [campaignImage, setCampaignImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [msg, setMsg] = useState(null);

  const ensure = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCampaignImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const createCampaign = async () => {
    try {
      await ensure();

      // Role check: advertiser only
      if (typeof contract.isAdvertiser === "function") {
        const adv = await contract.isAdvertiser(account);
        if (!adv) {
          setMsg("❌ Only an Advertiser can create a campaign. Ask Admin to assign Advertiser role.");
          return;
        }
      }

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
      if (initialBudgetWei.lt(cpcWei)) {
        setMsg("❌ Initial budget must be at least equal to CPC");
        return;
      }

      setMsg("⏳ Creating campaign...");

      // Store image locally (unchanged)
      if (campaignImage) {
        const base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(campaignImage);
        });
        localStorage.setItem(
          `campaign_image_${id}`,
          JSON.stringify({
            image: base64Image,
            imageName: campaignImage.name,
            timestamp: Date.now(),
          })
        );
      }

      // Light on-chain metadata
      const lightMeta = JSON.stringify({
        description: meta,
        hasImage: !!campaignImage,
        timestamp: Date.now(),
      });

      // Let provider estimate gas; fall back to a ceiling if estimation fails
      let tx;
      try {
        tx = await contract.createCampaign(id, cpcWei, lightMeta, {
          value: initialBudgetWei,
        });
      } catch (estErr) {
        // If estimate fails for any reason, try with a conservative gas limit
        tx = await contract.createCampaign(id, cpcWei, lightMeta, {
          value: initialBudgetWei,
          gasLimit: 600000,
        });
      }

      setMsg("⏳ Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      setMsg("✅ Campaign created successfully!");

      // Clear form
      setCampaignId("");
      setCpcEth("");
      setInitialBudget("");
      setMeta("");
      setCampaignImage(null);
      setImagePreview("");
    } catch (e) {
      const em = e?.reason || e?.message || String(e);
      console.error("CreateCampaign error:", e);

      if (em.toLowerCase().includes("campaign id already exists")) {
        setMsg("❌ Campaign ID already exists");
      } else if (em.toLowerCase().includes("initial budget required")) {
        setMsg("❌ Initial budget is required");
      } else if (em.toLowerCase().includes("cpc must be > 0")) {
        setMsg("❌ CPC must be greater than 0");
      } else if (em.toLowerCase().includes("not authorized")) {
        setMsg("❌ Not authorized to create this campaign");
      } else {
        setMsg("❌ Error: " + em);
      }
    }
  };

  return (
    <Card>
      <Card.Header>📢 Create Campaign</Card.Header>
      <Card.Body>
        {msg && (
          <Alert variant={msg.includes("✅") ? "success" : msg.includes("⏳") ? "info" : "danger"}>
            {msg}
          </Alert>
        )}

        <Form.Group className="mb-3">
          <Form.Label>Campaign ID (unique)</Form.Label>
          <Form.Control
            type="number"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="e.g. 1004"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>CPC (ETH)</Form.Label>
          <Form.Control
            type="text"
            value={cpcEth}
            onChange={(e) => setCpcEth(e.target.value)}
            placeholder="e.g. 0.01"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Initial Budget (ETH)</Form.Label>
          <Form.Control
            type="text"
            value={initialBudget}
            onChange={(e) => setInitialBudget(e.target.value)}
            placeholder="e.g. 1.0"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Campaign Image</Form.Label>
          <Form.Control
            type="file"
            accept="image/*"
            onChange={handleImageChange}
          />
          <Form.Text className="text-muted">
            Images are stored locally and will sync across your published ads
          </Form.Text>
          {imagePreview && (
            <div className="mt-2">
              <img
                src={imagePreview}
                alt="Campaign Preview"
                style={{ maxWidth: "200px", maxHeight: "150px", objectFit: "cover" }}
                className="img-thumbnail"
              />
            </div>
          )}
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Meta (Campaign description/details)</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder="Campaign details or description"
          />
        </Form.Group>

        <Button variant="primary" onClick={createCampaign}>
          🚀 Create Campaign
        </Button>
      </Card.Body>
    </Card>
  );
};

export default CreateCampaign;
