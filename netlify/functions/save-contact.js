
/
Claude ha terminato la risposta
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
    // Brevo richiede il numero in formato internazionale (es. +393331234567).
    // Qui lo sistemiamo automaticamente, assumendo un numero italiano se il
    // candidato non ha già scritto il prefisso internazionale.
    function normalizzaTelefono(tel) {
      if (!tel) return "";
      let pulito = tel.replace(/[^0-9+]/g, ""); // toglie spazi, trattini, parentesi
      if (pulito.startsWith("+")) return pulito;
      if (pulito.startsWith("00")) return "+" + pulito.slice(2);
      if (pulito.startsWith("39")) return "+" + pulito;
      if (pulito.startsWith("0")) pulito = pulito.slice(1); // es. 0333... -> 333...
      return "+39" + pulito;
    }
    const telefonoNormalizzato = normalizzaTelefono(telefono);
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
          SMS: telefonoNormalizzato,
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

Mostra altro
Perfetto, questa volta la funzione normalizzaTelefono c'è — il salvataggio è andato a buon fine! Ottimo lavoro.

Ora rifacciamo il test:

1. Vai sul tuo sito widu-break-the-rules.netlify.app
2. Ricarica la pagina con forza (Cmd+Shift+R, per essere sicuri che non carichi una versione vecchia dalla cache)
3. Fai il quiz fino alla fine
4. Compila il form — questa volta il numero può essere scritto in qualsiasi formato (con o senza +39, con o senza spazi), la funzione lo sistema da sola
5. Invia

Fammi sapere se questa volta va a buon fine, o se serve guardare di nuovo i log della funzione su Netlify.

ANCORA NON VA


Investigated persistente problemi di validazione telefonica
Investigated persistente problemi di validazione telefonica
Ok, andiamo a vedere l'errore preciso di questo nuovo tentativo — potrebbe essere cambiato rispetto a prima. Vai su Netlify → Functions → save-contact e mandami l'ultimo log (quello con l'orario più recente).

Nel frattempo, un sospetto concreto: se nel form hai inserito un numero di prova troppo corto o non realistico (es. "1234567" o simile), Brevo lo rifiuta comunque, perché controlla che sia un numero di telefono plausibile per il paese indicato — non basta il formato con +39 davanti, deve anche avere il numero giusto di cifre (per un cellulare italiano, di solito 9-10 cifre dopo il prefisso).

Che numero hai provato questa volta, giusto per capire se è quello il problema (puoi dirmi solo quante cifre ha, non serve scrivermelo per intero)?

Jul 13, 03:23:15 PM: 2661f738 ERROR  Errore da Brevo: {"code":"invalid_parameter","message":"Invalid phone number"}
Jul 13, 03:23:15 PM: 2661f738 Duration: 390.81 ms    Memory Usage: 128 MB


Diagnosed persistent phone format issue and deployment concerns
Diagnosed persistent phone format issue and deployment concerns
Stesso errore esatto — questo mi fa pensare che il vero numero che hai messo nel form probabilmente non è un numero di telefono realistico (es. troppo corto, o inventato per il test), e nessuna sistemazione di formato può aggiustare quello: Brevo controlla anche che il numero abbia la lunghezza giusta per essere un vero cellulare.

Prova questo test mirato: nel form, scrivi il tuo vero numero di cellulare italiano, scritto semplice, senza prefissi né spazi (es. se il tuo numero fosse 333 123 4567, scrivilo tutto attaccato: 3331234567). Non serve che sia un numero "vero" che userai davvero per Widu — basta che abbia la struttura di un numero di cellulare italiano reale (10 cifre, che inizia con 3).

Se con un numero fatto così ancora dà errore, allora il problema è altrove e guardiamo il codice della funzione di nuovo. Fammi sapere.

ho messo il mio nr


Investigato validazione numero e pianificato debug con logging
Investigato validazione numero e pianificato debug con logging
Buona ipotesi da escludere prima: forse il problema non è il formato ma proprio il numero stesso (magari con una cifra di troppo o di meno per un errore di battitura). Il modo più veloce per scoprirlo è far scrivere alla funzione, nei log, esattamente il numero che sta provando a mandare a Brevo — così vediamo con i nostri occhi cosa viene generato, senza indovinare.

Aggiungo una riga di debug temporanea:


File modificato, eseguito un comando
File modificato, eseguito un comando
Ecco il codice aggiornato con la riga di debug in più — copialo e incollalo su GitHub come sempre (Cmd+A per selezionare tutto, poi Cmd+V):

javascript
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

    // Brevo richiede il numero in formato internazionale (es. +393331234567).
    // Qui lo sistemiamo automaticamente, assumendo un numero italiano se il
    // candidato non ha già scritto il prefisso internazionale.
    function normalizzaTelefono(tel) {
      if (!tel) return "";
      let pulito = tel.replace(/[^0-9+]/g, ""); // toglie spazi, trattini, parentesi
      if (pulito.startsWith("+")) return pulito;
      if (pulito.startsWith("00")) return "+" + pulito.slice(2);
      if (pulito.startsWith("39")) return "+" + pulito;
      if (pulito.startsWith("0")) pulito = pulito.slice(1); // es. 0333... -> 333...
      return "+39" + pulito;
    }
    const telefonoNormalizzato = normalizzaTelefono(telefono);
    console.log("DEBUG numero originale:", telefono, "-> normalizzato:", telefonoNormalizzato, "lunghezza:", telefonoNormalizzato.length);

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
Dopo il commit, rifai il test sul sito, poi vai di nuovo su Netlify → Functions → save-contact e mandami la riga di log che inizia con "DEBUG numero originale:" — quella ci mostrerà esattamente cosa viene generato e mandato a Brevo.








Claude è un'AI e può commettere errori. Verifica le fonti citate.







CopiaCopia
