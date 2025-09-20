import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import HeroSection from "../components/HeroSection";
import FeatureGrid from "../components/FeatureGrid";

const HomePage = () => {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1">
        <HeroSection />
        <section className="py-4">
          <FeatureGrid />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;
