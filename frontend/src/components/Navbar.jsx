import React from "react";
import { Navbar, Nav, Container, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

const AppNavbar = () => {
  const { account, connect, disconnect } = useWallet();

  const short = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  return (
    <>
      {/* Top Navigation */}
      <Navbar expand="lg" className="shadow-sm glass-card border-0 py-3">
        <Container>
          <Navbar.Brand
            as={Link}
            to="/"
            className="fw-bold neon-label fs-4"
          >
            AdFraud<span className="text-primary">PBFT</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="ms-auto">
<Nav.Link as={Link} to="/pbft-node" className="nav-link-custom">
  PBFT Node
</Nav.Link>

              <Nav.Link as={Link} to="/">Home</Nav.Link>
              <Nav.Link as={Link} to="/advertiser">Advertiser</Nav.Link>
              <Nav.Link as={Link} to="/gateway">Gateway</Nav.Link>
              <Nav.Link as={Link} to="/publisher">Publisher</Nav.Link>
              <Nav.Link as={Link} to="/auditor">Auditor</Nav.Link>
              <Nav.Link as={Link} to="/explorer">Explorer</Nav.Link>
              <Nav.Link as={Link} to="/block-explorer">Block Explorer</Nav.Link>
              <Nav.Link as={Link} to="/admin">Admin</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Wallet Row */}
      <div className="wallet-row glass-card border-0">
        <Container>
          <Row className="justify-content-end">
            <Col xs="auto">
              {account ? (
                <div className="d-flex align-items-center">
                  <span className="me-3 fw-semibold neon-label">
                    {short(account)}
                  </span>
                  <button
                    className="btn btn-outline-danger btn-sm rounded-pill"
                    onClick={disconnect}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-primary btn-sm rounded-pill px-4"
                  onClick={() => connect()}
                >
                  🔗 Connect MetaMask
                </button>
              )}
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
};

export default AppNavbar;
