// import React, { useState, useEffect } from "react";
// import {
//   Container,
//   Card,
//   ListGroup,
//   Button,
//   Collapse,
//   Badge,
//   Alert,
//   Spinner,
//   ProgressBar,
//   Form,
//   Row,
//   Col,
// } from "react-bootstrap";
// import { ethers } from "ethers";
// import Navbar from "../components/Navbar";
// import Footer from "../components/Footer";

// const DARK_BG = "#121212";
// const DARK_CARD_BG = "#1E1E1E";
// const DARK_TEXT = "#E0E0E0";
// const ACCENT_COLOR = "#4caf50"; // Green accent

// const BlockExplorer = () => {
//   const [contractBlocks, setContractBlocks] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [expanded, setExpanded] = useState({});
//   const [error, setError] = useState(null);
//   const [latestBlock, setLatestBlock] = useState(null);
//   const [searchProgress, setSearchProgress] = useState(0);
//   const [searchStatus, setSearchStatus] = useState("");
//   const [darkMode, setDarkMode] = useState(true);

//   // Environment variables
//   const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS;
//   const ALCHEMY_RPC_URL = process.env.REACT_APP_ALCHEMY_RPC_URL;
//   const NETWORK_NAME = "sepolia";
//   const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

//   useEffect(() => {
//     if (!CONTRACT_ADDRESS || !ALCHEMY_RPC_URL) {
//       setError("Contract address or RPC URL not configured");
//       setLoading(false);
//       return;
//     }
//     fetchContractBlocks();
//     // eslint-disable-next-line
//   }, [CONTRACT_ADDRESS, ALCHEMY_RPC_URL]);

//   const fetchContractBlocks = async () => {
//     try {
//       setLoading(true);
//       setError(null);
//       setSearchProgress(0);
//       setSearchStatus("Connecting to Sepolia...");

//       const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC_URL);
//       const currentBlock = await provider.getBlockNumber();
//       setLatestBlock(currentBlock);

//       setSearchStatus("Scanning the latest 10 blocks for contract-created blocks...");
//       const SEARCH_BLOCKS = 10;
//       const startBlock = Math.max(0, currentBlock - SEARCH_BLOCKS + 1);

//       const detailedBlocks = [];

//       // Iterate with reverse for better UX (latest at top)
//       for (let blockNum = currentBlock; blockNum >= startBlock; blockNum--) {
//         setSearchProgress(((currentBlock - blockNum + 1) / SEARCH_BLOCKS) * 100);
//         setSearchStatus(`Scanning block ${blockNum}...`);

//         try {
//           const block = await provider.getBlockWithTransactions(blockNum);

//           // Find tx where 'to' address matches contract address
//           const fromContractTx = block.transactions.filter(
//             (tx) =>
//               tx.to && tx.to.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
//           );

//           if (fromContractTx.length > 0) {
//             detailedBlocks.push({
//               ...block,
//               contractTransactions: fromContractTx,
//             });
//           }

//           // Small delay (rate limiting)
//           await new Promise((resolve) => setTimeout(resolve, 50));
//         } catch (blockError) {
//           console.warn(`⚠️ Error fetching block ${blockNum}:`, blockError.message);
//           continue;
//         }
//       }

//       setContractBlocks(detailedBlocks);
//       setSearchStatus(
//         `Found ${detailedBlocks.length} blocks created by contract transactions`
//       );
//       setSearchProgress(100);
//     } catch (error) {
//       setError(`Failed to fetch contract blocks: ${error.message}`);
//       setSearchStatus("Error occurred");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const toggleExpand = (blockNumber) => {
//     setExpanded((prev) => ({
//       ...prev,
//       [blockNumber]: !prev[blockNumber],
//     }));
//   };

//   const getTransactionMethodName = (tx) => {
//     try {
//       if (!tx.data || tx.data === "0x") return "ETH Transfer";

//       const methodSignatures = {
//         "0x2f2ff15d": "grantRole",
//         "0xd547741f": "revokeRole",
//         "0x91d14854": "hasRole",
//         "0x022a91d4": "addPBFTNode",
//         "0xa217fddf": "DEFAULT_ADMIN_ROLE",
//       };

