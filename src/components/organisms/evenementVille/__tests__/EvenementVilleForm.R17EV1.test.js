import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EvenementDeLaVilleForm from '../EvenementVilleForm';

// 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — « AJOUTER UN ÉVÉNEMENT DE LA VILLE », point 2.
// Planches validées : P10-evenement-tel (le tunnel), P10-evenement-ordi (le panneau, les refus,
// la panne), P11-evenement-v2-tel (« Où ? », « Qui le voit ? » en 3 niveaux, le récapitulatif).
// Ce témoin fige :
//   - le tunnel : 6 étapes dans l'ordre ; 4 depuis une case du planning ; « Ailleurs » saute
//     « Quelle place ? » ; une étape avec un refus ne s'ouvre pas (le refus se dit) ;
//   - le récapitulatif et le corps envoyé (« Qui le voit ? », toute la place ou aucune) ;
//   - « 1 séance touchée » quand l'aperçu du serveur en trouve ;
//   - la panne : la saisie est gardée, « Réessayer » renvoie ;
//   - le panneau : tous les champs, « Annuler » ferme, les refus empêchent l'envoi.

/** @type {any} */
let mockApercu;
const mockDateProps = [];
const mockHeureProps = [];
const mockInputProps = [];

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
      Images: {},
      Spaces: espaces,
    }),
  };
});
// R17-EVT-1-BIS (d) : l'occupation des installations aux heures choisies (lue par le crochet).
/** @type {any} */
let mockOccupations = {};
/** @type {any[]} */
const mockOccupationDemandes = [];
jest.mock('@/services/collectivite/collectiviteEvenementQueries', () => ({
  useApercuEvenement: () => mockApercu,
  useOccupationDesLieux: (/** @type {any[]} */ ...args) => {
    mockOccupationDemandes.push(args);
    return mockOccupations;
  },
}));
jest.mock('@/components/organisms/seasonSlot/SeasonSlotForm', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    PuceDeChoix: (/** @type {any} */ props) => reactActuel.createElement(
      PressableRN,
      {
        accessibilityState: { checked: props.actif },
        onPress: props.onPress,
        testID: props.testID,
      },
      reactActuel.createElement(TexteRN, null, props.libelle),
    ),
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      {
        disabled: props.disabled,
        onPress: props.onPress,
        // Le vrai bouton ne pose aucun testID : on le vise par son libellé.
        testID: props.testID ?? `bouton:${props.title}`,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    mockInputProps.push(props);
    return props.error ? reactActuel.createElement(TexteRN, null, props.error) : null;
  };
});
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock(/** @type {any} */ props) {
    mockDateProps.push(props);
    return null;
  },
);
jest.mock(
  '@/components/molecules/timePickerInput/TimePickerInput',
  () => function TimePickerInputMock(/** @type {any} */ props) {
    mockHeureProps.push(props);
    return null;
  },
);
// R17-EVT-1-BIS (e) : la saisie d'adresse partagée (R17-ADRESSE), doublée : elle garde ses props
// et dit son refus comme le champ texte.
/** @type {any[]} */
const mockAdresseProps = [];
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');
    return function AutocompleteAddressInputMock(/** @type {any} */ props) {
      mockAdresseProps.push(props);
      return props.error ? reactActuel.createElement(TexteRN, null, props.error) : null;
    };
  },
);
// R17-EVT-1-BIS (f) : le choix d'une image et son envoi (comme les pièces des actualités).
/** @type {any} */
let mockImageChoisie = null;
const mockTeleverser = jest.fn();
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { pickImage: async () => mockImageChoisie },
}));
jest.mock('@/services/collectivite/collectiviteActualiteService', () => ({
  uploadActualiteFile: (/** @type {any} */ fichier) => mockTeleverser(fichier),
}));
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN,
    TouchableOpacity: PressableRN,
    View: VueRN,
  } = jest.requireActual('react-native');
  return function WizardStepLayoutMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      VueRN,
      null,
      reactActuel.createElement(TexteRN, { testID: 'tunnel-titre' }, props.title),
      reactActuel.createElement(
        TexteRN,
        { testID: 'tunnel-compte' },
        `${props.stepIndex}/${props.stepCount}`,
      ),
      props.subtitle
        ? reactActuel.createElement(TexteRN, { testID: 'tunnel-sous-titre' }, props.subtitle)
        : null,
      props.children,
      reactActuel.createElement(
        PressableRN,
        { onPress: props.onNext, testID: 'tunnel-suivant' },
        reactActuel.createElement(TexteRN, null, props.nextLabel),
      ),
      props.onBack
        ? reactActuel.createElement(PressableRN, { onPress: props.onBack, testID: 'tunnel-retour' })
        : null,
    );
  };
});

