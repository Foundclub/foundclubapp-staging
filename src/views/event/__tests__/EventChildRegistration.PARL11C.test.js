import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventChildRegistration, {
  EventChildRegistrationsForOrganizer,
} from '../components/EventChildRegistration';

// 👪 PAR-L11c (14/10) — LES CINQ RESTES DE « INSCRIRE MES ENFANTS » (PAR-012, design parent
// planche 9), A L ECRAN : annuler une inscription (point 1), le motif saisi au refus (point 4),
// la categorie dans le rappel en tete (point 5). Meme banc que EventChildRegistration.PARL11 :
// vraie fr.js, vrai theme, services doubles.
// ⏳ Dates relatives a aujourd hui (garde-fou `temoins:horloge`).

const mockChildren = { current: [] };
const mockMine = { current: [] };
const mockRows = { current: [] };
const mockRegister = jest.fn();
const mockDecide = jest.fn();
const mockCancel = jest.fn();

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: mockChildren.current }),
}));
jest.mock('@/services/eventChildRegistration/eventChildRegistrationQueries', () => ({
  useCancelChildRegistration: () => ({ isPending: false, mutate: mockCancel }),
  useDecideChildRegistration: () => ({ isPending: false, mutateAsync: mockDecide }),
  useEventChildRegistrations: () => ({ data: mockRows.current }),
  useMyChildRegistrations: () => ({ data: mockMine.current }),
  useRegisterChildren: () => ({ isPending: false, mutateAsync: mockRegister }),
}));
jest.mock('react-i18next', () => {
  const i18next = jest.requireActual('i18next');
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({ t: (key, options) => i18next.t(key, options) }),
  };
});
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});
jest.mock('@/components/atoms/checkable/Checkable', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function CheckableDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityState: { checked: props.isChecked },
        onPress: () => props.setIsChecked(!props.isChecked),
      },
      react.createElement(rn.Text, null, props.text),
    );
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return react.createElement(
      rn.View,
      null,
      props.headerComponent,
      props.children,
      props.footerComponent,
    );
  };
});

const JOUR = 24 * 3600 * 1000;
const DANS_UNE_SEMAINE = new Date(Date.now() + 7 * JOUR).toISOString();
const HIER = new Date(Date.now() - JOUR).toISOString();
const evenement = (typeName, extra = {}) => ({
  club: { name: 'FC Test' },
  date: DANS_UNE_SEMAINE,
  documentId: 'evt-1',
  eventFormat: 'single',
  isActive: true,
  sessionStatus: 'open',
  type: { name: typeName },
  ...extra,
});
const DETECTION = evenement("Détection / Séance d'essai", { name: 'Détection U11' });
const ligne = (prenom, status, extra = {}) => ({
  child: { documentId: prenom.toLowerCase(), firstname: prenom },
  documentId: `r-${prenom.toLowerCase()}`,
  event: { date: DANS_UNE_SEMAINE, documentId: 'evt-1', name: 'Détection U11' },
  status,
  ...extra,
});

/** @type {any} */
let arbre = null;
const render = (element) => {
  act(() => { arbre = renderer.create(element); });
};
const texteDe = (node) => [].concat(node.props.children)
  .filter((part) => typeof part === 'string' || typeof part === 'number')
  .join('');
const textes = () => arbre.root.findAll((node) => node.type === Text).map(texteDe);
const queryByText = (attendu) => {
  const trouve = textes().find((texte) => (
    attendu instanceof RegExp ? attendu.test(texte) : texte === attendu
  ));
  return trouve === undefined ? null : trouve;
};
const getByText = (attendu) => {
  const trouve = queryByText(attendu);
  if (trouve === null) {
    throw new Error(`texte absent : ${attendu}\nA l ecran : ${textes().join(' | ')}`);
  }
  return trouve;
};
const getAllByText = (attendu) => textes().filter((texte) => texte === attendu);
const pressables = (attendu) => arbre.root.findAll((node) => node.type === Text)
  .filter((node) => texteDe(node) === attendu)
  .map((node) => {
    let courant = node;
    while (courant && typeof courant.props?.onPress !== 'function') courant = courant.parent;
    return courant;
  })
  .filter(Boolean);
const press = (attendu, rang = 0) => {
  getByText(attendu);
  const cible = pressables(attendu)[rang];
  if (!cible) throw new Error(`rien a presser pour : ${attendu}`);
  if (cible.props.disabled) return;
  act(() => { cible.props.onPress(); });
};
const pressAsync = async (attendu, rang = 0) => {
  getByText(attendu);
  const cible = pressables(attendu)[rang];
  if (!cible) throw new Error(`rien a presser pour : ${attendu}`);
  await act(async () => { await cible.props.onPress(); });
};
const byTestId = (testID) => arbre.root.findAll((node) => node.props?.testID === testID);

beforeEach(() => {
  mockChildren.current = [
    { age: 9, documentId: 'anissa', firstname: 'Anissa' },
    { age: 7, documentId: 'martin', firstname: 'Martin' },
  ];
  mockMine.current = [];
  mockRows.current = [];
  mockRegister.mockReset();
  mockDecide.mockReset();
  mockCancel.mockReset();
});

