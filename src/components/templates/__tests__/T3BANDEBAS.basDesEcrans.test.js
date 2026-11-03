import { readFileSync } from 'fs';
import { join } from 'path';

import { parse } from '@babel/parser';
import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// jest.setup.js pose une doublure à 0 : ce témoin-ci lit la vraie valeur.
const { default: useRetraitBasDuDefilement } = jest.requireActual(
  '@/components/templates/useRetraitBasDuDefilement',
);

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 48, left: 0, right: 0, top: 0,
  }),
}));

// T3-BANDE-BAS (03/11, décision d'Adel) : le contenu descend jusqu'en bas, sans bande au-dessus de
// la barre du téléphone. Règle : le dernier élément reste atteignable et n'est jamais caché. Le
// cadre ne garde donc plus rien en bas, et ce qu'il gardait passe à la fin de ce qui défile.

const FAITS = [
  'admin/AdminAssistance.js', 'admin/AdminClaimList.js', 'admin/AdminClubOnboardingList.js',
  'admin/AdminComplexeDetail.js', 'admin/AdminPopupCampaignDetail.js', 'admin/AdminReports.js',
  'admin/AdminUserDetail.js', 'admin/FeaturedRequestsList.js', 'club/ClubMembershipRequestList.js',
  'club/RequestsDashboard.js', 'collectivite/ClubSlotRequests.js',
  'collectivite/CollectiviteActualites.js', 'collectivite/CollectiviteActualitesCanal.js',
  'collectivite/CollectiviteCanalMembres.js', 'collectivite/CollectiviteHome.js',
  'collectivite/CollectiviteJoin.js', 'collectivite/CollectiviteJoinRequest.js',
  'collectivite/CollectiviteRequests.js', 'complexe/ComplexeAccueil.js',
  'complexe/ComplexeDemandes.js', 'complexe/ComplexeStatistiques.js',
  'facility/MyFacilityReports.js', 'friendlyMatch/FriendlyMatchAdDetails.js',
  'league/ComingSoonLeagueScreen.js', 'league/details/SquadRequestsScreen.js',
  'league/match/MatchHistoryScreen.js', 'license/PublicLicensePayment.js',
  'matchStats/PendingMatchStatsScreen.js', 'multisportClub/CMDashboard.js',
  'multisportClub/FeaturedRequestsScreen.js', 'multisportClub/MultisportClubDetails.js',
  'notification/NotificationList.js', 'profile/BlockedUsers.js', 'profile/MyParentLink.js',
  'profile/PlayerCardGallery.js', 'profile/PrivacySettings.js',
  'reserverTerrain/ReserverAnnonce.js', 'reserverTerrain/ReserverEchec.js',
  'reserverTerrain/ReserverFavoris.js', 'reserverTerrain/ReserverInvitation.js',
  'reserverTerrain/ReserverMaReservation.js', 'reserverTerrain/ReserverResultat.js',
  'search/MyActivitiesScreen.js', 'team/TeamMembershipRequestList.js',
  'training/TrainingEnrolled.js', 'training/TrainingVideoQueue.js',
];

// Ces deux fiches portent déjà leur retrait, dans une variable à elles (essai vu par Adel).
const FICHES = {
  'club/ClubDetails.js': 'floatingClubActionsScrollPaddingBottom',
  'profile/UserDetails.js': 'scrollBottomPadding',
};

// Relus et laissés : leur cadre garde sa marge. Ils sortent de cette liste un par un, sur décision.
const LAISSES = {
  'admin/AdminCollectiviteInvitations.js': 'saisie dans la liste',
  'club/AssignCoachTeams.js': 'bouton fixe sous la liste',
  'club/ClubMemberRoles.js': 'saisie dans la liste',
  'collectivite/CollectiviteSignupStatus.js': 'pied fixe sous la liste',
  'complexe/ComplexeCanal.js': 'saisie dans la liste',
  'complexe/ComplexeClients.js': 'saisie dans la liste',
  'event/ParticipantEventList.js': 'onglet et bouton flottant',
  'league/match/PastMatchDetails.js': 'SafeAreaView : le retrait reviendrait sur iPhone',
  'league/ranking/RankingScreen.js': 'liste dans une carte',
  'reserverTerrain/ReserverVeille.js': 'pied fixe sous la liste',
  'search/SearchAlerts.js': 'bouton fixe posé sur la liste',
};

/**
 * Lit le retrait dans un vrai composant.
 * @param {number} [marge] La marge du cadre.
 * @returns {number | undefined} Le retrait.
 */
function retraitLu(marge) {
  /** @type {number | undefined} */
  let lu;
  /**
   * Sonde.
   * @returns {null} Rien à afficher.
   */
  function Sonde() {
    lu = useRetraitBasDuDefilement(marge);
    return null;
  }
  act(() => { renderer.create(<Sonde />); });
  return lu;
}

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
  /** @type {any} */
  let cadre = null;
  parcourir(ast.program, (noeud) => {
    if (noeud.type === 'JSXElement' && nomDe(noeud.openingElement) === 'ScreenContainer') {
      cadre = noeud;
    }
  });
  const prop = (/** @type {any} */ element, /** @type {string} */ nom) => {
    const attribut = element.openingElement.attributes.find((a) => a.name?.name === nom);
    return attribut?.value ? source.slice(attribut.value.start, attribut.value.end) : '';
  };
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
    retraits: listes.map((liste) => prop(liste, 'contentContainerStyle')),
    source,
  };
};

describe('T3-BANDE-BAS : le bas des écrans', () => {
  test('les 59 écrans sont classés, une seule fois', () => {
    const tous = [...FAITS, ...Object.keys(FICHES), ...Object.keys(LAISSES)];
    expect(tous).toHaveLength(59);
    expect(new Set(tous).size).toBe(59);
  });

  test.each(FAITS)('%s : le cadre ne garde rien, la fin du défilement garde tout', (fichier) => {
    const ecran = lire(fichier);
    expect(ecran.mode).toBe('"edge-to-edge"');
    expect(ecran.marges).not.toMatch(/paddingBottom|paddingVertical|padding\[/);
    expect(ecran.retraits.length).toBeGreaterThan(0);
    ecran.retraits.forEach((retrait) => expect(retrait).toMatch(/paddingBottom: [^,}]*retraitBas/));
    expect(ecran.source).toMatch(/const retraitBas = useRetraitBasDuDefilement\((12)?\);/);
  });

  test.each(Object.entries(FICHES))('%s : le défilement garde sa variable', (fichier, variable) => {
    const { source } = lire(fichier);
    expect(source).toMatch(/bottomInsetMode="edge-to-edge"/);
    expect(source).toMatch(new RegExp(`paddingBottom: [^,}]*${variable}`));
  });

  test.each(Object.entries(LAISSES))('%s reste protégé par son cadre (%s)', (fichier) => {
    expect(lire(fichier).mode).not.toBe('"edge-to-edge"');
  });

  describe('la valeur du retrait', () => {
    const osInitial = Platform.OS;
    afterEach(() => { Platform.OS = osInitial; });

    test.each(['ios', 'android'])('%s : la barre du téléphone, plus la marge du cadre', (os) => {
      Platform.OS = /** @type {any} */ (os);
      expect(retraitLu()).toBe(48);
      expect(retraitLu(12)).toBe(60);
    });

    test('site : rien, sa page ne change pas', () => {
      Platform.OS = 'web';
      expect(retraitLu(12)).toBe(0);
    });
  });
});
