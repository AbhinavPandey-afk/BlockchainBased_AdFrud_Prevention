// import React, { useState } from "react";
// import { Container, Form, Button, Alert, Card, Row, Col } from "react-bootstrap";
// import { useWallet } from "../context/WalletContext";
// import { ethers } from "ethers";
// import Navbar from "../components/Navbar";
// import Footer from "../components/Footer";
// import SubmitClick from "../components/SubmitClick";

// const Gateway = () => {
//   const { contract, account, connect } = useWallet();
//   const [stakeAmount, setStakeAmount] = useState("");
//   const [unstakeAmount, setUnstakeAmount] = useState("");
//   const [msg, setMsg] = useState(null);

//   const ensure = async () => {
//     if (!account) await connect();
//     if (!contract) throw new Error("Contract not available");
//   };

//   const stake = async () => {
//     try {
//       await ensure();
//       const value = ethers.utils.parseEther(stakeAmount || "0");
//       const tx = await contract.stakeGateway({ value });
//       await tx.wait();
//       setMsg("Staked successfully");
//     } catch (e) { setMsg("Error: " + e.message); }
//   };

//   const unstake = async () => {
//     try {
//       await ensure();
//       const amt = ethers.utils.parseEther(unstakeAmount || "0");
//       const tx = await contract.unstakeGateway(amt);
//       await tx.wait();
//       setMsg("Unstaked successfully");
//     } catch (e) { setMsg("Error: " + e.message); }
//   };

//   return (
//     <div className="d-flex flex-column min-vh-100">
//       <Navbar />
//       <Container className="py-5">
//         <h2>Gateway</h2>
//         {msg && <Alert variant={msg.startsWith("Error") ? "danger" : "success"} className="glass-alert">{msg}</Alert>}

//         {/* Stake & Unstake side by side */}
//         <Row className="mb-4">
//           <Col md={6}>
//             <Card className="glass-card border-0 h-100">
//               <Card.Body>
//                 <Card.Title className="neon-label">💰 Stake Gateway</Card.Title>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Amount (ETH)</Form.Label>
//                   <Form.Control
//                     type="text"
//                     placeholder="0.1"
//                     value={stakeAmount}
//                     onChange={(e) => setStakeAmount(e.target.value)}
//                     className="neon-input"
//                   />
//                 </Form.Group>
//                 <Button
//                   className="btn btn-primary w-100"
//                   onClick={stake}
//                   disabled={!stakeAmount}
//                 >
//                   Stake
//                 </Button>
//               </Card.Body>
//             </Card>
//           </Col>

//           <Col md={6}>
//             <Card className="glass-card border-0 h-100">
//               <Card.Body>
//                 <Card.Title className="neon-label">🪙 Unstake Gateway</Card.Title>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Amount (ETH)</Form.Label>
//                   <Form.Control
//                     type="text"
//                     placeholder="0.1"
//                     value={unstakeAmount}
//                     onChange={(e) => setUnstakeAmount(e.target.value)}
//                     className="neon-input"
//                   />
//                 </Form.Group>
//                 <Button
//                   className="btn btn-primary w-100"
//                   onClick={unstake}
//                   disabled={!unstakeAmount}
//                 >
//                   Unstake
//                 </Button>
//               </Card.Body>
//             </Card>
//           </Col>
//         </Row>

//         <SubmitClick />
//       </Container>
//       <Footer />
//     </div>
//   );
// };

// export default Gateway;
import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert, Card, Row, Col, Badge } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SubmitClick from "../components/SubmitClick";
import "./AdminDashboard.css"; // Use AMOLED styles

