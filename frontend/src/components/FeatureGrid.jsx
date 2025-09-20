import React from "react";
import { Container, Row, Col, Card, Button as RBButton } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const features = [
  { title: "Admin", desc: "Configure the protocol", path: "/admin", icon: "🛠" },
  { title: "Gateway", desc: "Stake, unstake, submit clicks", path: "/gateway", icon: "🔗" },
  { title: "Advertiser", desc: "Create & fund campaigns", path: "/advertiser", icon: "📢" },
  { title: "Publisher", desc: "Withdraw earnings", path: "/publisher", icon: "💰" },
  { title: "Auditor", desc: "Report fraud & slash", path: "/auditor", icon: "🔍" },
  { title: "Explorer", desc: "View on-chain events", path: "/explorer", icon: "📜" }
];

const FeatureGrid = () => {
  const navigate = useNavigate();
  return (
    <Container className="py-5">
      <Row className="g-4">
        {features.map((f, i) => (
          <Col key={i} xs={12} md={6} lg={4}>
            <Card className="h-100 shadow-sm">
              <Card.Body className="d-flex flex-column">
                <div className="fs-1 mb-3">{f.icon}</div>
                <Card.Title>{f.title}</Card.Title>
                <Card.Text className="text-muted">{f.desc}</Card.Text>
                <div className="mt-auto">
                  <RBButton variant="primary" onClick={() => navigate(f.path)}>Open</RBButton>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default FeatureGrid;
