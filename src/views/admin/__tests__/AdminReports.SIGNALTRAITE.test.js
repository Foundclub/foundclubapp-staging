import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminReports from '../AdminReports';

// 🚩 SIGNALTRAITE (décision 8 d'Adel, option A, 25/10/2026) — l'écran « Signalements » du
// SuperAdmin. Avant le lot, aucun signalement ne pouvait être traité : la pastille ne
// redescendait jamais. Ce témoin fige :
//   - CARACTÉRISATION (le comportement d'avant, gardé) : la cible, la source, le motif, l'auteur ;
//     le filtre « Source » ; la liste vide ;
//   - le filtre « À traiter / Traités », qui demande au SERVEUR la bonne liste ;
//   - « Marquer traité » sur un signalement à traiter, et seulement sur lui ;
//   - un signalement traité dit quand, et par qui.

/** @type {any[]} */
let mockReports;
/** @type {any[]} */
const mockReportsCalls = [];
const mockMarquer = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});

jest.mock('i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    __esModule: true,
    default: {
      language: 'fr',
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, segment) => (noeud == null ? undefined : noeud[segment]),
          catalogue,
        );
        return typeof valeur === 'string' ? valeur : String(repli);
      },
    },
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

jest.mock('@/services/admin/adminQueries', () => ({
  useGetAdminReports: (/** @type {any} */ ...args) => {
    mockReportsCalls.push(args);
    return {
      data: { data: mockReports }, error: null, isLoading: false, refetch: jest.fn(),
    };
  },
  useMarkReportTreated: () => ({ isPending: false, mutateAsync: mockMarquer }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/views/admin/components/AdminStateView', () => function AdminStateViewMock() {
  return null;
});

const signalementEvenement = {
  authorLabel: 'Léa Martin',
  createdAt: '2026-10-20T10:00:00.000Z',
  documentId: 'rep-evt',
  message: 'Horaire faux',
  source: 'event',
  status: 'pending',
  targetDocumentId: 'evt-1',
  targetKind: 'event',
  targetLabel: 'Match U13',
};
const signalementMessage = {
  authorLabel: 'Hugo Petit',
  createdAt: '2026-10-21T10:00:00.000Z',
  documentId: 'rep-msg',
  message: 'Insulte',
  source: 'message',
  status: 'pending',
  targetDocumentId: 'chat-1',
  targetKind: 'conversation',
  targetLabel: 'Conversation avec Hugo',
};

/**
 * Tous les textes affichés, bout à bout.
 * @param {any} arbre - Le rendu.
 * @returns {string} Les textes.
 */
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
  .join(' | ');

/**
 * Appuie sur la pastille de filtre qui porte ce libellé.
 * @param {any} arbre - Le rendu.
 * @param {string} libelle - Le libellé de la pastille.
 */
const appuyerSurPastille = (arbre, libelle) => {
  const texte = arbre.root.findAllByType(Text)
    .find((/** @type {any} */ noeud) => [].concat(noeud.props.children).join('') === libelle);
  if (!texte) throw new Error(`pastille absente : ${libelle}`);
  let noeud = texte;
  while (noeud && typeof noeud.props.onPress !== 'function') noeud = noeud.parent;
  act(() => { noeud.props.onPress(); });
};

/**
 * Les boutons « Marquer traité » affichés.
 * @param {any} arbre - Le rendu.
 * @returns {any[]} Les boutons.
 */
const boutonsMarquer = (arbre) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.props.testID === 'bouton-Marquer traité');

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdminReports />); });
  return arbre;
};

beforeEach(() => {
  mockReports = [signalementEvenement, signalementMessage];
  mockReportsCalls.length = 0;
  mockMarquer.mockReset();
  mockMarquer.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// CARACTÉRISATION — ce que l'écran faisait déjà, et qui reste
// ---------------------------------------------------------------------------

test('C1 — chaque signalement montre sa cible, sa source, son motif et son auteur', () => {
  const arbre = rendre();
  const vu = textes(arbre);
  expect(vu).toContain('Match U13');
  expect(vu).toContain('Horaire faux');
  expect(vu).toContain('Léa Martin');
  expect(vu).toContain('Conversation avec Hugo');
  expect(vu).toContain('Insulte');
  expect(vu).toContain('2 signalement(s) affiché(s)');
});

test('C2 — le filtre Source « Messages » ne garde que les messages', () => {
  const arbre = rendre();
  appuyerSurPastille(arbre, 'Messages');
  const vu = textes(arbre);
  expect(vu).not.toContain('Match U13');
  expect(vu).toContain('Conversation avec Hugo');
  expect(vu).toContain('1 signalement(s) affiché(s)');
});

test('C3 — sans signalement, la liste vide le dit', () => {
  mockReports = [];
  const arbre = rendre();
  expect(textes(arbre)).toContain('Aucun signalement à traiter');
});

// ---------------------------------------------------------------------------
// SIGNALTRAITE — « À traiter / Traités » et « Marquer traité »
// ---------------------------------------------------------------------------

test('T1 — l écran s ouvre sur « À traiter » et demande au serveur cette liste', () => {
  const arbre = rendre();
  const vu = textes(arbre);
  expect(vu).toContain('À traiter');
  expect(vu).toContain('Traités');
  // Les anciens statuts « Résolus » / « Refusés » n existent pas côté serveur : ils partent.
  expect(vu).not.toContain('Refusés');
  expect(mockReportsCalls[mockReportsCalls.length - 1]).toEqual([{ treated: false }]);
});

test('T2 — « Traités » demande au serveur les signalements traités', () => {
  const arbre = rendre();
  appuyerSurPastille(arbre, 'Traités');
  expect(mockReportsCalls[mockReportsCalls.length - 1]).toEqual([{ treated: true }]);
});

test('T3 — « Marquer traité » envoie le signalement et sa source', async () => {
  const arbre = rendre();
  const boutons = boutonsMarquer(arbre);
  expect(boutons).toHaveLength(2);
  await act(async () => { boutons[1].props.onPress(); });
  expect(mockMarquer).toHaveBeenCalledWith({ documentId: 'rep-msg', source: 'message' });
});

test('T4 — un signalement traité dit quand et par qui, sans bouton « Marquer traité »', () => {
  mockReports = [{
    ...signalementEvenement,
    status: 'resolved',
    treatedAt: '2026-10-24T09:30:00.000Z',
    treatedByLabel: 'Adel F.',
  }];
  const arbre = rendre();
  const vu = textes(arbre);
  expect(vu).toContain('Traité');
  expect(vu).toContain('Adel F.');
  expect(boutonsMarquer(arbre)).toHaveLength(0);
});
