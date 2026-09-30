import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import EventParticipants from '../components/EventParticipants';

// FINITIONS4 — D6 (recette emulateur, tournee 6, 29/09) : UN EVENEMENT OU L ON
// NE PEUT PAS REPONDRE AFFICHAIT QUAND MEME SES COMPTEURS DE REPONSES.
//
// Constats (fiche joueur et dirigeant) :
//   · « Les participants repondent » decochee : « Présent·e·s 0 / Absent·e·s 0 /
//     Sans réponse 1 », « 0 réponse sur 1 · 0 % », « Personne n'a encore
//     confirmé sa présence » — pour des reponses que personne ne peut donner ;
//   · evenement passe : le compteur dit « Sans réponse » quand le texte dit
//     « pas renseigné » ;
//   · « Relancer » proposé sur un evenement termine.
//
// Decision du chef (29/09) : reponses desactivees ⇒ ni compteurs de reponses ni
// « Relancer » ; UN SEUL libelle, « pas renseigné », des qu une reponse n est plus
// attendue ; « Relancer » jamais sur un evenement termine.
//
// Ecrits ROUGES contre app `12692738`. Harnais repris de POINTAGEListeDesParticipants.

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: jest.fn(),
  markCoachArrivalBulk: jest.fn(),
  resetCoachAttendance: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ key) => key }),
}));

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

const MOURI = {
  documentId: 'mouri', firstname: 'Mouri', id: 32, lastname: 'Nio',
};

const DEBUT = Date.parse('2026-09-30T09:00:00.000Z');
const FIN = Date.parse('2026-09-30T10:00:00.000Z');
const LA_VEILLE = DEBUT - 24 * 60 * 60 * 1000;
const LE_LENDEMAIN = FIN + 24 * 60 * 60 * 1000;

const PASTILLE_SANS_REPONSE = 'eventParticipants.noAnswer';
const PAS_RENSEIGNE = 'eventDetails.attendanceBadge.notReported';
const SANS_REPONSE = 'eventDetails.participationStatus.notAnswered';
const RELANCER = 'eventDetails.actions.remind';

/**
 * La liste d un entrainement vue par l entraineur, avec la CARTE D EQUIPE (le
 * chemin de la recette : « COMPO-Foot-U15 · Équipe organisatrice »).
 * @param {{ evenement?: object, maintenant?: number, attendance?: object }} [options]
 * @returns {object} Les proprietes.
 */
const proprietes = ({ attendance = {}, evenement = {}, maintenant = LA_VEILLE } = {}) => ({
  attendanceByUserId: { [MOURI.documentId]: attendance },
  canEdit: true,
  event: {
    date: new Date(DEBUT).toISOString(),
    documentId: 'evt-3050',
    endDate: new Date(FIN).toISOString(),
    ...evenement,
  },
  eventStartAt: new Date(DEBUT),
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: maintenant,
  onCoachEditLate: jest.fn(),
  participantsSummary: { participatingCount: 0 },
  pendingParticipations: [],
  teamParticipationSections: [{
    historical: {},
    isHome: true,
    key: 'team-u15',
    missing: [],
    notAnswered: [MOURI],
    participating: [],
    pending: [],
    staff: {},
    teamName: 'COMPO-Foot-U15',
  }],
});

const monter = async (props) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading -- l ecran a 19 props */}
        <EventParticipants {...props} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

const titres = (arbre) => arbre.root.findAllByType(Button).map((bouton) => bouton.props.title);
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((noeud) => noeud.props.children)
  .filter((enfant) => typeof enfant === 'string');
const parTestID = (arbre, testID) => arbre.root.findAll((noeud) => noeud.props.testID === testID);
const aLeTestID = (arbre, testID) => parTestID(arbre, testID).length > 0;

