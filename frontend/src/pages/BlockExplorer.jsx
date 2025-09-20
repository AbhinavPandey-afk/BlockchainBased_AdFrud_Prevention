import React, { useState, useEffect } from "react";
import { Container, Card, ListGroup, Button, Collapse } from "react-bootstrap";
import { ethers, providers, utils } from "ethers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const BlockExplorer = () => {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const fetchBlocks = async () => {
      try {
    const provider = new providers.JsonRpcProvider("http://127.0.0.1:7545");
        const latest = await provider.getBlockNumber();
        const blockPromises = [];
        for (let i = 0; i < 10; i++) {
          if (latest - i >= 0) {
            blockPromises.push(provider.getBlockWithTransactions(latest - i));
          }
        }
        const fetchedBlocks = await Promise.all(blockPromises);
        setBlocks(fetchedBlocks);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBlocks();
  }, []);

  const toggleExpand = (blockNumber) => {
    setExpanded(prev => ({ ...prev, [blockNumber]: !prev[blockNumber] }));
  };

  return (
    <div className="d-flex flex-column min-vh-100 amoled-bg text-light">
      <Navbar />
      <Container className="py-5">
        <h2 className="mb-4 text-center fw-bold neon-cyan display-5">🔍 Block Explorer</h2>
        {loading ? <p>Loading blocks...</p> : (
          blocks.map(block => (
            <Card key={block.number} className="glass-card mb-3">
              <Card.Body>
                <Card.Title>Block #{block.number}</Card.Title>
                <p>Hash: {block.hash}</p>
                <p>Timestamp: {new Date(block.timestamp * 1000).toLocaleString()}</p>
                <p>Transactions: {block.transactions.length}</p>
                <Button onClick={() => toggleExpand(block.number)} className="btn btn-primary">
                  {expanded[block.number] ? 'Hide' : 'Show'} Transactions
                </Button>
                <Collapse in={expanded[block.number]}>
                  <div>
                    <ListGroup variant="flush" className="mt-3">
                      {block.transactions.map(tx => (
                        <ListGroup.Item key={tx.hash} className="bg-dark text-light">
                          <p>Hash: {tx.hash}</p>
                          <p>From: {tx.from}</p>
                          <p>To: {tx.to || 'Contract Creation'}</p>
                          <p>Value: {utils.formatEther(tx.value)} ETH</p>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </div>
                </Collapse>
              </Card.Body>
            </Card>
          ))
        )}
      </Container>
      <Footer />
    </div>
  );
};

export default BlockExplorer;
