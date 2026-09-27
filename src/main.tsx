import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BuilderTitleBar } from "./components/builder/BuilderTitleBar";
import "./BuilderTheme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="builder-window-frame">
      <BuilderTitleBar />
      <div className="builder-window-content">
        <App />
      </div>
    </div>
  </React.StrictMode>,
);
