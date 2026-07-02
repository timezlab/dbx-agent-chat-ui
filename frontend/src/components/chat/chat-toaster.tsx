"use client";

import { useTheme } from "next-themes";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * App-wide toast host. Mounted once in AppShell so it is shared by both the Next app and
 * the Vite embed. Its main job today is surfacing detailed chat stream failures: those
 * toasts are dispatched with `autoClose: false` (see use-chat) so the reason stays on
 * screen until the user dismisses it — the inline "network error" notice alone never
 * says *why*. Theme follows next-themes so it matches the rest of the UI.
 */
export function ChatToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <ToastContainer
      position="bottom-right"
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

export default ChatToaster;
