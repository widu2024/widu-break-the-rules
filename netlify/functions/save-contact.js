// ===================================================================
// NETLIFY FUNCTION — save-contact
// ===================================================================
// Questo file gira sui server di Netlify, MAI nel browser del candidato.
// È qui che teniamo la chiave segreta di Brevo, al sicuro.
//
// Riceve i dati dal form della landing e crea (o aggiorna) il contatto
// su Brevo, aggiungendolo alla lista "Break the Rules" (ID 5).
// ===================================================================

exports.handler = async function (event) {
  // Accettiamo solo richieste POST (quelle che arrivano dal form)
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Metodo non permesso" }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { nome, email, telefono, archetipo, consensoEmail, consensoWhatsapp } = data;

    // Controlli minimi: email è l'unico campo che Brevo richiede sempre
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email mancante" }) };
    }

    // La chiave segreta NON è scritta qui nel codice: arriva dalla
    // variabile d'ambiente configurata su Netlify (Site settings →
    // Environment variables → BREVO_API_KEY). Così non è mai visibile
    // a chi guarda il codice sorgente della pagina o il repository.
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = 5; // la lista "Break the Rules" creata su Brevo

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
          FIRSTNAME: nome || "",
          SMS: telefono || "",
          // Nota: se vuoi salvare anche l'archetipo e il consenso WhatsApp
          // come colonne visibili in Brevo, vanno prima create come
          // "attributi contatto" personalizzati nelle impostazioni di
          // Brevo (Contatti → Impostazioni → Attributi contatto), con
          // questi stessi nomi: ARCHETIPO (testo), CONSENSO_WHATSAPP (booleano).
          ARCHETIPO: archetipo || "",
          CONSENSO_WHATSAPP: !!consensoWhatsapp
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true // se il contatto esiste già, lo aggiorna invece di dare errore
      })
    });

    // Brevo risponde 201 (creato) o 204 (aggiornato) quando va bene
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
