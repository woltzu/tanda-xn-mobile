#!/usr/bin/env node
/**
 * B8h5 — final polish sweep.
 *
 * Walks every screens/*.tsx, finds `>SomeEnglish<` JSX text literals, and
 * for each one that matches our curated STRING_MAP, rewrites it to
 * `>{t("final_polish.<slug>")}<`. Adds entries to en.json + fr.json under
 * the `final_polish` namespace using the EN/FR pair from STRING_MAP.
 *
 * Curated — only known-safe translations are applied. Logo text ("Xn"),
 * debug labels, and brand names are excluded.
 */
const fs = require("fs");
const path = require("path");

const SCREENS_DIR = path.join(__dirname, "..", "screens");
const EN_PATH = path.join(__dirname, "..", "i18n", "locales", "en.json");
const FR_PATH = path.join(__dirname, "..", "i18n", "locales", "fr.json");

// Curated EN → FR translation map. Only strings in this map are rewritten.
const STRING_MAP = {
  // Common chrome
  "Done": "Terminé",
  "Cancel": "Annuler",
  "Save": "Enregistrer",
  "Delete": "Supprimer",
  "Close": "Fermer",
  "Back": "Retour",
  "Next": "Suivant",
  "Skip": "Passer",
  "Retry": "Réessayer",
  "Help": "Aide",
  "Send": "Envoyer",
  "Submit": "Soumettre",
  "Continue": "Continuer",
  "Confirm": "Confirmer",
  "Edit": "Modifier",
  "Remove": "Retirer",
  "Add": "Ajouter",
  "Update": "Mettre à jour",
  "Loading": "Chargement",
  "Loading...": "Chargement...",
  // Status / state badges
  "Active": "Actif",
  "Pending": "En attente",
  "Verified": "Vérifié",
  "Paid": "Payé",
  "New": "Nouveau",
  "Joined": "Rejoint",
  "Join": "Rejoindre",
  "Live": "En direct",
  "Preview": "Aperçu",
  "Available": "Disponible",
  "Locked": "Verrouillé",
  "Advanced": "Avancé",
  "Maxed out": "Limite atteinte",
  "Limited": "Limité",
  "Members": "Membres",
  "Total": "Total",
  "Status": "Statut",
  "Amount": "Montant",
  "Description": "Description",
  "Privacy": "Confidentialité",
  "Password": "Mot de passe",
  "Tier": "Palier",
  "Term": "Durée",
  "Recipient": "Destinataire",
  "Frequency": "Fréquence",
  "Instant": "Instantané",
  // Specific button text
  "Create Circle": "Créer un cercle",
  "Find a Circle": "Trouver un cercle",
  "Request Advance": "Demander une avance",
  "Invite": "Inviter",
  "Pay": "Payer",
  "Log Out": "Se déconnecter",
  // Section / card titles
  "Security Tips": "Conseils de sécurité",
  "Active Defaults": "Défauts actifs",
  "Late Payments": "Paiements en retard",
  "Total Owed": "Total dû",
  "Security Score": "Score de sécurité",
  "No Active Circles": "Aucun cercle actif",
  "No Advance History Yet": "Aucun historique d'avance",
  "No Active Advances": "Aucune avance active",
  "Goal not found": "Objectif introuvable",
  "Loan Agreement": "Contrat de prêt",
  "Installments": "Versements",
  "Lump Sum": "Forfait",
  "Fee": "Frais",
  "Max Advance": "Avance maximale",
  "Expected Payout": "Paiement prévu",
  "Payout Date": "Date de paiement",
  "Processing Time": "Délai de traitement",
  "Your Payout": "Votre paiement",
  "Your privacy is protected": "Votre confidentialité est protégée",
  "First contribution confirmed": "Première contribution confirmée",
  "Check your email": "Vérifiez votre e-mail",
  "Open email": "Ouvrir l'e-mail",
  "Use a different email": "Utiliser un autre e-mail",
  "Protect your account": "Protégez votre compte",
  "Verify your business": "Vérifiez votre entreprise",
  "Active now": "Actif maintenant",
  "This Device": "Cet appareil",
  "Other Sessions": "Autres sessions",
  "Log Out All Other Sessions": "Déconnecter toutes les autres sessions",
  "Activity Name": "Nom de l'activité",
  "Start": "Début",
  "End": "Fin",
  "Category": "Catégorie",
  "View on Maps": "Voir sur Maps",
  "Organizer Note": "Note de l'organisateur",
  "Save Activity": "Enregistrer l'activité",
  "No countries found": "Aucun pays trouvé",
  "Key Terms Summary": "Résumé des conditions clés",
  "Agreement Accepted": "Contrat accepté",
  "Amount Disbursed": "Montant versé",
  "View Advance Details": "Voir les détails de l'avance",
  "Advanced": "Avancé",
  "Advanced": "Avancé",
  "Advance Information": "Informations sur l'avance",
  "Timeline": "Chronologie",
  "Actions": "Actions",
  "To Repay": "À rembourser",
  "Advance Amount": "Montant de l'avance",
  "Select Disbursement Method": "Sélectionner le mode de versement",
  "Select Bank Account": "Sélectionner le compte bancaire",
  "Disbursement Summary": "Résumé du versement",
  "Advance amount": "Montant de l'avance",
  "Instant transfer fee": "Frais de transfert instantané",
  "Advance on Future Payout": "Avance sur paiement futur",
  "This is NOT a loan": "Ce n'est PAS un prêt",
  "Step by Step": "Étape par étape",
  "Choose a Future Payout": "Choisir un paiement futur",
  "Request Your Advance": "Demander votre avance",
  "Receive Funds": "Recevoir les fonds",
  "You Receive": "Vous recevez",
  "Today": "Aujourd'hui",
  "Frequently Asked Questions": "Questions fréquemment posées",
  "Important to Know": "Important à savoir",
  "View My Advance Options": "Voir mes options d'avance",
  "Why This Is Different": "Pourquoi c'est différent",
  "Family Circle": "Cercle familial",
  "Payout Arrives": "Paiement reçu",
  "Jobs": "Tâches",
  "Please wait a moment": "Veuillez patienter un instant",
  "Verification Failed": "Échec de la vérification",
  "Your Elder Journey": "Votre parcours d'Aîné",
  "Requirements": "Exigences",
  "Elder Benefits": "Avantages des Aînés",
  "Elder Tiers": "Paliers d'Aîné",
  "Sent": "Envoyé",
  "No members yet": "Aucun membre pour le moment",
  "Send to": "Envoyer à",
  "Language": "Langue",
  "Paste CSV data": "Coller les données CSV",
  "Upload History": "Historique des téléchargements",
};

