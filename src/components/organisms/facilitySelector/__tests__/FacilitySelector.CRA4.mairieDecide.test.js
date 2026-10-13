/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilitySelector from '../FacilitySelector';

// 🏛️ COLL-R-APP-CREATION (13/10/2026, COL-003, décision d'Adel « D2- A ») — À L'ÉTAPE 4, HORS DES
// CRÉNEAUX DU CLUB SUR UN GYMNASE DE LA VILLE, LA SÉANCE PART À LA MAIRIE (SPEC-PLACE) : constaté
// en recette le 11/10, l'étape disait seulement « Hors de tes créneaux de la Ville à cette heure. »,
// puis « Cette installation a encore de la capacité pour ce créneau. ». Le VRAI i18next (fr.js)
// écrit les phrases ; le VRAI sélecteur est monté (ses lectures sont doublées).
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - quand le serveur a dit « mairie » (la décision arrive de l'étape, `decisionDeLaVille`) : la
//     carte orange de « Modifier » — la mairie décidera, et si elle refuse la séance sera annulée ;
//     au complet, « Tu peux demander quand même » ; pour un compte qui gère la Ville, « tu pourras
//     l'accepter toi-même » ; la ligne d'avant s'efface ;
//   - sur un gymnase de la Ville, la carte de place ne promet plus rien (ni « encore de la
//     capacité », ni « validation d'un dirigeant ») : elle garde son compte ;
//   - sans réponse du serveur : la ligne d'avant reste (jamais une promesse fausse) ;
//   - une installation du club : rien ne change.

/** @type {Record<string, any>} */
const mockDonnees = {};
/** @type {{ data: Record<string, any> }} */
const mockOccupation = { data: {} };

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => false }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: (/** @type {any} */ options) => {
    const [cle] = options.queryKey;
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
  useGetFacilityOccupancy: (/** @type {string} */ _facilityId, /** @type {any} */ _fenetre, /** @type {any} */ options) => ({
    data: options?.enabled ? { data: mockOccupation.data } : undefined,
    isFetching: false,
  }),
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
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() { return null; });

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
// Heure de l appareil : samedi 10 octobre 2026, 15:00 – 16:30 (hors du créneau du mardi).
const SAMEDI = { end: new Date(2026, 9, 10, 16, 30).toISOString(), start: new Date(2026, 9, 10, 15, 0).toISOString() };
const LIBRE = {
  maxSlots: 2, overlapCount: 1, remaining: 1, saturated: false,
};
const PLEIN_A_VALIDER = {
  maxSlots: 2, overlapCount: 2, remaining: 0, requiresApproval: true, saturated: true,
};

const MAIRIE_LIBRE = 'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.';
const SI_REFUS = 'Si la mairie refuse, la séance sera annulée.';
const HORS_CRENEAU = 'Hors de tes créneaux de la Ville à cette heure.';
const ENCORE_DE_LA_PLACE = 'Cette installation a encore de la capacité pour ce créneau.';

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
        decisionDeLaVille={props.decisionDeLaVille}
        facilityId={props.facilityId || 'gym-ville'}
        location={null}
        occupancyWindow={SAMEDI}
        onChange={jest.fn()}
        teamId="team-U15"
        withVilleSlots
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const decision = (/** @type {any} */ autres = {}) => ({
  complet: false, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage', ...autres,
});

beforeEach(() => {
  mockDonnees.facilities = { data: [SALLE] };
  mockDonnees['facilities-ville-creneaux'] = [GYMNASE];
  mockOccupation.data = LIBRE;
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-R-APP-CREATION — l étape « Lieu » dit que la mairie décidera (COL-003)', () => {
  it('le serveur a dit « mairie » : la carte orange de « Modifier », à la place de la ligne d avant', () => {
    const arbre = monter({ decisionDeLaVille: decision() });
    const lus = textes(arbre);
    expect(lus).toContain(MAIRIE_LIBRE);
    expect(lus).toContain(SI_REFUS);
    expect(lus).not.toContain(HORS_CRENEAU);
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'facility-selector-mairie-decide').length).toBeGreaterThan(0);
  });

  it('au complet : « Tu peux demander quand même : la mairie décidera. », et l annulation en cas de refus', () => {
    mockOccupation.data = PLEIN_A_VALIDER;
    const lus = textes(monter({ decisionDeLaVille: decision({ complet: true }) }));
    expect(lus).toContain('Tu peux demander quand même : la mairie décidera.');
    expect(lus).toContain(SI_REFUS);
    expect(lus).not.toContain(MAIRIE_LIBRE);
  });

  it('le compte gère aussi la Ville : « tu pourras l accepter toi-même dans Demandes »', () => {
    const lus = textes(monter({ decisionDeLaVille: decision({ tuAcceptes: true }) }));
    expect(lus).toContain('Ta demande partira à la Ville ; tu pourras l’accepter toi-même dans Demandes.');
    expect(lus).toContain(SI_REFUS);
    expect(lus).not.toContain(MAIRIE_LIBRE);
  });

  it('sur un gymnase de la Ville, la carte de place ne promet plus rien : elle garde son compte', () => {
    const lus = textes(monter({ decisionDeLaVille: decision() }));
    expect(lus).toContain('1/2 place occupée • 1 restante');
    expect(lus).not.toContain(ENCORE_DE_LA_PLACE);
    mockOccupation.data = PLEIN_A_VALIDER;
    const pleins = textes(monter({ decisionDeLaVille: decision({ complet: true }) }));
    expect(pleins.join(' | ')).not.toMatch(/validation d'un dirigeant/);
  });

  it('sans réponse du serveur : la ligne d avant reste, aucune carte orange, et pas de promesse de place', () => {
    const lus = textes(monter({ decisionDeLaVille: undefined }));
    expect(lus).toContain(HORS_CRENEAU);
    expect(lus).not.toContain(MAIRIE_LIBRE);
    expect(lus).not.toContain(ENCORE_DE_LA_PLACE);
  });

  it('une installation du club : rien ne change (la carte de place dit toujours qu il reste de la place)', () => {
    const lus = textes(monter({ decisionDeLaVille: decision({ deLaVille: false, mairie: false }), facilityId: 'salle-annexe' }));
    expect(lus).toContain(ENCORE_DE_LA_PLACE);
    expect(lus).not.toContain(MAIRIE_LIBRE);
    expect(lus).not.toContain(HORS_CRENEAU);
  });
});
