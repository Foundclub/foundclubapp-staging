/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilitySelector from '../FacilitySelector';

// 🏟️ COLL-C2C (02/10) — D32 : L ÉTAPE « LIEU » PROPOSE AUSSI LES INSTALLATIONS DE LA VILLE OÙ LE
// CLUB A UN CRÉNEAU (constaté en recette le 29/09 : elle ne proposait QUE celles du club). Le VRAI
// i18next (fr.js) écrit les phrases ; le VRAI sélecteur est monté (ses lectures sont doublées).
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - sur demande (`withVilleSlots`, l étape « Lieu » d un événement), les installations de la
//     Ville où le club a un créneau s ajoutent à celles du club, avec leurs créneaux ;
//   - dans un créneau du club : « validée directement », sans la carte d occupation de
//     l installation (le créneau porte la place) ; hors créneau : on le dit, et la carte reste ;
//   - les 4 autres appelants ne demandent rien : aucune lecture de plus, la liste d avant.

/** @type {Record<string, any>} */
const mockDonnees = {};
/** @type {Record<string, any>} */
const mockRequetes = {};
/** @type {any[]} */
const mockOccupations = [];

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => false }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: (/** @type {any} */ options) => {
    const [cle] = options.queryKey;
    mockRequetes[cle] = options;
    return {
      data: options.enabled ? mockDonnees[cle] : undefined, isFetching: false, isLoading: false, refetch: jest.fn(),
    };
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { check: 1 },
      Spaces: espaces,
    }),
  };
});
jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacilityOccupancy: (/** @type {string} */ facilityId, /** @type {any} */ _fenetre, /** @type {any} */ options) => {
    mockOccupations.push({ enabled: Boolean(options?.enabled), facilityId });
    return {
      data: options?.enabled ? {
        data: {
          maxSlots: 2, overlapCount: 1, remaining: 1, saturated: false,
        },
      } : undefined,
      isFetching: false,
    };
  },
}));
jest.mock('@/services/facility/facilityService', () => ({
  getClubVilleFacilitiesWithSlots: jest.fn(),
  getCMFacilities: jest.fn(),
  getFacilities: jest.fn(),
}));
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function MarqueeTextMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, null, props.text);
  };
});
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => function AdresseMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});

const SALLE = {
  address: { description: '3 rue du Stade' }, documentId: 'salle-annexe', maxSlots: 1, name: 'Salle annexe',
};
const GYMNASE = {
  address: { description: '12 rue des Tilleuls' },
  clubSeasonSlots: [{
    documentId: 's1', endTime: '19:00', facility: { documentId: 'gym-ville' }, startTime: '17:30', team: { documentId: 'team-U15', name: 'U15' }, validFrom: '2026-09-01', validUntil: '2027-06-30', weekday: 2,
  }],
  collectivite: { documentId: 'ville', name: 'Ville de Montrivage' },
  documentId: 'gym-ville',
  isReadOnly: true,
  isShared: true,
  maxSlots: 2,
  name: 'Gymnase des Tilleuls',
  ownerName: 'Ville de Montrivage',
  ownerType: 'collectivite',
};
// Heure de l appareil : mardi 6 octobre 2026, 17:45 – 18:45 ; mercredi 7, meme heure.
const MARDI = { end: new Date(2026, 9, 6, 18, 45).toISOString(), start: new Date(2026, 9, 6, 17, 45).toISOString() };
const MERCREDI = { end: new Date(2026, 9, 7, 18, 45).toISOString(), start: new Date(2026, 9, 7, 17, 45).toISOString() };

/** @type {any[]} */
const arbresMontes = [];
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const monter = (/** @type {any} */ props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <FacilitySelector
        clubId="as-montrivage"
        currentFacility={props.currentFacility}
        facilityId={props.facilityId || null}
        location={null}
        occupancyWindow={props.occupancyWindow}
        onChange={props.onChange || jest.fn()}
        teamId={props.teamId}
        withVilleSlots={props.withVilleSlots}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children).trim());

