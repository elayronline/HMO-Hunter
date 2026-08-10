import { redirect } from "next/navigation"

export default function SignUpPage() {
  redirect("/auth/login?message=Create+your+account+to+get+started")
}
