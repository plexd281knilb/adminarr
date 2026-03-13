import { redirect } from "next/navigation";

export default function Home() {
  // Since we removed the public dashboard, anyone who hits the root URL
  // should just be redirected straight to the new Admin Mission Control.
  redirect("/admin");
}