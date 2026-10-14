import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventChildRegistration, {
  EventChildRegistrationsForOrganizer,
} from '../components/EventChildRegistration';

// 👪 PAR-L11b (13/10) — « INSCRIRE MES ENFANTS » (PAR-012, D4 B d Adel du 12/10), A L ECRAN.
// Le parcours de la planche 9 du design parent : le bouton, la feuille « Qui inscris-tu ? »
// a choix MULTIPLE (les enfants qu on ne peut pas cocher sont montres avec leur raison), le
// recapitulatif, puis le resultat ENFANT PAR ENFANT ; et chez l organisateur, « Anissa,
// 9 ans » et « Parent : Maryline Monroe ».
// ⏳ Dates relatives a aujourd hui (garde-fou `temoins:horloge`).

const mockChildren = { current: [] };
const mockMine = { current: [] };
const mockRows = { current: [] };
const mockRegister = jest.fn();
const mockDecide = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: mockChildren.current }),
}));
jest.mock('@/services/eventChildRegistration/eventChildRegistrationQueries', () => ({
  // PAR-L11c (14/10) : le bloc sait annuler (temoin : EventChildRegistration.PARL11C.test.js).
  useCancelChildRegistration: () => ({ isPending: false, mutate: jest.fn() }),
  useDecideChildRegistration: () => ({ isPending: false, mutateAsync: mockDecide }),
  useEventChildRegistrations: () => ({ data: mockRows.current }),
  useMyChildRegistrations: () => ({ data: mockMine.current }),
  useRegisterChildren: () => ({ isPending: false, mutateAsync: mockRegister }),
}));
// Les VRAIS textes : `jest.setup.js` demarre i18next en francais sur la vraie `fr.js` ;
// `useTranslation` y est branche ici (interpolation et pluriel compris).
jest.mock('react-i18next', () => {
  const i18next = jest.requireActual('i18next');
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({ t: (key, options) => i18next.t(key, options) }),
  };
});
// Le VRAI theme : un jeton mal nomme casse ce temoin.
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
// La vraie case charge `react-native-bouncy-checkbox` (ESM pur, hors Babel) : meme doublure
// que les temoins d AutocompleteSelect, une case pressable qui montre son texte.
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
const RESPONSABILITE = 'Je déclare avoir pris connaissance de la '
  + '"Déclaration de responsabilité et acceptation des risques"';
const CONDITIONS = "J'accepte les conditions pour participer à l'événement";
const evenement = (typeName, extra = {}) => ({
  club: { name: 'FC Test' },
  date: new Date(Date.now() + 7 * JOUR).toISOString(),
  documentId: 'evt-1',
  eventFormat: 'single',
  isActive: true,
  sessionStatus: 'open',
  type: { name: typeName },
  ...extra,
});
const DETECTION = evenement("Détection / Séance d'essai");

