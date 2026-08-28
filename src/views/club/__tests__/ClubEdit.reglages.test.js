import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubEdit from '../ClubEdit';

// D34 (E6) : `ClubEdit.js` avait un seul test, et il ne couvre QUE l'apercu du
// logo (L15). L'ecran 02 du pack « Gerer mon club » retouche justement les deux
// blocs que rien ne surveillait : la carte-rangee du toggle « Afficher les
// membres publiquement » (dont le libelle passe AVANT sa description) et les
// deux rangees-radio de delegation (qui perdent la carte bordee qui les
// enfermait — « jamais de carte dans une carte »).
//
// Ce filet fige ce que l'ecran ENVOIE, jamais ce qu'il dessine : le mode de
// gestion des demandes d'adhesion est un reglage reel du club, et le confondre
// vaut a un entraineur de perdre — ou de gagner — le droit d'accepter des
// joueurs dans son equipe.
//
// Il doit passer, INCHANGE, avant et apres la refonte.

const mockRefetch = jest.fn();
const mockMutate = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: mockMutate }),
}));

// L'ecran appelle `t('common.actions.save')` SANS repli : sans cette petite
// table, la doublure rendrait la cle brute et « Enregistrer » n'existerait pas
// a l'ecran. On ne recopie ici que les cles appelees sans repli.
const TRADUCTIONS_SANS_REPLI = {
  'common.actions.save': 'Enregistrer',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      return TRADUCTIONS_SANS_REPLI[cle] || cle;
    },
  }),
}));

// Le vrai Joi, sans le bootstrap i18next que '@/theme/strings' declenche a
// l'import (il chargerait fr.js, tenu par un autre lot).
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

jest.mock('@/theme/colors', () => ({
  withAlpha: () => 'couleur-transparente',
}));

jest.mock('@/theme/themeContext', () => {
  const feuilleDeStyle = {};
  const rampe = () => new Proxy({}, { get: () => feuilleDeStyle });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => feuilleDeStyle }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

const mockGetClub = jest.fn();
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: (/** @type {any} */ ...args) => mockGetClub(...args),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

jest.mock('@/services/club/clubService', () => ({
  updateClubInfo: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

// Contrairement au filet L15, le bouton est ici un VRAI pressable portant son
// libelle : c'est le seul moyen d'appuyer sur « Enregistrer » et d'observer ce
// que l'ecran envoie, quelle que soit la mise en page.
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

jest.mock(
  '@/components/molecules/autocompleteSelect/AutocompleteSelect',
  () => function AutocompleteSelectMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/selectAvatar/SelectAvatar',
  () => function SelectAvatarMock() {
    return null;
  },
);

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const CLUB = {
  activites: [],
  addressDetails: null,
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  email: 'contact@smuc.fr',
  membershipRequestManagementMode: 'COACH_ALLOWED_BY_TEAM',
  name: 'Stade Marseillais Université Club',
  phoneNumber: '0491000000',
};

/**
 * Aplatit les enfants d'un noeud en une chaine.
 * @param {any} enfants - Les enfants du noeud.
 * @returns {string} Le texte aplati.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Le texte visible.
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/**
 * Monte l'ecran avec le club donne.
 * @param {any} club - Le club a servir.
 * @returns {Promise<any>} L'arbre rendu.
 */
const monter = async (club = CLUB) => {
  mockGetClub.mockReturnValue({
    data: club,
    error: null,
    isLoading: false,
    refetch: mockRefetch,
  });

  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubEdit
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { clubId: 'club-1' } })}
      />,
    );
  });
  return arbre;
};

/**
 * Appuie sur le pressable le plus profond qui porte ce libelle.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle visible.
 * @returns {Promise<void>} Rien.
 */
