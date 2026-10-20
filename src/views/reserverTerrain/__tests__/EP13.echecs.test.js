import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverEchec from '@/views/reserverTerrain/ReserverEchec';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';

// RESA-L6A (14/10/2026) — E-P13 « Les messages d'échec » (planche EP13 ; plan E-P13, RC-P08,
// RC-P07, R2, AT-10) : un seul écran, un même gabarit (pictogramme sans emoji, titre, texte, carte
// de la réservation, boutons empilés) ; chaque refus du serveur rend un CODE qui choisit la
// variante (domains/complexe/reserverTerrain.js). ⛔ RC-P08 : le banni ne lit jamais la raison du
// complexe, et n'a pas « Écrire au complexe ».
// Pas dans ce lot : les variantes de la collecte (1, 2 : serveur L3), « Voir mes réservations »
// (E-P10, L6b), « Écrire au complexe » (la conversation de la réservation, serveur L3).

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

const mockVersLaRecherche = jest.fn();
jest.mock('@/views/search/searchRouteHelpers', () => ({
  navigateToSearchHub: (/** @type {any[]} */ ...args) => mockVersLaRecherche(...args),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const CRENEAU = {
  complexe: 'Le Five de Montrivage',
  date: '2026-10-14',
  from: '18:00',
  slug: 'le-five-de-montrivage',
  telephone: '+33639981234',
  terrain: 'Terrain 1',
  terrainId: 't-1',
  to: '19:00',
};

/**
 * Monte l'écran avec ses paramètres.
 * @param {Record<string, any>} params - Les paramètres de route.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (params) => {
  mockParams = params;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverEchec />);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('E-P13 — les variantes', () => {
  it('créneau pris : le texte, la carte, « Voir d’autres créneaux » (calendrier)', async () => {
    const arbre = await monter({ ...CRENEAU, variante: 'pris' });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Ce créneau vient d’être pris',
      'Choisis-en un autre : rien n’a été réservé.',
      'Mercredi 14/10 · 18 h – 19 h · Terrain 1',
      'Le Five de Montrivage',
    ]));
    await appuyer(arbre, 'Voir d’autres créneaux');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverCreneau, {
      date: '2026-10-14', slug: 'le-five-de-montrivage', terrainId: 't-1',
    });
  });

  it('sous l’âge minimum (R2) : l’âge du complexe, « Réserver ailleurs »', async () => {
    const arbre = await monter({
      ...CRENEAU, details: { code: 'COMPLEXE_RESERVATION_AGE', minAge: 16 }, variante: 'age',
    });
    expect(lisibles(arbre)).toContain('Ce complexe accepte les réservations à partir de 16 ans.');
    await appuyer(arbre, 'Réserver ailleurs');
    expect(mockVersLaRecherche).toHaveBeenCalledWith(expect.anything(), 'reservations');
  });

  it('sans date de naissance : « Compléter mon profil » ouvre l’édition du profil', async () => {
    const arbre = await monter({ ...CRENEAU, variante: 'dateDeNaissance' });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Ajoute ta date de naissance pour réserver.', 'Chaque complexe fixe un âge minimum.',
    ]));
    await appuyer(arbre, 'Compléter mon profil');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ProfileStack, {
      screen: RouteNames.ProfileEdit,
    });
  });

  it('plafond atteint : le plafond du complexe', async () => {
    const arbre = await monter({
      ...CRENEAU, details: { code: 'COMPLEXE_RESERVATION_PLAFOND', max: 2 }, variante: 'plafond',
    });
    expect(lisibles(arbre))
      .toContain('Tu as déjà 2 réservations à venir dans ce complexe (le maximum).');
  });

  it('⛔ banni (RC-P08) : la phrase seule, ni raison, ni « Écrire », ni « Appeler »', async () => {
    const arbre = await monter({ ...CRENEAU, message: 'la raison privée', variante: 'banni' });
    const vus = lisibles(arbre);
    expect(vus).toContain('Tu ne peux plus réserver dans ce complexe.');
    expect(JSON.stringify(vus)).not.toContain('raison privée');
    expect(JSON.stringify(vus)).not.toContain('Appeler');
    expect(JSON.stringify(vus)).not.toContain('Écrire');
    expect(vus).toContain('Réserver ailleurs');
  });

  it('trop tard pour réserver ici : « Appeler » le complexe', async () => {
    const arbre = await monter({ ...CRENEAU, variante: 'tropTard' });
    expect(lisibles(arbre)).toContain('Trop tard pour réserver ici : appelle le complexe.');
    await appuyer(arbre, 'Appeler le 06 39 98 12 34');
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+33639981234');
  });

  it('refusée : le motif du complexe lu tel quel', async () => {
    const arbre = await monter({
      ...CRENEAU, motif: 'terrain réservé pour un tournoi.', variante: 'refusee',
    });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Le Five de Montrivage a refusé ta demande',
      'Motif : terrain réservé pour un tournoi.',
    ]));
  });

  it('fermeture : le texte de la fermeture, « Réserver un autre jour »', async () => {
    const arbre = await monter({
      ...CRENEAU, fermeture: 'le 25/10 (travaux)', variante: 'fermeture',
    });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Le complexe sera fermé', 'Fermé le 25/10 (travaux) : ta réservation est annulée.',
    ]));
    await appuyer(arbre, 'Réserver un autre jour');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverCreneau, {
      slug: 'le-five-de-montrivage', terrainId: 't-1',
    });
  });

  it('une panne : « Réessayer » revient en arrière ; « Fermer » toujours là', async () => {
    const arbre = await monter({ ...CRENEAU, variante: 'panne' });
    expect(lisibles(arbre)).toContain('Quelque chose n’a pas marché. Réessaie.');
    await appuyer(arbre, 'Réessayer');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    await appuyer(arbre, 'Fermer');
    expect(mockGoBack).toHaveBeenCalledTimes(2);
  });

  it('un refus du serveur sans variante connue garde sa phrase (invalide, état)', async () => {
    const arbre = await monter({
      ...CRENEAU, message: 'Cette réservation a déjà commencé.', variante: 'etat',
    });
    expect(lisibles(arbre)).toContain('Cette réservation a déjà commencé.');
  });
});
