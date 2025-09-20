import React, { useEffect, useState } from "react";
import { Card, Badge } from "react-bootstrap";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";

const CampaignCard = ({ campaign }) => {
  const { contract } = useWallet();
  const { id, advertiser, cpcWei, budgetWei, paused, meta } = campaign;

  const [clicks, setClicks] = useState([]);

  const cpcEth = ethers.utils.formatEther(cpcWei);
  const budgetEth = ethers.utils.formatEther(budgetWei);

  useEffect(() => {
    const fetchClicks = async () => {
      if (!contract) return;
      try {
        const filter = contract.filters.ClickRecorded(null, id, null);
        const events = await contract.queryFilter(filter, 0, "latest");

        const clickData = events.map((e) => ({
          clickHash: e.args.clickHash,
          publisher: e.args.publisher,
          gateway: e.args.gateway,
          timestamp: new Date(
            e.args.timestamp.toNumber() * 1000
          ).toLocaleString(),
        }));
        setClicks(clickData);
      } catch (err) {
        console.error("Error fetching clicks:", err);
      }
    };

    fetchClicks();
  }, [contract, id]);

  return (
    <Card
      className="glass-card border-0 h-100 mb-4 w-100"
      style={{ opacity: paused ? 0.5 : 1 }} // Dim paused campaigns
    >
      <Card.Body>
        <Card.Title className="neon-label">
          🚀 Campaign {id}{" "}
          {paused ? (
            <Badge bg="danger" className="ms-2">
              Paused
            </Badge>
          ) : (
            <Badge bg="success" className="ms-2">
              Active
            </Badge>
          )}
        </Card.Title>

        <div className="neon-text">
          <p>
            <strong>Advertiser:</strong> {advertiser}
          </p>
          <p>
            <strong>CPC:</strong> {cpcEth} ETH
          </p>
          <p>
            <strong>Budget:</strong> {budgetEth} ETH
          </p>
          <p>
            <strong>Meta:</strong> {meta}
          </p>
          <p>
            <strong>Clicks Recorded:</strong> {clicks.length}
          </p>
        </div>

        {clicks.length > 0 && (
          <div
            className="glass-list mt-3 p-2 rounded"
            style={{ maxHeight: "180px", overflowY: "auto" }}
          >
            <strong className="neon-label">Click Details:</strong>
            <ul className="small mt-2 mb-0">
              {clicks.map((c, idx) => (
                <li key={idx} className="mb-1">
                  <span className="text-info">Hash:</span>{" "}
                  {c.clickHash.toString().slice(0, 10)}... |
                  <span className="text-warning"> Publisher:</span>{" "}
                  {c.publisher.slice(0, 6)}... |
                  <span className="text-success"> Gateway:</span>{" "}
                  {c.gateway.slice(0, 6)}... |
                  <span className="text-muted"> Time:</span> {c.timestamp}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default CampaignCard;
