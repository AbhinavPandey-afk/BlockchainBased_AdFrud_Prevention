import React, { useState } from "react";
import { Container, Form, Button, Alert, Card, Row, Col } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import RoleAssignment from "../components/RoleAssignment";
import "./AdminDashboard.css"; // custom AMOLED styles

const AdminDashboard = () => {
  const { contract, account, connect } = useWallet();
  const [treasury, setTreasury] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [msg, setMsg] = useState(null);

  const requireConnected = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const setTreas = async () => {
    try {
      await requireConnected();
      const tx = await contract.setTreasury(treasury);
      await tx.wait();
      setMsg("✅ Treasury updated successfully");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  const setMaxClickAge = async () => {
    try {
      await requireConnected();
      const tx = await contract.setMaxClickAgeSeconds(maxAge);
      await tx.wait();
      setMsg("✅ Max Click Age updated successfully");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100 amoled-bg text-light">
      <Navbar />

      <Container className="py-5">
        <h2 className="mb-4 text-center fw-bold neon-cyan display-5">
          ⚙️ Admin Dashboard
        </h2>
        <p className="text-center text-muted mb-5">
          Manage protocol parameters and oversee fraud prevention settings.
        </p>

        {msg && (
          <Alert
            variant={msg.startsWith("✅") ? "success" : "danger"}
            className="glass-alert text-center fw-semibold"
          >
            {msg}
          </Alert>
        )}

        <Row className="g-4">
          <Col md={6}>
            <RoleAssignment />
          </Col>

          {/* Treasury */}
          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">🏦 Treasury Management</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>Treasury Address</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="0x1234... address"
                    value={treasury}
                    onChange={(e) => setTreasury(e.target.value)}
                    className="neon-input"
                  />
                </Form.Group>
                <Button className="btn btn-primary w-100" onClick={setTreas}>
                  Update Treasury
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-4 mt-3">
          {/* Max Click Age */}
          <Col md={12}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">⏱ Click Settings</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>Max Click Age (seconds)</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="Enter seconds..."
                    value={maxAge}
                    onChange={(e) => setMaxAge(e.target.value)}
                    className="neon-input"
                  />
                </Form.Group>
                <Button className="btn btn-primary w-100" onClick={setMaxClickAge}>
                  Update Max Age
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
