import fs from 'fs';
import path from 'path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScrollView, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { computeMessageMenuLayout } from '@/domains/messaging/reactionPillPlacement';

import Calque from '@/components/molecules/messageReactionOverlay/MessageReactionOverlay';
import VideoMessagePlayer from '@/components/molecules/videoMessage/VideoMessagePlayer';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import LieuSurCarte from '@/components/organisms/autocompleteAddressInput/LieuSurCarte';
import PreDemandeNotifications from '@/components/organisms/notifications/PreDemandeNotifications';
import AdminsDuGroupe from '@/views/chat/AdminsDuGroupe';
import ApercuDuFil from '@/views/chat/ApercuDuFil';
import AutorisationsDuGroupe from '@/views/chat/AutorisationsDuGroupe';
import FeuillePhotoDuGroupe from '@/views/chat/FeuillePhotoDuGroupe';
import InfosDuGroupe from '@/views/chat/InfosDuGroupe';

import { proposerPreDemandeNotifications } from '@/utils/notifications/preDemandeNotifications';

import { setItem } from '@/platform/storage';

// 🤖 ANDROIDBAR-2BIS — les fenêtres <Modal statusBarTranslucent> qui restaient à trier après
// ANDROIDBAR-2. Règle mesurée à l'émulateur par ANDROIDBAR-2 (Pixel 9, Android 16, barre à
// 3 boutons = 48 dp) : une <Modal> AVEC `statusBarTranslucent` descend SOUS la barre d'Android ;
// ce qui touche son bas doit donc réserver `useSafeAreaInsets().bottom`. Sans ce réglage, Android
// remonte lui-même la fenêtre (garde G d'ANDROIDBAR2.feuillesEtBarre.test.js).
// Trié par lecture le 13/10 (`app` 28bae221) : 13 fenêtres translucides, 0 à corriger :
// - réservent déjà la barre : Adresse et Convocation (corrigées avant), les 7 rendues ici ;
// - sans objet (carte centrée, ou menu posé en haut) : MenuDuFil, SmartNotificationHost,
//   GlobalPromptModal, EventDetails « en retard ».
// Ce témoin garde l'acquis : une 14ᵉ fenêtre translucide le fait rougir tant qu'elle n'est pas
// triée ici, et chaque feuille rendue rougit si sa marge basse redevient fixe.
// 🖼️ MSGIMG (20/10) — 15ᵉ, triée : l'image d'une conversation ouverte en grand (ApercuDImage).
// Seul l'avis « Image enregistrée » touche son bas, et il RÉSERVE la barre (`insets.bottom + 24`,
// mesuré dans ConversationMSGIMG.apercu MSGIMG-3a) ; boutons en haut, image centrée.
// 🎬 MSG-MEDIA (29/10) — 16ᵉ, triée : le lecteur d'une vidéo de messagerie (VideoMessagePlayer,
// plein écran). Son bas porte « Ouvrir dans le navigateur » et RÉSERVE la barre
// (`bottom + 12`), mesuré ci-dessous ; la croix est en haut, sous `insets.top`.
// 🔔 NOTIF-PREDEMANDE (29/10) — 17ᵉ, triée : l'écran « Active les notifications » (plein écran).
// Son bas porte « Activer » / « Plus tard » et RÉSERVE la barre (`insets.bottom + 24`), mesuré
// ci-dessous. Les deux lots ont tourné pendant la panne des modules du 29/10 (21:31) : ce
// témoin ne les avait pas vus, la récolte 2686 l'a fait rougir.
// 📐 COLL-R-A7 (13/10, COL-005) — 14ᵉ, triée : le tunnel « Attribuer un créneau » en plein écran
// (`FenetrePleinEcran` de SeasonSlotForm). Son bas est celui du gabarit des tunnels
// (WizardStepLayout, `insets.bottom + 12`, D53) : RÉSERVE la barre, mesuré ci-dessous.

