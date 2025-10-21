import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert, Card, Row, Col, Table, Badge, Modal, Spinner } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import RoleAssignment from "../components/RoleAssignment";
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const { contract, account, connect } = useWallet();
  const [treasury, setTreasury] = useState("");
  const [msg, setMsg] = useState(null);
  
  // PBFT Node Management States
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [pbftNodes, setPbftNodes] = useState([]);
  const [newNodeAddress, setNewNodeAddress] = useState("");
  const [nodeStake, setNodeStake] = useState("");
  
  // PBFT Configuration States
  const [consensusPercentage, setConsensusPercentage] = useState("");
  const [consensusTimeout, setConsensusTimeout] = useState("");
  const [minPBFTStake, setMinPBFTStake] = useState("");

  // NEW: Admin Approval States
  const [adminPendingTxs, setAdminPendingTxs] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [adminServiceUrl] = useState("http://localhost:3001"); // Backend service URL

  const requireConnected = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  // Original Treasury Function
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

  // Fetch pending transactions that need PBFT consensus
  const fetchPendingTransactions = async () => {
    try {
      await requireConnected();
      
      const pendingHashes = await contract.getPendingTransactionHashes();
      const pending = [];
      
      for (const txHash of pendingHashes) {
        const details = await contract.getPendingTransactionDetails(txHash);
        
        if (!details.executed) {
          pending.push({
            hash: txHash,
            campaignId: details.campaignId.toString(),
            publisher: details.publisher,
            gateway: details.gateway,
            approveVotes: details.approveVotes.toString(),
            rejectVotes: details.rejectVotes.toString(),
            totalVotes: details.totalVotes.toString(),
            requiredVotes: details.requiredVotes.toString(),
            consensusReached: details.consensusReached,
            proposalTime: new Date(details.proposalTime * 1000).toLocaleString()
          });
        }
      }
      
      setPendingTransactions(pending);
    } catch (e) {
      console.error("Error fetching pending transactions:", e);
    }
  };

  // NEW: Fetch transactions awaiting admin approval from backend service
  const fetchAdminPendingTransactions = async () => {
    try {
      const response = await fetch(`${adminServiceUrl}/api/transactions/pending`);
      if (response.ok) {
        const data = await response.json();
        setAdminPendingTxs(data.transactions || []);
      } else {
        console.error("Failed to fetch admin pending transactions");
      }
    } catch (error) {
      console.error("Error fetching admin pending transactions:", error);
      // Don't show error if backend service is not running
    }
  };

  // Fetch active PBFT nodes
  const fetchPBFTNodes = async () => {
    try {
      await requireConnected();
      
      const activeNodeAddresses = await contract.getActiveNodes();
      const nodes = [];
      
      for (const nodeAddress of activeNodeAddresses) {
        const nodeStats = await contract.getNodeStats(nodeAddress);
        
        nodes.push({
          address: nodeAddress,
          isActive: nodeStats.isActive,
          stake: ethers.utils.formatEther(nodeStats.stake),
          votesParticipated: nodeStats.votesParticipated.toString(),
          correctVotes: nodeStats.correctVotes.toString(),
          accuracyPercentage: nodeStats.accuracyPercentage.toString()
        });
      }
      
      setPbftNodes(nodes);
    } catch (e) {
      console.error("Error fetching PBFT nodes:", e);
    }
  };

  // Add new PBFT node
  const addPBFTNode = async () => {
    try {
      await requireConnected();
      const tx = await contract.addPBFTNode(newNodeAddress, {
        value: ethers.utils.parseEther(nodeStake)
      });
      await tx.wait();
      setMsg("✅ PBFT Node added successfully");
      setNewNodeAddress("");
      setNodeStake("");
      fetchPBFTNodes();
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  // Remove PBFT node
  const removePBFTNode = async (nodeAddress) => {
    try {
      await requireConnected();
      const tx = await contract.removePBFTNode(nodeAddress);
      await tx.wait();
      setMsg("✅ PBFT Node removed successfully");
      fetchPBFTNodes();
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  // Update PBFT Configuration functions
  const updateConsensusPercentage = async () => {
    try {
      await requireConnected();
      const tx = await contract.setRequiredConsensusPercentage(consensusPercentage);
      await tx.wait();
      setMsg("✅ Consensus percentage updated successfully");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  const updateConsensusTimeout = async () => {
    try {
      await requireConnected();
      const tx = await contract.setConsensusTimeout(consensusTimeout);
      await tx.wait();
      setMsg("✅ Consensus timeout updated successfully");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  const updateMinPBFTStake = async () => {
    try {
      await requireConnected();
      const tx = await contract.setMinPBFTStake(ethers.utils.parseEther(minPBFTStake));
      await tx.wait();
      setMsg("✅ Minimum PBFT stake updated successfully");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  // Cleanup expired transactions
  const cleanupExpiredTransaction = async (txHash) => {
    try {
      await requireConnected();
      const tx = await contract.cleanupExpiredTransaction(txHash);
      await tx.wait();
      setMsg("✅ Expired transaction cleaned up");
      fetchPendingTransactions();
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  // NEW: Handle admin approval modal
  const handleAdminApproval = (tx) => {
    setSelectedTx(tx);
    setShowApprovalModal(true);
  };

  // NEW: Submit admin approval (approve/reject)
  const submitAdminDecision = async (decision) => {
    if (!selectedTx) return;
    
    setApprovalLoading(true);
    try {
      await requireConnected();
      
      // Get signer from MetaMask
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const adminAddress = await signer.getAddress();

      // Get current nonce from backend (for replay protection)
      let nonce = 0;
      try {
        const nonceResponse = await fetch(`${adminServiceUrl}/api/admin/nonce/${adminAddress}`);
        if (nonceResponse.ok) {
          const nonceData = await nonceResponse.json();
          nonce = nonceData.nonce || 0;
        }
      } catch (e) {
        console.log("Using default nonce 0");
      }

      // Create message hash (matching backend logic)
      const messageHash = ethers.utils.solidityKeccak256(
        ['string', 'string', 'address', 'uint256'],
        ['ADMIN_APPROVAL_V1', selectedTx.id, adminAddress, nonce]
      );

      // Sign the message
      const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));

      // Submit approval to backend service
      const response = await fetch(`${adminServiceUrl}/api/transactions/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTx.id,
          adminSignature: signature,
          adminAddress,
          decision
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMsg(`✅ Transaction ${decision}d successfully!`);
        setShowApprovalModal(false);
        setSelectedTx(null);
        fetchAdminPendingTransactions(); // Refresh admin pending list
        fetchPendingTransactions(); // Refresh PBFT pending list
      } else {
        setMsg(`❌ Error: ${result.error}`);
      }

    } catch (error) {
      console.error('Admin approval failed:', error);
      setMsg(`❌ Failed to ${decision} transaction: ${error.message}`);
    } finally {
      setApprovalLoading(false);
    }
  };

  // NEW: Get transaction status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      'PENDING_ADMIN_APPROVAL': { bg: 'warning', text: '⏳ Awaiting Admin' },
      'ADMIN_APPROVED': { bg: 'success', text: '✅ Approved' },
      'ADMIN_REJECTED': { bg: 'danger', text: '❌ Rejected' },
      'EXECUTED': { bg: 'info', text: '🚀 Executed' }
    };
    
    const config = statusConfig[status] || { bg: 'secondary', text: status };
    return <Badge bg={config.bg}>{config.text}</Badge>;
  };

  useEffect(() => {
    if (contract) {
      fetchPendingTransactions();
      fetchPBFTNodes();
      fetchAdminPendingTransactions(); // NEW: Fetch admin pending
      
      // Set up real-time listeners for blockchain events
      const proposedFilter = contract.filters.TransactionProposed();
      const consensusFilter = contract.filters.ConsensusReached();
      const nodeAddedFilter = contract.filters.PBFTNodeAdded();
      const nodeRemovedFilter = contract.filters.PBFTNodeRemoved();
      
      contract.on(proposedFilter, fetchPendingTransactions);
      contract.on(consensusFilter, fetchPendingTransactions);
      contract.on(nodeAddedFilter, fetchPBFTNodes);
      contract.on(nodeRemovedFilter, fetchPBFTNodes);
      
      // Set up polling for admin service (since it's off-chain)
      const adminPollingInterval = setInterval(fetchAdminPendingTransactions, 30000); // Every 30s
      
      return () => {
        contract.off(proposedFilter, fetchPendingTransactions);
        contract.off(consensusFilter, fetchPendingTransactions);
        contract.off(nodeAddedFilter, fetchPBFTNodes);
        contract.off(nodeRemovedFilter, fetchPBFTNodes);
        clearInterval(adminPollingInterval);
      };
    }
  }, [contract]);

  return (
    <div className="d-flex flex-column min-vh-100 amoled-bg text-light">
      <Navbar />
      
      <Container className="py-5">
        <h2 className="mb-4 text-center fw-bold neon-cyan display-5">
          ⚙️ Admin Dashboard - PBFT Network + Admin Approval
        </h2>
        <p className="text-center text-muted mb-5">
          Manage PBFT consensus nodes, monitor transaction validation, and provide final admin approval.
        </p>
        
        {msg && (
          <Alert
            variant={msg.startsWith("✅") ? "success" : "danger"}
            className="glass-alert text-center fw-semibold"
            onClose={() => setMsg(null)}
            dismissible
          >
            {msg}
          </Alert>
        )}

        {/* NEW: Admin Approval Section (Top Priority) */}
        <Row className="g-4 mb-4">
          <Col md={12}>
            <Card className="glass-card border-0 border-warning">
              <Card.Body>
                <Card.Title className="neon-label text-warning">
                  🔐 Transactions Awaiting Admin Signature ({adminPendingTxs.length})
                </Card.Title>
                
                {adminPendingTxs.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <p>✅ No transactions pending admin approval</p>
                    <small>Backend service status: {adminServiceUrl}</small>
                  </div>
                ) : (
                  <Table striped bordered hover variant="dark" className="mb-0">
                    <thead>
                      <tr>
                        <th>Transaction ID</th>
                        <th>Campaign</th>
                        <th>Publisher</th>
                        <th>PBFT Consensus</th>
                        <th>Submitted</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminPendingTxs.map((tx) => (
                        <tr key={tx.id} className="table-warning">
                          <td className="font-monospace">
                            {tx.id.substring(0, 12)}...
                          </td>
                          <td>#{tx.campaignId}</td>
                          <td className="font-monospace">
                            {tx.publisher.substring(0, 8)}...
                          </td>
                          <td>
                            <Badge bg="success">
                              ✅ {tx.pbftConsensus?.approveVotes || 'N/A'} Nodes Approved
                            </Badge>
                          </td>
                          <td>{new Date(tx.submittedAt).toLocaleString()}</td>
                          <td>{getStatusBadge(tx.status)}</td>
                          <td>
                            {tx.status === 'PENDING_ADMIN_APPROVAL' && (
                              <div className="btn-group" role="group">
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => handleAdminApproval(tx)}
                                  disabled={approvalLoading}
                                >
                                  🔐 Review & Sign
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* First Row: Role Assignment and Treasury */}
        <Row className="g-4 mb-4">
          <Col md={6}>
            <RoleAssignment />
          </Col>
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

        {/* PBFT Configuration */}
        <Row className="g-4 mb-4">
          <Col md={4}>
            <Card className="glass-card border-0">
              <Card.Body>
                <Card.Title className="neon-label">🎯 Consensus Settings</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>Required Consensus (%)</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="67"
                    min="51"
                    max="100"
                    value={consensusPercentage}
                    onChange={(e) => setConsensusPercentage(e.target.value)}
                    className="neon-input"
                  />
                </Form.Group>
                <Button 
                  className="btn btn-secondary w-100" 
                  onClick={updateConsensusPercentage}
                  disabled={!consensusPercentage}
                >
                  Update Percentage
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="glass-card border-0">
              <Card.Body>
                <Card.Title className="neon-label">⏰ Timeout Settings</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>Consensus Timeout (seconds)</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="600"
                    value={consensusTimeout}
                    onChange={(e) => setConsensusTimeout(e.target.value)}
                    className="neon-input"
                  />
                </Form.Group>
                <Button 
                  className="btn btn-secondary w-100" 
                  onClick={updateConsensusTimeout}
                  disabled={!consensusTimeout}
                >
                  Update Timeout
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="glass-card border-0">
              <Card.Body>
                <Card.Title className="neon-label">💰 Stake Settings</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>Min PBFT Stake (ETH)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.1"
                    placeholder="1.0"
                    value={minPBFTStake}
                    onChange={(e) => setMinPBFTStake(e.target.value)}
                    className="neon-input"
                  />
                </Form.Group>
                <Button 
                  className="btn btn-secondary w-100" 
                  onClick={updateMinPBFTStake}
                  disabled={!minPBFTStake}
                >
                  Update Min Stake
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* PBFT Node Management */}
        <Row className="g-4 mb-4">
          <Col md={12}>
            <Card className="glass-card border-0">
              <Card.Body>
                <Card.Title className="neon-label">🔗 PBFT Node Management</Card.Title>
                
                {/* Add New Node Form */}
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Node Address</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="0x..."
                        value={newNodeAddress}
                        onChange={(e) => setNewNodeAddress(e.target.value)}
                        className="neon-input"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Stake (ETH)</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        placeholder="1.0"
                        value={nodeStake}
                        onChange={(e) => setNodeStake(e.target.value)}
                        className="neon-input"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2} className="d-flex align-items-end">
                    <Button 
                      onClick={addPBFTNode} 
                      className="btn btn-success w-100"
                      disabled={!newNodeAddress || !nodeStake}
                    >
                      Add Node
                    </Button>
                  </Col>
                </Row>
                
                {/* Active Nodes Table */}
                <Table striped bordered hover variant="dark" className="mt-3">
                  <thead>
                    <tr>
                      <th>Node Address</th>
                      <th>Stake (ETH)</th>
                      <th>Votes Participated</th>
                      <th>Accuracy</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pbftNodes.map((node, index) => (
                      <tr key={index}>
                        <td>{node.address.substring(0, 10)}...{node.address.substring(node.address.length - 8)}</td>
                        <td>{parseFloat(node.stake).toFixed(2)}</td>
                        <td>{node.votesParticipated}</td>
                        <td>
                          <Badge 
                            bg={parseInt(node.accuracyPercentage) >= 80 ? "success" : 
                                parseInt(node.accuracyPercentage) >= 60 ? "warning" : "danger"}
                          >
                            {node.accuracyPercentage}%
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={node.isActive ? "success" : "secondary"}>
                            {node.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            variant="danger" 
                            size="sm"
                            onClick={() => removePBFTNode(node.address)}
                            disabled={!node.isActive}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                
                {pbftNodes.length === 0 && (
                  <div className="text-center text-muted py-4">
                    No PBFT nodes configured
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Pending Transactions Requiring Consensus */}
        <Row className="g-4">
          <Col md={12}>
            <Card className="glass-card border-0">
              <Card.Body>
                <Card.Title className="neon-label">⏳ Pending PBFT Consensus</Card.Title>
                <Table striped bordered hover variant="dark">
                  <thead>
                    <tr>
                      <th>Transaction Hash</th>
                      <th>Campaign ID</th>
                      <th>Publisher</th>
                      <th>Gateway</th>
                      <th>Votes Progress</th>
                      <th>Consensus Status</th>
                      <th>Proposal Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTransactions.map((tx, index) => {
                      const approveProgress = parseInt(tx.requiredVotes) > 0 
                        ? (parseInt(tx.approveVotes) / parseInt(tx.requiredVotes)) * 100 
                        : 0;
                      const rejectProgress = parseInt(tx.requiredVotes) > 0 
                        ? (parseInt(tx.rejectVotes) / parseInt(tx.requiredVotes)) * 100 
                        : 0;
                      
                      return (
                        <tr key={index}>
                          <td>{tx.hash.substring(0, 10)}...{tx.hash.substring(tx.hash.length - 8)}</td>
                          <td>{tx.campaignId}</td>
                          <td>{tx.publisher.substring(0, 10)}...</td>
                          <td>{tx.gateway.substring(0, 10)}...</td>
                          <td>
                            <div className="mb-1">
                              <small>Approve: {tx.approveVotes}/{tx.requiredVotes}</small>
                              <div className="progress" style={{height: '6px'}}>
                                <div 
                                  className="progress-bar bg-success" 
                                  style={{width: `${Math.min(approveProgress, 100)}%`}}
                                ></div>
                              </div>
                            </div>
                            <div>
                              <small>Reject: {tx.rejectVotes}/{tx.requiredVotes}</small>
                              <div className="progress" style={{height: '6px'}}>
                                <div 
                                  className="progress-bar bg-danger" 
                                  style={{width: `${Math.min(rejectProgress, 100)}%`}}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge bg={tx.consensusReached ? "success" : "warning"}>
                              {tx.consensusReached ? "Reached" : "Pending"}
                            </Badge>
                          </td>
                          <td>{tx.proposalTime}</td>
                          <td>
                            {!tx.consensusReached && (
                              <Button 
                                variant="outline-warning" 
                                size="sm"
                                onClick={() => cleanupExpiredTransaction(tx.hash)}
                              >
                                Cleanup
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                
                {pendingTransactions.length === 0 && (
                  <div className="text-center text-muted py-4">
                    No pending transactions requiring consensus
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* NEW: Admin Approval Modal */}
      <Modal show={showApprovalModal} onHide={() => setShowApprovalModal(false)} centered size="lg">
        <Modal.Header closeButton className="bg-dark text-light">
          <Modal.Title>🔐 Admin Transaction Review</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-light">
          {selectedTx && (
            <div>
              <h5>Transaction Details:</h5>
              <Table variant="dark" borderless className="mb-4">
                <tbody>
                  <tr>
                    <td><strong>Transaction ID:</strong></td>
                    <td className="font-monospace">{selectedTx.id}</td>
                  </tr>
                  <tr>
                    <td><strong>Campaign ID:</strong></td>
                    <td>#{selectedTx.campaignId}</td>
                  </tr>
                  <tr>
                    <td><strong>Publisher:</strong></td>
                    <td className="font-monospace">{selectedTx.publisher}</td>
                  </tr>
                  <tr>
                    <td><strong>Gateway:</strong></td>
                    <td className="font-monospace">{selectedTx.gateway}</td>
                  </tr>
                  <tr>
                    <td><strong>PBFT Consensus:</strong></td>
                    <td>
                      <Badge bg="success">
                        ✅ {selectedTx.pbftConsensus?.approveVotes || 'N/A'} nodes approved
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Submitted:</strong></td>
                    <td>{new Date(selectedTx.submittedAt).toLocaleString()}</td>
                  </tr>
                </tbody>
              </Table>
              
              <Alert variant="info">
                <h6>🔒 Admin Signature Required</h6>
                <p className="mb-0">
                  This transaction has passed PBFT consensus validation. As an admin, you need to 
                  provide your cryptographic signature to authorize final execution on the blockchain.
                </p>
              </Alert>

              <Alert variant="warning">
                <h6>⚠️ Review Carefully</h6>
                <ul className="mb-0">
                  <li>Verify the publisher and campaign details</li>
                  <li>Check PBFT node consensus results</li>
                  <li>Ensure transaction legitimacy</li>
                  <li>Your signature will be recorded on-chain</li>
                </ul>
              </Alert>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-dark">
          <Button variant="secondary" onClick={() => setShowApprovalModal(false)} disabled={approvalLoading}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={() => submitAdminDecision('reject')}
            disabled={approvalLoading}
          >
            {approvalLoading ? <Spinner animation="border" size="sm" /> : "❌ Reject"}
          </Button>
          <Button 
            variant="success" 
            onClick={() => submitAdminDecision('approve')}
            disabled={approvalLoading}
          >
            {approvalLoading ? <Spinner animation="border" size="sm" /> : "✅ Sign & Approve"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
