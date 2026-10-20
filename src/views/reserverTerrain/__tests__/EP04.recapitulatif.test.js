import { ScrollView } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverRecapitulatif from '@/views/reserverTerrain/ReserverRecapitulatif';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { maReservation, recapitulatif } from '@/testSupport/temoinReserver';

// RESA-L6A (14/10/2026) — E-P04 « Le récapitulatif » (planches EP04, P00 bloc 7, OR3 ; plan
// E-P04, A-P02, D3, D4, D7, AT-04, AT-14) : « Ta réservation » (complexe, terrain, sport, jour,
// heures, prix FIGÉ par le serveur « à régler sur place », Modifier), « Combien de joueurs ? » (2
// à la capacité), « Un petit mot » (140), la case du numéro DÉCOCHÉE (absente pour un mineur,
// AT-04), le mot du complexe, l'engagement sur l'honneur en TEXTE SEUL juste au-dessus du bouton
// (AT-14 : rien à cocher, bouton actif d'emblée) et le délai d'annulation, puis « Réserver »
// (automatique) ou « Envoyer la demande » (sur demande). Le serveur recalcule tout (RG-SECU).
// ⛔ Pas dans ce lot : « Pour qui ? » (pour mon équipe) et la collecte (quorum) — serveur L3
// puis L6b.

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));

const mockReserver = jest.fn();
const mockApercu = jest.fn();
let mockReservationEnCours = false;
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: mockApercu }),
  // RESA-L6B-2 : l'âge minimum du bandeau « Pour mon équipe » (témoin EP04.pourQuiCollecte).
  useComplexePublic: () => ({ data: null }),
  useReserverUnCreneau: () => ({ isPending: mockReservationEnCours, mutateAsync: mockReserver }),
}));

let mockNaissance = /** @type {string | null} */ ('1990-05-02');
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: mockNaissance, documentId: 'u-1' } }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  },
);
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte l'écran, et laisse passer une lecture éventuelle.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverRecapitulatif />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return arbre;
};

/**
 * Le bouton dont le titre est EXACTEMENT celui-ci (RESA-L6B-2 : « Réserver seulement quand assez
 * de joueurs ont répondu présent » contient aussi « Réserver »).
 * @param {any} arbre - L'arbre.
 * @param {string} titre - Le titre.
 * @returns {any} Le bouton ; lève une erreur s'il n'existe pas.
 */
const bouton = (arbre, titre) => {
  const trouves = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.title === titre && typeof noeud.props?.onPress === 'function'
  ));
  if (!trouves.length) throw new Error(`Aucun bouton « ${titre} »`);
  return trouves[0];
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    noeud.props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNaissance = '1990-05-02';
  mockReservationEnCours = false;
  mockParams = {
    apercu: recapitulatif(),
    date: '2026-10-16',
    from: '18:00',
    slug: 'le-five-de-montrivage',
    terrainId: 't-1',
  };
  mockReserver.mockResolvedValue(maReservation());
  mockApercu.mockResolvedValue(recapitulatif());
});

