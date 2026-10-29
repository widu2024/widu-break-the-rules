// NETLIFY FUNCTION — sos-pirati
// Quando il candidato preme SOS, manda una email al team Widu via Brevo
// con i dati del candidato. La chiave Brevo resta sul server.
//
// Variabili da impostare su Netlify (Site settings → Environment variables):
//   BREVO_API_KEY    già presente
//   SOS_TO_EMAIL     indirizzo Widu che riceve l'SOS (es. pirati@wi-du.it)
//   SOS_FROM_EMAIL   mittente verificato su Brevo (es. noreply@wi-du.it)

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Metodo non permesso" }) };
  }
  try {
    const { nome, cognome, email, telefono, archetipo } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: "Email mancante" }) };

    const { BREVO_API_KEY, SOS_TO_EMAIL, SOS_FROM_EMAIL } = process.env;
    if (!BREVO_API_KEY || !SOS_TO_EMAIL || !SOS_FROM_EMAIL) {
      return { statusCode: 500, body: JSON.stringify({ error: "Configurazione email mancante" }) };
    }

    const esc = s => String(s || "-").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const html = `<h2>⚓ SOS da Break the Rules</h2>
<p>Un candidato vuole parlare con i pirati di Widu.</p>
<p><b>Nome:</b> ${esc(nome)} ${esc(cognome)}<br>
<b>Email:</b> ${esc(email)}<br>
<b>Telefono:</b> ${esc(telefono)}<br>
<b>Archetipo:</b> ${esc(archetipo)}</p>`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "api-key": BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: "Widu Break the Rules", email: SOS_FROM_EMAIL },
        to: [{ email: SOS_TO_EMAIL }],
        replyTo: { email: email, name: `${nome || ""} ${cognome || ""}`.trim() || email },
        subject: `SOS pirati: ${nome || ""} ${cognome || ""}`.trim(),
        htmlContent: html
      })
    });

    if (!res.ok) {
      console.error("Errore da Brevo:", await res.text());
      return { statusCode: 502, body: JSON.stringify({ error: "Invio email non riuscito" }) };
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Errore nella function:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Errore interno" }) };
  }
};
