// I18N-1 : le code teste lit ses textes par i18next / t() (replis, interpolation) ;
// ce temoin initialise le VRAI i18next en francais (fr.js + replis), sans rien
// changer a ce qu'il affirme.
/* eslint-disable max-len -- donnees de temoin sur une ligne */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import { formatLicenseMoney } from '../licenseDesignSystem';
import MyLicenses from '../MyLicenses';

/**
 * AA07 / K1 — « MES cotisations » quand on en a PLUSIEURS.
 * Reecrit pour S9, vague S, sous l architecture A.
 *
 * 🗣️ Adel, recette du 2026-08-20 : « l'accueil dit "Ma cotisation", et si on en
 * a plusieurs on n'en voit qu'une — impossible d'atteindre l'autre. »
 *
 * 🔁 CE QUI A CHANGE, ET POURQUOI LE TEMOIN CHANGE AVEC : la reparation d aout
 * posait un SELECTEUR dans l ecran de detail, avec un bouton « Voir la
 * cotisation <club> ». Le pack de design supprime ce bouton — son libelle
 * arrivait tronque, « Voir la cotisation STADE MARS… » (defaut 3), parce qu il
 * portait un nom de club de 42 caracteres.
 *
 * ⚖️ LA GARANTIE, ELLE, NE CHANGE PAS D UN POUCE : plusieurs cotisations
 * restent ATTEIGNABLES, et chacune est nommee. Seul le chemin change — c est
 * desormais la LISTE, et la carte entiere est la cible tactile.
 *
 * ⛔ CE TEMOIN N EST PAS UN TEST DE PEINTURE : il n observe ni couleur ni
 * marge, il observe qu une cotisation nommee par le serveur est atteignable a
 * l ecran, et que le geste mene bien a SON detail.
 */

/** @type {any} */
let mockMesCotisations;

jest.mock('@/services/license/licenseQueries', () => ({
  useMyLicenses: () => mockMesCotisations,
}));

// FIN-PARENT (02/11) : l ecran lit le role du compte, et sa branche Parent ses enfants ; ce temoin
// parle d un compte qui n est pas Parent.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ accountRoleKey: 'player' }),
}));
jest.mock('@/services/parentLink/parentLinkQueries', () => ({}));
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({}));

// S9-bis — `MemberTopBar` reutilise desormais `HeaderBackButton`, le composant
// de retour des 65 autres ecrans. Il appelle `useNavigation()` en interne (pour
// pouvoir se passer d un `onPress`), ce qui exige un navigateur autour. C est le
// meme mock que les suites qui montent deja cet entete (AttendanceSheets,
// DetectionRotationBoard...).
const mockNavigationContexte = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigationContexte,
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock(
  /** @type {any} */ { children },
) {
  return children;
});

// PERF2 — l ecran importe desormais WithDataWrapper → SkeletonLoader, qui tire
// MaskedView / LinearGradient / Reanimated : hors sujet ici (cette suite ne
// monte que des etats charges). Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

const cotisation = ({
  campaign, club, documentId, status,
}) => ({
  amountDueCents: 18000,
  amountPaidCents: 0,
  amountRemainingCents: 18000,
  campaign: {
    club: { name: club },
    documentId: `camp-${documentId}`,
    name: campaign,
    paymentModes: {},
    seasonLabel: '2026-2027',
    status: 'active',
  },
  club: { documentId: `club-${documentId}`, name: club },
  currency: 'EUR',
  documentId,
  installments: [],
  payments: [],
  receipts: [],
  status,
});

/** @type {any} */
let arbre = null;
const mockNaviguer = jest.fn();

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  jest.clearAllMocks();
});

/**
 * Monte l ecran de liste avec les cotisations donnees.
 * @param {any[]} liste les cotisations rendues par `/licenses/me`
 * @returns {string} tout le texte rendu, mis a plat
 */
const monter = (liste) => {
  mockMesCotisations = {
    data: liste, isError: false, isLoading: false, refetch: jest.fn(),
  };

  act(() => {
    arbre = renderer.create(
      <MyLicenses
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: mockNaviguer }}
        route={{ params: {} }}
      />,
    );
  });

  return JSON.stringify(arbre.toJSON());
};

/**
 * Retrouve la cible tactile d une cotisation par un morceau de son libelle
 * d accessibilite — c est ce que lit un lecteur d ecran, donc c est ce qui
 * prouve qu elle est ATTEIGNABLE.
 * @param {string} morceau texte cherche
 * @returns {any} la cible, ou undefined
 */
const cible = (morceau) => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
    && String(noeud.props?.accessibilityLabel || '').includes(morceau),
)[0];

/*
 * T-NOTIFS-TOURNOI (j, 18/11/2026, capture Android recette 45, compte 777) — « PAYÉE · 0,00 € » pour une place
 * de tournoi payee 20 EUR. Le serveur remplit bien le paye (license.ts `recalc`) : la carte affichait le RESTE
 * a payer, 0 une fois solde, pour toute cotisation. Soldee : la carte montre ce qui a ete paye.
 * (Monte comme AA07 : en-tete recopie de MyLicenses.AA07.plusieursCotisations.test.js.)
 */
const texte = (cents) => formatLicenseMoney(cents, 'EUR');
// Les textes de LA CARTE de la cotisation (sa cible tactile), pas ceux de la carte de total au-dessus,
// qui dit a bon droit « 0,00 € tout est réglé ».
const textesDeLaCarte = (morceau) => cible(morceau)
  .findAll((/** @type {any} */ noeud) => noeud.type === 'Text')
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

describe('T-NOTIFS-TOURNOI (j) — le montant d une cotisation soldee', () => {
  it('une place de tournoi payee 20 EUR montre 20,00 EUR, pas 0,00 EUR', () => {
    monter([{
      ...cotisation({
        campaign: 'Inscription - Tournoi FoundClub x AR Soccer', club: 'FoundClub x AR Soccer', documentId: 'place-777', status: 'paid',
      }),
      amountDueCents: 2000,
      amountPaidCents: 2000,
      amountRemainingCents: 0,
    }]);
    const textes = textesDeLaCarte('Inscription');
    expect(textes).toContain(texte(2000));
    expect(textes).not.toContain(texte(0));
  });

  it('une cotisation due montre toujours son reste a payer', () => {
    monter([cotisation({
      campaign: 'Licence senior', club: 'FC Nord', documentId: 'due', status: 'pending',
    })]);
    expect(textesDeLaCarte('Licence senior')).toContain(texte(18000));
  });

  it('une cotisation exemptee garde son montant d avant (0)', () => {
    monter([{
      ...cotisation({
        campaign: 'Licence senior', club: 'FC Nord', documentId: 'offerte', status: 'waived',
      }),
      amountRemainingCents: 0,
    }]);
    expect(textesDeLaCarte('Licence senior')).toContain(texte(0));
  });
});
