import renderer, { act } from 'react-test-renderer';

import EcrireAuClient from '@/views/complexe/components/EcrireAuClient';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// MESSAGERIE-COMPLEXE (10/11/2026, ligne Gérant 47 / M1137) — « Écrire au client », sur la fiche
// d'une réservation (E-G05) et sur la fiche client (E-G15). Le fil complexe ↔ client naît au
// PREMIER MESSAGE (modèle « Écrire aux dirigeants » de la Ville, COLL-FIX-DEMANDES) :
//   · il existe : l'appui l'ouvre, dans l'espace du complexe ;
//   · il n'existe pas : le bouton devient, sur place, la saisie du premier message ; rien n'est
//     créé tant qu'on n'envoie pas ; « Annuler » revient au bouton ;
//   · l'envoi crée le fil (avec le message) puis l'ouvre ;
//   · un refus se dit, sans rien ouvrir.

const mockNavigate = jest.fn();
const mockEcrire = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useEcrireAuReserveur: () => ({ isPending: false, mutateAsync: mockEcrire }),
}));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { onChangeText, testID, value }) {
    return <Saisie onChangeText={onChangeText} testID={testID} value={value} />;
  };
});
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <EcrireAuClient
        complexeId="cx-five"
        navigation={{ navigate: mockNavigate }}
        reservationId="r-48"
        testID="fiche-ecrire"
        title="Écrire au client"
      />,
    );
  });
  return arbre;
};

/**
 * Appuie sur le premier élément pressable DANS le repère.
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {Promise<void>} Fini.
 */
const appuyerDans = async (arbre, testID) => {
  const cible = parRepere(arbre, testID)
    .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MESSAGERIE-COMPLEXE — « Écrire au client »', () => {
  it(
    'le fil existe : l’appui le RETROUVE (sans message) et l’ouvre dans l’espace du complexe',
    async () => {
      mockEcrire.mockResolvedValue({ data: { chat: 'chat-154' } });
      const arbre = await monter();
      expect(lisibles(arbre)).toContain('Écrire au client');
      await appuyerDans(arbre, 'fiche-ecrire');
      expect(mockEcrire).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-48' });
      expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Conversation, {
        chatId: 'chat-154', espace: 'complexe',
      });
    },
  );

  it(
    'pas de fil : la saisie du premier message, sur place ; rien d’ouvert, rien de créé',
    async () => {
      mockEcrire.mockResolvedValue({ data: { chat: null } });
      const arbre = await monter();
      await appuyerDans(arbre, 'fiche-ecrire');
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockEcrire).toHaveBeenCalledTimes(1);
      expect(parRepere(arbre, 'fiche-ecrire-saisie')).not.toBeNull();
      expect(lisibles(arbre)).toContain('La conversation s’ouvre quand tu envoies ce message.');
    },
  );

  it('l’envoi crée le fil AVEC le message, puis l’ouvre', async () => {
    mockEcrire
      .mockResolvedValueOnce({ data: { chat: null } })
      .mockResolvedValueOnce({ data: { chat: 'chat-154' } });
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-ecrire');
    await act(async () => {
      parRepere(arbre, 'fiche-ecrire-premier-message').props.onChangeText('Salut !');
    });
    await appuyerDans(arbre, 'fiche-ecrire-envoyer');
    expect(mockEcrire).toHaveBeenLastCalledWith({
      complexeId: 'cx-five', message: 'Salut !', reservationId: 'r-48',
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Conversation, {
      chatId: 'chat-154', espace: 'complexe',
    });
  });

  it('« Annuler » revient au bouton, sans rien envoyer', async () => {
    mockEcrire.mockResolvedValue({ data: { chat: null } });
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-ecrire');
    await appuyerDans(arbre, 'fiche-ecrire-annuler');
    expect(parRepere(arbre, 'fiche-ecrire-saisie')).toBeNull();
    expect(mockEcrire).toHaveBeenCalledTimes(1);
  });

  it('un refus du serveur se dit, sans ouvrir de conversation', async () => {
    mockEcrire.mockRejectedValue(new Error('refus'));
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-ecrire');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(parRepere(arbre, 'fiche-ecrire-erreur')).not.toBeNull();
  });
});
