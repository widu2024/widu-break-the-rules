// NETLIFY FUNCTION — save-contact
// ===================================================================
// Questo file gira sui server di Netlify, MAI nel browser del candidato.
// È qui che teniamo la chiave segreta di Brevo, al sicuro.
//
// Riceve i dati dal form della landing e crea (o aggiorna) il contatto
// su Brevo, aggiungendolo alla lista "Break the Rules" (ID 5).
// ===================================================================

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Metodo non permesso" }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { nome, cognome, email, telefono, archetipo, consensoEmail, consensoWhatsapp } = data;

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email mancante" }) };
    }

    function normalizzaTelefono(tel) {
      if (!tel) return "";
      let pulito = tel.replace(/[^0-9+]/g, "");
      if (pulito.startsWith("+")) return pulito;
      if (pulito.startsWith("00")) return "+" + pulito.slice(2);
      if (pulito.startsWith("0")) pulito = pulito.slice(1);
      if (pulito.length === 12 && pulito.startsWith("39")) return "+" + pulito;
      return "+39" + pulito;
    }
    const telefonoNormalizzato = normalizzaTelefono(telefono);

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = 5;

    if (!BREVO_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Chiave Brevo non configurata sul server" }) };
    }

    const brevoResponse = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          NOME: nome || "",
          COGNOME: cognome || "",
          SMS: telefonoNormalizzato,
          ARCHETIPO: archetipo || "",
          CONSENSO_WHATSAPP: !!consensoWhatsapp
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true
      })
    });

    if (!brevoResponse.ok && brevoResponse.status !== 204) {
      const errText = await brevoResponse.text();
      console.error("Errore da Brevo:", errText);
      return { statusCode: 502, body: JSON.stringify({ error: "Brevo ha rifiutato la richiesta" }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error("Errore nella function:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Errore interno" }) };
  }
};
