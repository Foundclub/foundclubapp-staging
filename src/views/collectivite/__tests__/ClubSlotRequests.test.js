import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubSlotRequests from '../ClubSlotRequests';

// 🏛️ COLL-C3B (02/10) — « TES DEMANDES À LA VILLE » (planches P8v2-demande, tel état 5, ordi C).
// Écran NEUF : ce témoin était rouge faute d'écran. Ce qu'il fige :
//   - la réponse et le mot de la mairie au même endroit : équipe · installation, le moment,
//     l'état (En attente / Acceptée / Refusée), « c'était complet à l'envoi », le mot en citation ;
//   - une série se lit « Chaque jeudi, … jusqu'au 30 juin » ;
//   - un refus propose « Demander une autre heure » (le formulaire, prérempli) ;
//   - vide : une phrase ; sur ordinateur : un tableau.

const mockGet = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
let mockDimensions = {
  fontScale: 1, height: 812, scale: 2, width: 375,
};

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args), post: jest.fn(), put: jest.fn() },
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: { documentId: 'club-A' } } }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        const valeurs = typeof repli === 'object' && repli ? repli : options;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
      },
    }),
  };
});
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const ligne = (/** @type {any} */ champs) => ({
  collectivite: { name: 'Ville de Montrivage' },
  decisionReason: null,
  facility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls' },
  isRecurring: false,
  maxSlots: 2,
  overlapCount: 2,
  requestedEnd: '2030-10-03T17:30:00.000Z',
  requestedStart: '2030-10-03T16:00:00.000Z',
  series: null,
  seriesCount: 1,
  status: 'pending',
  team: { documentId: 'u13', name: 'U13' },
  ...champs,
});
const EN_ATTENTE = ligne({ documentId: 'rq-1' });
const ACCEPTEE = ligne({
  decisionReason: 'Accord de la mairie, bon entraînement !',
  documentId: 'rq-2',
  status: 'approved',
  team: { documentId: 'u15', name: 'U15' },
});
const REFUSEE = ligne({
  decisionReason: 'Gymnase complet le 8 octobre',
  documentId: 'rq-3',
  status: 'refused',
  team: { documentId: 'u15', name: 'U15' },
});
const SERIE = ligne({
  documentId: 'rq-4',
  isRecurring: true,
  series: { until: '2031-06-30' },
  seriesCount: 30,
});
const heure = (/** @type {string} */ iso) => format(new Date(iso), 'HH:mm');
const JOUR = format(new Date(EN_ATTENTE.requestedStart), 'EEE d MMM', { locale: fr });
// eslint-disable-next-line max-len
const MOMENT = `${JOUR.charAt(0).toUpperCase()}${JOUR.slice(1)}, ${heure(EN_ATTENTE.requestedStart)} – ${heure(EN_ATTENTE.requestedEnd)}`;

let mockLignes = [EN_ATTENTE, ACCEPTEE, REFUSEE, SERIE];
/** @type {Record<string, any>} */
let mockRouteParams = {};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());

jest.setTimeout(20000);
const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let essai = 0; essai < 150 && !condition(); essai += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
  }
};
const monter = async (/** @type {(lus: string[]) => boolean} */ pret) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <ClubSlotRequests />
      </QueryClientProvider>,
    );
  });
  await attendre(() => pret(textes(arbre)));
  return arbre;
};

beforeEach(() => {
  mockDimensions = {
    fontScale: 1, height: 812, scale: 2, width: 375,
  };
  mockLignes = [EN_ATTENTE, ACCEPTEE, REFUSEE, SERIE];
  mockRouteParams = {};
  mockGet.mockReset();
  mockNavigate.mockReset();
  mockSetOptions.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ url, /** @type {any} */ config) => {
    if (url === '/facility-override-requests/sent' && config?.params?.clubId === 'club-A') {
      return { data: { data: mockLignes } };
    }
    throw new Error(`GET inattendu ${url}`);
  });
});

