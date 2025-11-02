import React, { useState, useEffect } from "react";
import { Form, Button, Alert, Card, Dropdown } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";

const SubmitClick = ({ availableHashes = [] }) => {
  const { contract, account, connect } = useWallet();
  const [clickHash, setClickHash] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [publisher, setPublisher] = useState("");
  const [metadataCIDHash, setMetadataCIDHash] = useState("");
  const [msg, setMsg] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  const showMsg = (text) => {
    setMsg(text);
    // auto clear success/info after 4s
    if (text.startsWith("✅") || text.startsWith("⏳")) {
      setTimeout(() => setMsg(null), 4000);
    }
  };

  // Check if campaign is paused and exists
  const checkCampaignPaused = async (id) => {
    if (!contract || !id) return;
    try {
      const campaign = await contract.getCampaign(id);
      // campaign tuple: [advertiser, cpcWei, budgetWei, paused, meta]
      const advertiser = campaign[0];
      const paused = campaign[3];
      if (advertiser === ethers.constants.AddressZero) {
        setIsPaused(true); // treat missing as paused/blocked
        return;
      }
      setIsPaused(Boolean(paused));
    } catch (e) {
      console.error("Error fetching campaign:", e?.message || e);
      // on error, don't block the form, but be conservative
      setIsPaused(false);
    }
  };

  useEffect(() => {
    checkCampaignPaused(campaignId);
  }, [campaignId, contract]);

  const selectHashFromAvailable = (hashData) => {
    setClickHash(hashData.clickHash);
    setCampaignId(hashData.campaignId);
    setPublisher(hashData.publisherAddress);
    setMetadataCIDHash(""); // reset metadata
  };

  const submitClick = async () => {
    try {
      if (!account) await connect();
      if (!contract) throw new Error("Contract not available");

      if (!clickHash || !campaignId || !publisher) {
        showMsg("❌ Error: Please fill all click submission fields");
        return;
      }

      // Gateway role check (prevents Not gateway revert)
      if (typeof contract.isGateway === "function") {
        const gw = await contract.isGateway(account);
        if (!gw) {
          showMsg("❌ Connected wallet is not a Gateway. Ask Admin to assign Gateway role.");
          return;
        }
      }

      // Paused campaign prevention
      await checkCampaignPaused(campaignId);
      if (isPaused) {
        showMsg("❌ Campaign is currently paused");
        return;
      }

      const timestamp = Math.floor(Date.now() / 1000);

      // Normalize bytes32 for clickHash and metadataCIDHash
      const clickHashBytes = clickHash.startsWith("0x")
        ? clickHash
        : ethers.utils.formatBytes32String(clickHash);

      const metadataBytes = metadataCIDHash
        ? (metadataCIDHash.startsWith("0x") ? metadataCIDHash : ethers.utils.formatBytes32String(metadataCIDHash))
        : ethers.constants.HashZero;

      // Optional: sanity on publisher address
      if (!ethers.utils.isAddress(publisher)) {
        showMsg("❌ Invalid publisher address");
        return;
      }

      // Submit via Gateway-direct path (contract will route to PBFT)
      const tx = await contract.submitClickGatewayDirect(
        clickHashBytes,
        campaignId,
        publisher,
        timestamp,
        metadataBytes
      );
      showMsg("⏳ Submitting click... waiting for confirmation");
      await tx.wait();

      showMsg("✅ Click submitted successfully");

      // Clear the form
      const oldHash = clickHash;
      setClickHash("");
      setCampaignId("");
      setPublisher("");
      setMetadataCIDHash("");

      // Remove the hash from localStorage if present
      const existing = JSON.parse(localStorage.getItem("availableHashes") || "[]");
      const updated = existing.filter((h) => h.clickHash !== oldHash);
      localStorage.setItem("availableHashes", JSON.stringify(updated));
    } catch (e) {
      const em = e?.reason || e?.message || String(e);

      if (em.includes("Campaign paused")) {
        showMsg("❌ Campaign is currently paused");
      } else if (em.toLowerCase().includes("duplicate click") || em.toLowerCase().includes("already used")) {
        showMsg("❌ Click hash already used");
      } else if (em.toLowerCase().includes("campaign missing")) {
        showMsg("❌ Campaign not found");
      } else if (em.toLowerCase().includes("not gateway")) {
        showMsg("❌ This account is not a Gateway. Please switch wallet or ask Admin to assign role.");
      } else if (em.toLowerCase().includes("insufficient budget")) {
        showMsg("❌ Campaign has insufficient budget for CPC");
      } else {
        showMsg("❌ Error: " + em);
      }
    }
  };

  return (
    <Card>
      <Card.Header>🖱 Submit Click</Card.Header>
      <Card.Body>
        {msg && (
          <Alert variant={msg.includes("✅") ? "success" : msg.includes("⏳") ? "info" : "danger"}>
            {msg}
          </Alert>
        )}

        {availableHashes.length > 0 && (
          <div className="mb-3">
            <label className="form-label">Quick Select from Available Hashes:</label>
            <Dropdown>
              <Dropdown.Toggle variant="outline-info" size="sm">
                Select Hash ({availableHashes.length} available)
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {availableHashes.map((hash, index) => (
                  <Dropdown.Item
                    key={index}
                    onClick={() => selectHashFromAvailable(hash)}
                  >
                    Campaign #{hash.campaignId} - {hash.cpc} ETH
                    <br />
                    <small className="text-muted">{hash.clickHash.substring(0, 20)}...</small>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>
        )}

        <Form.Group className="mb-3">
          <Form.Label>Click Hash</Form.Label>
          <Form.Control
            type="text"
            value={clickHash}
            onChange={(e) => setClickHash(e.target.value)}
            placeholder="0x... or plain text (auto-encoded to bytes32)"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Campaign ID</Form.Label>
          <Form.Control
            type="text"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="Campaign ID"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Publisher Address</Form.Label>
          <Form.Control
            type="text"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            placeholder="0x..."
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Metadata CID Hash (optional)</Form.Label>
          <Form.Control
            type="text"
            value={metadataCIDHash}
            onChange={(e) => setMetadataCIDHash(e.target.value)}
            placeholder="0x... or leave empty"
          />
        </Form.Group>

        <Button
          variant={isPaused ? "secondary" : "primary"}
          onClick={submitClick}
          disabled={isPaused}
        >
          {isPaused ? "Campaign Paused" : "Submit Click"}
        </Button>
      </Card.Body>
    </Card>
  );
};

export default SubmitClick;
