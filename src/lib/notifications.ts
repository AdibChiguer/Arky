import toast from "react-hot-toast";

export type Notification = { tone: "success" | "error" | "info"; message: string };

export function notify({ tone, message }: Notification) {
  if (tone === "success") toast.success(message);
  else if (tone === "error") toast.error(message);
  else toast(message, { icon: "ℹ" });
}