describe('FINITIONS4 D6 — reponses desactivees : aucun compteur de reponses', () => {
  it('🚨 LE TEMOIN : ni tuiles, ni pastilles de filtre, ni « 0 réponse sur 1 · 0 % »', async () => {
    const arbre = await monter(proprietes({ evenement: { rsvpEnabled: false } }));

    expect(aLeTestID(arbre, 'AD06-tuile-participating')).toBe(false);
    expect(aLeTestID(arbre, 'AD06-tuile-missing')).toBe(false);
    expect(aLeTestID(arbre, 'AD06-tuile-notAnswered')).toBe(false);
    expect(aLeTestID(arbre, 'P2-pastille-notAnswered')).toBe(false);
    expect(aLeTestID(arbre, 'AD06-barre-legende')).toBe(false);
    expect(aLeTestID(arbre, 'AE02-pourcentage')).toBe(false);
  });

  it('🚨 ni « Personne n a encore confirmé… », ni « Aucune absence signalée »', async () => {
    const lus = textes(await monter(proprietes({ evenement: { rsvpEnabled: false } })));

    expect(lus).not.toContain('eventDetails.emptyStates.noConfirmation');
    expect(lus).not.toContain('eventDetails.emptyStates.noAbsence');
  });

  it('🚨 le membre est « pas renseigné », jamais « Sans réponse » (titre ET pastille)', async () => {
    const arbre = await monter(proprietes({ evenement: { rsvpEnabled: false } }));
    const lus = textes(arbre);

    expect(lus).toContain(PAS_RENSEIGNE);
    expect(lus).not.toContain(SANS_REPONSE);
    expect(lus).not.toContain(PASTILLE_SANS_REPONSE);
    // Il reste listé : l entraineur voit toujours qui est convoqué.
    expect(aLeTestID(arbre, `COMPACT-rangee-${MOURI.documentId}`)).toBe(true);
  });

  it('pas de « Relancer » (acquis de POINTAGE, garde)', async () => {
    const arbre = await monter(proprietes({ evenement: { rsvpEnabled: false } }));

    expect(titres(arbre)).not.toContain(RELANCER);
  });
});

describe('FINITIONS4 D6 — evenement termine : « pas renseigné », et plus de « Relancer »', () => {
  const termine = () => proprietes({
    attendance: { finalOperationalStatus: 'not_reported', rsvpStatus: 'not_answered' },
    maintenant: LE_LENDEMAIN,
  });

  it('🚨 LE TEMOIN : « Relancer » n est plus propose', async () => {
    const arbre = await monter(termine());

    expect(titres(arbre)).not.toContain(RELANCER);
  });

  it('🚨 le compteur, la pastille de filtre et le titre disent « pas renseigné »', async () => {
    const arbre = await monter(termine());
    const lus = textes(arbre);

    expect(lus).not.toContain(SANS_REPONSE);
    const tuile = parTestID(arbre, 'AD06-tuile-notAnswered')[0];
    const libellesTuile = tuile.findAllByType(Text).map((noeud) => noeud.props.children);
    expect(libellesTuile).toContain(PAS_RENSEIGNE);
    const pastille = parTestID(arbre, 'P2-pastille-notAnswered')[0];
    const libellePastille = pastille.findAllByType(Text)
      .map((noeud) => noeud.props.children)
      .join(' ');
    expect(libellePastille).toContain(PAS_RENSEIGNE);
  });

  it('les compteurs restent : on a pu repondre, ils disent ce qui a ete repondu', async () => {
    const arbre = await monter(termine());

    expect(aLeTestID(arbre, 'AD06-tuile-participating')).toBe(true);
    expect(aLeTestID(arbre, 'AD06-barre-legende')).toBe(true);
  });
});

describe('FINITIONS4 D6 — evenement a venir, reponses ouvertes : rien ne change', () => {
  it('« Relancer » et « Sans réponse » sont la, comme avant', async () => {
    const arbre = await monter(proprietes());
    const lus = textes(arbre);

    expect(titres(arbre)).toContain(RELANCER);
    expect(lus).toContain(SANS_REPONSE);
    expect(lus).toContain(PASTILLE_SANS_REPONSE);
    expect(lus).not.toContain(PAS_RENSEIGNE);
    expect(aLeTestID(arbre, 'AD06-barre-legende')).toBe(true);
  });
});