describe('PAR-L11c point 1 — annuler une inscription, sous l evenement', () => {
  test('en attente ou confirmee : « Annuler l inscription » ; refusee : rien', () => {
    mockMine.current = [
      ligne('Anissa', 'pending'),
      ligne('Martin', 'accepted'),
      ligne('Sami', 'declined', { reason: 'Groupe complet' }),
    ];
    render(<EventChildRegistration event={DETECTION} />);

    expect(getAllByText("Annuler l'inscription")).toHaveLength(2);
    expect(byTestId('child-registration-cancel-r-anissa')).not.toHaveLength(0);
    expect(byTestId('child-registration-cancel-r-martin')).not.toHaveLength(0);
    expect(byTestId('child-registration-cancel-r-sami')).toHaveLength(0);
  });

  test('evenement passe : aucun lien d annulation', () => {
    mockMine.current = [ligne('Anissa', 'pending', {
      event: { date: HIER, documentId: 'evt-1', name: 'Détection U11' },
    })];
    render(<EventChildRegistration event={evenement('Détection', { date: HIER })} />);

    expect(queryByText("Annuler l'inscription")).toBeNull();
  });

  test('la feuille nomme l enfant ET l evenement ; « Garder l inscription » n envoie rien', () => {
    mockMine.current = [ligne('Anissa', 'pending')];
    render(<EventChildRegistration event={DETECTION} />);

    press("Annuler l'inscription");
    expect(getByText("Annuler l'inscription pour Anissa ?")).toBeTruthy();
    expect(getByText(/« Détection U11 »/)).toBeTruthy();

    press("Garder l'inscription");
    expect(queryByText("Annuler l'inscription pour Anissa ?")).toBeNull();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  test('confirmer : la route part avec la ligne, le bandeau dit « Inscription annulée. »', () => {
    mockCancel.mockImplementation((_row, { onSuccess }) => onSuccess());
    mockMine.current = [ligne('Anissa', 'pending')];
    render(<EventChildRegistration event={DETECTION} />);

    press("Annuler l'inscription");
    // Le lien de la ligne, puis le bouton Danger de la feuille : meme libelle, le 2e.
    press("Annuler l'inscription", 1);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel.mock.calls[0][0])
      .toEqual(expect.objectContaining({ documentId: 'r-anissa' }));
    expect(getByText('Inscription annulée.')).toBeTruthy();
    expect(getByText('Tu peux inscrire Anissa de nouveau.')).toBeTruthy();
  });

  test('serveur sans la route : « L annulation n est pas encore disponible. »', () => {
    mockCancel.mockImplementation((_row, { onError }) => onError({
      message: 'Not Found', name: 'NotFoundError', status: 404,
    }));
    mockMine.current = [ligne('Anissa', 'pending')];
    render(<EventChildRegistration event={DETECTION} />);

    press("Annuler l'inscription");
    press("Annuler l'inscription", 1);

    expect(getByText("L'annulation n'est pas encore disponible.")).toBeTruthy();
  });

  test('deja effacee ailleurs : « Cette inscription n existe plus. »', () => {
    mockCancel.mockImplementation((_row, { onError }) => onError({
      message: 'Registration not found', name: 'NotFoundError', status: 404,
    }));
    mockMine.current = [ligne('Anissa', 'accepted')];
    render(<EventChildRegistration event={DETECTION} />);

    press("Annuler l'inscription");
    press("Annuler l'inscription", 1);

    expect(getByText("Cette inscription n'existe plus.")).toBeTruthy();
  });

  test('pas de reseau : l echec se dit, « Réessayer » relance la meme ligne', () => {
    mockCancel.mockImplementation((_row, { onError }) => onError('Network Error'));
    mockMine.current = [ligne('Anissa', 'pending')];
    render(<EventChildRegistration event={DETECTION} />);

    press("Annuler l'inscription");
    press("Annuler l'inscription", 1);
    expect(getByText("L'inscription n'a pas pu être annulée.")).toBeTruthy();

    press('Réessayer');
    expect(mockCancel).toHaveBeenCalledTimes(2);
    expect(mockCancel.mock.calls[1][0])
      .toEqual(expect.objectContaining({ documentId: 'r-anissa' }));
  });
});

// Point 3 — la liste de l organisateur sert AUSSI le site (EventDetails.web.js) : une
// erreur se dit DANS le bloc, jamais par `Alert` (sur le site, une fenetre systeme).
describe('PAR-L11c point 3 — chez l organisateur, sur le telephone comme sur le site', () => {
  const MARYLINE = { firstname: 'Maryline', lastname: 'Monroe' };

  test('🔴 un refus du serveur s ecrit sous la ligne, sans fenetre systeme', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRows.current = [{
      child: { age: 9, firstname: 'Anissa' },
      documentId: 'r-1',
      parent: MARYLINE,
      status: 'pending',
    }];
    mockDecide.mockRejectedValue({ details: { code: 'FULL' }, status: 400 });
    render(<EventChildRegistrationsForOrganizer eventId="evt-1" />);

    await pressAsync('Accepter');

    expect(alerte).not.toHaveBeenCalled();
    expect(byTestId('child-registration-error-r-1')).not.toHaveLength(0);
    expect(getByText('Plus de place.')).toBeTruthy();
    alerte.mockRestore();
  });
});
