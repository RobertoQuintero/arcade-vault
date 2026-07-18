"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getUser as getGuestUser,
  setUser as setGuestUser,
} from "@/lib/storage";

export interface SessionUser {
  name: string;
  isGuest: boolean;
}

function nameFromSupabaseUser(user: {
  user_metadata?: { name?: string };
  email?: string;
}): string {
  return (
    user.user_metadata?.name ||
    (user.email ?? "JUGADOR").split("@")[0].toUpperCase().slice(0, 10)
  );
}

export function useSessionUser(): SessionUser | null {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const syncFromGuest = () => {
      const guest = getGuestUser();
      setUser(guest ? { name: guest.name, isGuest: true } : null);
    };

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ name: nameFromSupabaseUser(data.user), isGuest: false });
      } else {
        syncFromGuest();
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser({ name: nameFromSupabaseUser(session.user), isGuest: false });
        } else {
          syncFromGuest();
        }
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  return user;
}

export async function signOutSession(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  setGuestUser(null);
}
