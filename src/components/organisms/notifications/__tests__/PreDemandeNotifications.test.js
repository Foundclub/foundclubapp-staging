// NOTIF-PREDEMANDE (29/10/2026, decision d'Adel « 2- A ») — notre ecran de
// pre-demande : « Activer » ouvre la fenetre systeme, « Plus tard » ne demande rien,
// il revient aux moments cles au plus une fois tous les 7 jours, et un refus deja
// donne transforme le bouton en « Ouvrir les Réglages ».
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Linking, Modal, Platform, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { lireEtatPermissionNotifications } from '@/utils/notifications/etatPermissionNotifications';
import {
  lireMemoirePreDemande,
  proposerPreDemandeNotifications,
} from '@/utils/notifications/preDemandeNotifications';

import PreDemandeNotifications from '../PreDemandeNotifications';

// Le stockage reel du telephone (doublure memoire en test), pour repartir d'un appareil neuf.
const { setItem } = require('@/platform/storage');

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { getNotificationSettings: jest.fn() },
}));

jest.mock('@/utils/notifications/etatPermissionNotifications', () => ({
  lireEtatPermissionNotifications: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_cle, repli) => repli }),
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

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const JOUR = 24 * 60 * 60 * 1000;

const texte = (noeud) => [].concat(noeud.props.children).join('');
const textes = (arbre) => arbre.root.findAllByType(Text).map(texte);
const visible = (arbre) => arbre.root.findByType(Modal).props.visible;
const appuyer = async (arbre, libelle) => {
  const noeud = arbre.root.findAllByType(TouchableOpacity)
    .find((n) => n.findAllByType(Text).some((t) => texte(t) === libelle));
  await act(async () => { await noeud.props.onPress(); });
};

let queryClient;
let activerNotifications;

const monter = async () => {
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <PreDemandeNotifications activerNotifications={activerNotifications} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

const proposer = async (moment = 'inscription') => {
  await act(async () => {
    proposerPreDemandeNotifications(moment);
    await Promise.resolve();
  });
};

beforeEach(() => {
  setItem('notif_predemande_v1', '');
  Platform.OS = 'ios';
  queryClient = new QueryClient();
  activerNotifications = jest.fn(async () => 'success');
  lireEtatPermissionNotifications.mockResolvedValue('a_demander');
});

afterEach(() => queryClient.clear());

test('l ecran s ouvre a la demande, avec la raison, « Activer » et « Plus tard »', async () => {
  const arbre = await monter();
  expect(visible(arbre)).toBe(false);
  await proposer();
  expect(visible(arbre)).toBe(true);
  expect(textes(arbre).join(' ')).toContain('quand ton coach t’accepte');
  expect(textes(arbre)).toEqual(expect.arrayContaining(['Activer', 'Plus tard']));
});

test('« Activer » ⇒ la demande systeme, puis l ecran se ferme', async () => {
  const arbre = await monter();
  await proposer();
  await appuyer(arbre, 'Activer');
  expect(activerNotifications).toHaveBeenCalledTimes(1);
  expect(visible(arbre)).toBe(false);
});

test('« Plus tard » ⇒ aucune demande systeme, un report compte', async () => {
  const arbre = await monter();
  await proposer();
  await appuyer(arbre, 'Plus tard');
  expect(activerNotifications).not.toHaveBeenCalled();
  expect(visible(arbre)).toBe(false);
  expect(lireMemoirePreDemande().reports).toBe(1);
});

test('apres « Plus tard », rien avant 7 jours, puis retour au moment cle', async () => {
  const maintenant = jest.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
  const arbre = await monter();
  await proposer();
  await appuyer(arbre, 'Plus tard');

  maintenant.mockReturnValue(1_000_000_000_000 + (6 * JOUR));
  await proposer('adhesion');
  expect(visible(arbre)).toBe(false);

  maintenant.mockReturnValue(1_000_000_000_000 + (7 * JOUR));
  await proposer('adhesion');
  expect(visible(arbre)).toBe(true);
  maintenant.mockRestore();
});

test('un message non lu arrive dans le cache ⇒ l ecran revient', async () => {
  const arbre = await monter();
  await act(async () => {
    queryClient.setQueryData(['chats'], { pages: [{ data: [], meta: { unreadTotal: 1 } }] });
    await Promise.resolve();
  });
  expect(visible(arbre)).toBe(true);
});

test('permission deja accordee ⇒ l ecran ne s ouvre pas', async () => {
  lireEtatPermissionNotifications.mockResolvedValue('accordee');
  const arbre = await monter();
  await proposer();
  expect(visible(arbre)).toBe(false);
});

test('deja refusee ⇒ « Ouvrir les Réglages », sans demande systeme', async () => {
  lireEtatPermissionNotifications.mockResolvedValue('refusee');
  const reglages = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  const arbre = await monter();
  await proposer();
  expect(textes(arbre)).toContain('Ouvrir les Réglages');
  expect(textes(arbre)).not.toContain('Activer');
  await appuyer(arbre, 'Ouvrir les Réglages');
  expect(reglages).toHaveBeenCalledTimes(1);
  expect(activerNotifications).not.toHaveBeenCalled();
});
