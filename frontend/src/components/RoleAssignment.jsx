import React, { useState } from "react";
import { Form, Button, Alert, Card } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";

const RoleAssignment = () => {
  const { contract, account, connect } = useWallet();
  const [selectedRole, setSelectedRole] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState(null);

  const roles = {
    gateway: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GATEWAY_ROLE")),
    auditor: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("AUDITOR_ROLE")),
    advertiser: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADVERTISER_ROLE")),
    publisher: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PUBLISHER_ROLE"))
  };

  const assignRole = async () => {
    try {
      if (!account) await connect();
      if (!contract) throw new Error("Contract not available");
      const roleBytes = roles[selectedRole.toLowerCase()];
      if (!roleBytes) throw new Error("Invalid role");
      const tx = await contract.grantRole(roleBytes, address);
      await tx.wait();
      setMsg("✅ Role assigned successfully");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  return (
    <Card className="glass-card border-0 h-100">
      <Card.Body>
        <Card.Title className="neon-label">🔒 Role Assignment</Card.Title>
        {msg && (
          <Alert
            variant={msg.startsWith("✅") ? "success" : "danger"}
            className="glass-alert"
          >
            {msg}
          </Alert>
        )}
        <Form.Group className="mb-3">
          <Form.Label>Select Role</Form.Label>
          <Form.Select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="neon-input"
          >
            <option value="">Choose role...</option>
            <option value="Gateway">Gateway</option>
            <option value="Auditor">Auditor</option>
            <option value="Advertiser">Advertiser</option>
            <option value="Publisher">Publisher</option>
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Address</Form.Label>
          <Form.Control
            type="text"
            placeholder="0x1234... address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="neon-input"
          />
        </Form.Group>
        <Button
          className="btn btn-primary w-100"
          onClick={assignRole}
          disabled={!selectedRole || !address}
        >
          Assign Role
        </Button>
      </Card.Body>
    </Card>
  );
};

export default RoleAssignment;