let mockInsets = {
  bottom: 48, left: 0, right: 0, top: 24,
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));
// Un petit téléphone Android (360 × 640) : c'est là que l'aperçu du fil se raccourcit.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 640, scale: 3, width: 360,
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      return typeof gabarit === 'string' ? gabarit : cle;
    },
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
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
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
// COLL-R-A7 : le conteneur du gabarit des tunnels, réduit à la marge qu'il reçoit (son fond
// d'écran, un dégradé natif, reste hors du banc).
jest.mock('@/components/templates/ScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return function ScreenContainerMock(/** @type {any} */ { children, contentContainerStyle }) {
    return reactActuel.createElement(
      VueRN,
      { style: contentContainerStyle, testID: 'ecran-du-tunnel' },
      children,
    );
  };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/views/chat/AvatarDuFil', () => () => null);
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatMessages: () => ({ data: { pages: [] } }),
}));
// Carte « Placer le lieu » : la carte, le réseau, le champ et le bouton sont doublés.
jest.mock('@/platform/maps', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {
      readCurrentLocationIfGranted: () => null,
      renderPinMap: () => <VueRN testID="carte-a-epingle" />,
    },
  };
});
jest.mock('@/services/places/placesQueries', () => ({
  useCreateLieu: () => ({ isPending: false, mutateAsync: () => Promise.resolve({}) }),
  useGetPlacesFromCoordinates: () => ({ data: null }),
}));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: SaisieRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <SaisieRN testID="lieu-nom" />,
  };
});
jest.mock('@/components/atoms/button/Button', () => 'Button');
// MSG-MEDIA : le lecteur vidéo charge sa WebView à l'ouverture ; NOTIF-PREDEMANDE lit la
// permission du téléphone. Les deux sont doublés.
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: () => {} } }));
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { getNotificationSettings: () => Promise.resolve({}) },
}));
jest.mock('@/utils/notifications/etatPermissionNotifications', () => ({
  lireEtatPermissionNotifications: () => Promise.resolve('a_demander'),
}));

/** Android 15/16 en 3 boutons et en gestes, iPhone (barre d'accueil), Android ≤ 14. */
const BARRES = /** @type {[string, number][]} */ ([
  ['Android 15/16 à 3 boutons', 48],
  ['Android 15/16 à gestes', 24],
  ['iPhone', 34],
  ['Android ≤ 14', 0],
]);

/**
 * Pose la hauteur de la barre du bas que les feuilles liront.
 * @param {number} bas - `useSafeAreaInsets().bottom`
 */
const simuler = (bas) => {
  mockInsets = {
    bottom: bas, left: 0, right: 0, top: 24,
  };
};

/**
 * Monte un élément, rend son arbre.
 * @param {import('react').ReactElement} element
 * @returns {any}
 */
const monter = (element) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(element);
  });
  return arbre;
};

/**
 * La marge basse du premier nœud natif, lui ou un ancêtre, qui en porte une.
 * @param {any} noeud
 * @returns {number}
 */
const margeBasseDe = (noeud) => {
  for (let courant = noeud; courant; courant = courant.parent) {
    const marge = typeof courant.type === 'string'
      ? StyleSheet.flatten(courant.props.style)?.paddingBottom
      : undefined;
    if (typeof marge === 'number') return marge;
  }
  return Number.NaN;
};

/**
 * Le nœud natif qui porte ce `testID`.
 * @param {any} arbre
 * @param {string} testID
 * @returns {any}
 */