//       const methodId = tx.data.slice(0, 10);
//       return methodSignatures[methodId] || `Method ${methodId}`;
//     } catch {
//       return "Unknown Method";
//     }
//   };

//   const formatTimestamp = (timestamp) =>
//     new Date(timestamp * 1000).toLocaleString();

//   const formatHash = (hash) => `${hash.slice(0, 10)}...${hash.slice(-8)}`;

//   return (
//     <div style={{ backgroundColor: darkMode ? DARK_BG : "#f8f9fa", minHeight: "100vh", color: darkMode ? DARK_TEXT : "#212529" }}>
//       <Navbar darkMode={darkMode} />
//       <Container className="py-4">
//         <Row className="align-items-center mb-4">
//           <Col xs={12} md={8}>
//             <h2 className="mb-0" style={{ fontWeight: "700" }}>
//               ⚡ Contract-Origin Block Explorer
//             </h2>
//             <small className="text-muted" style={{ color: darkMode ? "#bbb" : "#6c757d" }}>
//               Scanning last 10 blocks only
//             </small>
//           </Col>
//           <Col xs={12} md={4} className="text-md-end mt-3 mt-md-0">
//             <Form.Check 
//               type="switch"
//               id="dark-mode-toggle"
//               label={darkMode ? "Dark Mode" : "Light Mode"}
//               checked={darkMode}
//               onChange={() => setDarkMode(!darkMode)}
//               style={{ color: darkMode ? DARK_TEXT : "#212529" }}
//             />
//           </Col>
//         </Row>

//         <Card
//           bg={darkMode ? "dark" : "light"}
//           text={darkMode ? "light" : "dark"}
//           className="mb-4 shadow-sm"
//           style={{ borderColor: ACCENT_COLOR }}
//         >
//           <Card.Body className="d-flex justify-content-between flex-wrap gap-3">
//             <div>
//               <div className="fw-bold" style={{ fontSize: "1.4rem", color: ACCENT_COLOR }}>
//                 {contractBlocks.length}
//               </div>
//               <small>Blocks Created by Contract</small>
//             </div>
//             <div>
//               <div className="fw-bold" style={{ fontSize: "1.4rem", color: ACCENT_COLOR }}>
//                 {contractBlocks.reduce(
//                   (sum, block) => sum + block.contractTransactions.length,
//                   0
//                 )}
//               </div>
//               <small>Contract Transactions</small>
//             </div>
//             <div className="d-flex align-items-center">
//               <Button
//                 variant={darkMode ? "outline-success" : "success"}
//                 size="sm"
//                 onClick={fetchContractBlocks}
//                 disabled={loading}
//               >
//                 {loading ? (
//                   <>
//                     <Spinner animation="border" size="sm" /> Refreshing...
//                   </>
//                 ) : (
//                   "🔄 Refresh"
//                 )}
//               </Button>
//             </div>
//           </Card.Body>
//         </Card>

//         {error && (
//           <Alert variant="danger" className="mb-4" style={{ fontWeight: "500" }}>
//             <Alert.Heading>⚠️ Error</Alert.Heading>
//             <p>{error}</p>
//             <Button variant="outline-danger" onClick={fetchContractBlocks}>
//               Try Again
//             </Button>
//           </Alert>
//         )}

