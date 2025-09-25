import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Button, Row, Col, Alert, Spinner, Badge, Modal } from 'react-bootstrap';
import { ethers } from 'ethers';
import ReCAPTCHA from 'react-google-recaptcha';
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
  const [account, setAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // CAPTCHA related states
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const captchaRef = useRef(null);

  const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
  const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

  // Connect wallet function
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setMsg("❌ MetaMask not found. Please install MetaMask.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        setMsg("✅ Wallet connected successfully!");
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setMsg("❌ Failed to connect wallet");
    }
  };

  // Initialize Web3 connection
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        let ethProvider;
        
        if (window.ethereum) {
          ethProvider = new ethers.providers.Web3Provider(window.ethereum);
          
          const accounts = await ethProvider.listAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
          }
          
          window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
              setAccount(accounts[0]);
              setIsConnected(true);
            } else {
              setAccount(null);
              setIsConnected(false);
            }
          });
          
        } else {
          ethProvider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
          const accounts = await ethProvider.listAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
          }
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

  // Event listeners (keeping your existing code)
  useEffect(() => {
    if (!contract) return;

    const setupEventListeners = async () => {
      try {
        const campaignCreatedFilter = contract.filters.CampaignCreated();
        
        contract.on(campaignCreatedFilter, (campaignId, advertiser, cpcWei, initialBudget, meta) => {
          console.log("New campaign created:", campaignId.toString());
          
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
              if (prev.find(c => c.id === newCampaign.id)) return prev;
              return [...prev, newCampaign];
            });
          }
        });

        contract.on("CampaignFunded", (campaignId, amount, newBudget) => {
          setCampaigns(prev => prev.map(c => 
            c.id === campaignId.toString() 
              ? { ...c, budgetWei: newBudget.toString() }
              : c
          ));
        });

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
    return () => {
      contract.removeAllListeners();
    };
  }, [contract]);

  useEffect(() => {
    if (contract) {
      fetchCampaigns();
    }
  }, [contract]);

  useEffect(() => {
    if (!contract) return;
    const interval = setInterval(() => {
      fetchCampaigns();
    }, 30000);
    return () => clearInterval(interval);
  }, [contract]);

  // CAPTCHA verification handlers
  const onCaptchaChange = (value) => {
    console.log("Captcha value:", value);
    if (value) {
      setCaptchaVerified(true);
      setCaptchaLoading(false);
    } else {
      setCaptchaVerified(false);
    }
  };

  const onCaptchaExpired = () => {
    console.log("Captcha expired");
    setCaptchaVerified(false);
    setMsg("❌ CAPTCHA expired. Please verify again.");
  };

  const onCaptchaError = () => {
    console.log("Captcha error");
    setCaptchaVerified(false);
    setMsg("❌ CAPTCHA error. Please try again.");
  };

  // Updated click handler with CAPTCHA verification
  const handleAdClick = async (campaign) => {
    if (!isConnected || !account) {
      setMsg("❌ Please connect your wallet first to generate clicks");
      return;
    }

    // Show CAPTCHA modal
    setSelectedCampaign(campaign);
    setShowCaptchaModal(true);
    setCaptchaVerified(false);
    setCaptchaLoading(false);
  };

  const processCaptchaAndClick = async () => {
    if (!captchaVerified || !selectedCampaign) {
      setMsg("❌ Please complete the CAPTCHA verification");
      return;
    }

    try {
      setCaptchaLoading(true);
      
      const timestamp = Math.floor(Date.now() / 1000);
      const clickHash = await generateClickHash(selectedCampaign.id, account, timestamp);
      
      const newHash = {
        clickHash,
        campaignId: selectedCampaign.id,
        publisherAddress: account,
        timestamp,
        cpc: ethers.utils.formatEther(selectedCampaign.cpcWei)
      };
      
      setGeneratedHashes(prev => [newHash, ...prev.slice(0, 9)]);
      setMsg(`✅ Click registered successfully! Hash: ${clickHash.substring(0, 10)}...`);
      
      // Store in localStorage
      const existingHashes = JSON.parse(localStorage.getItem('availableHashes') || '[]');
      existingHashes.unshift(newHash);
      existingHashes.splice(50);
      localStorage.setItem('availableHashes', JSON.stringify(existingHashes));
      
      // Close modal and reset
      setShowCaptchaModal(false);
      setSelectedCampaign(null);
      setCaptchaVerified(false);
      
      // Reset CAPTCHA for next use
      if (captchaRef.current) {
        captchaRef.current.reset();
      }
      
      setTimeout(() => setMsg(null), 5000);
      
    } catch (error) {
      setMsg(`❌ Error generating click hash: ${error.message}`);
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowCaptchaModal(false);
    setSelectedCampaign(null);
    setCaptchaVerified(false);
    if (captchaRef.current) {
      captchaRef.current.reset();
    }
  };

  // Existing parseMetadata function
  const parseMetadata = (metaString, campaignId) => {
    try {
      const meta = JSON.parse(metaString);
      
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="text-center">Published Advertisements</h1>
        
        <div className="text-end">
          {isConnected ? (
            <div>
              <Badge bg="success" className="mb-1">
                ✅ Connected
              </Badge>
              <div className="small text-muted">
                {account?.substring(0, 6)}...{account?.substring(account.length - 4)}
              </div>
            </div>
          ) : (
            <Button variant="primary" onClick={connectWallet}>
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
      
      {msg && (
        <Alert variant={msg.includes("✅") ? "success" : "danger"}>
          {msg}
        </Alert>
      )}

      {!isConnected && (
        <Alert variant="warning" className="mb-4">
          <h5>⚠️ Wallet Not Connected</h5>
          <p>Please connect your wallet to generate click hashes with your actual publisher address.</p>
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
                      <div className="position-relative">
                        <Badge 
                          bg="primary" 
                          className="position-absolute top-0 start-0 m-2"
                          style={{ zIndex: 10, fontSize: '0.8rem' }}
                        >
                          Campaign #{campaign.id}
                        </Badge>
                        
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
                        
                        <div className="mb-3">
                          <div className="d-flex justify-content-between small text-muted">
                            <span>CPC: <strong className="text-success">{ethers.utils.formatEther(campaign.cpcWei)} ETH</strong></span>
                            <span>Budget: <strong className="text-info">{parseFloat(ethers.utils.formatEther(campaign.budgetWei)).toFixed(3)} ETH</strong></span>
                          </div>
                        </div>
                        
                        <div className="mt-auto">
                          <Button 
                            variant="primary"
                            size="lg"
                            onClick={() => handleAdClick(campaign)}
                            disabled={!isConnected || campaign.paused || parseFloat(ethers.utils.formatEther(campaign.budgetWei)) <= 0}
                            className="w-100"
                          >
                            {!isConnected ? (
                              <>
                                <span className="me-2">🔗</span>
                                Connect Wallet First
                              </>
                            ) : campaign.paused ? (
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
                                <span className="me-2">🛡️</span>
                                Verify & Click Ad
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
                    <p className="text-muted small mt-2">
                      {!isConnected 
                        ? "Connect wallet to generate clicks"
                        : "No clicks generated yet."
                      }
                    </p>
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
                        <div><strong>Publisher:</strong> {hash.publisherAddress.substring(0, 10)}...</div>
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

      {/* CAPTCHA Verification Modal */}
      <Modal show={showCaptchaModal} onHide={handleModalClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <span className="me-2">🛡️</span>
            Security Verification Required
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <div className="mb-4">
            <h5>Campaign #{selectedCampaign?.id}</h5>
            <p className="text-muted">
              Please complete the security verification to proceed with clicking this ad.
            </p>
            <div className="small text-success">
              <strong>Reward: {selectedCampaign ? ethers.utils.formatEther(selectedCampaign.cpcWei) : '0'} ETH</strong>
            </div>
          </div>
          
          {recaptchaSiteKey ? (
            <div className="d-flex justify-content-center mb-4">
              <ReCAPTCHA
                ref={captchaRef}
                sitekey={recaptchaSiteKey}
                onChange={onCaptchaChange}
                onExpired={onCaptchaExpired}
                onError={onCaptchaError}
              />
            </div>
          ) : (
            <Alert variant="warning">
              reCAPTCHA site key not configured. Please add REACT_APP_RECAPTCHA_SITE_KEY to your environment variables.
            </Alert>
          )}
          
          {captchaVerified && (
            <Alert variant="success">
              ✅ Verification successful! You can now process the click.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>
            Cancel
          </Button>
          <Button 
            variant="success" 
            onClick={processCaptchaAndClick}
            disabled={!captchaVerified || captchaLoading}
          >
            {captchaLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Processing...
              </>
            ) : (
              <>
                <span className="me-2">🎯</span>
                Generate Click Hash
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Published;