const appuyerSur = async (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

  if (candidats.length === 0) {
    throw new Error(`Aucun element pressable ne porte le libelle « ${libelle} »`);
  }

  const cible = candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];

  await act(async () => {
    cible.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ClubEdit — les reglages du club (fige avant la refonte D34)', () => {
  it('montre les deux modes de delegation AVEC leur consequence', async () => {
    const arbre = await monter();
    const textes = texteDe(arbre.root);

    expect(textes).toContain('Gestion par le dirigeant');
    expect(textes).toContain("Délégation à l'entraîneur");
    // La consequence explicite est ce qui distingue une radio d'une etiquette.
    expect(textes).toContain('toutes les demandes');
    expect(textes).toContain('déléguer équipe par équipe');
  });

  it('montre le libelle du toggle ET sa description', async () => {
    const arbre = await monter();
    const textes = texteDe(arbre.root);

    expect(textes).toContain('Afficher les membres publiquement');
    expect(textes).toContain('publiquement sur la page du club');
  });

  it('envoie le mode du club tel qu il est, sans y toucher', async () => {
    const arbre = await monter();

    await appuyerSur(arbre, 'Enregistrer');

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      clubMembersPublicVisibility: true,
      documentId: 'club-1',
      membershipRequestManagementMode: 'COACH_ALLOWED_BY_TEAM',
    });
  });

  it('bascule sur « Gestion par le dirigeant » et l envoie', async () => {
    const arbre = await monter();

    await appuyerSur(arbre, 'Gestion par le dirigeant');
    await appuyerSur(arbre, 'Enregistrer');

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      membershipRequestManagementMode: 'CLUB_OWNER_ONLY',
    });
  });

  it('retombe sur la delegation quand le club n a aucun mode enregistre', async () => {
    const arbre = await monter({ ...CLUB, membershipRequestManagementMode: null });

    await appuyerSur(arbre, 'Enregistrer');

    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      membershipRequestManagementMode: 'COACH_ALLOWED_BY_TEAM',
    });
  });

  it('« Annuler » revient en arriere sans rien envoyer', async () => {
    const arbre = await monter();

    await appuyerSur(arbre, 'Annuler');

    expect(navigation.goBack).toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// LOT EQUIPES (E6) — Q3 et Q5 : CE QUE LE DIRIGEANT AUTORISE A SES ENTRAINEUR·ES.
//
// Demande d Adel du 28/08 : « si le dirigeant autorise les entraineurs dans son
// club », et « sinon, le dirigeant peut cocher une case qui fait que l equipe
// doit etre VALIDEE pour apparaitre vraiment ».
//
// ⚠️ LE CLIQUET EST LE COEUR DE CES TEMOINS : les 222 294 clubs de production
// n ont aucune de ces deux colonnes. Un dirigeant qui ouvre cet ecran et
// enregistre SANS RIEN TOUCHER ne doit rien changer pour son club.
// ---------------------------------------------------------------------------
describe('EQUIPES — les deux reglages de creation d equipe', () => {
  it('montre les deux interrupteurs, avec ce qu ils font', async () => {
    const arbre = await monter();
    const textes = texteDe(arbre.root);

    expect(textes).toContain('Mes entraîneur·es peuvent créer des équipes');
    expect(textes).toContain('Leurs équipes doivent être validées par moi');
    // Une bascule sans sa consequence est une etiquette, pas un reglage.
    expect(textes).toContain('créer toi-même toutes les équipes');
    expect(textes).toContain("n'apparaît dans le club qu'une fois que tu l'as validée");
  });

  it('LE CLIQUET — enregistrer sans rien toucher renvoie le comportement d aujourd hui', async () => {
    const arbre = await monter();

    await appuyerSur(arbre, 'Enregistrer');

    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      teamCreationByCoachesRequiresValidation: false,
      teamCreationManagementMode: 'COACH_ALLOWED',
    });
  });

  it('un club sans reglage enregistre retombe lui aussi sur AUTORISE', async () => {
    const arbre = await monter({
      ...CLUB,
      teamCreationByCoachesRequiresValidation: null,
      teamCreationManagementMode: null,
    });

    await appuyerSur(arbre, 'Enregistrer');

    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      teamCreationByCoachesRequiresValidation: false,
      teamCreationManagementMode: 'COACH_ALLOWED',
    });
  });

  it('le reglage deja pose par le dirigeant est RELU et renvoye tel quel', async () => {
    const arbre = await monter({
      ...CLUB,
      teamCreationByCoachesRequiresValidation: true,
      teamCreationManagementMode: 'CLUB_OWNER_ONLY',
    });

    await appuyerSur(arbre, 'Enregistrer');

    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      teamCreationByCoachesRequiresValidation: true,
      teamCreationManagementMode: 'CLUB_OWNER_ONLY',
    });
  });
});
