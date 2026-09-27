import React from "react";
import ReactDOM from "react-dom/client";
import Wheel from "./Wheel";
import "./App.css";
import "./wheel.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Wheel />
  </React.StrictMode>,
);
