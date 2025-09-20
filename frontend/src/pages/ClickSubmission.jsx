import React, { useState } from "react";
import { Container, Form, Button, Alert } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const ClickSubmission = () => {
  const { contract, account, connect } = useWallet();
  const [campaignId, setCampaignId] = useState("");
  const [publisher, setPublisher] = useState("");
  const [metadataCIDHash, setMetadataCIDHash] = useState("");
  const [msg, setMsg] = useState(null);

  const submitClick = async () => {
    try {
      if (!account) await connect();
      // The exact signature of submitClickGatewayDirect may vary; check your contract
      // Example: submitClickGatewayDirect(uint256 campaignId, address publisher, bytes32 metadataCIDHash)
      const tx = await contract.submitClickGatewayDirect(campaignId, publisher, metadataCIDHash);
      await tx.wait();
      setMsg("Click submitted");
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <Container className="py-5">
        <h2>Submit Click</h2>
        {msg && <Alert variant="info">{msg}</Alert>}

        <Form.Group className="mb-3">
          <Form.Label>Campaign ID</Form.Label>
          <Form.Control value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Publisher Address</Form.Label>
          <Form.Control value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Metadata CID Hash (bytes32 or string)</Form.Label>
          <Form.Control value={metadataCIDHash} onChange={(e) => setMetadataCIDHash(e.target.value)} />
        </Form.Group>

        <Button onClick={submitClick}>Submit Click (Direct)</Button>
      </Container>
      <Footer />
    </div>
  );
};

export default ClickSubmission;
