import { readFileSync } from 'fs';
import { join } from 'path';

import { parse } from '@babel/parser';

// DEFILEMENT-LOT1 (11/11/2026, registre D03b, « D03b A » d'Adel ; « tout défile », la bande du
// bas, demande du 04/11). Règle A de T3-BANDE-BAS, modèle FacilityList (10/11) : le cadre ne garde
// rien en bas (`scroll-edge`) et la fin de ce qui défile laisse sa marge + le retrait commun
// (`useRetraitBasDuDefilement`). Plus de place gardée pour une barre d'onglets absente : ces
// écrans vivent dans des piles posées AU-DESSUS des onglets (AdminStack, ClubStack, EventStack,
// pile racine). Relevé : `.local/bancs/RELEVE-DEFILEMENT-1111/RELEVE.md`.

// Quatre écrans de saisie laissés le 03/11, puis neuf écrans « tab-scene » sans barre.
const ECRANS = [
  'admin/AdminCollectiviteInvitations.js',
  'club/ClubMemberRoles.js',
  'complexe/ComplexeCanal.js',
  'complexe/ComplexeClients.js',
  'event/TournamentManagement.js',
  'event/TournamentTeamDetails.js',
  'license/ClubLicensePayments.js',
  'license/CMLicensesDashboard.js',
  'admin/AdminClubDetail.js',
  'admin/AdminClubForm.js',
  'admin/AdminClubList.js',
  'admin/AdminNotificationsHealth.js',
  'admin/AdminRevenue.js',
];

const LISTES = ['ScrollView', 'FlatList', 'SectionList', 'FlashList'];

const nomDe = (/** @type {any} */ balise) => balise.name.property?.name || balise.name.name;

const parcourir = (/** @type {any} */ noeud, /** @type {(n: any) => boolean | void} */ visite) => {
  if (!noeud || typeof noeud.type !== 'string') return;
  if (visite(noeud) === false) return;
  Object.values(noeud).forEach((valeur) => {
    if (Array.isArray(valeur)) valeur.forEach((enfant) => parcourir(enfant, visite));
    else if (valeur && typeof valeur === 'object') parcourir(valeur, visite);
  });
};

const lire = (/** @type {string} */ fichier) => {
  const source = readFileSync(join(__dirname, '..', '..', '..', 'views', fichier), 'utf8');
  const ast = parse(source, { plugins: ['jsx'], sourceType: 'module' });
  /** @type {any[]} */
  const cadres = [];
  parcourir(ast.program, (noeud) => {
    if (noeud.type === 'JSXElement' && nomDe(noeud.openingElement) === 'ScreenContainer') {
      cadres.push(noeud);
    }
  });
  const prop = (/** @type {any} */ element, /** @type {string} */ nom) => {
    const attribut = element.openingElement.attributes.find((a) => a.name?.name === nom);
    return attribut?.value ? source.slice(attribut.value.start, attribut.value.end) : '';
  };
  // Le cadre principal est le dernier du fichier (avant lui : le refus d'accès du tournoi).
  const cadre = cadres.at(-1);
  /** @type {any[]} */
  const listes = [];
  parcourir(cadre, (noeud) => {
    if (noeud.type !== 'JSXElement' || !LISTES.includes(nomDe(noeud.openingElement))) return true;
    if (noeud.openingElement.attributes.some((a) => a.name?.name === 'horizontal')) return true;
    listes.push(noeud);
    return false;
  });
  return {
    marges: prop(cadre, 'contentContainerStyle'),
    mode: prop(cadre, 'bottomInsetMode'),
    modes: cadres.map((c) => prop(c, 'bottomInsetMode')),
    retraits: listes.map((liste) => prop(liste, 'contentContainerStyle')),
    source,
  };
};

describe('DEFILEMENT-LOT1 : la fin du défilement suit la règle commune', () => {
  test.each(ECRANS)('%s : aucun cadre ne garde la place d une barre d onglets absente', (f) => {
    expect(lire(f).modes).not.toContain('"tab-scene"');
  });

  test.each(ECRANS)('%s : le cadre ne garde rien, la fin du défilement garde tout', (fichier) => {
    const ecran = lire(fichier);
    expect(ecran.mode).toBe('"scroll-edge"');
    expect(ecran.marges).not.toMatch(/paddingBottom|paddingVertical|padding\[/);
    expect(ecran.retraits.length).toBeGreaterThan(0);
    ecran.retraits.forEach((retrait) => expect(retrait).toMatch(/paddingBottom: [^,}]*retraitBas/));
    expect(ecran.source).toMatch(/const retraitBas = useRetraitBasDuDefilement\((12)?\);/);
  });

  // PastMatchDetails vit dans deux piles : sous l'onglet League (barre affichée) et dans la pile
  // racine (pas de barre). Seule la fin du défilement est dans ce lot ; son cadre et son
  // SafeAreaView (le haut) appartiennent au lot 2.
  test('PastMatchDetails : la place de la barre seulement quand la barre est là', () => {
    const { source } = lire('league/match/PastMatchDetails.js');
    expect(source).not.toMatch(/Math\.max\(sceneBottomInset/);
    expect(source).toMatch(/const hauteurDeLaBarre = useContext\(BottomTabBarHeightContext\)/);
    // Le site garde sa marge, comme FacilityList : sa coque décide du dock.
    expect(source).toMatch(/gardeLaPlaceDuDock = Platform\.OS === 'web' \|\| hauteurDeLaBarre > 0/);
    expect(source).toMatch(/gardeLaPlaceDuDock \? sceneBottomInset : 44/);
  });
});