const natif = (arbre, testID) => arbre.root.find(
  (/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === testID,
);

/**
 * Touche l'élément qui porte ce `testID`.
 * @param {any} arbre
 * @param {string} testID
 */
const toucher = (arbre, testID) => {
  act(() => {
    arbre.root.find(
      (/** @type {any} */ n) => n.props.testID === testID && typeof n.props.onPress === 'function',
    ).props.onPress();
  });
};

/**
 * La marge de fin du défilement (le premier `ScrollView`).
 * @param {any} arbre
 * @returns {number}
 */
const margeDuDefilement = (arbre) => StyleSheet.flatten(
  arbre.root.findAllByType(ScrollView)[0].props.contentContainerStyle,
).paddingBottom;

const rien = () => {};

/**
 * « Infos du groupe », ouverte, pour ce groupe.
 * @param {Record<string, any>} [chat]
 * @returns {import('react').ReactElement}
 */
const infosDuGroupe = (chat) => (
  <InfosDuGroupe
    adminIds={['moi']}
    chat={chat}
    estAdmin
    meId="moi"
    onAjouter={rien}
    onBasculerAdmin={rien}
    onClose={rien}
    onEnvoyerUnMessage={rien}
    onQuitter={rien}
    onRenommer={() => Promise.resolve()}
    onRetirer={rien}
    onSignaler={rien}
    visible
  />
);

/**
 * Chaque feuille : ce qui touche son bas, la marge que le dessin lui donne sans barre, la mesure.
 * @type {[string, number, () => number][]}
 */
const FEUILLES = [
  ['FeuillePhotoDuGroupe — dernière ligne', 34, () => margeBasseDe(natif(monter(
    <FeuillePhotoDuGroupe
      aPhoto
      enFenetre
      onChoisir={rien}
      onClose={rien}
      onSupprimer={rien}
      visible
    />,
  ), 'photo-du-groupe-feuille'))],
  ['AdminsDuGroupe — barre « Valider »', 34, () => margeBasseDe(natif(monter(
    <AdminsDuGroupe
      adminsInitiaux={['moi']}
      enFenetre
      meId="moi"
      membres={[{ id: 'moi', nom: 'Adel' }, { id: 'lea', nom: 'Léa' }]}
      note="Les admins gèrent le groupe."
      onClose={rien}
      onValider={rien}
      visible
    />,
  ), 'admins-du-groupe-valider').parent)],
  ['AutorisationsDuGroupe — fin de la liste', 40, () => margeDuDefilement(monter(
    <AutorisationsDuGroupe
      admins={[]}
      enFenetre
      onChanger={rien}
      onClose={rien}
      valeurs={{}}
      visible
    />,
  ))],
  ['InfosDuGroupe — fin de la page', 40, () => margeDuDefilement(monter(
    infosDuGroupe({
      groupName: 'Covoit U15',
      participants: [{ documentId: 'moi', firstname: 'Adel' }],
    }),
  ))],
  ['InfosDuGroupe — fiche d’un membre', 34, () => {
    const arbre = monter(infosDuGroupe({
      groupName: 'Covoit U15',
      participants: [
        { documentId: 'moi', firstname: 'Adel' },
        { documentId: 'lea', firstname: 'Léa' },
      ],
    }));
    toucher(arbre, 'infos-du-groupe-membre-lea');
    return margeBasseDe(natif(arbre, 'infos-du-groupe-fiche'));
  }],
  ['LieuSurCarte — panneau « Nom du lieu » / « Placer ici »', 16, () => margeBasseDe(natif(
    monter(<LieuSurCarte onFermer={rien} onLieuPose={rien} visible />),
    'lieu-nom',
  ).parent)],
  ['MessageReactionOverlay — clavier d’émojis', 0, () => {
    const arbre = monter(
      <Calque
        anchor={{
          height: 60, width: 220, x: 16, y: 300,
        }}
        myEmoji=""
        onAction={rien}
        onClose={rien}
        onSelect={rien}
        visible
      />,
    );
    toucher(arbre, 'WHATSAPP-plus');
    return margeBasseDe(natif(arbre, 'WHATSAPP-clavier'));
  }],
  ['VideoMessagePlayer — « Ouvrir dans le navigateur »', 12, () => margeBasseDe(natif(
    monter(<VideoMessagePlayer onClose={rien} url="https://cdn.example.test/but.mp4" />),
    'video-message-player-browser',
  ))],
  ['SeasonSlotForm — bas du tunnel plein écran (WizardStepLayout)', 12, () => margeBasseDe(natif(
    monter(
      <WizardStepLayout
        headerVariant="focus"
        onNext={rien}
        stepCount={5}
        stepIndex={1}
        title="Pour quel club ?"
      >
        {null}
      </WizardStepLayout>,
    ),
    'ecran-du-tunnel',
  ))],
];

// Le premier montage charge les feuilles et leurs dépendances.
jest.setTimeout(60000);

describe('ANDROIDBAR-2BIS — les fenêtres translucides réservent la barre d’Android', () => {
  test('R — il y a 17 <Modal statusBarTranslucent> dans src/, toutes triées ici', () => {
    const racine = path.join(__dirname, '..', '..');
    /** @type {string[]} */
    const trouvees = [];
    /**
     * Relève, fichier par fichier, les fenêtres translucides de ce dossier.
     * @param {string} dossier
     */
    const parcourir = (dossier) => {
      fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
        const chemin = path.join(dossier, entree.name);
        if (entree.isDirectory()) {
          if (entree.name !== '__tests__') parcourir(chemin);
          return;
        }
        if (!/\.(js|jsx|ts|tsx)$/.test(entree.name) || /\.test\./.test(entree.name)) return;
        // L'attribut JSX, pas sa mention entre `…` dans un commentaire.
        const vues = fs.readFileSync(chemin, 'utf8')
          .match(/(^|[\s{(])statusBarTranslucent(?=[\s>=]|$)/gm);
        if (vues) {
          const relatif = path.relative(racine, chemin).split(path.sep).join('/');
          trouvees.push(`${relatif} ×${vues.length}`);
        }
      });
    };
    parcourir(racine);
    // Une fenêtre de plus : la trier (son bas touche-t-il la barre ?) puis l'ajouter ici.
    expect(trouvees.sort()).toEqual([
      'components/molecules/apercuDImage/ApercuDImage.js ×1',
      'components/molecules/messageReactionOverlay/MessageReactionOverlay.js ×1',
      'components/molecules/videoMessage/VideoMessagePlayer.js ×1',
      'components/organisms/autocompleteAddressInput/LieuSurCarte.js ×1',
      'components/organisms/feuilleDAdresse/FeuilleDAdresse.js ×1',
      'components/organisms/notifications/PreDemandeNotifications.js ×1',
      'components/organisms/notifications/SmartNotificationHost.js ×1',
      'components/organisms/popup/GlobalPromptModal.js ×1',
      'components/organisms/seasonSlot/SeasonSlotForm.js ×1',
      'views/chat/AdminsDuGroupe.js ×1',
      'views/chat/ApercuDuFil.js ×1',
      'views/chat/AutorisationsDuGroupe.js ×1',
      'views/chat/FeuillePhotoDuGroupe.js ×1',
      'views/chat/InfosDuGroupe.js ×1',
      'views/chat/MenuDuFil.js ×1',
      'views/conversationConvocation/ConvocationWizard.js ×1',
      'views/event/EventDetails.js ×1',
    ]);
  });

  describe.each(BARRES)('%s (barre %i)', (_nom, bas) => {
    test.each(FEUILLES)('%s : marge basse ≥ la barre, dessin gardé', (_f, dessin, mesurer) => {
      simuler(bas);
      const marge = mesurer();
      expect(marge).toBeGreaterThanOrEqual(bas);
      expect(marge).toBeGreaterThanOrEqual(dessin);
    });

    test('PreDemandeNotifications — les boutons du bas au-dessus de la barre', async () => {
      simuler(bas);
      // La memoire de la pre-demande remise a zero : l ecran peut s ouvrir a chaque barre.
      setItem('notif_predemande_v1', '');
      const client = new QueryClient();
      /** @type {any} */
      let arbre;
      await act(async () => {
        arbre = renderer.create(
          <QueryClientProvider client={client}>
            <PreDemandeNotifications activerNotifications={() => Promise.resolve('success')} />
          </QueryClientProvider>,
        );
      });
      await act(async () => {
        proposerPreDemandeNotifications('inscription');
        await Promise.resolve();
      });
      const bouton = arbre.root.findAll(
        (/** @type {any} */ n) => n.type === 'Button',
      )[0];
      const marge = margeBasseDe(bouton);
      expect(marge).toBeGreaterThanOrEqual(bas);
      expect(marge).toBeGreaterThanOrEqual(24);
      act(() => arbre.unmount());
      client.clear();
    });

    test('ApercuDuFil — le menu sous la carte finit au-dessus de la barre (écran 640)', () => {
      simuler(bas);
      const entrees = ['lu', 'epingler', 'archiver'].map((cle) => ({
        cle, icone: 'check', libelle: cle, onPress: rien,
      }));
      const arbre = monter(
        <ApercuDuFil
          chat={{ documentId: 'chat-1', groupName: 'Les U13', type: 'group' }}
          entrees={entrees}
          meId="moi"
          nonLu={false}
          onClose={rien}
          onOuvrir={rien}
          titre="Les U13"
          visible
        />,
      );
      // 50 : `LIGNE_DU_MENU` d'ApercuDuFil, la hauteur d'une ligne du menu.
      const basDuMenu = StyleSheet.flatten(natif(arbre, 'apercu-du-fil-menu').props.style).top
        + entrees.length * 50;
      expect(basDuMenu).toBeLessThanOrEqual(640 - bas);
    });

    test('MessageReactionOverlay — le menu d’un message du bas reste au-dessus de la barre', () => {
      // Bulle finie à 410 sur 640 : 222 de place dessous, assez pour le menu (200 + 8 + 8) si
      // l'on oublie la barre, plus assez avec elle ⇒ le menu doit monter au-dessus du message.
      const place = computeMessageMenuLayout({
        anchor: {
          height: 40, width: 200, x: 20, y: 370,
        },
        insets: { bottom: bas, top: 24 },
        menu: { height: 200, width: 220 },
        pill: { height: 48, width: 300 },
        window: { height: 640, width: 360 },
      });
      expect(place.menu.top + 200).toBeLessThanOrEqual(640 - bas);
    });
  });
});
