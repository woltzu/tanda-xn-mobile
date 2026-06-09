#!/usr/bin/env node
// B8h6 — final final sweep. Maps remaining 77 Text-content literals.
const fs = require("fs");
const path = require("path");
const SCREENS_DIR = path.join(__dirname, "..", "screens");
const EN_PATH = path.join(__dirname, "..", "i18n", "locales", "en.json");
const FR_PATH = path.join(__dirname, "..", "i18n", "locales", "fr.json");

const MAP = {
  "Lending Opportunities": "Opportunités de prêt",
  "HEALTHY": "SAIN",
  "Deadline": "Date limite",
  "Member Status": "Statut du membre",
  "Full Timeline": "Chronologie complète",
  "Current Cycle": "Cycle actuel",
  "Loading recovery data...": "Chargement des données de récupération...",
  "No Defaults": "Aucun défaut",
  "Default": "Par défaut",
  "Loading payout schedule...": "Chargement du calendrier de paiement...",
  "Collapse Risk": "Risque d'effondrement",
  "Icon": "Icône",
  "Go back": "Retour",
  "Cover photo": "Photo de couverture",
  "Coming soon": "Bientôt disponible",
  "Elective Courses": "Cours optionnels",
  "Export Format": "Format d'exportation",
  "Date Range": "Plage de dates",
  "Include Data": "Inclure les données",
  "Contact support": "Contacter le support",
  "Feed Settings": "Paramètres du fil",
  "FINAL BALANCE": "SOLDE FINAL",
  "EST. ADDITIONAL COSTS": "COÛTS SUPPLÉMENTAIRES EST.",
  "ESTIMATED COST": "COÛT ESTIMÉ",
  "Get This Deal": "Obtenir cette offre",
  "Create a Custom Goal": "Créer un objectif personnalisé",
  "Editing goal details": "Modification des détails de l'objectif",
  "GOAL NAME": "NOM DE L'OBJECTIF",
  "MONTHLY CONTRIBUTION": "CONTRIBUTION MENSUELLE",
  "Milestones Hit": "Étapes franchies",
  "NEXT MILESTONE": "PROCHAINE ÉTAPE",
  "Go to My Goal": "Aller à mon objectif",
  "Interest Unlocked!": "Intérêts débloqués !",
  "Keep it growing": "Continuer à le faire croître",
  "Go to Dashboard": "Aller au tableau de bord",
  "Could not complete join": "Impossible de finaliser l'adhésion",
  "Next payment": "Prochain paiement",
  "Make a Payment": "Effectuer un paiement",
  "Enter your password": "Saisir votre mot de passe",
  "Could not load": "Échec du chargement",
  "Days left": "Jours restants",
  "My paid": "Mon payé",
  "My savings toward this trip": "Mes économies pour ce voyage",
  "Group total": "Total du groupe",
  "My schedule": "Mon calendrier",
  "From": "De",
  "Create your first trip and start organizing": "Créez votre premier voyage et commencez à organiser",
  "Create a Trip": "Créer un voyage",
  "Late": "En retard",
  "Confirm participant": "Confirmer le participant",
  "Loading camera...": "Chargement de la caméra...",
  "Enable Camera": "Activer la caméra",
  "Enter Code Manually Instead": "Saisir le code manuellement à la place",
  "Enter code manually": "Saisir le code manuellement",
  "Contribution per cycle": "Contribution par cycle",
  "Each cycle": "Chaque cycle",
  "Enabled": "Activé",
  "Login Alerts": "Alertes de connexion",
  "Get Started": "Commencer",
  "Member discount": "Remise membre",
  "Give TandaXn circle members a special rate": "Offrir un tarif spécial aux membres des cercles TandaXn",
  "Discount": "Remise",
  "Mark Completed": "Marquer comme terminé",
  "Dream Progress": "Progrès du rêve",
  "How much would you like to send?": "Combien souhaitez-vous envoyer ?",
  "Dream": "Rêve",
  "Itinerary Preview": "Aperçu de l'itinéraire",
  "Destination": "Destination",
  "Interactive map coming soon": "Carte interactive bientôt disponible",
  "Join This Trip": "Rejoindre ce voyage",
  "Go to Trip Dashboard": "Aller au tableau de bord du voyage",
  "Extra security for your account": "Sécurité supplémentaire pour votre compte",
  "Maybe later": "Peut-être plus tard",
  "How Vouching Works": "Comment fonctionne le vouching",
  "Method": "Méthode",
  "Early Withdrawal Penalty": "Pénalité de retrait anticipé",
};

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 55);
}
function fileSlug(p) {
  return path.basename(p, ".tsx").replace(/Screen$/, "").toLowerCase();
}

function processFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  if (!src.includes("useTranslation")) return { keys: {}, changed: 0 };
  let changed = 0;
  const keys = {};
  const fs2 = fileSlug(filePath);
  src = src.replace(/(<Text[^>]*>)([A-Z][a-zA-Z][a-zA-Z ,.'!?\-]+)(<\/Text>)/g, (match, open, text, close) => {
    const trimmed = text.trim();
    if (!MAP[trimmed]) return match;
    const ts = slug(trimmed);
    const key = `${fs2}_${ts}`;
    keys[key] = { en: trimmed, fr: MAP[trimmed] };
    changed++;
    return `${open}{t("final_polish.${key}")}${close}`;
  });
  if (changed > 0) fs.writeFileSync(filePath, src, "utf8");
  return { keys, changed };
}

function main() {
  const files = fs.readdirSync(SCREENS_DIR).filter(f => f.endsWith(".tsx"));
  const allKeys = {};
  let totalChanged = 0, filesChanged = 0;
  for (const f of files) {
    const { keys, changed } = processFile(path.join(SCREENS_DIR, f));
    if (changed > 0) {
      filesChanged++;
      totalChanged += changed;
      Object.assign(allKeys, keys);
      console.log(`  ${f}: ${changed}`);
    }
  }
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
  console.log(`\nFiles: ${filesChanged}  Replacements: ${totalChanged}  New keys: ${Object.keys(allKeys).length}`);
}
main();
