import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";

// Embed entry point — constrained fallback for manual-copy proxy mode.
// Shares chat UI components from src/ but avoids Next.js runtime assumptions.
// Chat screen is imported lazily to keep the initial bundle small.
const ChatScreen = (await import("../src/components/chat/chat-screen")).default;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <ChatScreen />
  </StrictMode>
);
