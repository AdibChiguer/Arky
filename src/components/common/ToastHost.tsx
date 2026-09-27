import { Toaster } from "react-hot-toast";

export function ToastHost() {
  return <Toaster position="top-right" toastOptions={{
    duration: 3500,
    style: { background: "#1d1d1d", border: "1px solid #4D4D4C", color: "#F8F9FA" },
    success: { iconTheme: { primary: "#4ADE80", secondary: "#151515" } },
    error: { duration: 5000, iconTheme: { primary: "#F87171", secondary: "#151515" } },
  }} />;
}