describe('E-P04 — les blocs, dans l’ordre de la fiche', () => {
  it('« Ta réservation » : complexe, terrain, sport, jour, prix figé, Modifier', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(
      expect.arrayContaining([
        'Récapitulatif',
        'Ta réservation',
        'Le Five de Montrivage · Terrain 1 · Foot à 5',
        'Vendredi 16 octobre · 18 h – 19 h',
        '60 €, à régler sur place',
      ]),
    );
    await toucher(pressable(arbre, 'Modifier'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('« Combien de joueurs ? » : la capacité d’abord, de 2 à la capacité', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(
      expect.arrayContaining(['Combien de joueurs ?', '10', 'De 2 à 10 : la capacité du terrain.']),
    );
  });

  it('l’engagement sur l’honneur : du texte seul, le bouton actif d’emblée (AT-14)', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(
      expect.arrayContaining([
        'Tu t’engages sur l’honneur à venir.',
        'La réservation vaut pour tous les participants.',
        'Le paiement se fait sur place.',
        'Annulation gratuite jusqu’à 24 h avant. Ensuite, appelle le complexe.',
      ]),
    );
    expect(
      arbre.root.findAll(
        (/** @type {any} */ n) => n.props?.accessibilityRole === 'checkbox'
          && String(n.props?.accessibilityLabel || '').includes('honneur'),
      ),
    ).toHaveLength(0);
    expect(bouton(arbre, 'Réserver').props.disabled).toBeFalsy();
  });

  it('le mot du complexe (A-G26)', async () => {
    expect(lisibles(await monter())).toEqual(
      expect.arrayContaining([
        'Le mot du complexe',
        'Arrive 10 minutes avant, chasubles à l’accueil.',
      ]),
    );
  });

  it('la case du numéro : décochée ; absente pour un mineur (AT-04)', async () => {
    const arbre = await monter();
    const casePresente = parRepere(arbre, 'reserver-partager-numero');
    expect(casePresente.props.accessibilityState).toEqual({ checked: false });
    mockNaissance = '2010-03-01';
    const mineur = await monter();
    expect(parRepere(mineur, 'reserver-partager-numero')).toBeNull();
    mockNaissance = '1990-05-02';
    mockParams.apercu = recapitulatif({ canSharePhone: false });
    expect(parRepere(await monter(), 'reserver-partager-numero')).toBeNull();
  });

  it('un terrain sur demande : « Sur demande », et « Envoyer la demande »', async () => {
    mockParams.apercu = recapitulatif({
      expiresAt: '2026-10-16T14:00:00.000Z',
      terrain: { ...recapitulatif().terrain, bookingMode: 'manuel' },
      willBe: 'en_attente',
    });
    const vus = lisibles(await monter());
    expect(vus).toContain('Sur demande : le complexe te répond');
    expect(vus).toContain('Envoyer la demande');
    expect(vus).not.toContain('Réserver');
  });
});

describe('E-P04 — réserver', () => {
  it('« Réserver » : la liste blanche du serveur, puis le résultat (E-P05)', async () => {
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'reserver-petit-mot').props.onChangeText('  Foot   du jeudi ');
    });
    await toucher(parRepere(arbre, 'reserver-partager-numero'));
    await toucher(pressable(arbre, 'Un joueur de moins'));
    await toucher(bouton(arbre, 'Réserver'));
    expect(mockReserver).toHaveBeenCalledWith({
      date: '2026-10-16',
      from: '18:00',
      note: 'Foot du jeudi',
      phoneShared: true,
      players: 9,
      terrain: 't-1',
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverResultat, {
      reservation: maReservation(),
    });
  });

  it('sans réseau : rien n’est parti, tout reste rempli', async () => {
    mockReserver.mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' });
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'reserver-petit-mot').props.onChangeText('Foot du jeudi');
    });
    await toucher(bouton(arbre, 'Réserver'));
    expect(lisibles(arbre)).toContain('La réservation n’est pas partie. Réessaie.');
    expect(parRepere(arbre, 'reserver-petit-mot').props.value).toBe('Foot du jeudi');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('créneau pris, âge, plafond… au dernier moment : les messages d’échec (E-P13)', async () => {
    mockReserver.mockRejectedValue({
      details: { code: 'COMPLEXE_RESERVATION_SLOT_TAKEN' },
      status: 409,
    });
    const arbre = await monter();
    await toucher(bouton(arbre, 'Réserver'));
    expect(mockReplace).toHaveBeenCalledWith(
      RouteNames.ReserverEchec,
      expect.objectContaining({
        complexe: 'Le Five de Montrivage',
        date: '2026-10-16',
        from: '18:00',
        slug: 'le-five-de-montrivage',
        terrain: 'Terrain 1',
        terrainId: 't-1',
        to: '19:00',
        variante: 'pris',
      }),
    );
  });

  it('venu sans récapitulatif (lien) : il le demande au serveur, puis s’affiche', async () => {
    delete mockParams.apercu;
    const arbre = await monter();
    expect(mockApercu).toHaveBeenCalledWith({ date: '2026-10-16', from: '18:00', terrain: 't-1' });
    expect(lisibles(arbre)).toContain('Le Five de Montrivage · Terrain 1 · Foot à 5');
  });

  it('venu sans récapitulatif, et refusé : les messages d’échec à la place', async () => {
    delete mockParams.apercu;
    mockApercu.mockRejectedValue({
      details: { code: 'COMPLEXE_RESERVATION_AGE', minAge: 16 },
      status: 403,
    });
    await monter();
    expect(mockReplace).toHaveBeenCalledWith(
      RouteNames.ReserverEchec,
      expect.objectContaining({
        details: { code: 'COMPLEXE_RESERVATION_AGE', minAge: 16 },
        variante: 'age',
      }),
    );
  });
});

// RESA-FIN-APP (20/10/2026) — tournées 1 et 2 : le compteur « Combien de joueurs ? » était une barre GRIS CLAIR
// au milieu d'un écran sombre (ton « surface » du compteur, fait pour les fiches claires) ; et « Réserver » /
// « Envoyer la demande » était au BAS de la page (il fallait défiler), pas en pied fixe comme la planche.
// Le compteur prend le ton sombre du parcours (« tunnel », le même que les tunnels de l'app) ; le bouton
// sort du défilement et reste en bas de l'écran.
describe('RESA-FIN-APP (2) E-P04 — le compteur sombre, le bouton en pied fixe', () => {
  it('« Combien de joueurs ? » au ton du parcours ; « Réserver » hors du défilement', async () => {
    const arbre = await monter();
    const [compteur] = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.props?.onIncrement === 'function' && 'tone' in n.props
    ));
    expect(compteur?.props.tone).toBe('tunnel');
    const [defilement] = arbre.root.findAllByType(ScrollView);
    const dansLeDefilement = defilement.findAll((/** @type {any} */ n) => (
      n.props?.title === 'Réserver' && typeof n.props?.onPress === 'function'
    ));
    expect(dansLeDefilement).toHaveLength(0);
    expect(arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.title === 'Réserver' && typeof n.props?.onPress === 'function'
    )).length).toBeGreaterThan(0);
  });
});
