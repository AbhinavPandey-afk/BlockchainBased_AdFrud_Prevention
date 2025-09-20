// src/pages/AdvertiserPage.jsx
// import React, { useState } from "react";
// import Navbar from "../components/Navbar";
// import Footer from "../components/Footer";
// import { Container } from "react-bootstrap";
// import Button from "../components/Button";

// const AdvertiserPage = () => {
//   const [account, setAccount] = useState(null);

//   async function connectMetaMask() {
//     if (window.ethereum) {
//       const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
//       setAccount(accounts[0]);
//     } else alert("MetaMask not installed.");
//   }

//   return (
//     <div className="d-flex flex-column min-vh-100">
//       <Navbar />
//       <main className="flex-grow-1 py-5">
//         <Container>
//           <h1 className="mb-4">Advertiser Dashboard</h1>
//           {account ? (
//             <p>Connected as <span className="fw-monospace">{account}</span></p>
//           ) : (
//             <Button onClick={connectMetaMask}>Connect MetaMask</Button>
//           )}

//           {/* TODO: Add create/fund campaign forms here */}
//         </Container>
//       </main>
//       <Footer />
//     </div>
//   );
// };

// export default AdvertiserPage;