const INSTALLATIONS = [
  { documentId: 'gym', name: 'Gymnase des Tilleuls' },
  { documentId: 'stade', name: 'Stade municipal' },
];

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const touche = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  // Le dernier : une fenêtre ouverte se dessine après l’écran (deux « Annuler l’événement »).
  const noeud = arbre.root.findAllByType(TouchableOpacity)
    .filter((n) => n.props.testID === id)
    .at(-1);
  if (!noeud) throw new Error(`pas de ${id}`);
  return act(async () => {
    await noeud.props.onPress();
  });
};
const titre = (/** @type {any} */ arbre) => aplatir(
  arbre.root.findByProps({ testID: 'tunnel-titre' }).props.children,
);
const dernierInput = (/** @type {string} */ testID) => [...mockInputProps]
  .reverse().find((p) => p.testID === testID);
const derniereDate = (/** @type {string} */ testID) => [...mockDateProps]
  .reverse().find((p) => p.testID === testID);
const dernieresHeures = () => mockHeureProps.slice(-2);

const monter = async (/** @type {any} */ {
  evenement = null,
  initial = null,
  onClose = jest.fn(),
  onPublier = jest.fn(async () => ({ data: { documentId: 'evt-1' } })),
  presentation = 'tunnel',
} = {}) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <EvenementDeLaVilleForm
        collectiviteId="ville-montrivage"
        collectiviteNom="Ville de Montrivage"
        collectiviteVille="Montrivage"
        evenement={evenement}
        initial={initial}
        installations={INSTALLATIONS}
        onClose={onClose}
        onPublier={onPublier}
        presentation={presentation}
      />,
    );
  });
  return arbre;
};

/**
 * Le tunnel rempli jusqu'à « Qui le voit ? » : la Fête du sport, au stade, samedi 24 octobre.
 * @param {any} arbre
 */
const remplirJusquaQui = async (/** @type {any} */ arbre) => {
  await act(async () => {
    dernierInput('evenement-nom').onChangeText('Fête du sport');
  });
  await touche(arbre, 'tunnel-suivant');
  await act(async () => {
    derniereDate('evenement-date').onChange('24/10/2026');
  });
  await act(async () => {
    dernieresHeures()[0].onChange('10:00');
  });
  await act(async () => {
    dernieresHeures()[1].onChange('17:00');
  });
  await touche(arbre, 'tunnel-suivant');
  await touche(arbre, 'evenement-lieu-stade');
  await touche(arbre, 'tunnel-suivant');
  await touche(arbre, 'tunnel-suivant');
};

beforeEach(() => {
  mockApercu = { data: null };
  mockDateProps.length = 0;
  mockHeureProps.length = 0;
  mockInputProps.length = 0;
});

