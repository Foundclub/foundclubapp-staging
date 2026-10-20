import fs from 'fs';
import path from 'path';

// ADRESSE-CARTE (07/10) — QUI propose « Adresse introuvable ? Placez-la sur la carte », et QUI ne
// le propose JAMAIS.
//
// Un lieu posé rejoint la base de lieux PUBLIQUE : la recherche d'adresse suivante, par n'importe
// qui, le propose. Le lien n'a donc sa place que dans un champ qui enregistre un lieu PUBLIC (une
// installation, le lieu d'un événement, d'une annonce, l'adresse d'un club, le terrain d'une
// équipe).
//
// ⛔ Jamais dans un champ d'adresse PERSONNELLE (l'inscription, le profil) ni dans le partage de
// position d'une conversation : on y poserait son domicile (« Chez Paul »), visible de tous.
// Les filtres de recherche (« autour de… ») non plus : ils n'enregistrent rien.
//
// Carte des appelants (R2) mesurée le 07/10 : 30 usages dans 30 fichiers. Ce témoin lit le code
// source : un appelant qui s'ajoute ou change d'avis doit changer cette liste, consciemment.
// R17-ADRESSE (REC17-008, 19/10) : 31. « Modifier le club » (ClubEdit.js) quitte le texte libre
// pour ce champ, et le rejoint côté « lieu public » (l'adresse d'un club se cherche par distance).
// ADRESSE-EN-PREMIER (20/10) : liste INCHANGÉE (31 sur cette base du site, sans la réservation). Le lien
// devient la 1re ligne de la liste, « Ajouter « <texte tapé> » », toujours par ce seul réglage. Mesuré
// appelant par appelant : aucun autre n'accepte de texte libre ; une ligne « Utiliser « <texte> » » n'y
// aurait rien à reprendre : elle n'est pas posée.

const SRC = path.resolve(__dirname, '..', '..', '..', '..');
// Le champ lui-même (et ses témoins) n'est pas un appelant.
const LE_CHAMP = 'components/organisms/autocompleteAddressInput/';

const LIEU_PUBLIC = [
  // R17-EVT-1-BIS (e) (20/10) : 35 — l'événement de la Ville « Ailleurs dans la commune » (place,
  // parc, salle des fêtes) : un lieu PUBLIC, avec le lien.
  'components/organisms/evenementVille/EvenementVilleForm.js',
  'components/organisms/facilitySelector/FacilitySelector.js',
  'views/admin/clubWizard/AdminClubWizardAddress.js',
  'views/club/ClubEdit.js',
  'views/club/wizard/ClubWizardAddress.js',
  'views/facility/FacilityForm.js',
  'views/friendlyMatch/wizard/FriendlyMatchWizardLocation.js',
  'views/team/TeamEdit.js',
  'views/team/createSquad/steps/SquadLocationStep.js',
];

const JAMAIS = [
  'views/Conversation.js',
  'views/onboarding/UserAddress.js',
  'views/profile/ProfileEdit.js',
  'views/profile/ProfileEdit.web.js',
  'views/profile/SelfProfilePlayerCoach.js',
  'views/profile/SelfProfileUnified.js',
];

/**
 * Les entrées d'un dossier.
 * @param {string} dossier - Le dossier.
 * @returns {fs.Dirent[]} Ses entrées.
 */
const entreesDe = (dossier) => fs.readdirSync(dossier, { withFileTypes: true });

/**
 * Tous les fichiers de production qui montent le champ d'adresse partagé.
 * @param {string} dossier - Le dossier à parcourir.
 * @returns {string[]} Les chemins relatifs à `src`.
 */
const appelants = (dossier = SRC) => entreesDe(dossier).flatMap((entree) => {
  const complet = path.join(dossier, entree.name);
  if (entree.isDirectory()) return entree.name === '__tests__' ? [] : appelants(complet);
  if (!/\.(js|jsx|ts|tsx)$/.test(entree.name) || /\.test\./.test(entree.name)) return [];
  const source = fs.readFileSync(complet, 'utf8');
  return /<AutocompleteAddressInput\b/.test(source) ? [path.relative(SRC, complet).replace(/\\/g, '/')] : [];
});

