import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Instructions from "./Instructions";
import DarkMode from "./DarkMode";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DarkMode />
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/instructions" element={<Instructions />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