describe('R17-EVT-1 — le tunnel « Ajouter un événement de la Ville »', () => {
  it('6 étapes dans l’ordre ; un nom vide se refuse et l’étape ne s’ouvre pas', async () => {
    const arbre = await monter();
    expect(titre(arbre)).toBe('Quel événement ?');
    expect(textes(arbre)).toContain('1/6');
    expect(textes(arbre)).toContain('Ville de Montrivage');
    await touche(arbre, 'tunnel-suivant');
    expect(titre(arbre)).toBe('Quel événement ?');
    expect(textes(arbre)).toContain('Donnez un nom à l’événement.');
    await remplirJusquaQui(arbre);
    expect(titre(arbre)).toBe('Qui le voit ?');
    expect(textes(arbre)).toContain('5/6');
    await touche(arbre, 'tunnel-suivant');
    expect(titre(arbre)).toBe('Récapitulatif');
    expect(textes(arbre)).toContain('Relisez, puis publiez.');
  });

  it('la fin avant le début se refuse à « Quand ? »', async () => {
    const arbre = await monter();
    await act(async () => {
      dernierInput('evenement-nom').onChangeText('Fête du sport');
    });
    await touche(arbre, 'tunnel-suivant');
    await act(async () => {
      derniereDate('evenement-date').onChange('24/10/2026');
    });
    await act(async () => {
      dernieresHeures()[0].onChange('17:00');
    });
    await act(async () => {
      dernieresHeures()[1].onChange('10:00');
    });
    await touche(arbre, 'tunnel-suivant');
    expect(titre(arbre)).toBe('Quand ?');
    expect(textes(arbre)).toContain('La fin doit venir après le début.');
  });

  it('depuis une case du planning : 4 étapes, « Quand ? » et « Où ? » sautées', async () => {
    const arbre = await monter({
      initial: {
        date: '2026-10-24',
        endTime: '15:30',
        facilityId: 'stade',
        startTime: '14:00',
      },
    });
    expect(textes(arbre)).toContain('1/4');
    await act(async () => {
      dernierInput('evenement-nom').onChangeText('Cross');
    });
    await touche(arbre, 'tunnel-suivant');
    expect(titre(arbre)).toBe('Quelle place prend-il ?');
  });

  it('« Ailleurs dans la commune » : une adresse, et « Quelle place ? » est sautée', async () => {
    const arbre = await monter();
    await act(async () => {
      dernierInput('evenement-nom').onChangeText('Fête du sport');
    });
    await touche(arbre, 'tunnel-suivant');
    await act(async () => {
      derniereDate('evenement-date').onChange('24/10/2026');
    });
    await act(async () => {
      dernieresHeures()[0].onChange('10:00');
    });
    await act(async () => {
      dernieresHeures()[1].onChange('17:00');
    });
    await touche(arbre, 'tunnel-suivant');
    await touche(arbre, 'evenement-lieu-ailleurs');
    expect(textes(arbre)).toContain('3/5');
    await touche(arbre, 'tunnel-suivant');
    expect(titre(arbre)).toBe('Où ?');
    expect(textes(arbre)).toContain(
      'Dites où a lieu l’événement : une installation, ou une adresse.',
    );
    // R17-EVT-1-BIS (e) : la saisie partagée, avec « Adresse introuvable ? » et la carte.
    const champ = mockAdresseProps.at(-1);
    expect(champ).toEqual(expect.objectContaining({
      permettreLieuSurCarte: true, villeConnue: 'Montrivage', vouvoyer: true,
    }));
    await act(async () => {
      champ.setAddress({ label: 'Parc des sports', lat: 45.75, lng: 4.83 });
    });
    await touche(arbre, 'tunnel-suivant');
    expect(titre(arbre)).toBe('Qui le voit ?');
  });

  it('le récapitulatif, puis le corps envoyé au serveur', async () => {
    const onPublier = jest.fn(async () => ({ data: { documentId: 'evt-1' } }));
    const arbre = await monter({ onPublier });
    await remplirJusquaQui(arbre);
    await touche(arbre, 'evenement-qui-public');
    await touche(arbre, 'tunnel-suivant');
    const lus = textes(arbre);
    expect(lus).toContain('Fête du sport · sam. 24 oct. · 10:00 – 17:00');
    expect(lus).toContain('Stade municipal · toute l’installation');
    expect(lus).toContain('Tout le monde');
    expect(lus).toContain('Publier l’événement');
    await touche(arbre, 'tunnel-suivant');
    expect(onPublier).toHaveBeenCalledWith({
      data: {
        address: null,
        audience: 'membres',
        description: null,
        endDate: null,
        endTime: '17:00',
        facilityId: 'stade',
        kind: 'manifestation',
        name: 'Fête du sport',
        startDate: '2026-10-24',
        startTime: '10:00',
        takesPlace: true,
        visibility: 'public',
      },
    });
  });

  it('« Toute l’installation » : l’encadré des séances touchées, avant de publier', async () => {
    mockApercu = {
      data: {
        clubsCount: 1,
        sessions: [
          {
            club: { documentId: 'as', name: 'AS Montrivage' },
            date: '2026-10-24',
            endTime: '15:30',
            startTime: '14:00',
            team: { name: 'U13' },
          },
        ],
        sessionsCount: 1,
      },
    };
    const arbre = await monter();
    await remplirJusquaQui(arbre);
    await touche(arbre, 'tunnel-retour');
    expect(titre(arbre)).toBe('Quelle place prend-il ?');
    const lus = textes(arbre);
    expect(lus).toContain('1 séance touchée');
    expect(lus).toContain('AS Montrivage · U13, sam. 24 oct. 14:00 – 15:30');
    expect(lus).toContain(
      'Son club la verra « Bloqué par la Ville · à déplacer » et pourra la déplacer.',
    );
    // « Aucune » : l'encadré disparaît.
    await touche(arbre, 'evenement-place-aucune');
    expect(textes(arbre)).not.toContain('1 séance touchée');
  });

  it('la panne : la saisie est gardée, « Réessayer » renvoie', async () => {
    const onPublier = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ data: { documentId: 'evt-1' } });
    const arbre = await monter({ onPublier });
    await remplirJusquaQui(arbre);
    await touche(arbre, 'tunnel-suivant');
    await touche(arbre, 'tunnel-suivant');
    const lus = textes(arbre);
    expect(lus).toContain('L’événement n’a pas été publié.');
    expect(lus).toContain('La connexion a été perdue. Ce que vous avez saisi est gardé.');
    expect(lus).toContain('Fête du sport · sam. 24 oct. · 10:00 – 17:00');
    await touche(arbre, 'bouton:Réessayer');
    expect(onPublier).toHaveBeenCalledTimes(2);
    expect(textes(arbre)).not.toContain('L’événement n’a pas été publié.');
  });
});

