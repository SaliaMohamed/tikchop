import { Session, User } from "@supabase/supabase-js";
import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { Seller } from "@/types/tikchop";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  seller: Seller | null;
  notice: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSeller: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
  configured: false,
  loading: false,
  session: null,
  user: null,
  seller: null,
  notice: "",
  signIn: async () => undefined,
  signOut: async () => undefined,
  refreshSeller: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [notice, setNotice] = useState("");

  const refreshSeller = useCallback(async () => {
    if (!supabase || !hasSupabaseConfig) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      setSeller(null);
      return;
    }

    const { data, error } = await supabase
      .from("sellers")
      .select("id,name,slug,phone_number,whatsapp_status,evolution_instance,owner_user_id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (error) {
      setNotice(error.message);
      setSeller(null);
      return;
    }

    setNotice(data ? "" : "Aucune boutique n'est encore liee a ce compte.");
    setSeller((data as Seller | null) || null);
  }, []);

  useEffect(() => {
    if (!supabase || !hasSupabaseConfig) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session || null);
      await refreshSeller();
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      refreshSeller().catch((error) => setNotice(error instanceof Error ? error.message : "Session non synchronisee."));
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [refreshSeller]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase n'est pas configure.");
    setLoading(true);
    setNotice("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setLoading(false);
      throw new Error(error.message);
    }
    setSession(data.session || null);
    await refreshSeller();
    setLoading(false);
  }, [refreshSeller]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setSeller(null);
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: hasSupabaseConfig,
    loading,
    session,
    user: session?.user || null,
    seller,
    notice,
    signIn,
    signOut,
    refreshSeller,
  }), [loading, notice, refreshSeller, seller, session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