/** @type {any} */
let arbre = null;
const render = (element) => {
  act(() => { arbre = renderer.create(element); });
  return { rerender: (suivant) => act(() => arbre.update(suivant)) };
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
// Le premier element pressable qui CONTIENT ce texte (le Text, puis ses parents).
const pressable = (attendu) => {
  getByText(attendu);
  let courant = arbre.root.findAll((node) => node.type === Text)
    .find((node) => texteDe(node) === attendu);
  while (courant && typeof courant.props?.onPress !== 'function') courant = courant.parent;
  if (!courant) throw new Error(`rien a presser pour : ${attendu}`);
  return courant;
};
const press = (attendu) => {
  const cible = pressable(attendu);
  if (cible.props.disabled) return;
  act(() => { cible.props.onPress(); });
};
const pressAsync = async (attendu) => {
  const cible = pressable(attendu);
  await act(async () => { await cible.props.onPress(); });
};
const cocherLesDeclarations = () => {
  press(RESPONSABILITE);
  press(CONDITIONS);
};

beforeEach(() => {
  mockChildren.current = [
    { age: 9, documentId: 'anissa', firstname: 'Anissa' },
    { age: 7, documentId: 'martin', firstname: 'Martin' },
    { age: 14, documentId: 'lina', firstname: 'Lina' },
  ];
  mockMine.current = [];
  mockRows.current = [];
  mockRegister.mockReset();
  mockDecide.mockReset();
  mockNavigate.mockReset();
});

describe('PAR-L11b — le parent inscrit ses enfants', () => {
  test('detection : choix multiple, recapitulatif, UNE ligne de resultat par enfant', async () => {
    mockRegister.mockResolvedValue({
      admission: 'request',
      results: [
        { child: 'anissa', firstname: 'Anissa', outcome: 'pending' },
        {
          child: 'martin', code: 'FULL', firstname: 'Martin', outcome: 'refused',
        },
      ],
    });
    render(<EventChildRegistration event={DETECTION} />);

    press('Inscrire mes enfants');
    expect(getByText('Qui inscris-tu ?')).toBeTruthy();
    // Lina (14 ans) est MONTREE, avec sa raison, et ne se coche pas.
    expect(getByText("À partir de 13 ans, Lina s'inscrit depuis son propre compte.")).toBeTruthy();

    press('Anissa · 9 ans');
    press('Martin · 7 ans');
    cocherLesDeclarations();
    press('Continuer (2)');

    expect(getByText('Récapitulatif')).toBeTruthy();
    expect(getByText("L'organisateur valide chaque inscription.")).toBeTruthy();
    await pressAsync('Envoyer 2 inscriptions');

    expect(mockRegister).toHaveBeenCalledWith(['anissa', 'martin']);
    expect(getByText("Anissa — demande envoyée, en attente de l'organisateur")).toBeTruthy();
    expect(getByText('Martin — plus de place')).toBeTruthy();
  });

  test('sans les deux declarations cochees, « Continuer » ne mene nulle part', () => {
    render(<EventChildRegistration event={DETECTION} />);
    press('Inscrire mes enfants');
    press('Anissa · 9 ans');
    press('Continuer (1)');

    expect(queryByText('Récapitulatif')).toBeNull();
  });

  test('reservation qui recrute : « Inscription immediate : une place par enfant »', () => {
    const resa = evenement('Réservation', { missingPlayers: 2, reservationMode: 'RECRUITING' });
    render(<EventChildRegistration event={resa} />);
    press('Inscrire mes enfants');
    press('Anissa · 9 ans');
    cocherLesDeclarations();
    press('Continuer (1)');

    expect(getByText('Inscription immédiate : une place par enfant.')).toBeTruthy();
    expect(getByText('Envoyer 1 inscription')).toBeTruthy();
  });

  test('tournoi et match amical : PAS de bouton, une phrase qui dit pourquoi', () => {
    const { rerender } = render(<EventChildRegistration event={evenement('Tournoi')} />);
    expect(queryByText('Inscrire mes enfants')).toBeNull();
    expect(getByText(/^Ce tournoi inscrit des équipes/)).toBeTruthy();

    rerender(<EventChildRegistration event={evenement('Match amical')} />);
    expect(queryByText('Inscrire mes enfants')).toBeNull();
    expect(getByText(/^Ce match amical oppose des équipes/)).toBeTruthy();
  });

  test('evenement ferme : « Reserve aux equipes invitees »', () => {
    render(<EventChildRegistration event={evenement('Match', { sessionStatus: 'closed' })} />);
    expect(queryByText('Inscrire mes enfants')).toBeNull();
    expect(getByText('Réservé aux équipes invitées.')).toBeTruthy();
  });

  test('a la reouverture, l etat de chaque enfant ; un enfant en attente ne se coche plus', () => {
    mockMine.current = [
      {
        child: { documentId: 'anissa', firstname: 'Anissa' },
        documentId: 'r-1',
        status: 'pending',
      },
      {
        child: { documentId: 'martin', firstname: 'Martin' },
        documentId: 'r-2',
        reason: 'Groupe complet',
        status: 'declined',
      },
    ];
    render(<EventChildRegistration event={DETECTION} />);

    expect(getByText("Anissa — en attente de l'organisateur")).toBeTruthy();
    expect(getByText('Martin — demande refusée : Groupe complet')).toBeTruthy();

    press('Inscrire mes enfants');
    expect(getByText("Demande déjà envoyée, en attente de l'organisateur.")).toBeTruthy();
    // Martin, refuse, peut etre redemande.
    expect(getByText('Martin · 7 ans')).toBeTruthy();
  });

  test('sans enfant declare : la feuille renvoie vers « Mes enfants »', () => {
    mockChildren.current = [];
    render(<EventChildRegistration event={DETECTION} navigation={{ navigate: mockNavigate }} />);
    press('Inscrire mes enfants');
    press('Ajouter un enfant');

    expect(mockNavigate).toHaveBeenCalledWith('MyChildren');
  });

  test('un refus du serveur pour l evenement s affiche en clair, la feuille reste', async () => {
    mockRegister.mockRejectedValue({ details: { code: 'INVITED_TEAMS_ONLY' }, status: 400 });
    render(<EventChildRegistration event={DETECTION} />);
    press('Inscrire mes enfants');
    press('Anissa · 9 ans');
    cocherLesDeclarations();
    press('Continuer (1)');
    await pressAsync('Envoyer 1 inscription');

    expect(getByText('Réservé aux équipes invitées.')).toBeTruthy();
    expect(getByText('Récapitulatif')).toBeTruthy();
  });
});

describe('PAR-L11b — chez l organisateur', () => {
  const MARYLINE = { firstname: 'Maryline', lastname: 'Monroe' };

  test('« Anissa, 9 ans », son parent, Accepter / Refuser sur une demande en attente', async () => {
    mockRows.current = [
      {
        child: { age: 9, firstname: 'Anissa' },
        documentId: 'r-1',
        parent: MARYLINE,
        status: 'pending',
      },
      {
        child: { age: 7, firstname: 'Martin' },
        documentId: 'r-2',
        parent: MARYLINE,
        status: 'accepted',
      },
    ];
    mockDecide.mockResolvedValue({});
    render(<EventChildRegistrationsForOrganizer eventId="evt-1" />);

    expect(getByText('Enfants inscrits par leurs parents')).toBeTruthy();
    expect(getByText('Anissa, 9 ans')).toBeTruthy();
    expect(getAllByText('Parent : Maryline Monroe')).toHaveLength(2);
    expect(getByText('Inscription acceptée')).toBeTruthy();

    await pressAsync('Accepter');
    expect(mockDecide).toHaveBeenCalledWith({ decision: 'accept', registrationId: 'r-1' });
  });

  test('aucun enfant inscrit : rien n est affiche', () => {
    render(<EventChildRegistrationsForOrganizer eventId="evt-1" />);
    expect(queryByText('Enfants inscrits par leurs parents')).toBeNull();
  });
});
