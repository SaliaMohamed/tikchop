import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/onboarding?new=1&step=account");
}
