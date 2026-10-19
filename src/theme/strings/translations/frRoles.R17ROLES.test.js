/* eslint-disable max-len -- la table des libellés est citée en entier */
import fs from 'fs';
import path from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// R17-ROLES (REC17-006, 19/10) — « Pour les rôles joueur il faut le renommer pratiquant/joueur pour
// parler à tout le monde, pareil pour coach il faut coach/prof. » (Adel, recette du 17/10).
//
// Réglage du chef : forme longue partout où le rôle est NOMMÉ comme une identité (inscription,
// profil, badges, rôles du club, rôle dans une conversation, audiences et filtres d'annonce,
// licences, console, sections) ; les phrases courtes gardent leur mot (« Mode joueur », « joueurs
// convoqués », compo, stats, postes d'annonce). Valeurs seulement : aucune clef renommée, aucun nom
// technique (`USER_ROLES`) touché. La comparaison des AUTRES clefs (valeurs identiques avant /
// après) est faite par le lot sur l'ensemble du dictionnaire, et collée dans son compte rendu.

/** La table du lot : clef → [français, anglais]. */
const TABLE = /** @type {Record<string, [string, string]>} */ ({
  'addCoach.fallbacks.inviteFirstname': ['Coach / Prof', 'Coach / Instructor'],
  'addCoach.roles.trainer': ['Coach / Prof', 'Coach / Instructor'],
  'adminUserList.roles.coach': ['Coach / Prof', 'Coach / Instructor'],
  'adminUserList.roles.player': ['Pratiquant / Joueur', 'Player / Participant'],
  'adWizardAudienceType.coach.title': ['Je recrute un coach / prof', "I'm recruiting a coach / instructor"],
  'adWizardAudienceType.players.title': ['Je recrute des pratiquants / joueurs', "I'm recruiting players / participants"],
  'adWizardAudienceType.subtitle': ['Choisis si tu publies une annonce pour recruter des pratiquants / joueurs ou un coach / prof.', 'Choose whether you are posting an ad to recruit players / participants or a coach / instructor.'],
  'adWizardRecap.adType.coach': ['Annonce coach / prof', 'Coach / instructor ad'],
  'clubDetails.alerts.inviteTrainer.message': ["Bonjour {{coachName}} !\nTu as été désigné·e comme coach / prof dans le club {{clubName}}.\nTélécharge l'application Found Club pour finaliser la création de ton compte et commencer à gérer tes équipes et tes événements.", "Hi {{coachName}}!\nYou've been designated as coach / instructor at {{clubName}}.\nDownload the FoundClub app to finish creating your account and start managing your teams and events."],
  'clubDetails.titles.coachs': ['Nos coachs / profs', 'Our coaches / instructors'],
  'clubLicenseCampaignSettings.review.audience.players': ['Pratiquants / Joueurs · {{teamCount}} équipe(s)', 'Players / Participants · {{teamCount}} team(s)'],
  'clubLicenseCampaignSettings.targetRoles.coaches': ['Coachs / Profs', 'Coaches / Instructors'],
  'clubLicenseCampaignSettings.targetRoles.players': ['Pratiquants / Joueurs', 'Players / Participants'],
  'clubLicenses.roles.coach': ['Coach / Prof', 'Coach / Instructor'],
  'clubLicenses.roles.player': ['Pratiquant / Joueur', 'Player / Participant'],
  'clubMemberRoles.chips.coachOf': ['Coach / Prof de {{team}}', 'Coach / Instructor of {{team}}'],
  'clubMemberRoles.chips.playerOf': ['Pratiquant / Joueur de {{team}}', 'Player / Participant of {{team}}'],
  'clubMemberRoles.confirm.coachAdd.message': ['{{name}} deviendra entraîneur de {{team}}. Son compte prendra le rôle Coach / Prof.', '{{name}} will become coach of {{team}}. Their account will take the Coach / Instructor role.'],
  'clubMemberRoles.intro': ["Touche un membre pour lui donner un rôle : pratiquant / joueur ou coach / prof d'une équipe, ou co-dirigeant. Un membre peut en cumuler plusieurs.", 'Tap a member to give them a role: player / participant or coach / instructor of a team, or co-manager. A member can hold several.'],
  'clubMemberRoles.roles.coachOf': ['Coach / Prof · {{teams}}', 'Coach / Instructor · {{teams}}'],
  'clubMemberRoles.roles.playerOf': ['Pratiquant / Joueur · {{teams}}', 'Player / Participant · {{teams}}'],
  'clubMemberRoles.sections.coach': ['Coach / Prof de', 'Coach / Instructor of'],
  'clubMemberRoles.sections.player': ['Pratiquant / Joueur de', 'Player / Participant of'],
  'cmMembersScreen.tabs.coaches': ['Coachs / Profs', 'Coaches / Instructors'],
  'cmMembersScreen.tabs.players': ['Pratiquants / Joueurs', 'Players / Participants'],
  'collectiviteDemandes.fonction.trainer': ['coach / prof', 'coach / instructor'],
  'conversation.staffRole.entraineur': ['Coach / Prof', 'Coach / Instructor'],
  'conversation.staffRole.joueur': ['Pratiquant / Joueur', 'Player / Participant'],
  'homeHub.roles.coach': ['Coach / Prof', 'Coach / Instructor'],
  'homeHub.roles.player': ['Pratiquant / Joueur', 'Player / Participant'],
  'newConversation.sections.coaches': ['Coachs / Profs', 'Coaches / Instructors'],
  'newConversation.sections.players': ['Pratiquants / Joueurs', 'Players / Participants'],
  'profile.fields.types.coach': ['Coach / Prof', 'Coach / Instructor'],
  'profile.fields.types.player': ['Pratiquant·e / Joueur·se', 'Player / Participant'],
  'profile.identity.roles.coach': ['Coach / Prof', 'Coach / Instructor'],
  'profile.identity.roles.player': ['Pratiquant / Joueur', 'Player / Participant'],
  'profileStats.coachBadge': ['Coach / Prof', 'Coach / Instructor'],
  'recruitmentAdCard.coachAudience': ['COACH / PROF', 'COACH / INSTRUCTOR'],
  'recruitmentFiltersSheet.audience.all': ['Pratiquant·e·s / Joueur·se·s et coachs / profs', 'Players / participants and coaches / instructors'],
  'recruitmentFiltersSheet.audience.coach': ['Coachs / Profs', 'Coaches / Instructors'],
  'recruitmentFiltersSheet.audience.player': ['Pratiquant·e·s / Joueur·se·s', 'Players / Participants'],
  'recrutementListContent.audience.coach': ['Coachs / Profs', 'Coaches / Instructors'],
  'recrutementListContent.audience.player': ['Pratiquants / Joueurs', 'Players / Participants'],
  'requestsHub.conversation.coachRow': ['{{name}} · coach / prof {{team}}', '{{name}} · coach / instructor {{team}}'],
  'teamDetails.sections.players_one': ['Pratiquant·e / Joueur·se', 'Player / Participant'],
  'teamDetails.sections.players_other': ['Pratiquant·e·s / Joueur·se·s', 'Players / Participants'],
  'teamDetails.sections.trainers_one': ['Coach / Prof', 'Coach / Instructor'],
  'teamDetails.sections.trainers_other': ['Coachs / Profs', 'Coaches / Instructors'],
  'teamEdit.fields.trainers.label': ['Coachs / Profs', 'Coaches / Instructors'],
  'teamList.badges.coach': ['COACH / PROF', 'COACH / INSTRUCTOR'],
  'teamList.badges.player': ['PRATIQUANT·E / JOUEUR·SE', 'PLAYER / PARTICIPANT'],
  'teamList.stats.trainers': ['Coachs / Profs', 'Coaches / Instructors'],
  'teamList.trainerGuide.body': ['{{name}} est maintenant dans ton club.\n\n1. Ouvre une équipe.\n2. Appuie sur "Modifier".\n3. Dans la section "Coachs / Profs", ajoute-le puis valide.', '{{name}} is now in your club.\n\n1. Open a team.\n2. Tap "Edit".\n3. In the "Coaches / Instructors" section, add them and confirm.'],
  'teamWizard.steps.trainers.title': ['Coachs / Profs', 'Coaches / Instructors'],
  'teamWizardRecap.trainers.fallback': ['Coach / Prof', 'Coach / Instructor'],
  'teamWizardRecap.trainers.roleCoach': ['coach / prof', 'coach / instructor'],
  'teamWizardTrainers.roles.coach': ['Coach / Prof', 'Coach / Instructor'],
  'userDetails.roleLabels.coach': ['Coach / Prof', 'Coach / Instructor'],
  'userDetails.roleLabels.player': ['PRATIQUANT / JOUEUR', 'PLAYER / PARTICIPANT'],
});

