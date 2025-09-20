import React, { useState } from "react";
import { Container, Form, Button, Alert, Card, Row, Col } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SubmitClick from "../components/SubmitClick";

const Gateway = () => {
  const { contract, account, connect } = useWallet();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [msg, setMsg] = useState(null);

  const ensure = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const stake = async () => {
    try {
      await ensure();
      const value = ethers.utils.parseEther(stakeAmount || "0");
      const tx = await contract.stakeGateway({ value });
      await tx.wait();
      setMsg("Staked successfully");
    } catch (e) { setMsg("Error: " + e.message); }
  };

  const unstake = async () => {
    try {
      await ensure();
      const amt = ethers.utils.parseEther(unstakeAmount || "0");
      const tx = await contract.unstakeGateway(amt);
      await tx.wait();
      setMsg("Unstaked successfully");
    } catch (e) { setMsg("Error: " + e.message); }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <Container className="py-5">
        <h2>Gateway</h2>
        {msg && <Alert variant={msg.startsWith("Error") ? "danger" : "success"} className="glass-alert">{msg}</Alert>}

        {/* Stake & Unstake side by side */}
        <Row className="mb-4">
          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">💰 Stake Gateway</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>Amount (ETH)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="0.1"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="neon-input"
                  />
                </Form.Group>
                <Button
                  className="btn btn-primary w-100"
                  onClick={stake}
                  disabled={!stakeAmount}
                >
                  Stake
                </Button>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">🪙 Unstake Gateway</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>Amount (ETH)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="0.1"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    className="neon-input"
                  />
                </Form.Group>
                <Button
                  className="btn btn-primary w-100"
                  onClick={unstake}
                  disabled={!unstakeAmount}
                >
                  Unstake
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <SubmitClick />
      </Container>
      <Footer />
    </div>
  );
};

export default Gateway;
