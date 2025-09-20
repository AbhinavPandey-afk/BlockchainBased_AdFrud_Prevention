import React from "react";

const Button = ({ children, variant = "primary", size = "md", onClick, disabled = false, className = "" }) => {
  const sizeCls = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  return (
    <button className={`btn btn-${variant} ${sizeCls} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

export default Button;
