import fs from 'fs';
import path from 'path';

// ADRESSE-CARTE (07/10) — QUI propose « Adresse introuvable ? Placez-la sur la carte », et QUI ne
// le propose JAMAIS.
//
// Un lieu posé rejoint la base de lieux PUBLIQUE : la recherche d'adresse suivante, par n'importe
// qui, le propose. Le lien n'a donc sa place que dans un champ qui enregistre un lieu PUBLIC (une
// installation, le lieu d'un événement, d'une annonce, l'adresse d'un club, le terrain d'une équipe).
//
// ⛔ Jamais dans un champ d'adresse PERSONNELLE (l'inscription, le profil) ni dans le partage de
// position d'une conversation : on y poserait son domicile (« Chez Paul »), visible de tous.
// Les filtres de recherche (« autour de… ») non plus : ils n'enregistrent rien.
//
// Carte des appelants (R2) mesurée le 07/10 : 30 usages dans 30 fichiers. Ce témoin lit le code
// source : un appelant qui s'ajoute ou change d'avis doit changer cette liste, consciemment.

const SRC = path.resolve(__dirname, '..', '..', '..', '..');

const LIEU_PUBLIC = [
  'components/organisms/facilitySelector/FacilitySelector.js',
  'views/admin/clubWizard/AdminClubWizardAddress.js',
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
 * Tous les fichiers de production qui montent le champ d'adresse partagé.
 * @param {string} dossier - Le dossier à parcourir.
 * @returns {string[]} Les chemins relatifs à `src`.
 */
const appelants = (dossier = SRC) => fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
  const complet = path.join(dossier, entree.name);
  if (entree.isDirectory()) return entree.name === '__tests__' ? [] : appelants(complet);
  if (!/\.(js|jsx|ts|tsx)$/.test(entree.name) || /\.test\./.test(entree.name)) return [];
  const source = fs.readFileSync(complet, 'utf8');
  return /<AutocompleteAddressInput\b/.test(source) ? [path.relative(SRC, complet).replace(/\\/g, '/')] : [];
});

const usagesDe = (/** @type {string} */ fichier) => {
  const source = fs.readFileSync(path.join(SRC, fichier), 'utf8');
  return [...source.matchAll(/<AutocompleteAddressInput\b([\s\S]*?)\/>/g)].map((m) => m[1]);
};

describe('ADRESSE-CARTE — le lien « Placez-la sur la carte » : où il est, où il n est jamais', () => {
  it('la carte des appelants tient toujours (30 fichiers montent le champ)', () => {
    expect(appelants().filter((f) => !f.startsWith('components/organisms/autocompleteAddressInput/')).length).toBe(30);
  });

  it.each(LIEU_PUBLIC)('%s : le champ qui enregistre un lieu PUBLIC propose le lien', (fichier) => {
    const usages = usagesDe(fichier);
    expect(usages.length).toBeGreaterThan(0);
    usages.forEach((usage) => expect(usage).toMatch(/\bpermettreLieuSurCarte\b/));
  });

  it.each(JAMAIS)('%s : adresse PERSONNELLE ou conversation, le lien n y est JAMAIS', (fichier) => {
    expect(fs.readFileSync(path.join(SRC, fichier), 'utf8')).not.toMatch(/permettreLieuSurCarte/);
  });

  it('aucun autre appelant ne l a (filtres, recherche d adversaire, écrans encore sans témoin)', () => {
    const autres = appelants().filter((f) => !LIEU_PUBLIC.includes(f)
      && !f.startsWith('components/organisms/autocompleteAddressInput/'));
    const porteurs = autres.filter((f) => /permettreLieuSurCarte/.test(fs.readFileSync(path.join(SRC, f), 'utf8')));
    expect(porteurs).toEqual([]);
  });
});