/**
 * Tous les fichiers de production de `src`.
 * @param {string} dossier - Le dossier à parcourir.
 * @returns {string[]} Les chemins relatifs à `src`.
 */
const fichiersDe = (dossier = SRC) => entreesDe(dossier).flatMap((entree) => {
  const complet = path.join(dossier, entree.name);
  if (entree.isDirectory()) return entree.name === '__tests__' ? [] : fichiersDe(complet);
  if (!/\.(js|jsx|ts|tsx)$/.test(entree.name) || /\.test\./.test(entree.name)) return [];
  return [path.relative(SRC, complet).replace(/\\/g, '/')];
});

const usagesDe = (/** @type {string} */ fichier) => {
  const source = fs.readFileSync(path.join(SRC, fichier), 'utf8');
  return [...source.matchAll(/<AutocompleteAddressInput\b([\s\S]*?)\/>/g)].map((m) => m[1]);
};

describe('ADRESSE-CARTE — le lien « Placez-la sur la carte » : où il est, où jamais', () => {
  it('la carte des appelants tient toujours (32 fichiers montent le champ)', () => {
    expect(appelants().filter((f) => !f.startsWith(LE_CHAMP)).length).toBe(32);
  });

  it.each(LIEU_PUBLIC)('%s : le champ qui enregistre un lieu PUBLIC propose le lien', (fichier) => {
    const usages = usagesDe(fichier);
    expect(usages.length).toBeGreaterThan(0);
    usages.forEach((usage) => expect(usage).toMatch(/\bpermettreLieuSurCarte\b/));
  });

  it.each(JAMAIS)('%s : adresse PERSONNELLE ou conversation, le lien n y est JAMAIS', (fichier) => {
    expect(fs.readFileSync(path.join(SRC, fichier), 'utf8')).not.toMatch(/permettreLieuSurCarte/);
  });

  // R17-ADRESSE (19/10) — la carte part de la ville de l'objet quand le texte tapé n'en nomme
  // aucune (club, équipe), et l'invitation vouvoie la Ville. La Ville n'a pas de ville chargée
  // dans son formulaire d'installation : elle part de la commune tapée, ou de la position.
  it.each([
    ['views/club/ClubEdit.js', /\bvilleConnue=/],
    ['views/team/TeamEdit.js', /\bvilleConnue=/],
    ['views/facility/FacilityForm.js', /\bvouvoyer=\{isCollectiviteMode\}/],
  ])('%s : le champ reçoit ce qu on sait de l objet', (fichier, attendu) => {
    usagesDe(fichier).forEach((usage) => expect(usage).toMatch(attendu));
  });

  // ADRESSE-EN-PREMIER — la ligne de tête ne s'obtient QUE par le champ d'adresse et son réglage :
  // aucun écran ne la passe lui-même à la liste déroulante (ni l'ancien lien).
  it('la ligne « Ajouter » ne se pose que par le champ d adresse', () => {
    const porteurs = fichiersDe().filter((f) => /\b(actionEnTete|lienSousLesOptions)=/
      .test(fs.readFileSync(path.join(SRC, f), 'utf8')));
    expect(porteurs).toEqual([`${LE_CHAMP}autocompleteAddressInput.js`]);
  });

  it('aucun autre appelant ne l a (filtres, adversaire, écrans sans témoin)', () => {
    const autres = appelants().filter((f) => !LIEU_PUBLIC.includes(f)
      && !f.startsWith(LE_CHAMP));
    const porteurs = autres.filter((f) => /permettreLieuSurCarte/.test(fs.readFileSync(path.join(SRC, f), 'utf8')));
    expect(porteurs).toEqual([]);
  });
});
