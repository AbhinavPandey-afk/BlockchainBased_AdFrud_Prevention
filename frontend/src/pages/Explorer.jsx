import React, { useEffect, useState } from "react";
import { Container, Card, ListGroup, Badge } from "react-bootstrap";
import { useWallet } from "../context/WalletContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const Explorer = () => {
  const { contract } = useWallet();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!contract) return;

    const fetchPastEvents = async () => {
      try {
        // Fetch historical events
        const pastCampaigns = await contract.queryFilter(contract.filters.CampaignCreated(), 0, "latest");
        const pastClicks = await contract.queryFilter(contract.filters.ClickRecorded(), 0, "latest");
        const pastWithdrawals = await contract.queryFilter(contract.filters.PublisherWithdrawal(), 0, "latest");

        const allPastEvents = [
          ...pastCampaigns.map(e => ({ event: "CampaignCreated", args: e.args, txHash: e.transactionHash })),
          ...pastClicks.map(e => ({ event: "ClickRecorded", args: e.args, txHash: e.transactionHash })),
          ...pastWithdrawals.map(e => ({ event: "PublisherWithdrawal", args: e.args, txHash: e.transactionHash })),
        ];

        setEvents(allPastEvents.sort((a, b) => b.args?.timestamp?.toNumber() - a.args?.timestamp?.toNumber()));
      } catch (err) {
        console.error("Error fetching past events:", err);
      }
    };

    fetchPastEvents();

    // Live event listeners
    const handleEvent = (eventName) => (...args) => {
      const lastArg = args[args.length - 1];
      const txHash = lastArg?.transactionHash || null;

      setEvents(prev => [{ event: eventName, args, txHash }, ...prev].slice(0, 100));
    };

    contract.on("CampaignCreated", handleEvent("CampaignCreated"));
    contract.on("ClickRecorded", handleEvent("ClickRecorded"));
    contract.on("PublisherWithdrawal", handleEvent("PublisherWithdrawal"));

    return () => {
      contract.removeAllListeners("CampaignCreated");
      contract.removeAllListeners("ClickRecorded");
      contract.removeAllListeners("PublisherWithdrawal");
    };
  }, [contract]);

  // Event badge colors
  const eventColors = {
    CampaignCreated: "info",
    ClickRecorded: "success",
    PublisherWithdrawal: "warning",
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <Container className="py-5">
        <h2 className="mb-4 text-center neon-label">📡 Blockchain Explorer</h2>

        {events.length === 0 ? (
          <Card className="glass-card border-0">
            <Card.Body className="text-center neon-text">No events yet</Card.Body>
          </Card>
        ) : (
          <div className="d-grid gap-3">
            {events.map((e, idx) => (
              <Card key={idx} className="glass-card border-0">
                <Card.Body>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h5 className="neon-label mb-0">{e.event}</h5>
                    <Badge bg={eventColors[e.event] || "secondary"}>
                      Tx: {e.txHash?.slice(0, 10)}...
                    </Badge>
                  </div>
                  <pre className="neon-text small mb-0">{JSON.stringify(e.args, null, 2)}</pre>
                </Card.Body>
              </Card>
            ))}
          </div>
        )}
      </Container>
      <Footer />
    </div>
  );
};

export default Explorer;