// Slug helper — produces a snake_case key from arbitrary text.
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function fileSlug(p) {
  return path.basename(p, ".tsx").replace(/Screen$/, "").toLowerCase();
}

// Find candidate `>SomeText<` JSX literals. Must:
// - start with capital letter
// - be at least 2 chars
// - be in our STRING_MAP
function processFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  if (!src.includes("useTranslation")) return { keys: {}, changed: 0 };

  let changed = 0;
  const keys = {};

  // Replace patterns like `>SomeText<` only (JSX text content)
  src = src.replace(/>([A-Z][A-Za-z][A-Za-z\s.,'?!-]*[A-Za-z])</g, (match, text) => {
    const trimmed = text.trim();
    if (!STRING_MAP[trimmed]) return match;
    const fs2 = fileSlug(filePath);
    const ts = slug(trimmed);
    const key = `${fs2}_${ts}`;
    keys[key] = { en: trimmed, fr: STRING_MAP[trimmed] };
    changed++;
    return `>{t("final_polish.${key}")}<`;
  });

  if (changed > 0) {
    fs.writeFileSync(filePath, src, "utf8");
  }
  return { keys, changed };
}

function main() {
  const files = fs.readdirSync(SCREENS_DIR).filter(f => f.endsWith(".tsx"));
  const allKeys = {};
  let totalChanged = 0;
  let filesChanged = 0;

  for (const f of files) {
    const fp = path.join(SCREENS_DIR, f);
    const { keys, changed } = processFile(fp);
    if (changed > 0) {
      filesChanged++;
      totalChanged += changed;
      Object.assign(allKeys, keys);
      console.log(`  ${f}: ${changed} replacements`);
    }
  }

  // Build the final_polish namespace
  const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
  const fr = JSON.parse(fs.readFileSync(FR_PATH, "utf8"));

  en.final_polish = en.final_polish || {};
  fr.final_polish = fr.final_polish || {};

  for (const [key, val] of Object.entries(allKeys)) {
    en.final_polish[key] = val.en;
    fr.final_polish[key] = val.fr;
  }

  fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + "\n", "utf8");
  fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 2) + "\n", "utf8");

  console.log(`\nFiles changed: ${filesChanged}`);
  console.log(`Total replacements: ${totalChanged}`);
  console.log(`Unique keys added: ${Object.keys(allKeys).length}`);
}

main();