//         {loading ? (
//           <div className="text-center py-5">
//             <Spinner animation="border" role="status" size="lg" variant="success" />
//             <div className="mt-3">{searchStatus}</div>
//             <ProgressBar
//               animated
//               now={searchProgress}
//               variant="success"
//               className="mt-3"
//               style={{ height: "8px", borderRadius: "4px" }}
//             />
//           </div>
//         ) : contractBlocks.length === 0 ? (
//           <Alert variant={darkMode ? "warning" : "warning"} style={{ fontWeight: "500" }}>
//             <Alert.Heading>🔍 No Blocks Found</Alert.Heading>
//             <p>No blocks were created by your contract in the last 10 blocks.</p>
//             <div className="mt-3 d-flex flex-wrap gap-2">
//               <Button variant="outline-success" onClick={fetchContractBlocks}>
//                 🔄 Refresh
//               </Button>
//               <Button
//                 variant="outline-secondary"
//                 href={`${ETHERSCAN_BASE}/address/${CONTRACT_ADDRESS}`}
//                 target="_blank"
//                 rel="noopener noreferrer"
//               >
//                 🔗 View on Etherscan
//               </Button>
//             </div>
//           </Alert>
//         ) : (
//           <div>
//             {contractBlocks.map((block) => (
//               <Card
//                 key={block.number}
//                 bg={darkMode ? "dark" : "light"}
//                 text={darkMode ? "light" : "dark"}
//                 className="mb-3 shadow-sm"
//                 style={{ borderColor: ACCENT_COLOR, cursor: "default" }}
//               >
//                 <Card.Header
//                   className="d-flex justify-content-between align-items-center"
//                   style={{ backgroundColor: darkMode ? DARK_CARD_BG : "#e9ecef" }}
//                 >
//                   <div>
//                     <strong>Block #{block.number}</strong>{" "}
//                     <Badge bg="success" pill>
//                       {block.contractTransactions.length} TX
//                     </Badge>
//                   </div>
//                   <div className="text-end d-flex align-items-center gap-2">
//                     <div className="small text-muted" style={{ minWidth: 140 }}>
//                       {formatTimestamp(block.timestamp)}
//                     </div>
//                     <Button
//                       variant="outline-primary"
//                       size="sm"
//                       href={`${ETHERSCAN_BASE}/block/${block.number}`}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       aria-label="View block on Etherscan"
//                     >
//                       🔗 Etherscan
//                     </Button>
//                     <Button
//                       variant="outline-secondary"
//                       size="sm"
//                       onClick={() => toggleExpand(block.number)}
//                       aria-expanded={expanded[block.number] ? "true" : "false"}
//                       aria-controls={`block-tx-${block.number}`}
//                     >
//                       {expanded[block.number] ? "🔼" : "🔽"}
//                     </Button>
//                   </div>
//                 </Card.Header>

//                 <Collapse in={expanded[block.number]}>
//                   <div id={`block-tx-${block.number}`}>
//                     <Card.Body style={{ backgroundColor: darkMode ? "#2c2c2c" : "#fff" }}>
//                       <h6 className="mb-3 text-success">
//                         💰 Contract Transactions ({block.contractTransactions.length})
//                       </h6>
//                       <ListGroup variant={darkMode ? "dark" : "flush"}>
//                         {block.contractTransactions.map((tx, index) => (
//                           <ListGroup.Item
//                             key={index}
//                             className={`${darkMode ? "bg-dark text-light" : ""} px-0`}
//                             style={{ border: "none" }}
//                           >
//                             <div className="d-flex justify-content-between align-items-center">
//                               <div style={{ wordBreak: "break-word", maxWidth: "80%" }}>
//                                 <small>
//                                   <strong>Hash:</strong> {formatHash(tx.hash)}
//                                 </small>
//                                 <br />
//                                 <small>
//                                   <strong>From:</strong> {formatHash(tx.from)}
//                                 </small>
//                                 <br />
//                                 <small>
//                                   <strong>To:</strong>{" "}
//                                   {tx.to ? formatHash(tx.to) : "Contract Creation"}
//                                 </small>
//                                 <br />
//                                 <small>
//                                   <strong>Method:</strong>{" "}
//                                   <Badge bg="primary">{getTransactionMethodName(tx)}</Badge>
//                                 </small>
//                                 <br />
//                                 <small>
//                                   <strong>Value:</strong>{" "}
//                                   {ethers.utils.formatEther(tx.value)} ETH
//                                 </small>
//                               </div>
//                               <div>
//                                 <Button
//                                   variant={darkMode ? "outline-light" : "outline-primary"}
//                                   size="sm"
//                                   href={`${ETHERSCAN_BASE}/tx/${tx.hash}`}
//                                   target="_blank"
//                                   rel="noopener noreferrer"
//                                   aria-label="View transaction on Etherscan"
//                                 >
//                                   🔗 View TX
//                                 </Button>
//                               </div>
//                             </div>
//                           </ListGroup.Item>
//                         ))}
//                       </ListGroup>
//                     </Card.Body>
//                   </div>
//                 </Collapse>
//               </Card>
//             ))}