const Gateway = () => {
  const { contract, account, connect } = useWallet();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [msg, setMsg] = useState(null);
  const [availableHashes, setAvailableHashes] = useState([]);
  const [currentStake, setCurrentStake] = useState("0");

  const ensure = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const fetchStake = async () => {
    if (!contract || !account) return;
    try {
      const stake = await contract.stakeOf(account);
      setCurrentStake(ethers.utils.formatEther(stake));
    } catch (e) {
      console.error("Error fetching stake:", e);
    }
  };

  const stake = async () => {
    try {
      await ensure();
      const value = ethers.utils.parseEther(stakeAmount || "0");
      const tx = await contract.stakeGateway({ value });
      await tx.wait();
      setMsg("✅ Staked successfully");
      setStakeAmount("");
      fetchStake();
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    }
  };

  const unstake = async () => {
    try {
      await ensure();
      const amt = ethers.utils.parseEther(unstakeAmount || "0");
      const tx = await contract.unstakeGateway(amt);
      await tx.wait();
      setMsg("✅ Unstaked successfully");
      setUnstakeAmount("");
      fetchStake();
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    }
  };

  // Load available hashes from localStorage
  useEffect(() => {
    const loadHashes = () => {
      const hashes = JSON.parse(localStorage.getItem('availableHashes') || '[]');
      // Filter hashes to show more recent ones first and add status indicators
      const processedHashes = hashes.map(hash => ({
        ...hash,
        isRecent: (Date.now() / 1000) - hash.timestamp < 3600, // Last hour
        age: Math.floor((Date.now() / 1000) - hash.timestamp)
      }));
      setAvailableHashes(processedHashes);
    };

    // Load initial hashes
    loadHashes();

    // Set up polling to check for new hashes
    const interval = setInterval(loadHashes, 2000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (contract && account) {
      fetchStake();
    }
  }, [contract, account]);

  const clearHash = (index) => {
    const updatedHashes = availableHashes.filter((_, i) => i !== index);
    setAvailableHashes(updatedHashes);
    localStorage.setItem('availableHashes', JSON.stringify(updatedHashes));
  };

  const clearAllHashes = () => {
    setAvailableHashes([]);
    localStorage.setItem('availableHashes', JSON.stringify([]));
  };

  const formatAge = (seconds) => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="d-flex flex-column min-vh-100 amoled-bg text-light">
      <Navbar />
      <Container className="py-5">
        <h2 className="mb-4 text-center fw-bold neon-cyan display-5">
          🌐 Gateway Operations
        </h2>
        
        <Row className="g-4 mb-4">
          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">⚡ Gateway Staking</Card.Title>
                
                <div className="text-center mb-3">
                  <h4 className="neon-cyan">Current Stake: {currentStake} ETH</h4>
                </div>

                {msg && (
                  <Alert 
                    variant={msg.includes("✅") ? "success" : "danger"}
                    className="glass-alert"
                    onClose={() => setMsg(null)}
                    dismissible
                  >
                    {msg}
                  </Alert>
                )}
                
                <Form.Group className="mb-3">
                  <Form.Label>Stake Amount (ETH)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.0"
                    className="neon-input"
                  />
                </Form.Group>
                <Button 
                  variant="success" 
                  onClick={stake} 
                  className="w-100 mb-3"
                  disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
                >
                  💰 Stake
                </Button>

                <Form.Group className="mb-3">
                  <Form.Label>Unstake Amount (ETH)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="0.0"
                    className="neon-input"
                    max={currentStake}
                  />
                </Form.Group>
                <Button 
                  variant="warning" 
                  onClick={unstake}
                  className="w-100"
                  disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0 || parseFloat(unstakeAmount) > parseFloat(currentStake)}
                >
                  📤 Unstake
                </Button>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Card.Title className="neon-label mb-0">🔗 Available Click Hashes</Card.Title>
                  {availableHashes.length > 0 && (
                    <Button variant="outline-danger" size="sm" onClick={clearAllHashes}>
                      Clear All
                    </Button>
                  )}
                </div>
                
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {availableHashes.length === 0 ? (
                    <div className="text-center text-muted py-4">
                      <span style={{ fontSize: '2rem', opacity: 0.5 }}>🔗</span>
                      <p className="small mt-2">
                        No click hashes available.<br/>
                        Visit the published ads page to generate clicks.
                      </p>
                    </div>
                  ) : (
                    availableHashes.map((hash, index) => (
                      <Card key={index} className="mb-3 glass-list border-0">
                        <Card.Body className="p-3">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <h6 className="text-info mb-0">
                              Click Hash #{index + 1}
                              {hash.isRecent && (
                                <Badge bg="success" className="ms-2">New</Badge>
                              )}
                            </h6>
                            <Button 
                              size="sm" 
                              variant="outline-danger" 
                              onClick={() => clearHash(index)}
                            >
                              ✕
                            </Button>
                          </div>
                          
                          <div className="small mb-2">
                            <Row>
                              <Col md={6}>
                                <div><strong>Campaign ID:</strong> {hash.campaignId}</div>
                                <div><strong>CPC:</strong> {hash.cpc} ETH</div>
                              </Col>
                              <Col md={6}>
                                <div>
                                  <strong>Publisher:</strong> 
                                  <br/>
                                  <code className="text-warning">
                                    {hash.publisherAddress.substring(0, 10)}...
                                    {hash.publisherAddress.substring(hash.publisherAddress.length - 6)}
                                  </code>
                                </div>
                              </Col>
                            </Row>
                            <div className="mt-2">
                              <strong>Hash:</strong> 
                              <br/>
                              <code className="text-muted small">
                                {hash.clickHash.substring(0, 40)}...
                              </code>
                            </div>
                          </div>
                          
                          <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                              Generated {formatAge(hash.age)}
                            </small>
                            <Badge bg={hash.age < 300 ? "success" : hash.age < 3600 ? "warning" : "secondary"}>
                              {hash.age < 300 ? "Fresh" : hash.age < 3600 ? "Valid" : "Aging"}
                            </Badge>
                          </div>
                        </Card.Body>
                      </Card>
                    ))
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-4">
          <Col>
            <SubmitClick availableHashes={availableHashes} />
          </Col>
        </Row>
      </Container>
      <Footer />
    </div>
  );
};

export default Gateway;