describe('COLL-C3B — « Tes demandes à la Ville »', () => {
  it('la réponse et le mot de la mairie, au même endroit ; une série sur une ligne', async () => {
    const lus = textes(await monter((l) => l.includes('Acceptée')));
    expect(lus).toEqual(expect.arrayContaining([
      'Tes demandes à la Ville',
      'U13 · Gymnase des Tilleuls',
      'En attente',
      `${MOMENT} · c’était complet à l’envoi`,
      'Acceptée',
      '« Accord de la mairie, bon entraînement ! »',
      'Refusée',
      `${MOMENT} · l’entraînement est annulé`,
      '« Gymnase complet le 8 octobre »',
      // eslint-disable-next-line max-len
      `Chaque jeudi, ${heure(SERIE.requestedStart)} – ${heure(SERIE.requestedEnd)}, jusqu’au 30 juin · c’était complet à l’envoi`,
    ]));
  });

  it('un refus propose « Demander une autre heure » : le formulaire, prérempli', async () => {
    const arbre = await monter((l) => l.includes('Refusée'));
    // eslint-disable-next-line max-len
    const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'bouton-Demander une autre heure'
      && typeof n.props?.onPress === 'function')[0];
    await act(async () => { bouton.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ClubSlotRequest', {
      clubId: 'club-A', facilityId: 'gym-ville', teamId: 'u15',
    });
  });

  it('vide : une phrase, et « Demander un créneau »', async () => {
    mockLignes = [];
    // eslint-disable-next-line max-len
    const lus = textes(await monter((l) => l.includes('Aucune demande envoyée à une Ville pour l’instant.')));
    expect(lus).toContain('Demander un créneau');
  });

  // eslint-disable-next-line max-len
  it('sur ordinateur : un tableau — équipe, installation, moment, réponse, mot de la mairie', async () => {
    mockDimensions = {
      fontScale: 1, height: 900, scale: 1, width: 1280,
    };
    const arbre = await monter((l) => l.includes('Mot de la mairie'));
    // eslint-disable-next-line max-len
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'demandes-tableau').length).toBeGreaterThan(0);
    // eslint-disable-next-line max-len
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Équipe', 'Installation', 'Moment', 'Réponse', 'Mot de la mairie']));
  });
});

// 🚪 FINITIONS12-COLL (03/10) — point 4 : LA RÉPONSE DE LA VILLE OUVRE LA DEMANDE. Tournée T11 : la
// notification de refus ouvrait l'entraînement annulé (écran rose). Le serveur envoie désormais
// `ctaRoute: 'ClubSlotRequests'`, `ctaParams: { clubId, requestId }` (maquette P8v3-notifs,
// état 2) ;
// l'écran met CETTE demande en tête, signalée, avec le refus et son motif. ROUGE avant le lot.
describe('FINITIONS12-COLL point 4 — la réponse de la Ville ouvre la demande', () => {
  it('la notification de refus mène ici, pas à l’entraînement annulé', () => {
    // eslint-disable-next-line global-require, max-len
    const { resolveNotificationDestination } = require('@/utils/notifications/notificationNavigation');
    const destination = resolveNotificationDestination({
      ctaParams: { clubId: 'club-A', requestId: 'rq-3' },
      ctaRoute: 'ClubSlotRequests',
      decision: 'refused',
      eventId: 'ev-annule',
      type: 'overbookingRequest',
    });
    expect(destination).toEqual({
      params: { clubId: 'club-A', requestId: 'rq-3' },
      route: 'ClubSlotRequests',
    });
  });

  // eslint-disable-next-line max-len
  it('ouverte sur une demande : celle-ci en tête, signalée, avec le refus et son motif', async () => {
    mockRouteParams = { clubId: 'club-A', requestId: 'rq-3' };
    const arbre = await monter((l) => l.includes('Refusée'));
    const cartes = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.testID === 'string'
      && n.props.testID.startsWith('demande-envoyee-') && n.type === View);
    expect(cartes[0].props.testID).toBe('demande-envoyee-ouverte');
    const dans = textes({ root: cartes[0] });
    expect(dans).toEqual(expect.arrayContaining(['Refusée', '« Gymnase complet le 8 octobre »']));
  });
});