// La seule phrase de la table qui garde un « entraîneur » : le verbe (« deviendra entraîneur de
// {{team}} »), pas le nom du rôle, qui suit (« prendra le rôle Coach / Prof »).
const PHRASES_GARDEES = ['clubMemberRoles.confirm.coachAdd.message'];

const SRC = path.resolve(__dirname, '..', '..', '..');
const DOSSIERS_EXCLUS = ['__mocks__', '__tests__', 'testSupport', 'translations'];

/**
 * La valeur d'une clef.
 * @param {any} dictionnaire
 * @param {string} chemin
 * @returns {any}
 */
const lire = (dictionnaire, chemin) => chemin.split('.').reduce(
  (/** @type {any} */ noeud, part) => (noeud == null ? undefined : noeud[part]),
  dictionnaire,
);

/**
 * Les feuilles du dictionnaire.
 * @param {any} noeud
 * @param {string[]} [prefixe]
 * @returns {Array<[string, any]>}
 */
const feuilles = (noeud, prefixe = []) => Object.entries(noeud).flatMap(([clef, valeur]) => {
  const chemin = prefixe.concat(clef);
  if (valeur !== null && typeof valeur === 'object') return feuilles(valeur, chemin);
  return [[chemin.join('.'), valeur]];
});

/**
 * Les fichiers de production sous src/ (témoins, doublures et dictionnaires exclus).
 * @param {string} dossier
 * @returns {string[]}
 */
