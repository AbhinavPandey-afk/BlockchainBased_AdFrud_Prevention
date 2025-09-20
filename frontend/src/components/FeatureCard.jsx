// src/components/FeatureCard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "./Button";

const FeatureCard = ({ title, description, path }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white shadow-md rounded-2xl p-6 flex flex-col justify-between hover:shadow-lg transition">
      <div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
      </div>
      <Button variant="primary" onClick={() => navigate(path)}>
        Go to {title}
      </Button>
    </div>
  );
};

export default FeatureCard;
