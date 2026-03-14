import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; userId?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthCtx>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => null,
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Safety timeout: if getSession takes > 4s (e.g. new device, slow network),
    // assume no session and show auth screen instead of hanging on splash.
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setSession(null);
        setLoading(false);
      }
    }, 4000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        clearTimeout(timeout);
        setSession(session);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) setSession(session);
      // When user clicks password reset link, navigate to reset-password page
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset-password");
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<{ error: string | null; userId?: string }> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return error ? { error: error.message } : { error: null, userId: data.user?.id };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Platform.OS === "web"
        ? `${window.location.origin}/reset-password`
        : "propertymanager://reset-password",
    });
    return error ? error.message : null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
