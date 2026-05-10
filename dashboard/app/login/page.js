import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/onboarding?mode=signin&method=phone");
}
