import { Alert, Text, TextInput } from 'react-native';
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

// Point 4 — « Refuser » ne part plus SANS motif possible : une feuille nomme l enfant, offre un
// champ « Motif (facultatif) » (500 caracteres, plafond du serveur), et le motif voyage dans
// `{ data: { reason } }` — le parent le lit sous l evenement et sur la fiche de l enfant.
describe('PAR-L11c point 4 — le motif saisi au refus', () => {
  const MARYLINE = { firstname: 'Maryline', lastname: 'Monroe' };
  const champDuMotif = () => arbre.root.findAll((node) => node.type === TextInput)[0];

  beforeEach(() => {
    mockRows.current = [{
      child: { age: 9, firstname: 'Anissa' },
      documentId: 'r-1',
      parent: MARYLINE,
      status: 'pending',
    }];
  });

  test('🔴 « Refuser » ouvre une feuille qui nomme l enfant, avec un champ motif', () => {
    render(<EventChildRegistrationsForOrganizer eventId="evt-1" />);

    press('Refuser');

    expect(getByText("Refuser l'inscription pour Anissa ?")).toBeTruthy();
    expect(getByText('Le parent verra ce motif.')).toBeTruthy();
    expect(getByText('Motif (facultatif)')).toBeTruthy();
    expect(champDuMotif().props.maxLength).toBe(500);
    expect(mockDecide).not.toHaveBeenCalled();
  });

  test('🔴 le motif saisi part avec le refus ; la feuille se ferme', async () => {
    mockDecide.mockResolvedValue({});
    render(<EventChildRegistrationsForOrganizer eventId="evt-1" />);

    press('Refuser');
    act(() => { champDuMotif().props.onChangeText('  Groupe complet  '); });
    await pressAsync("Refuser l'inscription");

    expect(mockDecide).toHaveBeenCalledWith({
      decision: 'refuse', reason: 'Groupe complet', registrationId: 'r-1',
    });
    expect(queryByText("Refuser l'inscription pour Anissa ?")).toBeNull();
  });

  test('sans motif, le refus part quand meme (le motif est facultatif)', async () => {
    mockDecide.mockResolvedValue({});
    render(<EventChildRegistrationsForOrganizer eventId="evt-1" />);

    press('Refuser');
    await pressAsync("Refuser l'inscription");

    expect(mockDecide).toHaveBeenCalledWith({
      decision: 'refuse', reason: '', registrationId: 'r-1',
    });
  });

  test('un refus du serveur reste DANS la feuille, le motif saisi n est pas perdu', async () => {
    mockDecide.mockRejectedValue({ details: { code: 'NOT_PENDING' }, status: 400 });
    render(<EventChildRegistrationsForOrganizer eventId="evt-1" />);

    press('Refuser');
    act(() => { champDuMotif().props.onChangeText('Groupe complet'); });
    await pressAsync("Refuser l'inscription");

    expect(getByText('Cette demande a déjà été traitée.')).toBeTruthy();
    expect(getByText("Refuser l'inscription pour Anissa ?")).toBeTruthy();
    expect(champDuMotif().props.value).toBe('Groupe complet');
  });

  test('« Annuler » referme la feuille, rien ne part', () => {
    render(<EventChildRegistrationsForOrganizer eventId="evt-1" />);

    press('Refuser');
    press('Annuler');

    expect(queryByText("Refuser l'inscription pour Anissa ?")).toBeNull();
    expect(mockDecide).not.toHaveBeenCalled();
  });
});

// Point 5 — le rappel en tete de « Qui inscris-tu ? » montre la CATEGORIE (design planche 9 :
// « Détection U11 · lun. 12/10 ») ; « la catégorie est montrée, rien n'est bloqué ». La
// categorie est celle de l equipe organisatrice, lue comme l en-tete de l evenement
// (EventHeader.js : `event.team.category.name`).
describe('PAR-L11c point 5 — la categorie dans le rappel en tete', () => {
  const DATE = /\d{2}\/\d{2}\/\d{4}$/;

  test('🔴 « type · categorie · date »', () => {
    render(<EventChildRegistration
      event={evenement("Détection / Séance d'essai", { team: { category: { name: 'U11' } } })}
    />);
    press('Inscrire mes enfants');

    const rappel = getByText(/^Détection \/ Séance d'essai · U11 · /);
    expect(rappel).toMatch(DATE);
  });

  test('sans categorie : « type · date », comme avant', () => {
    render(<EventChildRegistration event={evenement("Détection / Séance d'essai")} />);
    press('Inscrire mes enfants');

    const rappel = getByText(/^Détection \/ Séance d'essai · /);
    expect(rappel).toMatch(new RegExp(`^Détection / Séance d'essai · ${DATE.source}`));
  });

  test('la categorie ne bloque rien : un enfant de 7 ans reste cochable sur un U11', () => {
    render(<EventChildRegistration
      event={evenement('Détection', { team: { category: { name: 'U11' } } })}
    />);
    press('Inscrire mes enfants');

    expect(byTestId('child-registration-unavailable-martin')).toHaveLength(0);
    expect(getByText('Martin · 7 ans')).toBeTruthy();
  });
});
