/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import DemandesDeRattachement from '../components/DemandesDeRattachement';

// 🏛️ FINITIONS-VILLE (08/10/2026, tournée T20 lot 5) — la Ville REFUSE une demande de
// rattachement avec la fenêtre « Refuser la demande » des créneaux (motifs fréquents + motif
// obligatoire), plus avec une confirmation sans motif. Le motif part au serveur (FVIL F3), qui
// le donne au club dans sa notification.
// ROUGE avant le lot : « Refuser » ouvrait une confirmation en ligne, sans motif.

/** @type {any} */
const mockRepondre = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};
const mockGeste = () => ({
  error: null, isPending: false, mutate: jest.fn(), variables: null,
});

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

jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({
  useAnswerCollectiviteAttachRequest: () => mockRepondre,
  useCancelCollectiviteProposal: () => mockGeste(),
  useProposeCollectiviteClub: () => mockGeste(),
  useRemindCollectiviteProposal: () => mockGeste(),
}));

jest.mock('@/services/facility/facilityQueries', () => ({
  useApproveFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRefuseFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

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
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
);
const parId = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
)[0];

const DEMANDE = {
  attachedElsewhere: false, canAnswer: true, canCancel: false, canRemind: false, club: { documentId: 'club-k', name: 'T20 Club Karim' }, createdAt: '2026-10-08T12:00:00.000Z', documentId: 'r1', kind: 'attach_request', outsideCommune: true, remindCount: 0, state: 'pending',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FVIL lot 5 · la Ville refuse un rattachement avec un motif', () => {
  it('V1 « Refuser » ouvre la fenêtre « Refuser la demande » : motifs fréquents, motif obligatoire, le motif part au serveur', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<DemandesDeRattachement collectiviteId="ville-m" demandes={[DEMANDE]} />);
    });
    await act(async () => { boutons(arbre, 'Refuser')[0].props.onPress(); });
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Refuser la demande', 'T20 Club Karim', 'Motifs fréquents', 'Club hors de la commune', 'Club inconnu de nos services', 'Demande en double', 'Le club reçoit votre motif ; il n’est pas rattaché.',
    ]));
    expect(lus.some((texte) => texte.startsWith('Demande du club · '))).toBe(true);
    expect(mockRepondre.mutate).not.toHaveBeenCalled();

    // Sans motif : la fenêtre le demande, rien ne part.
    await act(async () => { boutons(arbre, 'Refuser la demande')[0].props.onPress(); });
    expect(textes(arbre)).toContain('Écrivez le motif : le club le lira.');
    expect(mockRepondre.mutate).not.toHaveBeenCalled();

    await act(async () => { parId(arbre, 'motif-horsCommune').props.onPress(); });
    await act(async () => { boutons(arbre, 'Refuser la demande')[0].props.onPress(); });
    expect(mockRepondre.mutate).toHaveBeenCalledWith(
      {
        accept: false, collectiviteId: 'ville-m', invitationId: 'r1', reason: 'Club hors de la commune',
      },
      expect.any(Object),
    );
  });

  it('V2 la page se redessine (lecture, envoi en cours) : la fenêtre garde le motif tapé', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<DemandesDeRattachement collectiviteId="ville-m" demandes={[DEMANDE]} />);
    });
    await act(async () => { boutons(arbre, 'Refuser')[0].props.onPress(); });
    const champ = () => arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'collectivite-request-message'
        && typeof n.props?.onChangeText === 'function',
    )[0];
    await act(async () => { champ().props.onChangeText('Club inconnu'); });
    await act(async () => {
      arbre.update(<DemandesDeRattachement collectiviteId="ville-m" demandes={[{ ...DEMANDE }]} />);
    });
    expect(champ().props.value).toBe('Club inconnu');
  });
});