beforeEach(() => {
  Object.keys(mockRequetes).forEach((cle) => delete mockRequetes[cle]);
  mockOccupations.length = 0;
  mockDonnees.facilities = { data: [SALLE] };
  mockDonnees['facilities-ville-creneaux'] = [GYMNASE];
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-C2C — l étape « Lieu » : les installations de la Ville où le club a un créneau', () => {
  it('elles s ajoutent à celles du club, avec leurs créneaux, sans le suffixe de l omnisport', () => {
    const lus = textes(monter({ teamId: 'team-U15', withVilleSlots: true }));
    expect(lus).toContain('Salle annexe');
    expect(lus).toContain('Gymnase des Tilleuls');
    expect(lus.join(' | ')).not.toMatch(/\(CM\)/);
    expect(lus).toContain('Tes créneaux de la Ville : U15 · chaque mardi 17:30 – 19:00');
    expect(lus).toContain('Choisis une installation de ton club, ou de la Ville où ton club a un créneau.');
    expect(mockRequetes['facilities-ville-creneaux'].enabled).toBe(true);
  });

  // 🎨 FINITIONS13-COLL (04/10) — point 8 : « Modifier » ne listait pas le Gymnase où la séance
  // a lieu (tournée T12, F11C_5 ; T13, C2_7b). L'installation ACTUELLE de la séance est toujours
  // proposée, même hors des listes lues. ROUGE avant le lot.
  it('FIN13-COLL : l installation actuelle de la séance est toujours dans la liste', () => {
    const lus = textes(monter({
      currentFacility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls' },
      facilityId: 'gym-ville',
    }));
    expect(lus).toContain('Salle annexe');
    expect(lus).toContain('Gymnase des Tilleuls');
  });

  it('les 4 autres appelants ne demandent rien : aucune lecture de plus, la liste d avant', () => {
    const lus = textes(monter());
    expect(mockRequetes['facilities-ville-creneaux']?.enabled).toBeFalsy();
    expect(lus).not.toContain('Gymnase des Tilleuls');
    expect(lus).toContain('Choisis une installation existante de ton club.');
  });

  it('dans le créneau du club : « validée directement », sans la carte d occupation', () => {
    const lus = textes(monter({
      facilityId: 'gym-ville', occupancyWindow: MARDI, teamId: 'team-U15', withVilleSlots: true,
    }));
    expect(lus).toContain('Dans ton créneau U15 · chaque mardi 17:30 – 19:00 : la séance est validée directement. Si ton club y est déjà au complet à cette heure, ton dirigeant décide.');
    expect(mockOccupations.filter((appel) => appel.facilityId === 'gym-ville').every((appel) => !appel.enabled)).toBe(true);
    expect(lus.join(' | ')).not.toMatch(/Hors de tes créneaux/);
  });

  it('hors des créneaux du club (un autre jour, ou une autre équipe) : on le dit, et la carte d occupation reste', () => {
    let lus = textes(monter({
      facilityId: 'gym-ville', occupancyWindow: MERCREDI, teamId: 'team-U15', withVilleSlots: true,
    }));
    expect(lus).toContain('Hors de tes créneaux de la Ville à cette heure.');
    expect(mockOccupations.at(-1)).toEqual({ enabled: true, facilityId: 'gym-ville' });
    lus = textes(monter({
      facilityId: 'gym-ville', occupancyWindow: MARDI, teamId: 'team-U13', withVilleSlots: true,
    }));
    expect(lus).toContain('Hors de tes créneaux de la Ville à cette heure.');
  });

  it('choisir le gymnase de la Ville le passe à l événement, comme une installation du club', () => {
    const onChange = jest.fn();
    const arbre = monter({ onChange, teamId: 'team-U15', withVilleSlots: true });
    const carte = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
      && n.findAllByType(Text).some((/** @type {any} */ t) => aplatir(t.props.children) === 'Gymnase des Tilleuls'), { deep: false });
    act(() => { carte[0].props.onPress(); });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ facilityId: 'gym-ville' }));
  });
});