describe('R17-EVT-1 — le panneau (ordinateur)', () => {
  it('tous les champs ; « Annuler » ferme ; les refus empêchent l’envoi', async () => {
    const onClose = jest.fn();
    const onPublier = jest.fn();
    const arbre = await monter({ onClose, onPublier, presentation: 'panneau' });
    const lus = textes(arbre);
    expect(lus).toEqual(
      expect.arrayContaining([
        'Ajouter un événement de la Ville',
        'Type',
        'Manifestation',
        'Tournoi',
        'Portes ouvertes',
        'Réunion',
        'Autre',
        'Sur plusieurs jours',
        'Où',
        'Gymnase des Tilleuls',
        'Stade municipal',
        'Ailleurs dans la commune',
        'Quelle place prend-il ?',
        'Toute l’installation',
        'Aucune',
        'Qui le voit ?',
        'Les clubs',
        'Les clubs et une actualité',
        'Tout le monde',
        'L’actualité va à',
        'Les dirigeants',
        'Tous les membres',
        '+ Ajouter une description',
        'Annuler',
        'Publier l’événement',
      ]),
    );
    await touche(arbre, 'bouton:Publier l’événement');
    expect(onPublier).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Donnez un nom à l’événement.');
    await touche(arbre, 'bouton:Annuler');
    expect(onClose).toHaveBeenCalled();
    // « Ailleurs » : « Quelle place prend-il ? » disparaît.
    await touche(arbre, 'evenement-lieu-ailleurs');
    expect(textes(arbre)).not.toContain('Quelle place prend-il ?');
  });

  it('« Modifier » : le panneau repart de l’événement et dit « Enregistrer »', async () => {
    const arbre = await monter({
      evenement: {
        audience: 'dirigeants',
        documentId: 'evt-1',
        endTime: '17:00',
        facility: { documentId: 'stade', name: 'Stade municipal' },
        kind: 'tournoi',
        name: 'Tournoi',
        startDate: '2026-10-24',
        startTime: '10:00',
        takesPlace: false,
        visibility: 'actualite',
      },
      presentation: 'panneau',
    });
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Modifier l’événement', 'Enregistrer']));
    expect(dernierInput('evenement-nom').value).toBe('Tournoi');
  });
});

// 🏛️ R17-EVT-1-BIS (f) (20/10/2026, tri du chef) — L'AFFICHE (facultative), dans « Quel
// événement ? » et dans le panneau : « + Ajouter une affiche » choisit une image, l'envoie (comme
// les pièces des actualités de la Ville) et la joint au corps (`poster`) ; « Retirer l'affiche »
// l'enlève. Plus de 10 Mo : un refus, rien n'est envoyé. ROUGE avant (aucun bouton).
describe('R17-EVT-1-BIS — l’affiche', () => {
  const CASE = {
    date: '2026-10-24', endTime: '17:00', facilityId: 'stade', startTime: '10:00',
  };
  beforeEach(() => {
    mockAdresseProps.length = 0;
    mockTeleverser.mockReset();
    mockImageChoisie = { assets: [{ fileSize: 1000, uri: 'file://affiche.jpg' }] };
  });

  it('🔴 « + Ajouter une affiche » : choisie, envoyée, puis jointe au corps (poster)', async () => {
    mockTeleverser.mockResolvedValue({ id: 12, url: '/uploads/affiche.jpg' });
    const onPublier = jest.fn(async () => ({ data: { documentId: 'evt-1' } }));
    const arbre = await monter({ initial: CASE, onPublier, presentation: 'panneau' });
    await act(async () => {
      dernierInput('evenement-nom').onChangeText('Fête du sport');
    });
    await touche(arbre, 'evenement-ajouter-affiche');
    expect(mockTeleverser).toHaveBeenCalledWith(mockImageChoisie);
    expect(textes(arbre)).toContain('Retirer l’affiche');
    await touche(arbre, 'bouton:Publier l’événement');
    expect(onPublier).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Fête du sport', poster: 12 }),
    });
  });

  it('🔴 plus de 10 Mo : un refus, rien n’est envoyé', async () => {
    mockImageChoisie = { assets: [{ fileSize: 11 * 1024 * 1024, uri: 'file://lourde.jpg' }] };
    const arbre = await monter({ initial: CASE, presentation: 'panneau' });
    await touche(arbre, 'evenement-ajouter-affiche');
    expect(mockTeleverser).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Cette image dépasse 10 Mo.');
  });

  it('🔴 « Modifier » : l’affiche en place se garde ; « Retirer » envoie poster: null', async () => {
    const onPublier = jest.fn(async () => ({ data: { documentId: 'evt-1' } }));
    const arbre = await monter({
      evenement: {
        audience: 'dirigeants',
        documentId: 'evt-1',
        endTime: '17:00',
        facility: { documentId: 'stade', name: 'Stade municipal' },
        kind: 'tournoi',
        name: 'Tournoi',
        poster: { url: '/uploads/tournoi.jpg' },
        startDate: '2026-10-24',
        startTime: '10:00',
        takesPlace: false,
        visibility: 'actualite',
      },
      onPublier,
      presentation: 'panneau',
    });
    expect(textes(arbre)).toContain('Retirer l’affiche');
    await touche(arbre, 'evenement-retirer-affiche');
    expect(textes(arbre)).toContain('+ Ajouter une affiche');
    await touche(arbre, 'bouton:Enregistrer');
    expect(onPublier).toHaveBeenCalledWith({ data: expect.objectContaining({ poster: null }) });
  });
});

