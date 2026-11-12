import { Linking, Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TrainerInvitedModal from '../TrainerInvitedModal';

// RETOURS-TESTEUR-2 (06/11/2026, M0077, décision du chef « A ») — « pas adapté pour un ordi : pas
// possible d'envoyer un SMS sur un ordinateur ». Sur le site, sur ordinateur, la feuille propose
// « Copier le lien d'invitation » et « Envoyer par e-mail » à la place du SMS. Téléphone (et site
// sur un téléphone) : le SMS, inchangé.

/** @type {any[]} */
const mockFeuilles = [];
jest.mock('@/components/organisms/feuilleDeSucces/FeuilleDeSucces', () => (
  /** @type {any} */ props,
) => {
  mockFeuilles.push(props);
  return null;
});

let mockOrdinateur = true;
jest.mock('@/responsive/useIsDesktop', () => ({ useIsDesktop: () => mockOrdinateur }));

const mockCopier = jest.fn();
jest.mock('@/platform/share', () => ({
  copier: (/** @type {string} */ texte) => mockCopier(texte),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

const MESSAGE = 'Bonjour Léa !\nTélécharge l application ici : https://foundclub.app/i/club/c1';
const osDOrigine = Platform.OS;
const derniere = () => mockFeuilles[mockFeuilles.length - 1];

const monter = () => {
  const onInvite = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TrainerInvitedModal
        isVisible
        messageDInvitation={MESSAGE}
        onClose={jest.fn()}
        onInvite={onInvite}
        trainerName="Léa"
      />,
    );
  });
  return { arbre, onInvite };
};

beforeEach(() => {
  mockFeuilles.length = 0;
  mockOrdinateur = true;
  mockCopier.mockResolvedValue(true);
  Platform.OS = 'web';
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  Platform.OS = osDOrigine;
  jest.restoreAllMocks();
});

describe('M0077 — inviter depuis un ordinateur', () => {
  it('site sur ordinateur : Copier le lien d invitation, puis Envoyer par e-mail', () => {
    monter();
    expect(derniere().actionPrincipale.title).toBe('Copier le lien d’invitation');
    expect(derniere().actionSecondaire.title).toBe('Envoyer par e-mail');
  });

  it('Copier met l invitation (lien compris) dans le presse-papiers et le dit', async () => {
    const { onInvite } = monter();
    await act(async () => { await derniere().actionPrincipale.onPress(); });
    expect(mockCopier).toHaveBeenCalledWith(MESSAGE);
    expect(onInvite).not.toHaveBeenCalled();
    expect(derniere().texte)
      .toBe('Invitation copiée : colle-la dans un e-mail, WhatsApp ou un SMS.');
  });

  it('Envoyer par e-mail ouvre la messagerie avec le message, sans SMS', async () => {
    const { onInvite } = monter();
    await act(async () => { await derniere().actionSecondaire.onPress(); });
    const adresse = /** @type {any} */ (Linking.openURL).mock.calls[0][0];
    expect(adresse.startsWith('mailto:?subject=')).toBe(true);
    expect(decodeURIComponent(adresse.split('body=')[1])).toBe(MESSAGE);
    expect(onInvite).not.toHaveBeenCalled();
  });

  // INVITE-STAFF (10/11) : les appelants fournissent le titre et le texte de l'invitation envoyée
  // (la prop `dejaInscrit` d'INVITE-COACH-EXISTANT, sans appelant, est retirée par MENAGE-T10).
  it('titre et texte fournis par l appelant : affichés, et Copier marche', async () => {
    act(() => {
      renderer.create(
        <TrainerInvitedModal
          isVisible
          messageDInvitation={MESSAGE}
          onClose={jest.fn()}
          onInvite={jest.fn()}
          texte="Invitation envoyée à Léa."
          titre="Invitation envoyée"
          trainerName="Léa"
        />,
      );
    });
    expect(derniere().titre).toBe('Invitation envoyée');
    expect(derniere().texte).toBe('Invitation envoyée à Léa.');
    await act(async () => { await derniere().actionPrincipale.onPress(); });
    expect(mockCopier).toHaveBeenCalledWith(MESSAGE);
    expect(derniere().texte)
      .toBe('Invitation copiée : colle-la dans un e-mail, WhatsApp ou un SMS.');
  });

  it('site sur téléphone, ou application : le SMS, inchangé', () => {
    mockOrdinateur = false;
    monter();
    expect(derniere().actionPrincipale.title).toBe('addCoach.actions.invite');
    Platform.OS = 'ios';
    mockOrdinateur = true;
    monter();
    expect(derniere().actionPrincipale.title).toBe('addCoach.actions.invite');
  });
});
