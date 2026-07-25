"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("host");
  return `${protocol}://${host}`;
}

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

export async function resetPassword(email: string): Promise<AuthResult> {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    return {
      status: "error",
      message: "No se pudo procesar la solicitud. Intenta de nuevo.",
    };
  }

  return {
    status: "success",
    message: "Si el correo existe, te enviamos un enlace de recuperación.",
  };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      status: "error",
      message:
        "No se pudo actualizar la contraseña. El enlace puede haber expirado.",
    };
  }

  return {
    status: "success",
    message: "Contraseña actualizada correctamente.",
  };
}
