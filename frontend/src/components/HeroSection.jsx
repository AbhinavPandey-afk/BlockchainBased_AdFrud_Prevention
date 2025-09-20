import React from "react";
import { Container } from "react-bootstrap";
import Button from "./Button";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();
  return (
    <section className="py-5" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
      <Container className="text-center py-5">
        <h1 className="display-5 fw-bold">AdFraudPBFT — Secure Ad Network</h1>
        <p className="lead mt-3 mb-4">Stake, create campaigns, record clicks, and fight ad fraud on-chain.</p>
        <Button variant="primary" onClick={() => navigate("/advertiser")}>Get Started</Button>
      </Container>
    </section>
  );
};

export default HeroSection;
