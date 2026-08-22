import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initFrontendMonitoring } from "./observability/monitoring";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./styles/index.css";

initFrontendMonitoring();

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
