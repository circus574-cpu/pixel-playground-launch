/** Transactional e-mail through the Resend HTTP API (https://resend.com/docs/api-reference/emails). */
export type Mail = { to: string; subject: string; html: string; text: string };
export type Mailer = { configured: boolean; send(mail: Mail): Promise<void> };

export function resendMailer(env: NodeJS.ProcessEnv = process.env, http = fetch): Mailer {
  const key = env["RESEND_API_KEY"];
  const from = env["EMAIL_FROM"] || "Ki Legends <konto@kilegends.pl>";
  return {
    configured: Boolean(key),
    async send(mail) {
      if (!key) throw Error("MAIL_NOT_CONFIGURED");
      const response = await http("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!response.ok) throw Error("MAIL_SEND_FAILED " + response.status);
    },
  };
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function layout(title: string, lines: string[], link: string, button: string) {
  const html = `<!doctype html><html lang="pl"><body style="margin:0;background:#0b111e;font-family:system-ui,sans-serif;color:#e2e8f0">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<h1 style="color:#f5d48a;font-family:Georgia,serif;letter-spacing:4px">KI LEGENDS</h1>
<h2 style="font-size:20px">${escape(title)}</h2>
${lines.map((l) => `<p style="line-height:1.5">${escape(l)}</p>`).join("")}
<p style="margin:28px 0"><a href="${escape(link)}" style="background:#c8a35a;color:#111;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700">${escape(button)}</a></p>
<p style="font-size:12px;color:#94a3b8">Jeśli przycisk nie działa, skopiuj adres: ${escape(link)}</p>
<p style="font-size:12px;color:#94a3b8">Jeśli to nie Ty, zignoruj tę wiadomość.</p>
</div></body></html>`;
  return {
    html,
    text: [title, ...lines, link, "Jeśli to nie Ty, zignoruj tę wiadomość."].join("\n\n"),
  };
}

export function confirmationMail(to: string, nick: string, link: string): Mail {
  return {
    to,
    subject: "Ki Legends — aktywuj konto",
    ...layout(
      `Witaj, ${nick}!`,
      ["Kliknij przycisk, aby aktywować konto w Ki Legends. Link jest ważny 24 godziny."],
      link,
      "Aktywuj konto",
    ),
  };
}

export function resetMail(to: string, link: string): Mail {
  return {
    to,
    subject: "Ki Legends — nowe hasło",
    ...layout(
      "Ustaw nowe hasło",
      ["Otrzymaliśmy prośbę o zmianę hasła. Link jest ważny 1 godzinę."],
      link,
      "Ustaw nowe hasło",
    ),
  };
}
