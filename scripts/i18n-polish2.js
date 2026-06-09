#!/usr/bin/env node
/**
 * B8h5 — second polish pass.
 *
 * Targets Alert.alert("Title") titles + remaining placeholder="..." attrs
 * that the first pass didn't touch. Uses curated EN→FR maps.
 */
const fs = require("fs");
const path = require("path");

const SCREENS_DIR = path.join(__dirname, "..", "screens");
const EN_PATH = path.join(__dirname, "..", "i18n", "locales", "en.json");
const FR_PATH = path.join(__dirname, "..", "i18n", "locales", "fr.json");

const ALERT_TITLES = {
  "Error": "Erreur",
  "Couldn't submit": "Échec de la soumission",
  "Couldn't save": "Échec de l'enregistrement",
  "Couldn't load": "Échec du chargement",
  "Couldn't send": "Échec de l'envoi",
  "Couldn't load rooms": "Échec du chargement des salons",
  "Test charge crashed": "Échec du test de débit",
  "Sign in required": "Connexion requise",
  "Setup Failed": "Échec de la configuration",
  "Pick a name": "Choisir un nom",
  "Pick a dispute type": "Choisir un type de litige",
  "Payment Cancelled": "Paiement annulé",
  "Not signed in": "Non connecté",
  "Missing circle": "Cercle manquant",
  "Invalid Amount": "Montant invalide",
  "Required": "Requis",
  "Success": "Succès",
  "Warning": "Avertissement",
  "Confirm": "Confirmer",
  "Saved": "Enregistré",
  "Sent": "Envoyé",
  "Done": "Terminé",
  "Sign up failed": "Échec de l'inscription",
  "Sign in failed": "Échec de la connexion",
};

const PLACEHOLDERS = {
  "Why are you withdrawing?": "Pourquoi retirez-vous ?",
  "White sand, turquoise water, and the sun painting everything gold...": "Sable blanc, eau turquoise, et le soleil qui peint tout en or...",
  "The contribution due on May 15 was never received…": "La contribution due le 15 mai n'a jamais été reçue…",
  "Tell customers what you offer…": "Dites aux clients ce que vous offrez…",
  "State": "État",
  "Search by name, phone, circle...": "Rechercher par nom, téléphone, cercle...",
  "Search by name or country...": "Rechercher par nom ou pays...",
  "Search FAQ...": "Rechercher dans la FAQ...",
  "Paste your CSV data here...": "Collez vos données CSV ici...",
  "Password": "Mot de passe",
  "My Quick Circle": "Mon cercle rapide",
  "Exclusive offer or message (optional)": "Offre exclusive ou message (facultatif)",
  "Describe your business (optional)": "Décrivez votre entreprise (facultatif)",
  "A short note about what you're looking for…": "Une courte note sur ce que vous recherchez…",
  "Email": "E-mail",
  "Name": "Nom",
  "Phone": "Téléphone",
  "Address": "Adresse",
  "City": "Ville",
  "Country": "Pays",
  "Search...": "Rechercher...",
  "Add a note": "Ajouter une note",
  "Optional": "Facultatif",
};

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

function processFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  if (!src.includes("useTranslation")) return { keys: {}, changed: 0 };

  let changed = 0;
  const keys = {};
  const fs2 = fileSlug(filePath);

  // Alert.alert("Title", ...) — first arg only
  src = src.replace(/Alert\.alert\(\s*"([^"]+)"/g, (match, text) => {
    if (!ALERT_TITLES[text]) return match;
    const ts = slug(text);
    const key = `${fs2}_alert_${ts}`;
    keys[key] = { en: text, fr: ALERT_TITLES[text] };
    changed++;
    return `Alert.alert(t("final_polish.${key}")`;
  });

  // placeholder="..."
  src = src.replace(/placeholder="([^"]+)"/g, (match, text) => {
    if (!PLACEHOLDERS[text]) return match;
    const ts = slug(text);
    const key = `${fs2}_ph_${ts}`;
    keys[key] = { en: text, fr: PLACEHOLDERS[text] };
    changed++;
    return `placeholder={t("final_polish.${key}")}`;
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
