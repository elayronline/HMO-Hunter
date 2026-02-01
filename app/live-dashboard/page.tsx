import { redirect } from "next/navigation"

// This page is for admin use only - redirect regular users to main app
export default function LiveDashboard() {
  redirect("/")
}