//             <Alert variant="success" className="text-center mt-3" style={{ fontWeight: "600" }}>
//               ✅ Showing only blocks created by your contract in the last 10 blocks.
//             </Alert>
//           </div>
//         )}
//       </Container>
//       <Footer darkMode={darkMode} />
//     </div>
//   );
// };

// export default BlockExplorer;
import React, { useState, useEffect } from "react";
import {
  Container,
  Card,
  ListGroup,
  Button,
  Collapse,
  Badge,
  Alert,
  Spinner,
  ProgressBar,
  Form,
  Row,
  Col,
} from "react-bootstrap";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ContractJSON from "../contracts/AdFraudPBFT.json";

const DARK_BG = "#121212";
const DARK_CARD_BG = "#1E1E1E";
const DARK_TEXT = "#E0E0E0";
const ACCENT_COLOR = "#4caf50"; // Green accent

// Build a selector->name map from ABI
const buildSelectorMap = (abi) => {
  const iface = new ethers.utils.Interface(abi);
  const map = {};
  for (const fn of Object.values(iface.functions)) {
    const sig = fn.format(); // e.g., "createCampaign(uint256,uint256,string)"
    const selector = iface.getSighash(sig); // 0x....
    map[selector] = fn.name; // e.g., "createCampaign"
  }
  return map;
};
const SELECTOR_MAP = buildSelectorMap(ContractJSON.abi);

