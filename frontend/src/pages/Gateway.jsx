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
  const [availableHashes, setAvailableHashes] = useState([]);

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
      setMsg("✅ Staked successfully");
      setStakeAmount("");
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
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    }
  };

  // Load available hashes from localStorage
  useEffect(() => {
    const loadHashes = () => {
      const hashes = JSON.parse(localStorage.getItem('availableHashes') || '[]');
      setAvailableHashes(hashes);
    };

    // Load initial hashes
    loadHashes();

    // Set up polling to check for new hashes
    const interval = setInterval(loadHashes, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const clearHash = (index) => {
    const updatedHashes = availableHashes.filter((_, i) => i !== index);
    setAvailableHashes(updatedHashes);
    localStorage.setItem('availableHashes', JSON.stringify(updatedHashes));
  };

  const clearAllHashes = () => {
    setAvailableHashes([]);
    localStorage.setItem('availableHashes', JSON.stringify([]));
  };

  return (
    <>
      <Navbar />
      <Container>
        <Row>
          <Col md={6}>
            <Card>
              <Card.Header>⚡ Gateway Staking</Card.Header>
              <Card.Body>
                {msg && (
                  <Alert variant={msg.includes("✅") ? "success" : "danger"}>
                    {msg}
                  </Alert>
                )}
                
                <Form.Group className="mb-3">
                  <Form.Label>Stake Amount (ETH)</Form.Label>
                  <Form.Control
                    type="text"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.0"
                  />
                </Form.Group>
                <Button variant="success" onClick={stake} className="me-2">
                  💰 Stake
                </Button>

                <Form.Group className="mb-3 mt-3">
                  <Form.Label>Unstake Amount (ETH)</Form.Label>
                  <Form.Control
                    type="text"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="0.0"
                  />
                </Form.Group>
                <Button variant="warning" onClick={unstake}>
                  📤 Unstake
                </Button>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span>🔗 Available Click Hashes</span>
                {availableHashes.length > 0 && (
                  <Button variant="outline-danger" size="sm" onClick={clearAllHashes}>
                    Clear All
                  </Button>
                )}
              </Card.Header>
              <Card.Body>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {availableHashes.length === 0 ? (
                    <p className="text-muted">No click hashes available. Visit the published ads page to generate clicks.</p>
                  ) : (
                    availableHashes.map((hash, index) => (
                      <Card key={index} className="mb-2 border-info">
                        <Card.Body className="p-3">
                          <h6 className="text-info mb-1">Click Hash #{index + 1}</h6>
                          <p className="small mb-1">
                            <strong>Campaign ID:</strong> {hash.campaignId}<br/>
                            <strong>Publisher:</strong> {hash.publisherAddress.substring(0, 10)}...<br/>
                            <strong>CPC:</strong> {hash.cpc} ETH<br/>
                            <strong>Hash:</strong> <code>{hash.clickHash.substring(0, 30)}...</code>
                          </p>
                          <div className="d-flex justify-content-between">
                            <small className="text-muted">
                              {new Date(hash.timestamp * 1000).toLocaleTimeString()}
                            </small>
                            <Button size="sm" variant="outline-danger" onClick={() => clearHash(index)}>
                              Remove
                            </Button>
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

        <Row className="mt-4">
          <Col>
            <SubmitClick availableHashes={availableHashes} />
          </Col>
        </Row>
      </Container>
      <Footer />
    </>
  );
};

export default Gateway;
