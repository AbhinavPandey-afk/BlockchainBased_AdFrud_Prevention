import React, { useState, useEffect } from "react";
import { Container, Card, Button, Table, Alert, Badge, Row, Col, Collapse } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./AdminDashboard.css";

const PBFTNodeInterface = () => {
  const { contract, account, connect } = useWallet();
  const [pendingVotes, setPendingVotes] = useState([]);
  const [decidedItems, setDecidedItems] = useState([]); // NEW: consensus reached but not executed or already decided
  const [executedItems, setExecutedItems] = useState([]); // NEW: executed
  const [nodeStats, setNodeStats] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // PBFT phase logs per txHash
  const [pbftLogs, setPbftLogs] = useState({}); // { [hash]: [{ type, data, blockNumber }] }
  const [expanded, setExpanded] = useState({}); // { [hash]: bool }

  const pushLog = (hash, entry) => {
    setPbftLogs((prev) => {
      const arr = prev[hash] ? [...prev[hash]] : [];
      // de-dup simple
      if (!arr.find((x) => x.type === entry.type && x.blockNumber === entry.blockNumber)) {
        arr.push(entry);
      }
      arr.sort((a, b) => (a.blockNumber || 0) - (b.blockNumber || 0));
      return { ...prev, [hash]: arr };
    });
  };

  const requireConnected = async () => {
    if (!account) await connect();
    if (!contract) throw new Error("Contract not available");
  };

  const fetchPbftLogs = async (hashes) => {
    try {
      if (!contract || hashes.length === 0) return;
      const provider = contract.provider;
      const iface = contract.interface;

      const fProposed = contract.filters.TransactionProposed();
      const fVote = contract.filters.ConsensusVote();
      const fReached = contract.filters.ConsensusReached();
      const fExec = contract.filters.TransactionExecuted();

      const fromBlock = 0;
      const toBlock = "latest";

      const pull = async (filter) => {
        const logs = await provider.getLogs({ ...filter, fromBlock, toBlock, address: contract.address });
        return logs.map((l) => {
          const parsed = iface.parseLog(l);
          return { name: parsed.name, args: parsed.args, blockNumber: l.blockNumber };
        });
      };

      const [proposed, votes, reached, executed] = await Promise.all([
        pull(fProposed),
        pull(fVote),
        pull(fReached),
        pull(fExec),
      ]);

      const track = new Set(hashes.map((h) => h.toLowerCase()));

      const apply = async (ev) => {
        const rawTxHash = ev.args.txHash || ev.args.clickHash;
        if (!rawTxHash) return;
        const key = rawTxHash.toLowerCase();
        if (!track.has(key)) return;

        if (ev.name === "TransactionProposed") {
          const d = await contract.getPendingTransactionDetails(ev.args.txHash);
          pushLog(ev.args.txHash, {
            type: "PrePrepare",
            data: { leader: d.gateway, requiredVotes: d.requiredVotes.toString() },
            blockNumber: ev.blockNumber,
          });
        } else if (ev.name === "ConsensusVote") {
          pushLog(ev.args.txHash, {
            type: "Prepare",
            data: { node: ev.args.node, approve: ev.args.vote },
            blockNumber: ev.blockNumber,
          });
        } else if (ev.name === "ConsensusReached") {
          pushLog(ev.args.txHash, {
            type: "Commit",
            data: { approved: ev.args.approved, voteCount: ev.args.voteCount.toString() },
            blockNumber: ev.blockNumber,
          });
        } else if (ev.name === "TransactionExecuted") {
          pushLog(ev.args.txHash, {
            type: "Reply",
            data: { publisher: ev.args.publisher },
            blockNumber: ev.blockNumber,
          });
        }
      };

      for (const ev of [...proposed, ...votes, ...reached, ...executed]) {
        // eslint-disable-next-line no-await-in-loop
        await apply(ev);
      }
    } catch (e) {
      console.error("PBFT log backfill error:", e);
    }
  };

  // Fetch everything: pending to vote, decided, executed
  const fetchAllBuckets = async () => {
    try {
      await requireConnected();

      const pendingHashes = await contract.getPendingTransactionHashes();
      const toVote = [];
      const decided = [];
      const executed = [];

      for (const txHash of pendingHashes) {
        const d = await contract.getPendingTransactionDetails(txHash);
        const hasVoted = await contract.hasNodeVoted(txHash, account);
        const currentTime = Math.floor(Date.now() / 1000);
        const consensusTimeout = await contract.consensusTimeoutSeconds();
        const isExpired = currentTime > d.proposalTime.toNumber() + consensusTimeout.toNumber();

        const base = {
          hash: txHash,
          campaignId: d.campaignId.toString(),
          publisher: d.publisher,
          gateway: d.gateway,
          approveVotes: d.approveVotes.toString(),
          rejectVotes: d.rejectVotes.toString(),
          totalVotes: d.totalVotes.toString(),
          requiredVotes: d.requiredVotes.toString(),
          proposalTime: new Date(d.proposalTime * 1000).toLocaleString(),
          timeRemaining: d.proposalTime.toNumber() + consensusTimeout.toNumber() - currentTime,
          consensusReached: d.consensusReached,
          executed: d.executed,
        };

        // Open/pending bucket for voting
        if (!d.executed && !d.consensusReached && !hasVoted && !isExpired) {
          toVote.push(base);
        }

        // Decided bucket (show timeline even if already voted or consensus done)
        if (d.consensusReached && !d.executed) {
          decided.push(base);
        }

        // Executed bucket
        if (d.executed) {
          executed.push(base);
        }
      }

      setPendingVotes(toVote);
      // Keep only a recent window for decided/executed to avoid very long lists
      setDecidedItems(decided.slice(-25));
      setExecutedItems(executed.slice(-25));

      const allHashes = [...toVote, ...decided, ...executed].map((x) => x.hash);
      await fetchPbftLogs(allHashes);
    } catch (e) {
      console.error("fetchAllBuckets error:", e);
      setMsg("❌ Error fetching PBFT transactions: " + e.message);
    }
  };

  const fetchNodeStats = async () => {
    try {
      await requireConnected();
      const stats = await contract.getNodeStats(account);
      setNodeStats({
        isActive: stats.isActive,
        stake: ethers.utils.formatEther(stats.stake),
        endpoint: stats.endpoint,
        votesParticipated: stats.votesParticipated.toString(),
        correctVotes: stats.correctVotes.toString(),
        accuracyPercentage: stats.accuracyPercentage.toString(),
      });
    } catch (e) {
      console.error("Error fetching node stats:", e);
      setNodeStats(null);
    }
  };

  const voteOnTransaction = async (txHash, approve) => {
    try {
      setLoading(true);
      await requireConnected();

      const tx = await contract.voteOnTransaction(txHash, approve);
      setMsg(`⏳ Vote submitted. Waiting for confirmation...`);

      await tx.wait();
      setMsg(`✅ Vote ${approve ? "APPROVED" : "REJECTED"} for transaction ${txHash.substring(0, 10)}...`);

      // Refresh all buckets and stats
      fetchAllBuckets();
      fetchNodeStats();
    } catch (e) {
      setMsg("❌ Vote failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return "Expired";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    if (minutes > 0) return `${minutes}m ${secs}s remaining`;
    return `${secs}s remaining`;
  };

  useEffect(() => {
    if (contract && account) {
      fetchAllBuckets();
      fetchNodeStats();

      const onProposed = async (txHash, campaignId, publisher, evt) => {
        try {
          const d = await contract.getPendingTransactionDetails(txHash);
          pushLog(txHash, {
            type: "PrePrepare",
            data: { leader: d.gateway, requiredVotes: d.requiredVotes.toString() },
            blockNumber: evt.blockNumber,
          });
          fetchAllBuckets();
        } catch {}
      };
      const onVote = (txHash, node, approve, evt) => {
        pushLog(txHash, { type: "Prepare", data: { node, approve }, blockNumber: evt.blockNumber });
        fetchAllBuckets();
      };
      const onReached = (txHash, approved, voteCount, evt) => {
        pushLog(txHash, { type: "Commit", data: { approved, voteCount: voteCount.toString() }, blockNumber: evt.blockNumber });
        fetchAllBuckets();
      };
      const onExecuted = (txHash, campaignId, publisher, evt) => {
        pushLog(txHash, { type: "Reply", data: { publisher }, blockNumber: evt.blockNumber });
        fetchAllBuckets();
      };

      const proposedFilter = contract.filters.TransactionProposed();
      const consensusFilter = contract.filters.ConsensusReached();
      const voteFilter = contract.filters.ConsensusVote();
      const executedFilter = contract.filters.TransactionExecuted();

      contract.on(proposedFilter, onProposed);
      contract.on(consensusFilter, onReached);
      contract.on(voteFilter, onVote);
      contract.on(executedFilter, onExecuted);

      const interval = setInterval(() => {
        fetchAllBuckets();
      }, 30000);

      return () => {
        contract.off(proposedFilter, onProposed);
        contract.off(consensusFilter, onReached);
        contract.off(voteFilter, onVote);
        contract.off(executedFilter, onExecuted);
        clearInterval(interval);
      };
    }
  }, [contract, account]);

  // Access guard
  if (nodeStats === null && contract && account) {
    return (
      <div className="d-flex flex-column min-vh-100 amoled-bg text-light">
        <Navbar />
        <Container className="py-5">
          <Alert variant="warning" className="text-center">
            <h4>Access Denied</h4>
            <p>This interface is only available for registered PBFT nodes. Contact an administrator to register your address as a PBFT node.</p>
          </Alert>
        </Container>
        <Footer />
      </div>
    );
  }

  const toggleExpand = (hash) => {
    setExpanded((prev) => ({ ...prev, [hash]: !prev[hash] }));
  };

  const TimelineRow = ({ tx }) => {
    const logs = pbftLogs[tx.hash] || [];
    const isOpen = !!expanded[tx.hash];
    return (
      <>
        <tr>
          <td style={{ cursor: "pointer" }} onClick={() => toggleExpand(tx.hash)}>
            {tx.hash.substring(0, 10)}...{tx.hash.substring(tx.hash.length - 8)}
            <span className="ms-2 small text-info">{isOpen ? "Hide PBFT" : "Show PBFT"}</span>
          </td>
          <td>{tx.campaignId}</td>
          <td>{tx.publisher.substring(0, 10)}...</td>
          <td>{tx.gateway.substring(0, 10)}...</td>
          <td>
            <div>
              <Badge bg="success" className="me-1">✓ {tx.approveVotes}</Badge>
              <Badge bg="danger">✗ {tx.rejectVotes}</Badge>
              <div className="small text-muted">Need {tx.requiredVotes} to reach consensus</div>
            </div>
          </td>
          <td>
            <Badge bg={tx.timeRemaining > 300 ? "success" : tx.timeRemaining > 60 ? "warning" : "danger"}>
              {typeof tx.timeRemaining === "number" ? formatTimeRemaining(tx.timeRemaining) : "-"}
            </Badge>
          </td>
          <td>
            {!tx.consensusReached && !tx.executed && (
              <>
                <Button
                  variant="success"
                  size="sm"
                  className="me-2"
                  onClick={() => voteOnTransaction(tx.hash, true)}
                  disabled={loading || (typeof tx.timeRemaining === "number" && tx.timeRemaining <= 0)}
                >
                  {loading ? "..." : "✓ Approve"}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => voteOnTransaction(tx.hash, false)}
                  disabled={loading || (typeof tx.timeRemaining === "number" && tx.timeRemaining <= 0)}
                >
                  {loading ? "..." : "✗ Reject"}
                </Button>
              </>
            )}
          </td>
        </tr>
        <tr>
          <td colSpan={7} className="bg-dark">
            <Collapse in={isOpen}>
              <div>
                <div className="small">
                  <strong>PBFT Timeline</strong>
                  {logs.length === 0 && <div className="text-muted">No PBFT messages yet.</div>}
                  {logs.map((l, i) => (
                    <div key={i} className="d-flex align-items-center my-1">
                      <span
                        className={`badge me-2 bg-${
                          l.type === "PrePrepare" ? "primary" : l.type === "Prepare" ? "info" : l.type === "Commit" ? "warning" : "success"
                        }`}
                      >
                        {l.type}
                      </span>
                      <code className="me-2">blk #{l.blockNumber || "-"}</code>
                      <span className="text-muted">
                        {l.type === "PrePrepare" && `leader=${l.data.leader}, required=${l.data.requiredVotes}`}
                        {l.type === "Prepare" && `node=${l.data.node}, approve=${l.data.approve ? "yes" : "no"}`}
                        {l.type === "Commit" && `approved=${l.data.approved ? "yes" : "no"}, votes=${l.data.voteCount}`}
                        {l.type === "Reply" && `publisher=${l.data.publisher}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Collapse>
          </td>
        </tr>
      </>
    );
  };

  return (
    <div className="d-flex flex-column min-vh-100 amoled-bg text-light">
      <Navbar />

      <Container className="py-5">
        <h2 className="mb-4 text-center fw-bold neon-cyan display-5">🗳️ PBFT Node - Transaction Voting</h2>
        <p className="text-center text-muted mb-5">Vote on pending transactions to participate in consensus validation.</p>

        {msg && (
          <Alert
            variant={msg.startsWith("✅") ? "success" : msg.startsWith("⏳") ? "info" : "danger"}
            className="glass-alert text-center fw-semibold"
            onClose={() => setMsg(null)}
            dismissible
          >
            {msg}
          </Alert>
        )}

        {/* Node Statistics */}
        {nodeStats && (
          <Row className="g-4 mb-4">
            <Col md={12}>
              <Card className="glass-card border-0">
                <Card.Body>
                  <Card.Title className="neon-label">📊 Your Node Statistics</Card.Title>
                  <Row>
                    <Col md={3}>
                      <div className="text-center">
                        <h5 className="text-muted">Stake</h5>
                        <h4 className="neon-cyan">{parseFloat(nodeStats.stake).toFixed(2)} ETH</h4>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h5 className="text-muted">Votes Participated</h5>
                        <h4 className="text-info">{nodeStats.votesParticipated}</h4>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h5 className="text-muted">Correct Votes</h5>
                        <h4 className="text-success">{nodeStats.correctVotes}</h4>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-center">
                        <h5 className="text-muted">Accuracy</h5>
                        <h4>
                          <Badge
                            bg={parseInt(nodeStats.accuracyPercentage) >= 80 ? "success" : parseInt(nodeStats.accuracyPercentage) >= 60 ? "warning" : "danger"}
                            className="fs-6"
                          >
                            {nodeStats.accuracyPercentage}%
                          </Badge>
                        </h4>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Pending Votes */}
        <Row className="g-4">
          <Col md={12}>
            <Card className="glass-card border-0">
              <Card.Body>
                <Card.Title className="neon-label">⏳ Pending Transactions Requiring Your Vote</Card.Title>
                <Table striped bordered hover variant="dark">
                  <thead>
                    <tr>
                      <th>Transaction Hash</th>
                      <th>Campaign ID</th>
                      <th>Publisher</th>
                      <th>Gateway</th>
                      <th>Current Votes</th>
                      <th>Time Remaining</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingVotes.map((tx, index) => (
                      <React.Fragment key={`pending-${index}`}>
                        <TimelineRow tx={tx} />
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>

                {pendingVotes.length === 0 && (
                  <div className="text-center text-muted py-4">
                    <h5>No pending transactions to vote on</h5>
                    <p>All current transactions have either reached consensus or you have already voted.</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* NEW: Recent PBFT activity (decided + executed) */}
        <Row className="g-4 mt-4">
          <Col md={12}>
            <Card className="glass-card border-0">
              <Card.Body>
                <Card.Title className="neon-label">🧭 Recent PBFT Activity</Card.Title>
                <Table striped bordered hover variant="dark">
                  <thead>
                    <tr>
                      <th>Transaction Hash</th>
                      <th>Campaign ID</th>
                      <th>Publisher</th>
                      <th>Gateway</th>
                      <th>Current Votes</th>
                      <th>Time Remaining</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...decidedItems, ...executedItems].map((tx, index) => (
                      <React.Fragment key={`history-${index}`}>
                        <TimelineRow tx={{ ...tx, timeRemaining: "-" }} />
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>

                {decidedItems.length + executedItems.length === 0 && (
                  <div className="text-center text-muted py-4">
                    <h5>No recent PBFT activity</h5>
                    <p>New items will appear here once consensus is reached or transactions are executed.</p>
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

export default PBFTNodeInterface;
