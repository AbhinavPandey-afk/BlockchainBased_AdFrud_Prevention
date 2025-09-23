// import React from "react";
// import { Routes, Route } from "react-router-dom";
// import HomePage from "./pages/HomePage";
// import AdminDashboard from "./pages/AdminDashboard";
// import Gateway from "./pages/Gateway";
// import Advertiser from "./pages/Advertiser";
// import Publisher from "./pages/Publisher";
// import Auditor from "./pages/Auditor";
// import ClickSubmission from "./pages/ClickSubmission";
// import Explorer from "./pages/Explorer";
// import BlockExplorer from "./pages/BlockExplorer";

// function App() {
//   return (
//     <Routes>
//       <Route path="/" element={<HomePage />} />
//       <Route path="/admin" element={<AdminDashboard />} />
//       <Route path="/gateway" element={<Gateway />} />
//       <Route path="/advertiser" element={<Advertiser />} />
//       <Route path="/publisher" element={<Publisher />} />
//       <Route path="/auditor" element={<Auditor />} />
//       <Route path="/submit-click" element={<ClickSubmission />} />
//       <Route path="/explorer" element={<Explorer />} />
//       <Route path="/block-explorer" element={<BlockExplorer />} />
//     </Routes>
//   );
// }

// export default App;
import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdminDashboard from "./pages/AdminDashboard";
import Gateway from "./pages/Gateway";
import Advertiser from "./pages/Advertiser";
import Publisher from "./pages/Publisher";
import Published from "./pages/Published"; // Add this import
import Auditor from "./pages/Auditor";
import ClickSubmission from "./pages/ClickSubmission";
import Explorer from "./pages/Explorer";
import BlockExplorer from "./pages/BlockExplorer";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/gateway" element={<Gateway />} />
      <Route path="/advertiser" element={<Advertiser />} />
      <Route path="/publisher" element={<Publisher />} />
      <Route path="/published" element={<Published />} /> {/* Add this route */}
      <Route path="/auditor" element={<Auditor />} />
      <Route path="/submit-click" element={<ClickSubmission />} />
      <Route path="/explorer" element={<Explorer />} />
      <Route path="/block-explorer" element={<BlockExplorer />} />
    </Routes>
  );
}

export default App;
