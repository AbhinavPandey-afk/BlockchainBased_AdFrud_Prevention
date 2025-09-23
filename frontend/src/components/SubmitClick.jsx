// import React, { useState, useEffect } from "react";
// import { Form, Button, Alert, Card } from "react-bootstrap";
// import { useWallet } from "../context/WalletContext";
// import { ethers } from "ethers";

// const SubmitClick = () => {
//   const { contract, account, connect } = useWallet();
//   const [clickHash, setClickHash] = useState("");
//   const [campaignId, setCampaignId] = useState("");
//   const [publisher, setPublisher] = useState("");
//   const [metadataCIDHash, setMetadataCIDHash] = useState("");
//   const [msg, setMsg] = useState(null);
//   const [isPaused, setIsPaused] = useState(false);

//   // --- Check if campaign is paused ---
//   const checkCampaignPaused = async (id) => {
//     if (!contract || !id) return;
//     try {
//       const campaign = await contract.getCampaign(id);
//       setIsPaused(campaign[3]); // campaign[3] is the paused boolean
//     } catch (e) {
//       console.error("Error fetching campaign:", e.message);
//     }
//   };

//   useEffect(() => {
//     checkCampaignPaused(campaignId);
//   }, [campaignId, contract]);

//   const submitClick = async () => {
//     try {
//       if (!account) await connect();
//       if (!contract) throw new Error("Contract not available");

//       if (!clickHash || !campaignId || !publisher) {
//         setMsg("Error: Please fill all click submission fields");
//         return;
//       }

//       if (isPaused) {
//         setMsg("❌ Campaign is currently paused");
//         return;
//       }

//       const timestamp = Math.floor(Date.now() / 1000);

//       // Handle bytes32 properly
//       const clickHashBytes = clickHash.startsWith("0x") ? clickHash : ethers.utils.formatBytes32String(clickHash);
//       const metadataBytes = metadataCIDHash
//         ? (metadataCIDHash.startsWith("0x") ? metadataCIDHash : ethers.utils.formatBytes32String(metadataCIDHash))
//         : ethers.constants.HashZero;

//       const tx = await contract.submitClickGatewayDirect(
//         clickHashBytes,
//         campaignId,
//         publisher,
//         timestamp,
//         metadataBytes
//       );

//       await tx.wait();
//       setMsg("✅ Click submitted successfully");
//     } catch (e) {
//       // Check if error is due to paused campaign
//       if (e.message.includes("Campaign paused")) {
//         setMsg("❌ Campaign is currently paused");
//       } else {
//         setMsg("❌ Error: " + e.message);
//       }
//     }
//   };

//   return (
//     <Card className="glass-card border-0 h-100 mt-4">
//       <Card.Body>
//         <Card.Title className="neon-label">🖱 Submit Click</Card.Title>

//         {msg && (
//           <Alert
//             variant={msg.startsWith("❌") ? "danger" : "success"}
//             className="glass-alert"
//           >
//             {msg}
//           </Alert>
//         )}

//         <Form.Group className="mb-3">
//           <Form.Label>Click Hash</Form.Label>
//           <Form.Control
//             type="text"
//             placeholder="Enter click hash"
//             value={clickHash}
//             onChange={(e) => setClickHash(e.target.value)}
//             className="neon-input"
//           />
//         </Form.Group>

//         <Form.Group className="mb-3">
//           <Form.Label>Campaign ID</Form.Label>
//           <Form.Control
//             type="text"
//             placeholder="Enter campaign ID"
//             value={campaignId}
//             onChange={(e) => setCampaignId(e.target.value)}
//             className="neon-input"
//           />
//         </Form.Group>

//         <Form.Group className="mb-3">
//           <Form.Label>Publisher Address</Form.Label>
//           <Form.Control
//             type="text"
//             placeholder="Enter publisher address"
//             value={publisher}
//             onChange={(e) => setPublisher(e.target.value)}
//             className="neon-input"
//           />
//         </Form.Group>

//         <Form.Group className="mb-3">
//           <Form.Label>Metadata CID Hash (optional)</Form.Label>
//           <Form.Control
//             type="text"
//             placeholder="Enter metadata CID hash"
//             value={metadataCIDHash}
//             onChange={(e) => setMetadataCIDHash(e.target.value)}
//             className="neon-input"
//           />
//         </Form.Group>

//         <Button
//           className="btn btn-primary w-100"
//           onClick={submitClick}
//           disabled={!clickHash || !campaignId || !publisher || isPaused}
//         >
//           {isPaused ? "Campaign Paused" : "Submit Click"}
//         </Button>
//       </Card.Body>
//     </Card>
//   );
// };

// export default SubmitClick;
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

  // Check if campaign is paused
  const checkCampaignPaused = async (id) => {
    if (!contract || !id) return;
    try {
      const campaign = await contract.getCampaign(id);
      setIsPaused(campaign[3]); // campaign[3] is the paused boolean
    } catch (e) {
      console.error("Error fetching campaign:", e.message);
    }
  };

  useEffect(() => {
    checkCampaignPaused(campaignId);
  }, [campaignId, contract]);

  const selectHashFromAvailable = (hashData) => {
    setClickHash(hashData.clickHash);
    setCampaignId(hashData.campaignId);
    setPublisher(hashData.publisherAddress);
    setMetadataCIDHash(""); // Reset metadata
  };

  const submitClick = async () => {
    try {
      if (!account) await connect();
      if (!contract) throw new Error("Contract not available");

      if (!clickHash || !campaignId || !publisher) {
        setMsg("❌ Error: Please fill all click submission fields");
        return;
      }

      if (isPaused) {
        setMsg("❌ Campaign is currently paused");
        return;
      }

      const timestamp = Math.floor(Date.now() / 1000);

      // Handle bytes32 properly
      const clickHashBytes = clickHash.startsWith("0x") ? clickHash : ethers.utils.formatBytes32String(clickHash);
      const metadataBytes = metadataCIDHash
        ? (metadataCIDHash.startsWith("0x") ? metadataCIDHash : ethers.utils.formatBytes32String(metadataCIDHash))
        : ethers.constants.HashZero;

      const tx = await contract.submitClickGatewayDirect(
        clickHashBytes,
        campaignId,
        publisher,
        timestamp,
        metadataBytes
      );
      await tx.wait();

      setMsg("✅ Click submitted successfully");
      
      // Clear the form
      setClickHash("");
      setCampaignId("");
      setPublisher("");
      setMetadataCIDHash("");

      // Remove the hash from localStorage
      const existingHashes = JSON.parse(localStorage.getItem('availableHashes') || '[]');
      const updatedHashes = existingHashes.filter(hash => hash.clickHash !== clickHash);
      localStorage.setItem('availableHashes', JSON.stringify(updatedHashes));

    } catch (e) {
      // Check if error is due to paused campaign
      if (e.message.includes("Campaign paused")) {
        setMsg("❌ Campaign is currently paused");
      } else if (e.message.includes("Already used")) {
        setMsg("❌ Click hash already used");
      } else {
        setMsg("❌ Error: " + e.message);
      }
    }
  };

  return (
    <Card>
      <Card.Header>🖱 Submit Click</Card.Header>
      <Card.Body>
        {msg && (
          <Alert variant={msg.includes("✅") ? "success" : "danger"}>
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
            placeholder="0x..."
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
