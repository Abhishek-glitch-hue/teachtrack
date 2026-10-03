function brevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? "TeachTrack";

  if (!apiKey || !senderEmail) {
    throw new Error("Email delivery is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.");
  }

  return { apiKey, senderEmail, senderName };
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const config = brevoConfig();
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": config.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: to }],
      subject: "Reset your TeachTrack password",
      htmlContent: `<p>We received a request to reset your TeachTrack password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in one hour. If you did not request this, you can safely ignore this email.</p>`,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const details = await response.text();
    // Keep provider responses useful for diagnosis without logging the API key.
    throw new Error(`Brevo email API returned ${response.status}: ${details.slice(0, 500)}`);
  }
}
