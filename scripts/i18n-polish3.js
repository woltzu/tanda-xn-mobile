#!/usr/bin/env node
/**
 * B8h6 — exhaustive Text-content sweep.
 *
 * Comprehensive EN→FR map for the ~293 remaining JSX text literals
 * found by `grep -E '<Text[^>]*>[A-Z][a-zA-Z]...</Text>'`. Replaces
 * each `<Text ...>EN</Text>` with `<Text ...>{t("final_polish.<key>")}</Text>`
 * and adds the bilingual pair to locale files.
 */
const fs = require("fs");
const path = require("path");

const SCREENS_DIR = path.join(__dirname, "..", "screens");
const EN_PATH = path.join(__dirname, "..", "i18n", "locales", "en.json");
const FR_PATH = path.join(__dirname, "..", "i18n", "locales", "fr.json");

const MAP = {
  "ADVANCE PAYOUT AGREEMENT": "ACCORD D'AVANCE SUR PAIEMENT",
  "AMOUNT": "MONTANT",
  "APY": "TAUX ANNUEL",
  "Achieved a Goal?": "Objectif atteint ?",
  "Active Advance": "Avance active",
  "Active Sessions": "Sessions actives",
  "Active Transfers": "Transferts actifs",
  "Active loans": "Prêts actifs",
  "Add Money": "Ajouter de l'argent",
  "Add Service": "Ajouter un service",
  "Add Your First Recipient": "Ajouter votre premier destinataire",
  "Add to Community Memory": "Ajouter à la mémoire communautaire",
  "Advance Approved!": "Avance approuvée !",
  "Advance": "Avance",
  "All Recipients": "Tous les destinataires",
  "All contributions are up to date": "Toutes les contributions sont à jour",
  "Almost there": "Presque là",
  "Application Rejected": "Demande rejetée",
  "Archive this event after it happens": "Archiver cet événement après qu'il se produise",
  "Authenticator app enabled": "Application d'authentification activée",
  "Auto-Approved": "Auto-approuvé",
  "Auto-Deposit": "Dépôt automatique",
  "Auto-Post Settings": "Paramètres de publication auto",
  "Auto-Repayment": "Remboursement automatique",
  "Auto-Save Settings": "Paramètres d'épargne auto",
  "Auto-Save from Payouts": "Épargne auto sur paiements",
  "Auto-Withheld": "Retenu automatiquement",
  "Auto-Withhold": "Retenue automatique",
  "Auto-recorded": "Auto-enregistré",
  "Auto-transfer ON": "Transfert auto ACTIVÉ",
  "Auto-withheld on": "Retenu automatiquement le",
  "Auto-withhold on": "Retenue automatique le",
  "Back to Wallet": "Retour au portefeuille",
  "Backup Codes": "Codes de secours",
  "Bank-Level Security": "Sécurité bancaire",
  "Biometrics": "Biométrie",
  "Breakdown by goal": "Répartition par objectif",
  "Browse Loan Marketplace": "Parcourir le marché des prêts",
  "Build Itinerary Now": "Créer l'itinéraire maintenant",
  "Business type": "Type d'entreprise",
  "CSV Format": "Format CSV",
  "Camera Access Required": "Accès à la caméra requis",
  "Cancel participant": "Annuler le participant",
  "Cascade active": "Cascade active",
  "Change Password": "Changer le mot de passe",
  "Chat with us": "Discuter avec nous",
  "Circle name": "Nom du cercle",
  "Circle payouts received": "Paiements de cercle reçus",
  "Circle": "Cercle",
  "Circles": "Cercles",
  "Claim Goal Now": "Récupérer l'objectif maintenant",
  "Cleared": "Effacé",
  "Click the link in your email to verify": "Cliquez sur le lien dans votre e-mail pour vérifier",
  "Coming Up": "À venir",
  "Confirm Withdrawal": "Confirmer le retrait",
  "Confirmed by host": "Confirmé par l'hôte",
  "Connect Your Account": "Connecter votre compte",
  "Connected": "Connecté",
  "Contribution": "Contribution",
  "Contributions": "Contributions",
  "Copy Link": "Copier le lien",
  "Create Sub-community": "Créer une sous-communauté",
  "Create as sub-community": "Créer comme sous-communauté",
  "Current Loans": "Prêts actuels",
  "Current": "Actuel",
  "Currently Lent": "Actuellement prêté",
  "Customize a Note": "Personnaliser une note",
  "Daily": "Quotidien",
  "Default Cleared": "Défaut effacé",
  "Defaulted": "En défaut",
  "Disbursed": "Versé",
  "Documents Submitted": "Documents soumis",
  "Documents": "Documents",
  "Done!": "Terminé !",
  "Download PDF": "Télécharger le PDF",
  "Earned Interest": "Intérêts gagnés",
  "Earnings": "Revenus",
  "Eligible": "Éligible",
  "Email Verified!": "E-mail vérifié !",
  "Empty seat": "Siège vide",
  "Enable": "Activer",
  "Endorsements": "Recommandations",
  "Estimated payout": "Paiement estimé",
  "Event Photo": "Photo de l'événement",
  "Families welcome": "Familles bienvenues",
  "Fee Tier": "Niveau de frais",
  "Filters": "Filtres",
  "Free withdrawal available": "Retrait gratuit disponible",
  "Frequency": "Fréquence",
  "From Yourself": "De vous-même",
  "From a friend": "D'un ami",
  "Get the App": "Obtenir l'application",
  "Get Now!": "Obtenir maintenant !",
  "Go Back": "Retour",
  "Goal Achieved!": "Objectif atteint !",
  "Goal Reached!": "Objectif atteint !",
  "Goal funded": "Objectif financé",
  "Group Power": "Puissance du groupe",
  "Have Two Goals Linked": "Avoir deux objectifs liés",
  "Health Score": "Score de santé",
  "Help & Support": "Aide et support",
  "Help center": "Centre d'aide",
  "Hide": "Masquer",
  "How does it work?": "Comment ça marche ?",
  "How much do you need?": "De combien avez-vous besoin ?",
  "I'll do it later": "Je le ferai plus tard",
  "I'll prefer cash": "Je préfère du liquide",
  "Important": "Important",
  "Inactive": "Inactif",
  "Include in Highlights": "Inclure dans les moments forts",
  "Income Stability Score": "Score de stabilité des revenus",
  "Installments Plan": "Plan de versements",
  "Interest Earned": "Intérêts gagnés",
  "Interest accumulated": "Intérêts accumulés",
  "Interested?": "Intéressé ?",
  "Invite Friends": "Inviter des amis",
  "Invite Others": "Inviter d'autres personnes",
  "Joined": "Rejoint",
  "Lend Out": "Prêter",
  "Let members know they can bring family": "Faire savoir aux membres qu'ils peuvent amener leur famille",
  "Liquidity": "Liquidité",
  "Loading circle...": "Chargement du cercle...",
  "Loading liquidity data...": "Chargement des données de liquidité...",
  "Loading recipients...": "Chargement des destinataires...",
  "Loading...": "Chargement...",
  "Loan Application": "Demande de prêt",
  "Loan Details": "Détails du prêt",
  "Loan Marketplace": "Marché des prêts",
  "Loan Summary": "Résumé du prêt",
  "Loan paid": "Prêt remboursé",
  "Loans": "Prêts",
  "Locked": "Verrouillé",
  "Manage Auto-Save": "Gérer l'épargne auto",
  "Manage Notifications": "Gérer les notifications",
  "Member joined": "Membre rejoint",
  "Membership Tier": "Niveau d'adhésion",
  "Milestone": "Étape clé",
  "Milestones": "Étapes clés",
  "Missed Payment Fee": "Frais de paiement manqué",
  "Missing Document Type": "Type de document manquant",
  "Monthly": "Mensuel",
  "Monthly Withdrawals": "Retraits mensuels",
  "Multiple Loans": "Plusieurs prêts",
  "My Bookings": "Mes réservations",
  "My Goals": "Mes objectifs",
  "My Loans": "Mes prêts",
  "My Picks": "Mes choix",
  "My Position": "Ma position",
  "My Trip": "Mon voyage",
  "My Wallet": "Mon portefeuille",
  "Need Help": "Besoin d'aide",
  "New Recipient": "Nouveau destinataire",
  "New": "Nouveau",
  "Next Payment": "Prochain paiement",
  "Next Step": "Étape suivante",
  "No History": "Aucun historique",
  "No Late Payments": "Aucun paiement en retard",
  "No Recipients Yet": "Aucun destinataire pour le moment",
  "No active loans": "Aucun prêt actif",
  "No active transfers": "Aucun transfert actif",
  "No activity yet": "Aucune activité pour le moment",
  "No advances yet": "Aucune avance pour le moment",
  "No documents submitted yet": "Aucun document soumis pour le moment",
  "No opportunities available right now": "Aucune opportunité disponible pour le moment",
  "No payments yet": "Aucun paiement pour le moment",
  "No recipients found": "Aucun destinataire trouvé",
  "No results": "Aucun résultat",
  "No services listed yet": "Aucun service répertorié pour le moment",
  "No services yet": "Aucun service pour le moment",
  "No sub-communities yet": "Aucune sous-communauté pour le moment",
  "No trips yet": "Aucun voyage pour le moment",
  "Not Included": "Non inclus",
  "Now claimable": "Récupérable maintenant",
  "Offer something special to members": "Offrir quelque chose de spécial aux membres",
  "On-Time Rate": "Taux de ponctualité",
  "On-time payment bonus": "Bonus de paiement à temps",
  "One simple step": "Une étape simple",
  "One-tap setup": "Configuration en un appui",
  "Open": "Ouvrir",
  "Options": "Options",
  "Order not yet determined": "Ordre pas encore déterminé",
  "Other store details": "Autres détails de la boutique",
  "Outstanding balance": "Solde impayé",
  "PAY FROM": "PAYER DEPUIS",
  "PDF": "PDF",
  "Participant not found": "Participant introuvable",
  "Pay now": "Payer maintenant",
  "Payment History": "Historique des paiements",
  "Payment Method": "Mode de paiement",
  "Payment Progress": "Progression du paiement",
  "Payment Schedule": "Calendrier de paiement",
  "Payout day": "Jour de paiement",
  "Payout recipient": "Destinataire du paiement",
  "Payout": "Paiement",
  "Pending Start": "Démarrage en attente",
  "People Who Need Vouching": "Personnes ayant besoin d'un voucher",
  "Per Person": "Par personne",
  "Personal Checklist": "Liste personnelle",
  "Pick the type that best describes it.": "Choisissez le type qui le décrit le mieux.",
  "Pool Available": "Réserve disponible",
  "Popular": "Populaire",
  "Position QR code within the frame": "Positionner le code QR dans le cadre",
  "Preview Trip Page": "Aperçu de la page du voyage",
  "Processing Fee": "Frais de traitement",
  "Progress": "Progression",
  "Quick Actions": "Actions rapides",
  "Quick Tips": "Conseils rapides",
  "RECOMMENDED": "RECOMMANDÉ",
  "Recovery Codes": "Codes de récupération",
  "Redirecting to login...": "Redirection vers la connexion...",
  "Redirecting to the app...": "Redirection vers l'application...",
  "Regenerate": "Régénérer",
  "Related": "Lié",
  "Remaining Balance": "Solde restant",
  "Remaining": "Restant",
  "Repaid": "Remboursé",
  "Repeat default": "Défaut récurrent",
  "Request Elder Endorsement": "Demander une recommandation d'Aîné",
  "Required Courses": "Cours obligatoires",
  "Return home": "Retour à l'accueil",
  "SELECT GOAL": "SÉLECTIONNER L'OBJECTIF",
  "SMS Preview": "Aperçu SMS",
  "Save Together. Grow Together.": "Épargner ensemble. Grandir ensemble.",
  "Save changes": "Enregistrer les modifications",
  "Scan Again": "Scanner à nouveau",
  "Security Alerts": "Alertes de sécurité",
  "Send Request": "Envoyer la demande",
  "Sessions": "Sessions",
  "Set per-reaction giving": "Définir le don par réaction",
  "Share My Story": "Partager mon histoire",
  "Share Receipt": "Partager le reçu",
  "Share Trip Link": "Partager le lien du voyage",
  "Sign out and use different account": "Se déconnecter et utiliser un autre compte",
  "Skip for now": "Passer pour le moment",
  "Stability": "Stabilité",
  "Start date": "Date de début",
  "Still stuck?": "Toujours bloqué ?",
  "Store name": "Nom de la boutique",
  "Store not found": "Boutique introuvable",
  "Submit dispute": "Soumettre le litige",
  "Submit for Review": "Soumettre pour examen",
  "Summary": "Résumé",
  "TANDA DISCOUNT": "REMISE TANDA",
  "TANDA SAVINGS": "ÉPARGNE TANDA",
  "TARGET AMOUNT": "MONTANT CIBLE",
  "THIS DEVICE": "CET APPAREIL",
  "TIMELINE": "CHRONOLOGIE",
  "TYPICAL COST": "COÛT TYPIQUE",
  "TandaXn Wallet": "Portefeuille TandaXn",
  "TandaXn": "TandaXn",
  "To Advance": "Vers l'avance",
  "To Go": "Restant",
  "To Goal": "Vers l'objectif",
  "Total outstanding": "Total impayé",
  "Total paid": "Total payé",
  "Transaction Alerts": "Alertes de transaction",
  "Transaction Details": "Détails de la transaction",
  "Transaction ID": "ID de transaction",
  "Transfer to my bank": "Transférer vers ma banque",
  "Travelers": "Voyageurs",
  "Trip is Live!": "Voyage en ligne !",
  "Two-Factor Authentication": "Authentification à deux facteurs",
  "USD": "USD",
  "Unlock": "Déverrouiller",
  "Upload a CSV or add members manually": "Téléverser un CSV ou ajouter des membres manuellement",
  "VERIFIED": "VÉRIFIÉ",
  "Verification Method": "Méthode de vérification",
  "Verifying your email...": "Vérification de votre e-mail...",
  "View Codes": "Voir les codes",
  "View Details": "Voir les détails",
  "View Public Page": "Voir la page publique",
  "View details": "Voir les détails",
  "View": "Voir",
  "WITHDRAW TO": "RETIRER VERS",
  "WITHDRAWAL AMOUNT": "MONTANT DU RETRAIT",
  "Want even more?": "Vous en voulez encore plus ?",
  "We welcome everyone.": "Nous accueillons tout le monde.",
  "Welcome Back": "Bon retour",
  "What Are You Achieving?": "Que réalisez-vous ?",
  "What happens next": "Ce qui se passe ensuite",
  "What if I default?": "Et si je fais défaut ?",
  "What you'll unlock": "Ce que vous déverrouillerez",
  "What's Included": "Ce qui est inclus",
  "What's changed": "Ce qui a changé",
  "What's the issue?": "Quel est le problème ?",
  "When": "Quand",
  "Why Partner Discounts?": "Pourquoi des remises partenaires ?",
  "Why are you leaving?": "Pourquoi partez-vous ?",
  "Why do you need it?": "Pourquoi en avez-vous besoin ?",
  "Withdraw Funds": "Retirer des fonds",
  "Withdrawal Amount": "Montant du retrait",
  "Withdrawal Summary": "Résumé du retrait",
  "XN Score": "Score Xn",
  "YOU DID IT!": "VOUS L'AVEZ FAIT !",
  "YOUR TRIP LINK": "VOTRE LIEN DE VOYAGE",
  "You'll Receive": "Vous recevrez",
  "You'll Send": "Vous enverrez",
  "You'll receive": "Vous recevrez",
  "You've earned": "Vous avez gagné",
  "You": "Vous",
  "Your Advances": "Vos avances",
  "Your Journey": "Votre parcours",
  "Your Position": "Votre position",
  "Your account is in good standing": "Votre compte est en règle",
  "Your funds are on the way": "Vos fonds sont en route",
};

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 55);
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

  // <Text ...>SomeText</Text>  → replace inner text only
  src = src.replace(/(<Text[^>]*>)([A-Z][a-zA-Z][a-zA-Z ,.'!?\-]+)(<\/Text>)/g, (match, open, text, close) => {
    const trimmed = text.trim();
    if (!MAP[trimmed]) return match;
    const ts = slug(trimmed);
    const key = `${fs2}_${ts}`;
    keys[key] = { en: trimmed, fr: MAP[trimmed] };
    changed++;
    return `${open}{t("final_polish.${key}")}${close}`;
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

  // Also add tier text from DashboardScreen edits
  en.dashboard_v3 = en.dashboard_v3 || {};
  fr.dashboard_v3 = fr.dashboard_v3 || {};
  en.dashboard_v3.tier_cannot_join = "Cannot join circles yet";
  fr.dashboard_v3.tier_cannot_join = "Vous ne pouvez pas encore rejoindre de cercles";
  en.dashboard_v3.tier_unlimited = "Unlimited access";
  fr.dashboard_v3.tier_unlimited = "Accès illimité";
  en.dashboard_v3.tier_capped = "Up to {{size}}-member circles · ${{cap}}/mo cap";
  fr.dashboard_v3.tier_capped = "Jusqu'à des cercles de {{size}} membres · plafond {{cap}} $/mois";

  for (const [key, val] of Object.entries(allKeys)) {
    en.final_polish[key] = val.en;
    fr.final_polish[key] = val.fr;
  }

  fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + "\n", "utf8");
  fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 2) + "\n", "utf8");

  console.log(`\nFiles: ${filesChanged}  Replacements: ${totalChanged}  New keys: ${Object.keys(allKeys).length}`);
}

main();