const fichiersDeProduction = (dossier) => fs.readdirSync(dossier, { withFileTypes: true })
  .flatMap((entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) return DOSSIERS_EXCLUS.includes(entree.name) ? [] : fichiersDeProduction(chemin);
    return /\.(js|ts|tsx)$/.test(entree.name) && !/\.test\./.test(entree.name) ? [chemin] : [];
  });

/**
 * Les replis du code : chaque `t('<clef>', '<repli>')` d'une clef de la table.
 * @returns {Array<[string, string, string]>} [fichier:ligne, clef, repli]
 */
const replisDuCode = () => {
  const echapper = (/** @type {string} */ texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Un commentaire peut séparer la clef de son repli (« // eslint-disable-next-line max-len »).
  const motif = new RegExp(`(['"\`])(${Object.keys(TABLE).map(echapper).join('|')})\\1\\s*,(?:\\s|//[^\\n]*\\n)*(['"\`])((?:\\\\.|(?!\\3).)*)\\3`, 'g');
  return fichiersDeProduction(SRC).flatMap((fichier) => {
    const texte = fs.readFileSync(fichier, 'utf8');
    return [...texte.matchAll(motif)].map((trouve) => /** @type {[string, string, string]} */ ([
      `${path.relative(SRC, fichier).replace(/\\/g, '/')}:${texte.slice(0, trouve.index).split('\n').length}`,
      trouve[2],
      trouve[4].replace(/\\n/g, '\n').replace(/\\(['"\\])/g, '$1'),
    ]));
  });
};

/**
 * Le nombre de fois qu'un motif apparaît.
 * @param {string} texte
 * @param {RegExp} motif
 * @returns {number}
 */
const compter = (texte, motif) => (texte.match(new RegExp(motif.source, 'giu')) || []).length;

describe('R17-ROLES · les rôles NOMMÉS disent « Pratiquant / Joueur » et « Coach / Prof »', () => {
  it.each(Object.entries(TABLE))('%s', (clef, [francais, anglais]) => {
    expect(lire(fr, clef)).toBe(francais);
    expect(lire(en, clef)).toBe(anglais);
  });

  it('aucune clef de la table ne nomme plus « Joueur » seul, « Coach » seul ni « Entraîneur »', () => {
    const fautives = Object.keys(TABLE).filter((clef) => {
      const valeur = String(lire(fr, clef));
      const joueurSeul = compter(valeur, /joueu/) !== compter(valeur, /pratiquant/);
      const coachSeul = compter(valeur, /(?<!\p{L})coachs?(?!\p{L})/) !== compter(valeur, /(?<!\p{L})profs?(?!\p{L})/);
      const entraineur = !PHRASES_GARDEES.includes(clef) && /entra[iî]neu/i.test(valeur);
      return joueurSeul || coachSeul || entraineur;
    });
    expect(fautives).toEqual([]);
  });

  it('les replis du code (t(clef, repli)) disent la même chose que fr.js', () => {
    const differents = replisDuCode()
      .filter(([, clef, repli]) => repli !== TABLE[clef][0])
      .map(([ou, clef, repli]) => `${ou} ${clef} « ${repli} »`);
    expect(differents).toEqual([]);
  });

  it('les mots neufs ne sortent pas de la table (aucune autre clef ne les a pris)', () => {
    const horsTable = (/** @type {any} */ dictionnaire, /** @type {RegExp} */ motif) => feuilles(dictionnaire)
      .filter(([clef, valeur]) => !(clef in TABLE) && typeof valeur === 'string' && motif.test(valeur))
      .map(([clef]) => clef);
    expect(horsTable(fr, /pratiquant|(?<!\p{L})profs?(?!\p{L})/iu)).toEqual([]);
    expect(horsTable(en, /instructor/i)).toEqual([]);
  });
});