// 🎨 FINITIONS13-COLL (04/10) — point 8, deux retouches vues par la T13 (C2_4a…4e). ROUGES avant.
describe('FINITIONS13-COLL point 8 — « Tes demandes à la Ville »', () => {
  it('le titre s’écrit UNE fois : la page le porte, l’en-tête de navigation se tait', async () => {
    const lus = textes(await monter((l) => l.includes('Acceptée')));
    expect(lus.filter((texte) => texte === 'Tes demandes à la Ville')).toHaveLength(1);
    expect(mockSetOptions).toHaveBeenCalledWith({ headerTitle: '' });
  });

  it('la date REFUSÉE d’une série dit SA date ; une série refusée, ses dates', async () => {
    const DATE_REFUSEE = ligne({
      decisionReason: 'Date non retenue : la Ville a accepté les autres dates de la série.',
      documentId: 'rq-5',
      isRecurring: true,
      series: { until: '2031-06-30' },
      seriesCount: 1,
      status: 'refused',
    });
    const SERIE_REFUSEE = ligne({
      documentId: 'rq-6',
      isRecurring: true,
      series: { until: '2030-10-03' },
      seriesCount: 3,
      status: 'refused',
    });
    mockLignes = [DATE_REFUSEE, SERIE_REFUSEE];
    const lus = textes(await monter((l) => l.includes('Refusée')));
    expect(lus).toContain(`${MOMENT} · l’entraînement est annulé`);
    // eslint-disable-next-line max-len
    expect(lus).toContain(`Chaque jeudi, ${heure(SERIE_REFUSEE.requestedStart)} – ${heure(SERIE_REFUSEE.requestedEnd)} · 3 dates · l’entraînement est annulé`);
    expect(lus.join(' | ')).not.toMatch(/jusqu’au/);
  });
});

// ⏳ COLL-S-DEMANDE-PERIMEE (12/10, décision d'Adel « 1- A ») — une demande que la Ville n'a pas
// tranchée avant la fin de sa séance EXPIRE (serveur : statut `expired`). ROUGE avant le lot :
// l'écran ne connaissait que trois états et la disait « En attente », en orange, pour toujours.
describe('COLL-S-DEMANDE-PERIMEE — une demande expirée se dit', () => {
  const EXPIREE = ligne({ documentId: 'rq-7', status: 'expired' });
  const SERIE_EXPIREE = ligne({
    documentId: 'rq-8',
    isRecurring: true,
    series: { until: '2030-10-10' },
    seriesCount: 2,
    status: 'expired',
  });
  // Le texte qui dit `texte`, et la couleur que son style lui donne.
  const etiquette = (/** @type {any} */ arbre, /** @type {string} */ texte) => arbre.root
    .findAllByType(Text)
    .find((/** @type {any} */ n) => aplatir(n.props.children).trim() === texte);
  const couleurDe = (/** @type {any} */ noeud) => [].concat(noeud.props.style).reduce(
    (/** @type {any} */ c, /** @type {any} */ s) => (s && s.color ? s.color : c),
    null,
  );

  it('« Expirée », en gris, et « non traitée à temps » après le moment', async () => {
    mockLignes = [EXPIREE];
    const arbre = await monter((l) => l.includes('Expirée'));
    expect(textes(arbre)).toContain(`${MOMENT} · non traitée à temps`);
    expect(textes(arbre)).not.toContain('En attente');
    // eslint-disable-next-line global-require
    const couleurs = require('@/theme/colors').default();
    expect(couleurDe(etiquette(arbre, 'Expirée'))).toBe(couleurs.neutral300);
  });

  it('une série expirée dit SES dates, jamais « jusqu’au »', async () => {
    mockLignes = [SERIE_EXPIREE];
    const lus = textes(await monter((l) => l.includes('Expirée')));
    // eslint-disable-next-line max-len
    expect(lus).toContain(`Chaque jeudi, ${heure(SERIE_EXPIREE.requestedStart)} – ${heure(SERIE_EXPIREE.requestedEnd)} · 2 dates · non traitée à temps`);
    expect(lus.join(' | ')).not.toMatch(/jusqu’au/);
  });

  it('sur ordinateur, la colonne « Réponse » dit « Expirée »', async () => {
    mockDimensions = {
      fontScale: 1, height: 900, scale: 1, width: 1280,
    };
    mockLignes = [EXPIREE];
    const lus = textes(await monter((l) => l.includes('Mot de la mairie')));
    expect(lus).toContain('Expirée');
  });

  it('l’avis « Demande non traitée à temps » ouvre CETTE demande', () => {
    // eslint-disable-next-line global-require, max-len
    const { resolveNotificationDestination } = require('@/utils/notifications/notificationNavigation');
    expect(resolveNotificationDestination({
      ctaParams: { clubId: 'club-A', requestId: 'rq-7' },
      ctaRoute: 'ClubSlotRequests',
      decision: 'expired',
      dedupeKey: 'overbookingRequest:expired:rq-7',
      eventId: 'ev-expire',
      type: 'overbookingRequest',
    })).toEqual({ params: { clubId: 'club-A', requestId: 'rq-7' }, route: 'ClubSlotRequests' });
  });
});
