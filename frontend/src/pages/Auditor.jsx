import React, { useState } from "react";
import { Container, Form, Button, Alert } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const Auditor = () => {
  const { contract, account, connect } = useWallet();
  const [gatewayAddr, setGatewayAddr] = useState("");
  const [pctBps, setPctBps] = useState("");
  const [evidence, setEvidence] = useState("");
  const [msg, setMsg] = useState(null);

  const slash = async () => {
    try {
      if (!account) await connect();
      // slashGateway(address gateway, uint16 pctBps, bytes32 evidenceCIDHash)
      const tx = await contract.slashGateway(gatewayAddr, parseInt(pctBps), evidence);
      await tx.wait();
      setMsg("Gateway slashed");
    } catch (e) { setMsg("Error: " + e.message); }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <Container className="py-5">
        <h2>Auditor</h2>
        {msg && <Alert variant="info">{msg}</Alert>}

        <Form.Group className="mb-3">
          <Form.Label>Gateway Address</Form.Label>
          <Form.Control value={gatewayAddr} onChange={(e) => setGatewayAddr(e.target.value)} />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Percentage (bps, e.g. 500 = 5%)</Form.Label>
          <Form.Control value={pctBps} onChange={(e) => setPctBps(e.target.value)} />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Evidence CID (bytes32 or string)</Form.Label>
          <Form.Control value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        </Form.Group>

        <Button onClick={slash} variant="danger">Slash Gateway</Button>
      </Container>
      <Footer />
    </div>
  );
};

export default Auditor;
