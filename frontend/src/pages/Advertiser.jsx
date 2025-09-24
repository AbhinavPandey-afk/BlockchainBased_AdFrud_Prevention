import React, { useState, useEffect } from "react";
import { Container, Alert, Form, Button, Card, Row, Col, Table, Badge } from "react-bootstrap";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CreateCampaign from "../components/CreateCampaign";
import "./AdminDashboard.css"; // Reuse AMOLED styles

const Advertiser = () => {
  const { contract, account, connect } = useWallet();
  const [campaignId, setCampaignId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [msg, setMsg] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignClicks, setSelectedCampaignClicks] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  const ensure = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const fundCampaign = async () => {
    try {
      await ensure();
      const value = ethers.utils.parseEther(fundAmount || "0");
      const tx = await contract.fundCampaign(campaignId, { value });
      await tx.wait();
      setMsg("✅ Campaign funded successfully");
      fetchCampaigns();
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    }
  };

  const pauseCampaign = async (pause) => {
    try {
      await ensure();
      const tx = await contract.setCampaignPaused(campaignId, pause);
      await tx.wait();
      setMsg(`✅ Campaign ${pause ? "paused" : "resumed"}`);
      fetchCampaigns();
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    }
  };

  // Fetch advertiser's campaigns
  const fetchCampaigns = async () => {
    try {
      await ensure();
      const campaignIds = await contract.getCampaignIds();
      const advertiserCampaigns = [];

      for (const id of campaignIds) {
        const campaign = await contract.getCampaign(id);
        if (campaign.advertiser.toLowerCase() === account.toLowerCase()) {
          advertiserCampaigns.push({
            id: id.toString(),
            advertiser: campaign.advertiser,
            cpcWei: campaign.cpcWei,
            budgetWei: campaign.budgetWei,
            paused: campaign.paused,
            meta: campaign.meta
          });
        }
      }

      setCampaigns(advertiserCampaigns);
    } catch (e) {
      console.error("Error fetching campaigns:", e);
    }
  };

  // Fetch clicks with PBFT consensus status
  const fetchCampaignClicks = async (campaignId) => {
    try {
      await ensure();
      setSelectedCampaignId(campaignId);

      // Get approved clicks (ClickRecorded events)
      const approvedFilter = contract.filters.ClickRecorded(null, campaignId, null);
      const approvedEvents = await contract.queryFilter(approvedFilter, 0, "latest");
      
      const approvedClicks = new Set();
      const approvedClicksData = approvedEvents.map((e) => {
        approvedClicks.add(e.args.clickHash);
        return {
          clickHash: e.args.clickHash,
          publisher: e.args.publisher,
          gateway: e.args.gateway,
          timestamp: new Date(e.args.timestamp.toNumber() * 1000).toLocaleString(),
          status: "approved",
          cpcPaid: ethers.utils.formatEther(e.args.cpcWei)
        };
      });

      // Get all proposed transactions for this campaign
      const proposedFilter = contract.filters.TransactionProposed();
      const proposedEvents = await contract.queryFilter(proposedFilter, 0, "latest");
      
      const pendingAndRejectedClicks = [];
      
      for (const event of proposedEvents) {
        const txHash = event.args.txHash;
        const eventCampaignId = event.args.campaignId.toString();
        
        if (eventCampaignId === campaignId && !approvedClicks.has(txHash)) {
          try {
            const details = await contract.getPendingTransactionDetails(txHash);
            
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
              publisher: details.publisher,
              gateway: details.gateway,
              timestamp: new Date(details.proposalTime * 1000).toLocaleString(),
              status: status,
              statusColor: statusColor,
              approveVotes: details.approveVotes.toString(),
              rejectVotes: details.rejectVotes.toString(),
              totalVotes: details.totalVotes.toString(),
              requiredVotes: details.requiredVotes.toString(),
              cpcPaid: status === "approved" ? ethers.utils.formatEther(
                (await contract.getCampaign(campaignId)).cpcWei
              ) : "0"
            });
          } catch (err) {
            console.error("Error fetching transaction details:", err);
          }
        }
      }

      // Combine and sort by timestamp (newest first)
      const allClicks = [...approvedClicksData, ...pendingAndRejectedClicks]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setSelectedCampaignClicks(allClicks);
    } catch (e) {
      console.error("Error fetching campaign clicks:", e);
    }
  };

  useEffect(() => {
    if (contract && account) {
      fetchCampaigns();
      
      // Set up event listeners for real-time updates
      const approvedFilter = contract.filters.ClickRecorded();
      const proposedFilter = contract.filters.TransactionProposed();
      const consensusFilter = contract.filters.ConsensusReached();
      
      contract.on(approvedFilter, () => {
        if (selectedCampaignId) {
          fetchCampaignClicks(selectedCampaignId);
        }
        fetchCampaigns();
      });
      
      contract.on(proposedFilter, () => {
        if (selectedCampaignId) {
          fetchCampaignClicks(selectedCampaignId);
        }
      });
      
      contract.on(consensusFilter, () => {
        if (selectedCampaignId) {
          fetchCampaignClicks(selectedCampaignId);
        }
      });
      
      return () => {
        contract.off(approvedFilter);
        contract.off(proposedFilter);
        contract.off(consensusFilter);
      };
    }
  }, [contract, account, selectedCampaignId]);

  return (
    <div className="d-flex flex-column min-vh-100 amoled-bg text-light">
      <Navbar />
      <Container className="py-5">
        <h2 className="mb-4 text-center fw-bold neon-cyan display-5">
          📢 Advertiser Dashboard
        </h2>

        <CreateCampaign />

        <hr className="neon-hr my-5" />

        {/* Campaign Management */}
        <Row className="g-4 mb-4">
          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">⚙️ Manage Campaign</Card.Title>

                {msg && (
                  <Alert
                    variant={msg.startsWith("✅") ? "success" : "danger"}
                    className="glass-alert"
                    onClose={() => setMsg(null)}
                    dismissible
                  >
                    {msg}
                  </Alert>
                )}

                <Form.Group className="mb-3">
                  <Form.Label>Campaign ID</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter campaign ID"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="neon-input"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Fund Amount (ETH)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. 0.5"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="neon-input"
                  />
                  <Button
                    className="btn btn-primary w-100 mt-2"
                    onClick={fundCampaign}
                    disabled={!campaignId || !fundAmount}
                  >
                    💰 Fund Campaign
                  </Button>
                </Form.Group>

                <div className="d-flex gap-2 mt-2">
                  <Button
                    className="btn btn-warning flex-fill"
                    onClick={() => pauseCampaign(true)}
                    disabled={!campaignId}
                  >
                    ⏸️ Pause
                  </Button>
                  <Button
                    className="btn btn-secondary flex-fill"
                    onClick={() => pauseCampaign(false)}
                    disabled={!campaignId}
                  >
                    ▶️ Resume
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="glass-card border-0 h-100">
              <Card.Body>
                <Card.Title className="neon-label">📊 Your Campaigns</Card.Title>
                
                {campaigns.length > 0 ? (
                  <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                    {campaigns.map((campaign, index) => (
                      <div 
                        key={index}
                        className="campaign-item p-3 mb-2 glass-list rounded cursor-pointer"
                        onClick={() => fetchCampaignClicks(campaign.id)}
                        style={{ 
                          opacity: campaign.paused ? 0.6 : 1,
                          cursor: "pointer",
                          transition: "all 0.3s ease"
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = "rgba(66, 165, 245, 0.1)"}
                        onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong className="text-info">Campaign {campaign.id}</strong>
                            {campaign.paused ? (
                              <Badge bg="danger" className="ms-2">Paused</Badge>
                            ) : (
                              <Badge bg="success" className="ms-2">Active</Badge>
                            )}
                          </div>
                          <small className="text-muted">Click to view clicks</small>
                        </div>
                        <div className="small mt-1">
                          <span className="text-warning">Budget: </span>
                          {ethers.utils.formatEther(campaign.budgetWei)} ETH |
                          <span className="text-success"> CPC: </span>
                          {ethers.utils.formatEther(campaign.cpcWei)} ETH
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted py-4">
                    <p>No campaigns found</p>
                    <small>Create a campaign above to get started</small>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Click Details with PBFT Status */}
        {selectedCampaignId && (
          <Row className="g-4">
            <Col md={12}>
              <Card className="glass-card border-0">
                <Card.Body>
                  <Card.Title className="neon-label">
                    🔍 Campaign {selectedCampaignId} - Click Analysis & PBFT Consensus
                  </Card.Title>
                  
                  {selectedCampaignClicks.length > 0 ? (
                    <Table striped bordered hover variant="dark" className="mt-3">
                      <thead>
                        <tr>
                          <th>Click Hash</th>
                          <th>Publisher</th>
                          <th>Gateway</th>
                          <th>PBFT Status</th>
                          <th>Votes</th>
                          <th>Payment</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCampaignClicks.map((click, index) => (
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
                                {click.clickHash.substring(click.clickHash.length - 6)}
                              </code>
                            </td>
                            <td>
                              <code className="small text-warning">
                                {click.publisher.substring(0, 8)}...
                              </code>
                            </td>
                            <td>
                              <code className="small text-info">
                                {click.gateway.substring(0, 8)}...
                              </code>
                            </td>
                            <td>
                              <div>
                                <Badge 
                                  bg={click.status === "approved" ? "success" : 
                                      click.status === "pending" ? "warning" : "danger"}
                                  className="mb-1"
                                >
                                  {click.status === "approved" ? "✅ APPROVED" :
                                   click.status === "pending" ? "⏳ PENDING" :
                                   "❌ REJECTED"}
                                </Badge>
                                {click.status === "approved" && (
                                  <div className="small text-success">
                                    ✨ Consensus Reached - Payment Processed
                                  </div>
                                )}
                                {click.status === "rejected" && (
                                  <div className="small text-danger">
                                    🚫 Consensus Rejected - Fraudulent Click
                                  </div>
                                )}
                                {click.status === "pending" && (
                                  <div className="small text-warning">
                                    🗳️ Awaiting PBFT Validation
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              {click.status !== "approved" && (
                                <div className="small">
                                  <div className="text-success">✓ {click.approveVotes || 0}</div>
                                  <div className="text-danger">✗ {click.rejectVotes || 0}</div>
                                  <div className="text-muted">
                                    Need: {click.requiredVotes || "N/A"}
                                  </div>
                                </div>
                              )}
                              {click.status === "approved" && (
                                <Badge bg="success">Validated</Badge>
                              )}
                            </td>
                            <td>
                              <div className="fw-bold">
                                {click.status === "approved" ? (
                                  <span className="text-success">
                                    {click.cpcPaid} ETH
                                  </span>
                                ) : (
                                  <span className="text-muted">
                                    0 ETH
                                  </span>
                                )}
                              </div>
                              <div className="small text-muted">
                                {click.status === "approved" ? "Paid to Publisher" :
                                 click.status === "pending" ? "Payment Pending" :
                                 "No Payment Made"}
                              </div>
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
                      <h5>No clicks recorded for this campaign</h5>
                      <p>Clicks will appear here once publishers start interacting with your ads.</p>
                    </div>
                  )}

                  {selectedCampaignClicks.length > 0 && (
                    <div className="mt-3 p-3 glass-list rounded">
                      <h6 className="neon-label mb-2">📈 Campaign Click Summary</h6>
                      <Row className="text-center">
                        <Col md={3}>
                          <div className="text-success">
                            <strong>{selectedCampaignClicks.filter(c => c.status === "approved").length}</strong>
                            <div className="small">Approved Clicks</div>
                          </div>
                        </Col>
                        <Col md={3}>
                          <div className="text-warning">
                            <strong>{selectedCampaignClicks.filter(c => c.status === "pending").length}</strong>
                            <div className="small">Pending Validation</div>
                          </div>
                        </Col>
                        <Col md={3}>
                          <div className="text-danger">
                            <strong>{selectedCampaignClicks.filter(c => c.status === "rejected").length}</strong>
                            <div className="small">Rejected (Fraud)</div>
                          </div>
                        </Col>
                        <Col md={3}>
                          <div className="text-info">
                            <strong>
                              {selectedCampaignClicks
                                .filter(c => c.status === "approved")
                                .reduce((sum, c) => sum + parseFloat(c.cpcPaid || 0), 0)
                                .toFixed(4)
                              } ETH
                            </strong>
                            <div className="small">Total Paid</div>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Container>
      <Footer />
    </div>
  );
};

export default Advertiser;
