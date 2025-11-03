
import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert, Row, Col, Card, Table, Badge } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CampaignCard from "../components/CampaignCard";
import "./AdminDashboard.css"; // Reuse AMOLED styles

const Publisher = () => {
  const { contract, account, connect } = useWallet();
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState(null);
  const [balance, setBalance] = useState("0");
  const [campaigns, setCampaigns] = useState([]);
  const [publisherClicks, setPublisherClicks] = useState([]);
  const [loading, setLoading] = useState(false);

  const requireConnected = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  // --- Withdraw ---
  const withdraw = async () => {
    try {
      setLoading(true);
      await requireConnected();
      const valueInWei = ethers.utils.parseEther(amount || "0");
      const tx = await contract.withdrawPublisher(valueInWei);
      await tx.wait();
      setMsg("✅ Withdrawn successfully");
      setAmount("");
      fetchBalance();
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Balance fetch ---
  const fetchBalance = async () => {
    if (!contract || !account) return;
    try {
      const bal = await contract.publisherBalance(account);
      setBalance(bal.toString());
    } catch (e) {
      console.error("Error fetching balance:", e);
      setMsg("❌ Error fetching balance: " + e.message);
    }
  };

  // --- Fetch all campaigns ---
  const fetchCampaigns = async () => {
    if (!contract) return;
    try {
      const campaignIds = await contract.getCampaignIds();
      const campaignData = [];
      
      for (const id of campaignIds) {
        const campaign = await contract.getCampaign(id);
        if (!campaign.paused && campaign.budgetWei.gt(0)) {
          campaignData.push({
            id: id.toString(),
            advertiser: campaign.advertiser,
            cpcWei: campaign.cpcWei,
            budgetWei: campaign.budgetWei,
            paused: campaign.paused,
            meta: campaign.meta
          });
        }
      }
      
      setCampaigns(campaignData);
    } catch (e) {
      console.error("Error fetching campaigns:", e);
    }
  };

  // --- Fetch publisher's clicks with PBFT status ---
  const fetchPublisherClicks = async () => {
    if (!contract || !account) return;
    try {
      // Get approved clicks where this publisher was paid
      const approvedFilter = contract.filters.ClickRecorded(null, null, account);
      const approvedEvents = await contract.queryFilter(approvedFilter, 0, "latest");
      
      const approvedClicks = new Set();
      const approvedClicksData = approvedEvents.map((e) => {
        approvedClicks.add(e.args.clickHash);
        return {
          clickHash: e.args.clickHash,
          campaignId: e.args.campaignId.toString(),
          gateway: e.args.gateway,
          timestamp: new Date(e.args.timestamp.toNumber() * 1000).toLocaleString(),
          status: "approved",
          earnings: ethers.utils.formatEther(e.args.cpcWei),
          blockNumber: e.blockNumber
        };
      });

      // Get all proposed transactions to find pending/rejected ones for this publisher
      const proposedFilter = contract.filters.TransactionProposed();
      const proposedEvents = await contract.queryFilter(proposedFilter, 0, "latest");
      
      const pendingAndRejectedClicks = [];
      
      for (const event of proposedEvents) {
        const txHash = event.args.txHash;
        
        if (!approvedClicks.has(txHash)) {
          try {
            const details = await contract.getPendingTransactionDetails(txHash);
            
            // Check if this transaction is for the current publisher
            if (details.publisher.toLowerCase() === account.toLowerCase()) {
              let status = "pending";
              let statusColor = "warning";
              
              if (details.consensusReached) {
                if (details.executed) {
                  status = "approved";
                  statusColor = "success";
                } else {
                  status = "rejected";
                  statusColor = "danger";
                }
              }

              pendingAndRejectedClicks.push({
                clickHash: txHash,
                campaignId: details.campaignId.toString(),
                gateway: details.gateway,
                timestamp: new Date(details.proposalTime * 1000).toLocaleString(),
                status: status,
                statusColor: statusColor,
                approveVotes: details.approveVotes.toString(),
                rejectVotes: details.rejectVotes.toString(),
                requiredVotes: details.requiredVotes.toString(),
                earnings: status === "approved" ? "Calculating..." : "0",
                blockNumber: event.blockNumber
              });
            }
          } catch (err) {
            console.error("Error fetching transaction details:", err);
          }
        }
      }

      // Combine and sort by block number (newest first)
      const allClicks = [...approvedClicksData, ...pendingAndRejectedClicks]
        .sort((a, b) => b.blockNumber - a.blockNumber);
      
      setPublisherClicks(allClicks);
    } catch (e) {
      console.error("Error fetching publisher clicks:", e);
    }
  };

  // --- Navigate to Published Page ---
  const goToPublishedPage = () => {
    window.open('/published', '_blank');
  };

  // --- Load on mount ---
  useEffect(() => {
    if (contract && account) {
      fetchBalance();
      fetchCampaigns();
      fetchPublisherClicks();

      // Set up event listeners for real-time updates
      const clickFilter = contract.filters.ClickRecorded(null, null, account);
      const proposedFilter = contract.filters.TransactionProposed();
      const consensusFilter = contract.filters.ConsensusReached();
      
      contract.on(clickFilter, () => {
        fetchBalance();
        fetchPublisherClicks();
      });
      
      contract.on(proposedFilter, (txHash, campaignId, publisher) => {
        if (publisher.toLowerCase() === account.toLowerCase()) {
          fetchPublisherClicks();
        }
      });
      
      contract.on(consensusFilter, () => {
        fetchPublisherClicks();
        fetchBalance();
      });
      
      return () => {
        contract.off(clickFilter);
        contract.off(proposedFilter);
        contract.off(consensusFilter);
      };
    }
  }, [contract, account]);

  return (
    <div className="d-flex flex-column min-vh-100 amoled-bg text-light">
      <Navbar />
      <Container className="py-5">
        <h2 className="mb-4 text-center fw-bold neon-cyan display-5">
          📰 Publisher Dashboard
        </h2>
        
        <Row className="g-4 mb-4">
          {/* Balance and Withdrawal */}
          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">💰 Publisher Balance</Card.Title>
                
                <div className="text-center mb-3">
                  <h3 className="neon-cyan">
                    {ethers.utils.formatEther(balance)} ETH
                  </h3>
                  <small className="text-muted">Available for withdrawal</small>
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
                  <Form.Label>Withdraw Amount (ETH)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="neon-input"
                    max={ethers.utils.formatEther(balance)}
                  />
                </Form.Group>
                
                <div className="d-grid gap-2">
                  <Button 
                    variant="success" 
                    onClick={withdraw} 
                    disabled={!amount || loading || parseFloat(amount) <= 0}
                  >
                    {loading ? "Processing..." : "💰 Withdraw"}
                  </Button>
                  
                  <Button variant="info" onClick={goToPublishedPage}>
                    🌐 View Published Ads
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Click Performance Summary */}
          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">📊 Click Performance</Card.Title>
                
                <Row className="text-center">
                  <Col md={4}>
                    <div className="text-success mb-2">
                      <strong>{publisherClicks.filter(c => c.status === "approved").length}</strong>
                      <div className="small">Approved</div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-warning mb-2">
                      <strong>{publisherClicks.filter(c => c.status === "pending").length}</strong>
                      <div className="small">Pending</div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-danger mb-2">
                      <strong>{publisherClicks.filter(c => c.status === "rejected").length}</strong>
                      <div className="small">Rejected</div>
                    </div>
                  </Col>
                </Row>

                <hr className="neon-hr" />

                <div className="text-center">
                  <h6 className="text-muted">Total Lifetime Earnings</h6>
                  <h4 className="text-success">
                    {publisherClicks
                      .filter(c => c.status === "approved")
                      .reduce((sum, c) => sum + parseFloat(c.earnings || 0), 0)
                      .toFixed(8)
                    } ETH
                  </h4>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Available Campaigns */}
        <Row className="g-4 mb-4">
          <Col>
            <Card className="glass-card border-0">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Card.Title className="neon-label mb-0">
                    🎯 Available Campaigns ({campaigns.length})
                  </Card.Title>
                  <Button variant="outline-primary" onClick={fetchCampaigns} size="sm">
                    🔄 Refresh
                  </Button>
                </div>
                
                <Row>
                  {campaigns.length === 0 ? (
                    <Col>
                      <Alert variant="info" className="glass-alert text-center">
                        <h5>No active campaigns available</h5>
                        <p>Check back later for new advertising opportunities!</p>
                      </Alert>
                    </Col>
                  ) : (
                    campaigns.map((campaign) => (
                      <Col md={4} key={campaign.id} className="mb-3">
                        <CampaignCard campaign={campaign} />
                      </Col>
                    ))
                  )}
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Publisher's Click History */}
        <Row className="g-4">
          <Col>
            <Card className="glass-card border-0">
              <Card.Body>
                <Card.Title className="neon-label">🔍 Your Click History & PBFT Status</Card.Title>
                
                {publisherClicks.length > 0 ? (
                  <Table striped bordered hover variant="dark" className="mt-3">
                    <thead>
                      <tr>
                        <th>Click Hash</th>
                        <th>Campaign</th>
                        <th>Gateway</th>
                        <th>PBFT Status</th>
                        <th>Earnings</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publisherClicks.map((click, index) => (
                        <tr 
                          key={index}
                          style={{
                            opacity: click.status === "approved" ? 1.0 : 
                                    click.status === "pending" ? 0.8 : 0.5,
                            backgroundColor: click.status === "approved" ? "rgba(76, 175, 80, 0.1)" :
                                           click.status === "rejected" ? "rgba(244, 67, 54, 0.1)" :
                                           "rgba(255, 193, 7, 0.1)"
                          }}
                        >
                          <td>
                            <code className="small">
                              {click.clickHash.substring(0, 10)}...
                            </code>
                          </td>
                          <td>
                            <Badge bg="info">Campaign {click.campaignId}</Badge>
                          </td>
                          <td>
                            <code className="small text-warning">
                              {click.gateway.substring(0, 8)}...
                            </code>
                          </td>
                          <td>
                            <Badge 
                              bg={click.status === "approved" ? "success" : 
                                  click.status === "pending" ? "warning" : "danger"}
                            >
                              {click.status === "approved" ? "✅ APPROVED" :
                               click.status === "pending" ? "⏳ PENDING PBFT" :
                               "❌ REJECTED"}
                            </Badge>
                            {click.status === "pending" && (
                              <div className="small text-muted mt-1">
                                Votes: {click.approveVotes}✓ {click.rejectVotes}✗ 
                                (Need: {click.requiredVotes})
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={
                              click.status === "approved" ? "text-success fw-bold" : "text-muted"
                            }>
                              {click.status === "approved" ? 
                                `${click.earnings} ETH` : 
                                "0 ETH"
                              }
                            </span>
                          </td>
                          <td>
                            <small className="text-muted">
                              {click.timestamp}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <div className="text-center text-muted py-4">
                    <h5>No clicks recorded yet</h5>
                    <p>Your click history will appear here once you start earning from ads.</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
      <Footer />
    </div>
  );
};

export default Publisher;


