import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionPlanCard, { useSubscriptionPlanCard } from '../SubscriptionPlanCard';

// ABONNEMENT-HAUT (12/11, Adel « 288 B ») — LA CARTE DE STATUT DU TELEPHONE, SORTIE DE
// « Mon abonnement » pour que le SITE pose la meme en haut de sa page. Sur le site
// (`detaille`), elle dit EN PLUS ce que les blocs retires affichaient et que le telephone
// tait : la certification hors offre Club, les noms des equipes couvertes, le signal
// partenaire. Sans l option, la carte du telephone ne change pas (les temoins de
// SubscriptionOverview.*.test.js le gardent).
//
// Pilote par le TEXTE VISIBLE, jamais par la forme de l'arbre.

/** @type {any} */
let mockAuthValue;

// Les VRAIES traductions, et le vrai i18next pour tout libelle a {{jetons}} :
// c'est lui qui echapperait une apostrophe si l'ecran oubliait SANS_ECHAPPEMENT.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
        if (
          (typeof repli === 'string' && valeurs)
          || (repli && typeof repli === 'object' && 'defaultValue_one' in repli)
        ) {
          return jest.requireActual('i18next').t(cle, repli, valeurs);
        }
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
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
      Images: {
        arrowRight: 1,
        calendar: 1,
        chart: 1,
        check: 1,
        euroCircle: 1,
        search: 1,
        shield: 1,
        users: 1,
      },
      Spaces: espaces,
    }),
  };
});

/**
 * Le contexte d un coach (offre Équipe, une place) ou d un dirigeant gratuit.
 * @param {{ equipe?: boolean, partenaire?: boolean }} decor
 * @returns {any}
 */
const session = ({ equipe = false, partenaire = false }) => ({
  accountSubscriptionAccessLevel: equipe ? 'TEAM' : 'FREE',
  clubVerificationSummary: {
    clubDocumentId: 'club-haut',
    clubPartner: partenaire,
    clubVerified: false,
    requiresClubVerification: false,
  },
  entitlementsSummary: equipe ? [{
    capability: 'ALL',
    paidBy: { documentId: 'u-coach' },
    scopeClubDocumentId: 'club-haut',
    scopeTeamDocumentId: 'equipe-seniors',
    scopeTeamName: 'Seniors',
    scopeType: 'TEAM',
    status: 'active',
    subscriptionCurrentPeriodEnd: '2027-11-12T12:00:00.000Z',
    subscriptionPlanCode: 'fc_team_1_yearly',
  }] : [],
  subscriptionAccessLevel: equipe ? 'TEAM' : 'FREE',
  subscriptionSummary: {
    activePlanCodes: equipe ? ['fc_team_1_yearly'] : [],
    payerSubscriptionsSummary: equipe ? [{
      autoRenew: true,
      billingPeriod: 'yearly',
      currentPeriodEnd: '2027-11-12T12:00:00.000Z',
      documentId: 'sub-equipe',
      isTrial: false,
      planCode: 'fc_team_1_yearly',
      provider: 'web',
      scopeClubDocumentIds: [],
      status: 'active',
    }] : [],
    teamSlotSummary: equipe
      ? {
        assigned: 1, available: 0, coveredTeamDocumentIds: ['equipe-seniors'], total: 1,
      }
      : {
        assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
      },
  },
  userData: {
    club: { documentId: 'club-haut', name: 'Club Haut' },
    documentId: 'u-coach',
    myTeams: [{ documentId: 'equipe-seniors', name: 'Seniors' }],
    trainedTeams: [],
  },
});

/**
 * La carte, rendue comme l ecran la rend.
 * @param {{ detaille?: boolean }} props
 * @returns {import('react').ReactElement}
 */
function Carte({ detaille }) {
  const carte = useSubscriptionPlanCard();
  return <SubscriptionPlanCard carte={carte} detaille={detaille} />;
}

/**
 * Le texte visible de la carte.
 * @param {{ detaille?: boolean }} props
 * @returns {string}
 */
const texteDe = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<Carte detaille={props.detaille} />);
  });
  return arbre.root.findAllByType(Text)
    .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
    .join(' | ');
};

describe('ABONNEMENT-HAUT — la carte de statut, au telephone et sur le site (detaille)', () => {
  it('telephone : la carte d un coach Équipe, inchangee', () => {
    mockAuthValue = session({ equipe: true, partenaire: true });
    const texte = texteDe({});
    expect(texte).toContain('Équipe');
    expect(texte).toContain('1 équipe couverte par ton offre.');
    expect(texte).toContain('1/1 place attribuée');
    expect(texte).toContain('Renouvelé le');
    expect(texte).toContain('12 novembre 2027');
    // Ce que le telephone tait.
    expect(texte).not.toContain('Certification');
    expect(texte).not.toContain('Seniors');
    expect(texte).not.toContain('Signal partenaire interne actif.');
  });

  it('site : la certification hors offre Club, comme l ancienne case « Vérification club »', () => {
    mockAuthValue = session({ equipe: true });
    expect(texteDe({ detaille: true })).toContain('Certification | Club non certifié');
  });

  it('site : les noms des equipes couvertes', () => {
    mockAuthValue = session({ equipe: true });
    expect(texteDe({ detaille: true })).toContain('Seniors');
  });

  it('site : le signal partenaire', () => {
    mockAuthValue = session({ equipe: true, partenaire: true });
    expect(texteDe({ detaille: true })).toContain('Signal partenaire interne actif.');
  });

  it('site : un compte gratuit lit « Offre gratuite FoundClub » et sa certification', () => {
    mockAuthValue = session({});
    const texte = texteDe({ detaille: true });
    expect(texte).toContain('Offre gratuite FoundClub');
    expect(texte).toContain('Club non certifié');
  });
});
