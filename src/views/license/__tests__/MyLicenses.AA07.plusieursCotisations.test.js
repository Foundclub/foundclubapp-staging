import renderer, { act } from 'react-test-renderer';

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

const DEUX_COTISATIONS = [
  cotisation({
    campaign: 'Licence senior', club: 'FC Nord', documentId: 'assign-nord', status: 'pending',
  }),
  cotisation({
    campaign: 'Cotisation futsal', club: 'AS Sud', documentId: 'assign-sud', status: 'pending',
  }),
];

describe('AA07 / K1 — plusieurs cotisations restent atteignables', () => {
  it('nomme les DEUX clubs quand deux cotisations sont dues', () => {
    const rendu = monter(DEUX_COTISATIONS);

    expect(rendu).toContain('FC Nord');
    // 🎯 LE CAS D'ADEL : la seconde existe, elle est due, et l ancien ecran ne
    // la montrait nulle part.
    expect(rendu).toContain('AS Sud');
  });

  it('offre un geste pour ouvrir la seconde cotisation, et il mene a SON detail', () => {
    monter(DEUX_COTISATIONS);

    const gesteVersLaSeconde = cible('AS Sud');
    expect(gesteVersLaSeconde).toBeTruthy();

    act(() => gesteVersLaSeconde.props.onPress());
    // ⛔ Pas seulement « ca navigue » : ca navigue vers LA BONNE cotisation.
    expect(mockNaviguer).toHaveBeenCalledWith(
      'MyLicense',
      { assignmentId: 'assign-sud' },
    );
  });

  it('distingue deux cotisations du MEME club par leur campagne, pas par le club', () => {
    // 🧨 Defaut 2 du pack : sur les captures du 21/08, deux cartes portent le
    // MEME nom de club et deux statuts opposes. Le joueur n a aucun moyen de
    // savoir laquelle il doit payer.
    const rendu = monter([
      cotisation({
        campaign: 'Licence senior', club: 'SMUC', documentId: 'a1', status: 'pending',
      }),
      cotisation({
        campaign: 'Stage de la Toussaint', club: 'SMUC', documentId: 'a2', status: 'paid',
      }),
    ]);

    expect(rendu).toContain('Licence senior');
    expect(rendu).toContain('Stage de la Toussaint');
    expect(cible('Licence senior')).toBeTruthy();
    expect(cible('Stage de la Toussaint')).toBeTruthy();
  });

  it('une seule cotisation reste atteignable, et aucune autre n est inventee', () => {
    // 🔒 GARDE-FOU : le cas normal ne gagne aucun choix parasite.
    const rendu = monter([DEUX_COTISATIONS[0]]);

    expect(rendu).toContain('FC Nord');
    expect(rendu).not.toContain('AS Sud');
    expect(cible('Licence senior')).toBeTruthy();
  });

  it('replie les saisons passees en UNE ligne, et ne ment pas sur leur solde', () => {
    // ❄️ Une saison archivee ne se dessine pas dans la liste : elle se replie,
    // et l archive est un ecran a part. ⛔ « tout est paye » ne s ecrit QUE si
    // c est vrai — l archive contient aussi les campagnes fermees par le club,
    // qui ne sont pas toutes soldees.
    const ancienne = cotisation({
      campaign: 'Licence U18', club: 'FC Nord', documentId: 'vieux', status: 'paid',
    });
    ancienne.campaign.seasonLabel = '2025-2026';
    ancienne.amountPaidCents = 18000;
    ancienne.amountRemainingCents = 0;

    const rendu = monter([DEUX_COTISATIONS[0], ancienne]);
    expect(rendu).toContain('1 saison archivée');
    expect(rendu).toContain('2025-2026');
    expect(rendu).toContain('tout est payé');
    // La cotisation archivee ne prend PAS une carte dans la saison en cours.
    expect(cible('Licence U18')).toBeFalsy();
  });

  it('ne dessine JAMAIS un statut que le pack ne nomme pas', () => {
    // ⛔ `not_due`, `refunded` et `disputed` sont masques (decision du chef,
    // 25/08). Une cotisation qui les porte ne doit pas apparaitre avec un mot
    // invente ni un statut brut anglais.
    const rendu = monter([
      DEUX_COTISATIONS[0],
      cotisation({
        campaign: 'Litige en cours', club: 'AS Sud', documentId: 'assign-lit', status: 'disputed',
      }),
    ]);

    expect(rendu).toContain('FC Nord');
    expect(rendu).not.toContain('Litige en cours');
    expect(rendu).not.toContain('disputed');
  });
});
