import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Row, Col, Alert, Spinner, Badge } from 'react-bootstrap';
import { ethers } from 'ethers';
import ContractJSON from '../contracts/AdFraudPBFT.json';

// Utility function to generate click hash
const generateClickHash = async (campaignId, publisherAddress, timestamp) => {
  const message = `click_${campaignId}_${publisherAddress}_${timestamp}_${Math.random()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hashHex;
};

const Published = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [generatedHashes, setGeneratedHashes] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);

  // Mock publisher address - in production, get from wallet
  const publisherAddress = "0x1234567890123456789012345678901234567890";

  const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;

  // Initialize Web3 connection
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        let ethProvider;
        
        // Try to use MetaMask if available, otherwise use local RPC
        if (window.ethereum) {
          ethProvider = new ethers.providers.Web3Provider(window.ethereum);
        } else {
          // Fallback to local development node
          ethProvider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
        }
        
        setProvider(ethProvider);
        const contractInstance = new ethers.Contract(contractAddress, ContractJSON.abi, ethProvider);
        setContract(contractInstance);
        
      } catch (error) {
        console.error("Failed to initialize connection:", error);
        setMsg("❌ Failed to connect to blockchain");
        setLoading(false);
      }
    };

    initializeConnection();
  }, []);

  // Fetch campaigns from blockchain
  const fetchCampaigns = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      const campaignIds = await contract.getCampaignIds();
      const campaignList = [];

      for (let id of campaignIds) {
        try {
          const campaignData = await contract.getCampaign(id);
          // Only show campaigns with budget > 0 and not paused
          if (campaignData[2].gt(0) && !campaignData[3]) {
            campaignList.push({
              id: id.toString(),
              advertiser: campaignData[0],
              cpcWei: campaignData[1].toString(),
              budgetWei: campaignData[2].toString(),
              paused: campaignData[3],
              meta: campaignData[4],
            });
          }
        } catch (error) {
          console.error(`Failed to fetch campaign ${id}:`, error);
        }
      }

      setCampaigns(campaignList);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      setMsg("❌ Failed to fetch campaigns from blockchain");
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time event listener
  useEffect(() => {
    if (!contract) return;

    const setupEventListeners = async () => {
      try {
        // Listen for new campaigns
        const campaignCreatedFilter = contract.filters.CampaignCreated();
        
        contract.on(campaignCreatedFilter, (campaignId, advertiser, cpcWei, initialBudget, meta) => {
          console.log("New campaign created:", campaignId.toString());
          
          // Add new campaign to state if it has budget and is not paused
          if (initialBudget.gt(0)) {
            const newCampaign = {
              id: campaignId.toString(),
              advertiser,
              cpcWei: cpcWei.toString(),
              budgetWei: initialBudget.toString(),
              paused: false,
              meta,
            };
            
            setCampaigns(prev => {
              // Check if campaign already exists
              if (prev.find(c => c.id === newCampaign.id)) return prev;
              return [...prev, newCampaign];
            });
          }
        });

        // Listen for campaign funding
        contract.on("CampaignFunded", (campaignId, amount, newBudget) => {
          setCampaigns(prev => prev.map(c => 
            c.id === campaignId.toString() 
              ? { ...c, budgetWei: newBudget.toString() }
              : c
          ));
        });

        // Listen for campaign pause/resume
        contract.on("CampaignPaused", (campaignId, paused) => {
          setCampaigns(prev => prev.map(c => 
            c.id === campaignId.toString() 
              ? { ...c, paused }
              : c
          ));
        });

      } catch (error) {
        console.error("Failed to set up event listeners:", error);
      }
    };

    setupEventListeners();

    // Cleanup listeners on unmount
    return () => {
      contract.removeAllListeners();
    };
  }, [contract]);

  // Initial load
  useEffect(() => {
    if (contract) {
      fetchCampaigns();
    }
  }, [contract]);

  // Polling fallback (in case events are missed)
  useEffect(() => {
    if (!contract) return;

    const interval = setInterval(() => {
      fetchCampaigns();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [contract]);

  const handleAdClick = async (campaign) => {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const clickHash = await generateClickHash(campaign.id, publisherAddress, timestamp);
      
      // Add to available hashes list
      const newHash = {
        clickHash,
        campaignId: campaign.id,
        publisherAddress,
        timestamp,
        cpc: ethers.utils.formatEther(campaign.cpcWei)
      };
      
      setGeneratedHashes(prev => [newHash, ...prev.slice(0, 9)]); // Keep only last 10
      setMsg(`✅ Click registered! Hash: ${clickHash.substring(0, 10)}...`);
      
      // Store in localStorage to be picked up by Gateway.jsx
      const existingHashes = JSON.parse(localStorage.getItem('availableHashes') || '[]');
      existingHashes.unshift(newHash); // Add to beginning
      existingHashes.splice(50); // Keep only last 50 hashes
      localStorage.setItem('availableHashes', JSON.stringify(existingHashes));
      
      // Clear message after 3 seconds
      setTimeout(() => setMsg(null), 3000);
      
    } catch (error) {
      setMsg(`❌ Error generating click hash: ${error.message}`);
    }
  };

  // Updated parseMetadata function to load images from localStorage
  const parseMetadata = (metaString, campaignId) => {
    try {
      const meta = JSON.parse(metaString);
      
      // Check if campaign has image stored locally
      if (meta.hasImage) {
        const storedImage = localStorage.getItem(`campaign_image_${campaignId}`);
        if (storedImage) {
          const imageData = JSON.parse(storedImage);
          meta.image = imageData.image;
          meta.imageName = imageData.imageName;
        }
      }
      
      return meta;
    } catch {
      // If meta is not JSON, treat it as simple description
      return { description: metaString, image: null };
    }
  };

  if (loading) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading campaigns...</span>
        </Spinner>
        <p className="mt-2">Loading campaigns from blockchain...</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h1 className="text-center mb-4">Published Advertisements</h1>
      
      {msg && (
        <Alert variant={msg.includes("✅") ? "success" : "danger"}>
          {msg}
        </Alert>
      )}

      <div className="mb-3 d-flex justify-content-between align-items-center">
        <h3>Active Ad Campaigns ({campaigns.length})</h3>
        <Button variant="outline-primary" onClick={fetchCampaigns} size="sm">
          🔄 Refresh
        </Button>
      </div>

      <Row>
        <Col md={8}>
          {campaigns.length === 0 ? (
            <Alert variant="info">
              No active campaigns found. Create a campaign first.
            </Alert>
          ) : (
            <Row>
              {campaigns.map((campaign) => {
                const metadata = parseMetadata(campaign.meta, campaign.id);
                return (
                  <Col md={6} lg={4} key={campaign.id} className="mb-4">
                    <Card className="h-100 shadow-sm border-0">
                      {/* Campaign ID Badge */}
                      <div className="position-relative">
                        <Badge 
                          bg="primary" 
                          className="position-absolute top-0 start-0 m-2"
                          style={{ zIndex: 10, fontSize: '0.8rem' }}
                        >
                          Campaign #{campaign.id}
                        </Badge>
                        
                        {/* Ad Image */}
                        <div style={{ height: '200px', overflow: 'hidden' }}>
                          {metadata.image ? (
                            <Card.Img
                              variant="top"
                              src={metadata.image}
                              alt={`Campaign ${campaign.id}`}
                              style={{
                                width: '100%',
                                height: '200px',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                console.error("Image failed to load for campaign", campaign.id);
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            style={{
                              width: '100%',
                              height: '200px',
                              backgroundColor: '#f8f9fa',
                              display: metadata.image ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#6c757d',
                              fontSize: '3rem'
                            }}
                          >
                            📢
                          </div>
                        </div>
                      </div>
                      
                      <Card.Body className="d-flex flex-column">
                        {/* Campaign Title with ID */}
                        <div className="mb-2">
                          <h5 className="card-title mb-1 text-primary">
                            Campaign #{campaign.id}
                          </h5>
                          {metadata.description && (
                            <Card.Text className="text-muted small">
                              {metadata.description.substring(0, 80)}
                              {metadata.description.length > 80 ? '...' : ''}
                            </Card.Text>
                          )}
                        </div>
                        
                        {/* Campaign Stats */}
                        <div className="mb-3">
                          <div className="d-flex justify-content-between small text-muted">
                            <span>CPC: <strong className="text-success">{ethers.utils.formatEther(campaign.cpcWei)} ETH</strong></span>
                            <span>Budget: <strong className="text-info">{parseFloat(ethers.utils.formatEther(campaign.budgetWei)).toFixed(3)} ETH</strong></span>
                          </div>
                        </div>
                        
                        {/* Click Button */}
                        <div className="mt-auto">
                          <Button 
                            variant="primary"
                            size="lg"
                            onClick={() => handleAdClick(campaign)}
                            disabled={campaign.paused || parseFloat(ethers.utils.formatEther(campaign.budgetWei)) <= 0}
                            className="w-100"
                          >
                            {campaign.paused ? (
                              <>
                                <span className="me-2">⏸️</span>
                                Campaign Paused
                              </>
                            ) : parseFloat(ethers.utils.formatEther(campaign.budgetWei)) <= 0 ? (
                              <>
                                <span className="me-2">💰</span>
                                No Budget
                              </>
                            ) : (
                              <>
                                <span className="me-2">👆</span>
                                Click Ad
                              </>
                            )}
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Col>
        
        <Col md={4}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-success text-white">
              <h4 className="mb-0">
                <span className="me-2">🎯</span>
                Recent Clicks
              </h4>
            </Card.Header>
            <Card.Body className="p-0">
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {generatedHashes.length === 0 ? (
                  <div className="text-center py-4">
                    <span style={{ fontSize: '2rem', opacity: 0.5 }}>🎯</span>
                    <p className="text-muted small mt-2">No clicks generated yet.</p>
                  </div>
                ) : (
                  generatedHashes.map((hash, index) => (
                    <div key={index} className="border-bottom p-3">
                      <div className="d-flex align-items-center mb-2">
                        <Badge bg="success" className="me-2">#{index + 1}</Badge>
                        <h6 className="text-success mb-0">Click Generated</h6>
                      </div>
                      <div className="small mb-2">
                        <div><strong>Campaign:</strong> #{hash.campaignId}</div>
                        <div><strong>CPC:</strong> {hash.cpc} ETH</div>
                        <div className="font-monospace">
                          <strong>Hash:</strong> {hash.clickHash.substring(0, 20)}...
                        </div>
                      </div>
                      <small className="text-muted">
                        {new Date(hash.timestamp * 1000).toLocaleTimeString()}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Published;
