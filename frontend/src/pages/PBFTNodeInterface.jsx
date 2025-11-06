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
  const [decidedItems, setDecidedItems] = useState([]);
  const [executedItems, setExecutedItems] = useState([]);
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

  // Backfill logs for both old and new consensus events
  const fetchPbftLogs = async (hashes) => {
    try {
      if (!contract || hashes.length === 0) return;
      const provider = contract.provider;
      const iface = contract.interface;

      // Old events (synthesized phases)
      const fProposed = contract.filters.TransactionProposed();
      const fVote = contract.filters.ConsensusVote();
      const fReached = contract.filters.ConsensusReached();
      const fExec = contract.filters.TransactionExecuted();

      // New canonical consensus events
      const fPrePrep = contract.filters.PrePrepare();
      const fPrep = contract.filters.Prepare();
      const fCommit = contract.filters.Commit();
      const fReply = contract.filters.Reply();

      const fromBlock = 0;
      const toBlock = "latest";

      const pull = async (filter) => {
        const logs = await provider.getLogs({ ...filter, fromBlock, toBlock, address: contract.address });
        return logs.map((l) => {
          const parsed = iface.parseLog(l);
          return { name: parsed.name, args: parsed.args, blockNumber: l.blockNumber };
        });
      };

      const [proposed, votes, reached, executed, prepreps, prepares, commits, replies] = await Promise.all([
        pull(fProposed),
        pull(fVote),
        pull(fReached),
        pull(fExec),
        pull(fPrePrep).catch(() => []),
        pull(fPrep).catch(() => []),
        pull(fCommit).catch(() => []),
        pull(fReply).catch(() => []),
      ]);

      const track = new Set(hashes.map((h) => h.toLowerCase()));

      // Normalizers
      const applyOld = async (ev) => {
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

      const applyNew = async (ev) => {
        // New events carry explicit fields
        if (ev.name === "PrePrepare") {
          const txHash = ev.args.txHash;
          if (!track.has(txHash.toLowerCase())) return;
          pushLog(txHash, {
            type: "PrePrepare",
            data: {
              leader: ev.args.leader,
              requiredVotes: ev.args.requiredVotes.toString(),
              proposalTime: ev.args.proposalTime.toString(),
            },
            blockNumber: ev.blockNumber,
          });
        } else if (ev.name === "Prepare") {
          const txHash = ev.args.txHash;
          if (!track.has(txHash.toLowerCase())) return;
          pushLog(txHash, {
            type: "Prepare",
            data: { node: ev.args.node, approve: ev.args.vote, blockTime: ev.args.blockTime.toString() },
            blockNumber: ev.blockNumber,
          });
        } else if (ev.name === "Commit") {
          const txHash = ev.args.txHash;
          if (!track.has(txHash.toLowerCase())) return;
          pushLog(txHash, {
            type: "Commit",
            data: { approved: ev.args.approved, voteCount: ev.args.voteCount.toString(), blockTime: ev.args.blockTime.toString() },
            blockNumber: ev.blockNumber,
          });
        } else if (ev.name === "Reply") {
          const txHash = ev.args.txHash;
          if (!track.has(txHash.toLowerCase())) return;
          pushLog(txHash, {
            type: "Reply",
            data: {
              publisher: ev.args.publisher,
              gateway: ev.args.gateway,
              cpcWei: ev.args.cpcWei.toString(),
              timestamp: ev.args.timestamp.toString(),
            },
            blockNumber: ev.blockNumber,
          });
        }
      };

      for (const ev of [...proposed, ...votes, ...reached, ...executed]) {
        // eslint-disable-next-line no-await-in-loop
        await applyOld(ev);
      }
      for (const ev of [...prepreps, ...prepares, ...commits, ...replies]) {
        // eslint-disable-next-line no-await-in-loop
        await applyNew(ev);
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

        if (!d.executed && !d.consensusReached && !hasVoted && !isExpired) {
          toVote.push(base);
        }
        if (d.consensusReached && !d.executed) {
          decided.push(base);
        }
        if (d.executed) {
          executed.push(base);
        }
      }

      setPendingVotes(toVote);
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

      // Old events (synthesized)
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

      // New canonical consensus events
      const onPrePrepare = (txHash, campaignId, publisher, leader, requiredVotes, proposalTime, evt) => {
        pushLog(txHash, {
          type: "PrePrepare",
          data: { leader, requiredVotes: requiredVotes.toString(), proposalTime: proposalTime.toString() },
          blockNumber: evt.blockNumber,
        });
      };
      const onPrepare = (txHash, node, vote, blockTime, evt) => {
        pushLog(txHash, {
          type: "Prepare",
          data: { node, approve: vote, blockTime: blockTime.toString() },
          blockNumber: evt.blockNumber,
        });
      };
      const onCommit = (txHash, approved, voteCount, blockTime, evt) => {
        pushLog(txHash, {
          type: "Commit",
          data: { approved, voteCount: voteCount.toString(), blockTime: blockTime.toString() },
          blockNumber: evt.blockNumber,
        });
      };
      const onReply = (txHash, campaignId, publisher, gateway, cpcWei, timestamp, evt) => {
        pushLog(txHash, {
          type: "Reply",
          data: { publisher, gateway, cpcWei: cpcWei.toString(), timestamp: timestamp.toString() },
          blockNumber: evt.blockNumber,
        });
      };

      const prePrepFilter = contract.filters.PrePrepare();
      const prepareFilter = contract.filters.Prepare();
      const commitFilter = contract.filters.Commit();
      const replyFilter = contract.filters.Reply();

      // Attach new listeners but guard if ABI doesn’t have them (older deployments)
      try { contract.on(prePrepFilter, onPrePrepare); } catch {}
      try { contract.on(prepareFilter, onPrepare); } catch {}
      try { contract.on(commitFilter, onCommit); } catch {}
      try { contract.on(replyFilter, onReply); } catch {}

      const interval = setInterval(() => { fetchAllBuckets(); }, 30000);

      return () => {
        contract.off(proposedFilter, onProposed);
        contract.off(consensusFilter, onReached);
        contract.off(voteFilter, onVote);
        contract.off(executedFilter, onExecuted);

        try { contract.off(prePrepFilter, onPrePrepare); } catch {}
        try { contract.off(prepareFilter, onPrepare); } catch {}
        try { contract.off(commitFilter, onCommit); } catch {}
        try { contract.off(replyFilter, onReply); } catch {}

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
                        {l.type === "PrePrepare" && `leader=${l.data.leader}${l.data.requiredVotes ? `, required=${l.data.requiredVotes}` : ""}`}
                        {l.type === "Prepare" && `node=${l.data.node}, approve=${l.data.approve ? "yes" : "no"}`}
                        {l.type === "Commit" && `approved=${l.data.approved ? "yes" : "no"}, votes=${l.data.voteCount}`}
                        {l.type === "Reply" && `publisher=${l.data.publisher}${l.data.gateway ? `, gateway=${l.data.gateway.substring(0,10)}...` : ""}`}
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

        {/* Recent PBFT activity */}
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
