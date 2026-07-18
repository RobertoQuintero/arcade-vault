"use server";

import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  status: "success" | "error";
  message: string;
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      status: "error",
      message: "Credenciales inválidas. Verifica tu correo y contraseña.",
    };
  }

  return { status: "success", message: "Sesión iniciada correctamente." };
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: name.toUpperCase().slice(0, 10) },
    },
  });

  if (error) {
    return {
      status: "error",
      message: "No se pudo crear la cuenta. Intenta con otro correo.",
    };
  }

  return { status: "success", message: "Cuenta creada correctamente." };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
