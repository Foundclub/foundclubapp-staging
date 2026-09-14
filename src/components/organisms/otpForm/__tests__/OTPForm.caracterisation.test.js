import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import OTPForm from '../OTPForm';

// E6 — OTPForm n'avait AUCUN témoin. Le commit Codex 441cb0ff (13/09) y a retiré
// le code prérempli « 123456 » et l'envoi automatique des contournements de
// recette, sans rien prouver. Ces tests figent le comportement ACTUEL :
//   1. rien ne part tout seul au montage, même avec un contournement de recette ;
//   2. la saisie manuelle de 6 chiffres envoie UNE fois ;
//   3. après un échec, rien ne repart seul, et l'utilisateur peut relancer.
// Preuve de discrimination (14/09) : sur la version d'avant 441cb0ff, le test 1
// est ROUGE (1 échec, 2 réussis).

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({ Alignments: { fullWidth: {} }, Spaces: { gap: { 24: {} } } }),
}));

jest.mock('@/hooks/useSafeTimers', () => ({
  __esModule: true,
  default: () => ({ clearSafeTimer: jest.fn(), setSafeInterval: jest.fn(() => 1) }),
}));

jest.mock('@/services/auth/otpSendThrottle', () => ({
  getOtpCooldownRemainingSeconds: () => 0,
}));

jest.mock('@/components/molecules/input/Input', () => {
  const { forwardRef } = jest.requireActual('react');
  const { TextInput: RNTextInput } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: forwardRef((/** @type {any} */ { onBlur, onChangeText, value }, ref) => (
      <RNTextInput onBlur={onBlur} onChangeText={onChangeText} ref={ref} value={value} />
    )),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <RNTouchable disabled={disabled} onPress={onPress}><RNText>{title}</RNText></RNTouchable>
    ),
  };
});

const CONFIRM_LABEL = 'otp.actions.confirm';

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

/**
 * Retrouve le bouton qui porte ce libellé.
 * @param {any} tree - l'arbre rendu
 * @param {string} title - le libellé cherché
 * @returns {any} le bouton
 */
const findButton = (tree, title) => tree.root.findAllByType(TouchableOpacity)
  .find((/** @type {any} */ node) => node.findAllByType(Text)
    .some((/** @type {any} */ txt) => txt.props.children === title));

/**
 * Rend le formulaire et laisse passer les effets du montage.
 * @param {any} loginMutation - la mutation de connexion simulée
 * @param {any} confirm - la confirmation Firebase simulée
 * @returns {Promise<any>} l'arbre rendu
 */
const renderForm = async (loginMutation, confirm) => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <OTPForm
        confirm={confirm}
        isLoading={false}
        loginMutation={loginMutation}
        phoneNumber="+33600000000"
      />,
    );
  });
  await flush();
  return /** @type {any} */ (tree);
};

describe('OTPForm — caractérisation après le retrait du préremplissage (441cb0ff)', () => {
  test('au montage : rien ne part, champ vide, même en contournement de recette', async () => {
    const loginMutation = { mutateAsync: jest.fn() };
    const confirm = { __localFirebaseFallbackBypass: true, __webQaBypass: true };
    const tree = await renderForm(loginMutation, confirm);

    expect(tree.root.findByType(TextInput).props.value).toBe('');
    expect(loginMutation.mutateAsync).not.toHaveBeenCalled();
  });

  test('6 chiffres puis « Valider » : un seul envoi, code et confirmation', async () => {
    const confirm = { verificationId: 'v1' };
    const loginMutation = { mutateAsync: jest.fn().mockResolvedValue({}) };
    const tree = await renderForm(loginMutation, confirm);

    await act(async () => { tree.root.findByType(TextInput).props.onChangeText('654321'); });
    await act(async () => { findButton(tree, CONFIRM_LABEL).props.onPress(); });
    await flush();

    expect(loginMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(loginMutation.mutateAsync).toHaveBeenCalledWith({ code: '654321', confirm });
  });

  test('après un échec, rien ne repart seul et un nouvel appui relance l envoi', async () => {
    const mutateAsync = jest.fn()
      .mockRejectedValueOnce(new Error('invalid-code'))
      .mockResolvedValue({});
    const tree = await renderForm({ mutateAsync }, { verificationId: 'v1' });

    await act(async () => { tree.root.findByType(TextInput).props.onChangeText('111111'); });
    await act(async () => { findButton(tree, CONFIRM_LABEL).props.onPress(); });
    await flush();
    await flush();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(findButton(tree, CONFIRM_LABEL).props.disabled).toBe(false);

    await act(async () => { findButton(tree, CONFIRM_LABEL).props.onPress(); });
    await flush();
    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });
});
