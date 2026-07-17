"use server";

import { Resend } from "resend";

export interface ContactFormResult {
  status: "success" | "error";
  message: string;
}

export async function sendContactMessage(
  name: string,
  email: string,
  msg: string
): Promise<ContactFormResult> {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.CONTACT_TO_EMAIL!,
      replyTo: email,
      subject: "Nuevo mensaje de contacto — Arcade Vault",
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
    });

    if (error) {
      return { status: "error", message: "No se pudo enviar el mensaje. Intenta de nuevo." };
    }

    return { status: "success", message: "Mensaje enviado correctamente." };
  } catch {
    return { status: "error", message: "No se pudo enviar el mensaje. Intenta de nuevo." };
  }
}