// 🏛️ R17-EVT-1-BIS (e) (20/10) — « Ailleurs dans la commune » placé sur la carte : le corps porte
// l'adresse choisie ET son point. ROUGE avant (champ texte, aucun point).
describe('R17-EVT-1-BIS — « Ailleurs », placé sur la carte', () => {
  it('🔴 le panneau : l’adresse choisie et son point partent au serveur', async () => {
    mockAdresseProps.length = 0;
    const onPublier = jest.fn(async () => ({ data: { documentId: 'evt-1' } }));
    const arbre = await monter({
      initial: {
        date: '2026-10-24', endTime: '17:00', facilityId: 'stade', startTime: '10:00',
      },
      onPublier,
      presentation: 'panneau',
    });
    await act(async () => {
      dernierInput('evenement-nom').onChangeText('Cross');
    });
    await touche(arbre, 'evenement-lieu-ailleurs');
    await act(async () => {
      mockAdresseProps.at(-1).setAddress({
        city: 'Montrivage', label: 'Parc des sports', lat: 45.75, lng: 4.83, postcode: '69000',
      });
    });
    await touche(arbre, 'bouton:Publier l’événement');
    expect(onPublier).toHaveBeenCalledWith({
      data: expect.objectContaining({
        address: 'Parc des sports',
        addressLocation: { lat: 45.75, lng: 4.83 },
        facilityId: null,
      }),
    });
  });
});

// 🏛️ R17-EVT-1-BIS (d) (20/10) — « Où ? » : chaque installation dit son occupation aux jours et
// heures choisis ; choisir une installation FERMÉE ce jour-là affiche un avertissement (la Ville
// décide de ses murs : rien n'est refusé). ROUGE avant.
describe('R17-EVT-1-BIS — « Où ? », l’occupation et la fermeture', () => {
  it('🔴 le panneau : chaque installation dit son occupation ; fermée : avertie', async () => {
    mockOccupations = {
      gym: {
        complet: false,
        fermeture: { documentId: 'f-1', kind: 'closure', reason: 'travaux' },
        seances: 0,
      },
      stade: { complet: false, fermeture: null, seances: 2 },
    };
    mockOccupationDemandes.length = 0;
    const arbre = await monter({
      initial: {
        date: '2026-10-24', endTime: '12:00', facilityId: 'stade', startTime: '10:00',
      },
      presentation: 'panneau',
    });
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Fermeture ce jour-là',
      '2 séances sur ces heures',
    ]));
    expect(mockOccupationDemandes.at(-1)).toEqual([
      'ville-montrivage',
      INSTALLATIONS,
      expect.objectContaining({
        date: '2026-10-24', heureDebut: '10:00', heureFin: '12:00',
      }),
    ]);
    expect(lus.join(' ')).not.toMatch(/Vous pouvez quand même/);
    await touche(arbre, 'evenement-lieu-gym');
    expect(textes(arbre)).toContain(
      'Gymnase des Tilleuls : fermeture ce jour-là. Vous pouvez quand même y tenir l’événement.',
    );
  });
});
