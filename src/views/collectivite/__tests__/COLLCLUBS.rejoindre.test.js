/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteJoin from '../CollectiviteJoin';
import CollectiviteJoinRequest from '../CollectiviteJoinRequest';

// 🏛️ COLL-CLUBS (01/10) — PLANCHE 3, côté CLUB : la page publique du lien de la Ville, et la
// demande de rattachement d'un club déjà inscrit (design HY521H1, page 7, « P7v3-inviter »,
// états 3, 4, 5 et A ; D70).
//
// Ce que ce témoin fige (ROUGE avant le lot : aucun de ces écrans n'existait) :
//   - la page publique dit QUI invite (« La Ville de Montrivage t'invite… »), ce que la Ville
//     ouvre, ses installations, et deux boutons ; sans compte, ils mènent à la connexion ;
//   - un lien changé ou fabriqué le dit, sans rien montrer d'autre ;
//   - un dirigeant choisit lequel de SES clubs rattacher ; hors de la commune, il est AVERTI avant
//     de demander ; la demande part, et l'écran dit qui fait quoi, sans délai (« Tu seras prévenu »).

/** @type {any} */
let mockApercu;
/** @type {any} */
let mockMesClubs;
/** @type {any} */
let mockUtilisateur;
const mockNavigate = jest.fn();
const mockOuvrirConnexion = jest.fn();
const mockDemander = { error: null, isPending: false, mutate: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { token: 'CodeDeLaVille0123456789ab' } }),
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUtilisateur }),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({
  openPublicAuthFlow: (/** @type {any} */ navigation) => mockOuvrirConnexion(navigation),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInvitationPreview: () => mockApercu,
  useMyClubsForCollectiviteInvitation: () => mockMesClubs,
  useRequestCollectiviteAttach: () => mockDemander,
}));

jest.mock('@/utils/facilityTypes', () => ({
  getFacilityTypeLabel: (/** @type {string} */ type) => type,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);

const APERCU = {
  collectivite: { name: 'Ville de Montrivage', type: 'commune' },
  installations: [
    {
      address: null, maxSlots: 1, name: 'Dojo municipal', type: 'Dojo',
    },
    {
      address: '12 rue des Tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', type: 'Gymnase',
    },
  ],
};

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const monter = async (/** @type {any} */ Ecran) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<Ecran />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockApercu = { data: APERCU, error: null, isLoading: false };
  mockMesClubs = {
    data: [{
      address: '10 Rue de Rivoli, 75001 Paris',
      attached: false,
      attachedElsewhere: false,
      documentId: 'recette-stripe-fc',
      inCommune: false,
      name: 'Recette Stripe FC',
      requested: false,
    }],
    error: null,
    isLoading: false,
  };
  mockUtilisateur = null;
});

describe('COLL-CLUBS — planche 3, côté club : la page du lien de la Ville', () => {
  it('qui invite, ce que la Ville ouvre, ses installations, et deux boutons', async () => {
    const lus = textes(await monter(CollectiviteJoin));
    expect(lus).toEqual(expect.arrayContaining([
      'La Ville de Montrivage t’invite à inscrire ton club sur FoundClub',
      'Une fois ton club rattaché à la Ville, tu pourras :',
      'Les installations de la Ville',
      'Gymnase des Tilleuls',
      'Gymnase · 2 équipe(s) à la fois · 12 rue des Tilleuls',
      'Dojo · 1 équipe(s) à la fois',
      'M',
    ]));
  });

  it('sans compte : les deux boutons mènent à la connexion', async () => {
    const arbre = await monter(CollectiviteJoin);
    await act(async () => { bouton(arbre, 'Mon club est déjà sur FoundClub').props.onPress(); });
    await act(async () => { bouton(arbre, 'Inscrire mon club').props.onPress(); });
    expect(mockOuvrirConnexion).toHaveBeenCalledTimes(2);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('connecté : « Mon club est déjà sur FoundClub » ouvre la demande, « Inscrire mon club » le tunnel de création', async () => {
    mockUtilisateur = { documentId: 'dirigeant-d' };
    const arbre = await monter(CollectiviteJoin);
    await act(async () => { bouton(arbre, 'Mon club est déjà sur FoundClub').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteJoinRequest', { token: 'CodeDeLaVille0123456789ab' });
    await act(async () => { bouton(arbre, 'Inscrire mon club').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', expect.objectContaining({ screen: 'ClubWizardName' }));
  });

  it('un lien changé ou fabriqué : le dire, sans rien montrer d’autre', async () => {
    mockApercu = { data: null, error: { message: 'introuvable' }, isLoading: false };
    const lus = textes(await monter(CollectiviteJoin));
    expect(lus).toContain('Ce lien d’invitation ne marche plus.');
    expect(lus.some((texte) => texte.includes('Gymnase'))).toBe(false);
  });
});

describe('COLL-CLUBS — planche 3, côté club : demander le rattachement', () => {
  it('hors de la commune : le dirigeant est averti AVANT de demander', async () => {
    const lus = textes(await monter(CollectiviteJoinRequest));
    expect(lus).toEqual(expect.arrayContaining([
      'Quel club veux-tu rattacher à la Ville de Montrivage ?',
      'Recette Stripe FC',
      'Ce club n’est pas à Montrivage',
      'L’équipe FoundClub vérifiera avec la Ville avant de le rattacher.',
      'Seuls les clubs dont tu es dirigeant sont proposés.',
    ]));
  });

  it('la demande part, et l’écran dit qui fait quoi, sans délai annoncé (D70)', async () => {
    const arbre = await monter(CollectiviteJoinRequest);
    await act(async () => { bouton(arbre, 'Demander le rattachement').props.onPress(); });
    expect(mockDemander.mutate).toHaveBeenCalledWith(
      { clubId: 'recette-stripe-fc', token: 'CodeDeLaVille0123456789ab' },
      expect.any(Object),
    );
    const { onSuccess } = mockDemander.mutate.mock.calls[0][1];
    await act(async () => { onSuccess({ outsideCommune: true, status: 'registered' }); });
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Demande envoyée',
      'L’équipe FoundClub vérifie que ton club est bien à Montrivage, puis le rattache à la Ville. Tu seras prévenu.',
      'D’ici là, ton club fonctionne déjà normalement.',
    ]));
    expect(lus.some((texte) => /\d+\s*(jour|heure|semaine)/.test(texte))).toBe(false);
    await act(async () => { bouton(arbre, 'Aller à mon club').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('Club', { clubId: 'recette-stripe-fc' });
  });

  it('un compte qui ne dirige aucun club : le dire, et proposer d’inscrire son club', async () => {
    mockMesClubs = { data: [], error: null, isLoading: false };
    const lus = textes(await monter(CollectiviteJoinRequest));
    expect(lus).toContain(
      'Tu ne diriges aucun club sur FoundClub. Inscris d’abord ton club, puis rouvre le lien de la Ville.',
    );
  });
});
