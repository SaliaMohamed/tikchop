import { useContext } from "react";

import { AuthContext } from "@/components/auth-context";

export function useAuth() {
  return useContext(AuthContext);
}
