import React, { useState, useEffect } from "react";
import { Form, Button, Alert, Card, Row, Col, Badge, InputGroup } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";

const RoleAssignment = () => {
  const { contract, account, connect } = useWallet();

  const [selectedRole, setSelectedRole] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState(null);

  // Live role status for the typed address
  const [roleState, setRoleState] = useState({
    isGateway: null,
    isAuditor: null,
    isPublisher: null,
    isAdvertiser: null,
  });

  const requireConnected = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const clearMessageSoon = () => {
    setTimeout(() => setMsg(null), 4000);
  };

  const refreshRoleState = async (addr) => {
    if (!contract || !addr || addr.length < 42) {
      setRoleState({ isGateway: null, isAuditor: null, isPublisher: null, isAdvertiser: null });
      return;
    }
    try {
      const [g, a, p, adv] = await Promise.all([
        typeof contract.isGateway === "function" ? contract.isGateway(addr) : Promise.resolve(null),
        typeof contract.isAuditor === "function" ? contract.isAuditor(addr) : Promise.resolve(null),
        typeof contract.isPublisher === "function" ? contract.isPublisher(addr) : Promise.resolve(null),
        typeof contract.isAdvertiser === "function" ? contract.isAdvertiser(addr) : Promise.resolve(null),
      ]);
      setRoleState({ isGateway: g, isAuditor: a, isPublisher: p, isAdvertiser: adv });
    } catch (e) {
      console.warn("Role read failed:", e);
    }
  };

  useEffect(() => {
    refreshRoleState(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, contract]);

  const doAssign = async () => {
    try {
      await requireConnected();
      if (!address) throw new Error("Provide a target address");
      const role = (selectedRole || "").toLowerCase();

      let tx;
      switch (role) {
        case "gateway":
          if (typeof contract.assignGateway !== "function")
            throw new Error("assignGateway not found in ABI/contract");
          tx = await contract.assignGateway(address);
          break;
        case "auditor":
          if (typeof contract.assignAuditor !== "function")
            throw new Error("assignAuditor not found in ABI/contract");
          tx = await contract.assignAuditor(address);
          break;
        case "publisher":
          if (typeof contract.assignPublisher !== "function")
            throw new Error("assignPublisher not found in ABI/contract");
          tx = await contract.assignPublisher(address);
          break;
        case "advertiser":
          if (typeof contract.assignAdvertiser !== "function")
            throw new Error("assignAdvertiser not found in ABI/contract");
          tx = await contract.assignAdvertiser(address);
          break;
        default:
          throw new Error("Invalid role selection");
      }

      setMsg("⏳ Submitting transaction...");
      const receipt = await tx.wait();
      setMsg(`✅ Role assigned in tx ${receipt.transactionHash.substring(0, 10)}...`);
      refreshRoleState(address);
      clearMessageSoon();
    } catch (e) {
      setMsg("❌ " + (e?.reason || e?.message || String(e)));
      clearMessageSoon();
    }
  };

  const doRevoke = async () => {
    try {
      await requireConnected();
      if (!address) throw new Error("Provide a target address");
      const role = (selectedRole || "").toLowerCase();

      let tx;
      switch (role) {
        case "gateway":
          if (typeof contract.revokeGateway !== "function")
            throw new Error("revokeGateway not found in ABI/contract");
          tx = await contract.revokeGateway(address);
          break;
        case "auditor":
          if (typeof contract.revokeAuditor !== "function")
            throw new Error("revokeAuditor not found in ABI/contract");
          tx = await contract.revokeAuditor(address);
          break;
        case "publisher":
          if (typeof contract.revokePublisher !== "function")
            throw new Error("revokePublisher not found in ABI/contract");
          tx = await contract.revokePublisher(address);
          break;
        case "advertiser":
          if (typeof contract.revokeAdvertiser !== "function")
            throw new Error("revokeAdvertiser not found in ABI/contract");
          tx = await contract.revokeAdvertiser(address);
          break;
        default:
          throw new Error("Invalid role selection");
      }

      setMsg("⏳ Submitting transaction...");
      const receipt = await tx.wait();
      setMsg(`✅ Role revoked in tx ${receipt.transactionHash.substring(0, 10)}...`);
      refreshRoleState(address);
      clearMessageSoon();
    } catch (e) {
      setMsg("❌ " + (e?.reason || e?.message || String(e)));
      clearMessageSoon();
    }
  };

  return (
    <Card className="glass-card border-0 h-100">
      <Card.Body>
        <Card.Title className="neon-label">🔒 Role Assignment</Card.Title>

        {msg && (
          <Alert
            variant={msg.startsWith("✅") ? "success" : msg.startsWith("⏳") ? "info" : "danger"}
            className="glass-alert"
          >
            {msg}
          </Alert>
        )}

        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Select Role</Form.Label>
              <Form.Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="neon-input"
              >
                <option value="">Choose role...</option>
                <option value="Gateway">Gateway</option>
                <option value="Auditor">Auditor</option>
                <option value="Publisher">Publisher</option>
                <option value="Advertiser">Advertiser</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Target Address</Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder="0x1234... address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="neon-input"
                />
                <Button
                  variant="outline-info"
                  onClick={() => refreshRoleState(address)}
                  disabled={!address || address.length < 42}
                >
                  Check
                </Button>
              </InputGroup>
            </Form.Group>
          </Col>
        </Row>

        {/* Live Role Badges */}
        <Row className="mb-3">
          <Col>
            <div className="d-flex flex-wrap gap-2">
              <Badge bg={roleState.isGateway ? "success" : "secondary"}>
                Gateway: {roleState.isGateway === null ? "-" : roleState.isGateway ? "Yes" : "No"}
              </Badge>
              <Badge bg={roleState.isAuditor ? "success" : "secondary"}>
                Auditor: {roleState.isAuditor === null ? "-" : roleState.isAuditor ? "Yes" : "No"}
              </Badge>
              <Badge bg={roleState.isPublisher ? "success" : "secondary"}>
                Publisher: {roleState.isPublisher === null ? "-" : roleState.isPublisher ? "Yes" : "No"}
              </Badge>
              <Badge bg={roleState.isAdvertiser ? "success" : "secondary"}>
                Advertiser: {roleState.isAdvertiser === null ? "-" : roleState.isAdvertiser ? "Yes" : "No"}
              </Badge>
            </div>
          </Col>
        </Row>

        <Row className="g-2">
          <Col md={6}>
            <Button
              className="btn btn-primary w-100"
              onClick={doAssign}
              disabled={!selectedRole || !address || address.length < 42}
            >
              Assign Role
            </Button>
          </Col>
          <Col md={6}>
            <Button
              className="btn btn-outline-danger w-100"
              onClick={doRevoke}
              disabled={!selectedRole || !address || address.length < 42}
            >
              Revoke Role
            </Button>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default RoleAssignment;