const BlockExplorer = () => {
  const [contractBlocks, setContractBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState(null);
  const [latestBlock, setLatestBlock] = useState(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchStatus, setSearchStatus] = useState("");
  const [darkMode, setDarkMode] = useState(true);

  // Environment variables
  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS;
  const ALCHEMY_RPC_URL = process.env.REACT_APP_ALCHEMY_RPC_URL;
  const NETWORK_NAME = "sepolia";
  const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

  useEffect(() => {
    if (!CONTRACT_ADDRESS || !ALCHEMY_RPC_URL) {
      setError("Contract address or RPC URL not configured");
      setLoading(false);
      return;
    }
    fetchContractBlocks();
    // eslint-disable-next-line
  }, [CONTRACT_ADDRESS, ALCHEMY_RPC_URL]);

  const fetchContractBlocks = async () => {
    try {
      setLoading(true);
      setError(null);
      setSearchProgress(0);
      setSearchStatus("Connecting to Sepolia...");

      const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC_URL);
      const currentBlock = await provider.getBlockNumber();
      setLatestBlock(currentBlock);

      setSearchStatus("Scanning the latest 10 blocks for contract-created blocks...");
      const SEARCH_BLOCKS = 10;
      const startBlock = Math.max(0, currentBlock - SEARCH_BLOCKS + 1);

      const detailedBlocks = [];

      // Iterate with reverse for better UX (latest at top)
      for (let blockNum = currentBlock; blockNum >= startBlock; blockNum--) {
        setSearchProgress(((currentBlock - blockNum + 1) / SEARCH_BLOCKS) * 100);
        setSearchStatus(`Scanning block ${blockNum}...`);

        try {
          const block = await provider.getBlockWithTransactions(blockNum);

          // Find tx where 'to' address matches contract address
          const fromContractTx = block.transactions.filter(
            (tx) =>
              tx.to && tx.to.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
          );

          if (fromContractTx.length > 0) {
            detailedBlocks.push({
              ...block,
              contractTransactions: fromContractTx,
            });
          }

          // Small delay (rate limiting)
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (blockError) {
          console.warn(`⚠️ Error fetching block ${blockNum}:`, blockError.message);
          continue;
        }
      }

      setContractBlocks(detailedBlocks);
      setSearchStatus(
        `Found ${detailedBlocks.length} blocks created by contract transactions`
      );
      setSearchProgress(100);
    } catch (error) {
      setError(`Failed to fetch contract blocks: ${error.message}`);
      setSearchStatus("Error occurred");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (blockNumber) => {
    setExpanded((prev) => ({
      ...prev,
      [blockNumber]: !prev[blockNumber],
    }));
  };

  // Decode method name from selector using ABI map
  const getTransactionMethodName = (tx) => {
    try {
      if (!tx.data || tx.data === "0x") return "ETH Transfer";
      const methodId = tx.data.slice(0, 10).toLowerCase();
      // Prefer ABI-derived name; fallback to generic tag
      return SELECTOR_MAP[methodId] || `Method ${methodId}`;
    } catch {
      return "Unknown Method";
    }
  };

  const formatTimestamp = (timestamp) =>
    new Date(timestamp * 1000).toLocaleString();

  const formatHash = (hash) => `${hash.slice(0, 10)}...${hash.slice(-8)}`;

  return (
    <div style={{ backgroundColor: darkMode ? DARK_BG : "#f8f9fa", minHeight: "100vh", color: darkMode ? DARK_TEXT : "#212529" }}>
      <Navbar darkMode={darkMode} />
      <Container className="py-4">
        <Row className="align-items-center mb-4">
          <Col xs={12} md={8}>
            <h2 className="mb-0" style={{ fontWeight: "700" }}>
              ⚡ Contract-Origin Block Explorer
            </h2>
            <small className="text-muted" style={{ color: darkMode ? "#bbb" : "#6c757d" }}>
              Scanning last 10 blocks only
            </small>
          </Col>
          <Col xs={12} md={4} className="text-md-end mt-3 mt-md-0">
            <Form.Check 
              type="switch"
              id="dark-mode-toggle"
              label={darkMode ? "Dark Mode" : "Light Mode"}
              checked={darkMode}
              onChange={() => setDarkMode(!darkMode)}
              style={{ color: darkMode ? DARK_TEXT : "#212529" }}
            />
          </Col>
        </Row>

        <Card
          bg={darkMode ? "dark" : "light"}
          text={darkMode ? "light" : "dark"}
          className="mb-4 shadow-sm"
          style={{ borderColor: ACCENT_COLOR }}
        >
          <Card.Body className="d-flex justify-content-between flex-wrap gap-3">
            <div>
              <div className="fw-bold" style={{ fontSize: "1.4rem", color: ACCENT_COLOR }}>
                {contractBlocks.length}
              </div>
              <small>Blocks Created by Contract</small>
            </div>
            <div>
              <div className="fw-bold" style={{ fontSize: "1.4rem", color: ACCENT_COLOR }}>
                {contractBlocks.reduce(
                  (sum, block) => sum + block.contractTransactions.length,
                  0
                )}
              </div>
              <small>Contract Transactions</small>
            </div>
            <div className="d-flex align-items-center">
              <Button
                variant={darkMode ? "outline-success" : "success"}
                size="sm"
                onClick={fetchContractBlocks}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" /> Refreshing...
                  </>
                ) : (
                  "🔄 Refresh"
                )}
              </Button>
            </div>
          </Card.Body>
        </Card>

        {error && (
          <Alert variant="danger" className="mb-4" style={{ fontWeight: "500" }}>
            <Alert.Heading>⚠️ Error</Alert.Heading>
            <p>{error}</p>
            <Button variant="outline-danger" onClick={fetchContractBlocks}>
              Try Again
            </Button>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" role="status" size="lg" variant="success" />
            <div className="mt-3">{searchStatus}</div>
            <ProgressBar
              animated
              now={searchProgress}
              variant="success"
              className="mt-3"
              style={{ height: "8px", borderRadius: "4px" }}
            />
          </div>
        ) : contractBlocks.length === 0 ? (
          <Alert variant={darkMode ? "warning" : "warning"} style={{ fontWeight: "500" }}>
            <Alert.Heading>🔍 No Blocks Found</Alert.Heading>
            <p>No blocks were created by your contract in the last 10 blocks.</p>
            <div className="mt-3 d-flex flex-wrap gap-2">
              <Button variant="outline-success" onClick={fetchContractBlocks}>
                🔄 Refresh
              </Button>
              <Button
                variant="outline-secondary"
                href={`${ETHERSCAN_BASE}/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                🔗 View on Etherscan
              </Button>
            </div>
          </Alert>
        ) : (
          <div>
            {contractBlocks.map((block) => (
              <Card
                key={block.number}
                bg={darkMode ? "dark" : "light"}
                text={darkMode ? "light" : "dark"}
                className="mb-3 shadow-sm"
                style={{ borderColor: ACCENT_COLOR, cursor: "default" }}
              >
                <Card.Header
                  className="d-flex justify-content-between align-items-center"
                  style={{ backgroundColor: darkMode ? DARK_CARD_BG : "#e9ecef" }}
                >
                  <div>
                    <strong>Block #{block.number}</strong>{" "}
                    <Badge bg="success" pill>
                      {block.contractTransactions.length} TX
                    </Badge>
                  </div>
                  <div className="text-end d-flex align-items-center gap-2">
                    <div className="small text-muted" style={{ minWidth: 140 }}>
                      {formatTimestamp(block.timestamp)}
                    </div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      href={`${ETHERSCAN_BASE}/block/${block.number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View block on Etherscan"
                    >
                      🔗 Etherscan
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => toggleExpand(block.number)}
                      aria-expanded={expanded[block.number] ? "true" : "false"}
                      aria-controls={`block-tx-${block.number}`}
                    >
                      {expanded[block.number] ? "🔼" : "🔽"}
                    </Button>
                  </div>
                </Card.Header>

                <Collapse in={expanded[block.number]}>
                  <div id={`block-tx-${block.number}`}>
                    <Card.Body style={{ backgroundColor: darkMode ? "#2c2c2c" : "#fff" }}>
                      <h6 className="mb-3 text-success">
                        💰 Contract Transactions ({block.contractTransactions.length})
                      </h6>
                      <ListGroup variant={darkMode ? "dark" : "flush"}>
                        {block.contractTransactions.map((tx, index) => (
                          <ListGroup.Item
                            key={index}
                            className={`${darkMode ? "bg-dark text-light" : ""} px-0`}
                            style={{ border: "none" }}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <div style={{ wordBreak: "break-word", maxWidth: "80%" }}>
                                <small>
                                  <strong>Hash:</strong> {formatHash(tx.hash)}
                                </small>
                                <br />
                                <small>
                                  <strong>From:</strong> {formatHash(tx.from)}
                                </small>
                                <br />
                                <small>
                                  <strong>To:</strong>{" "}
                                  {tx.to ? formatHash(tx.to) : "Contract Creation"}
                                </small>
                                <br />
                                <small>
                                  <strong>Method:</strong>{" "}
                                  <Badge bg="primary">{getTransactionMethodName(tx)}</Badge>
                                </small>
                                <br />
                                <small>
                                  <strong>Value:</strong>{" "}
                                  {ethers.utils.formatEther(tx.value)} ETH
                                </small>
                              </div>
                              <div>
                                <Button
                                  variant={darkMode ? "outline-light" : "outline-primary"}
                                  size="sm"
                                  href={`${ETHERSCAN_BASE}/tx/${tx.hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="View transaction on Etherscan"
                                >
                                  🔗 View TX
                                </Button>
                              </div>
                            </div>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </Card.Body>
                  </div>
                </Collapse>
              </Card>
            ))}

            <Alert variant="success" className="text-center mt-3" style={{ fontWeight: "600" }}>
              ✅ Showing only blocks created by your contract in the last 10 blocks.
            </Alert>
          </div>
        )}
      </Container>
      <Footer darkMode={darkMode} />
    </div>
  );
};

export default BlockExplorer;
