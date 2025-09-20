import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Github, Twitter, Linkedin } from "react-bootstrap-icons";

const Footer = () => {
  return (
    <footer
      className="text-light border-top mt-5"
      style={{
        backgroundColor: "#000000", // AMOLED dark
        boxShadow: "0 -2px 10px rgba(0,0,0,0.6)",
      }}
    >
      <div className="container py-5">
        <div className="row">
          {/* Brand & tagline */}
          <div className="col-md-4 mb-4">
            <h5 className="fw-bold text-white">AdFraudPBFT</h5>
            <p className="text-muted">
              A modern fraud detection system powered by PBFT consensus.  
              <br /> Made with ❤️ for security & trust.
            </p>
          </div>

          {/* Quick links */}
          <div className="col-md-2 mb-4">
            <h6 className="fw-bold text-white mb-3">Quick Links</h6>
            <ul className="list-unstyled">
              <li><a href="#" className="text-muted text-decoration-none hover-link">Docs</a></li>
              <li><a href="#" className="text-muted text-decoration-none hover-link">About</a></li>
              <li><a href="#" className="text-muted text-decoration-none hover-link">Contact</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="col-md-6 mb-4">
            <h6 className="fw-bold text-white mb-3">Stay Updated</h6>
            <form className="d-flex">
              <input
                type="email"
                className="form-control me-2 bg-dark text-light border-secondary"
                placeholder="Enter your email"
              />
              <button
                type="submit"
                className="btn btn-outline-light"
                style={{ transition: "0.3s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#a78bfa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center border-top border-secondary pt-3 mt-3">
          <small className="text-muted mb-2 mb-md-0">
            &copy; {new Date().getFullYear()}{" "}
            <span className="fw-semibold text-white">AdFraudPBFT</span>. All rights reserved.
          </small>
          <div className="d-flex gap-3">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="text-muted hover-link">
              <Github size={20} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-muted hover-link">
              <Twitter size={20} />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="text-muted hover-link">
              <Linkedin size={20} />
            </a>
          </div>
        </div>
      </div>

      {/* Extra hover effect */}
      <style>{`
        .hover-link:hover {
          color: #a78bfa !important;
          transition: color 0.3s ease;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
