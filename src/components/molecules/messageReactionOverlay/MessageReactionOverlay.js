import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EMOJI_CATALOG } from '@/domains/messaging/emojiCatalog';
import { getMessageActions } from '@/domains/messaging/messageActions';
import { computeMessageMenuLayout } from '@/domains/messaging/reactionPillPlacement';
import { REACTION_EMOJIS } from '@/domains/messaging/reactionUseCases';
import useTheme from '@/theme/themeContext';

/**
 * 👆 44 POINTS, ET CE N EST PAS NEGOCIABLE : c est le minimum tactile d Apple et
 * d Android, et la regle la plus severe du reperage UI. Les boutons faisaient 38
 * avant ce lot.
 */
const BOUTON = 44;

/**
 * ⚖️ L ECART EST A 4, SOUS LES 8 RECOMMANDES, et c est un arbitrage assume : sept
 * boutons de 44 avec 8 d ecart feraient 366 px, soit plus que la largeur utile
 * d un iPhone SE (359). Entre les deux regles, on garde LA TAILLE DE CIBLE (haute
 * severite) et on cede sur l ecart (severite moyenne) — c est aussi ce que fait
 * WhatsApp.
 */
const ECART = 4;
const MARGE_INTERNE = 6;

/** 6 raccourcis + le « + » : sept boutons, leurs ecarts, le cadre. */
export const REACTION_PILL_WIDTH = (BOUTON * 7) + (ECART * 6) + (MARGE_INTERNE * 2);
export const REACTION_PILL_HEIGHT = BOUTON + (MARGE_INTERNE * 2);

/** Le menu d actions : une rangee par action, toutes a la taille tactile. */
const MENU_WIDTH = 224;
const MENU_LIGNE = 48;
const MENU_MARGE = 6;

/** Le clavier d emojis occupe un peu plus de la moitie de l ecran, comme sur WhatsApp. */
const RATIO_CLAVIER = 0.55;
const COLONNES = 8;

/**
 * 🩹 L ESPACE RESERVE EN HAUT D UNE FEUILLE — LA CAUSE COMMUNE DES TITRES COUPES.
 *
 * Deux titres differents etaient rognes par le haut en 2.6.56 : les familles du
 * clavier d emojis et le « Ajouter » de la feuille du trombone. Le point commun
 * n etait ni la police (Montserrat h3 est en 20/28, large) ni le composant : les
 * deux posaient leur premier texte a ~10-12 px du bord superieur d une feuille
 * aux coins tres arrondis (24 et 32 px). Sous la courbe, ce haut de texte
 * disparait.
 *
 * ⇒ La regle, desormais explicite : le premier contenu d une feuille commence AU
 * MOINS au niveau du rayon de ses coins.
 */
const RAYON_FEUILLE = 24;
const ESPACE_SOUS_LE_BORD = RAYON_FEUILLE;

/**
 * WHATSAPP2 — LE MENU CONTEXTUEL DE L APPUI LONG.
 *
 * 🧨 CE QU IL CORRIGE. En 2.6.56, l appui long ouvrait DEUX choses : la pilule
 * d emojis posee sur le message, et un panneau d actions qui occupait tout le bas
 * de l ecran. Quand le message vise etait en bas — le cas le plus frequent — le
 * panneau recouvrait la pilule, et Adel voyait ses emojis tranches a mi-hauteur.
 *
 * 🎯 CE QU IL FAIT MAINTENANT, et c est le geste de WhatsApp :
 *   · le fond s assombrit, mais le message vise reste NET et en avant — le voile
 *     est decoupe en quatre morceaux AUTOUR de lui plutot que pose par-dessus ;
 *   · la rangee d emojis se pose juste au-dessus du message ;
 *   · les actions se posent juste en dessous, en menu compact ancre au message ;
 *   · un appui n importe ou ailleurs ferme tout. Plus rien ne monte du bas.
 *
 * 📐 Les deux panneaux sont places ENSEMBLE par `computeMessageMenuLayout`, qui
 * garantit qu ils ne se chevauchent jamais, quel que soit l endroit du message
 * dans le fil. C est ce calcul qui porte la correction, pas ce fichier.
 * @param {object} props Les proprietes.
 * @param {{height: number, width: number, x: number, y: number} | null} [props.anchor]
 *   La bulle visee, mesuree a l ecran (`measureInWindow`).
 * @param {boolean} [props.canCopy] Le message porte-t-il du texte a copier ?
 * @param {boolean} [props.canEdit] Puis-je le modifier ?
 * @param {boolean} [props.canEditComposition] MESSAGERIE-1C : la carte d'une convocation que je
 *   peux modifier (« Modifier la composition »).
 * @param {boolean} [props.isMine] Est-il a moi ? La pilule et le menu se rangent a droite.
 * @param {string} [props.myEmoji] L emoji que j ai deja pose sur ce message.
 * @param {(key: string) => void} props.onAction Appelee avec la clef de l action choisie.
 * @param {() => void} props.onClose Ferme le calque.
 * @param {(emoji: string) => void} props.onSelect Appelee avec l emoji choisi.
 * @param {boolean} props.visible Vrai quand le calque est ouvert.
 * @returns {import('react').ReactElement} Le calque.
 */
function MessageReactionOverlay({
  anchor = null,
  canCopy = false,
  canEdit = false,
  canEditComposition = false,
  isMine = false,
  myEmoji = '',
  onAction,
  onClose,
  onSelect,
  visible,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: hauteurEcran, width: largeurEcran } = useWindowDimensions();
  const [clavierOuvert, setClavierOuvert] = useState(false);
  const [famille, setFamille] = useState(EMOJI_CATALOG[0]?.key ?? '');

  const actions = useMemo(
    () => getMessageActions({
      canCopy, canEdit, canEditComposition, isMine,
    }),
    [canCopy, canEdit, canEditComposition, isMine],
  );

  const hauteurMenu = (actions.length * MENU_LIGNE) + (MENU_MARGE * 2);

  const place = useMemo(() => computeMessageMenuLayout({
    alignEnd: isMine,
    anchor,
    insets: { bottom: insets.bottom, top: insets.top },
    menu: { height: hauteurMenu, width: MENU_WIDTH },
    pill: { height: REACTION_PILL_HEIGHT, width: REACTION_PILL_WIDTH },
    window: { height: hauteurEcran, width: largeurEcran },
  }), [
    anchor, hauteurEcran, hauteurMenu, insets.bottom, insets.top, isMine, largeurEcran,
  ]);

  const emojisDeLaFamille = useMemo(() => (
    EMOJI_CATALOG.find((categorie) => categorie.key === famille)?.emojis ?? []
  ), [famille]);

  const fermer = () => {
    setClavierOuvert(false);
    onClose();
  };

  const choisir = (/** @type {string} */ emoji) => {
    setClavierOuvert(false);
    onSelect(emoji);
  };

  const VOILE = 'rgba(0, 0, 0, 0.55)';

  /**
   * Le voile, DECOUPE AUTOUR DU MESSAGE.
   *
   * 🔦 C est ce qui met le message « en avant » sans le redessiner : quatre bandes
   * sombres l encadrent, et le trou laisse voir la vraie bulle, nette, a sa vraie
   * place. Rien n est duplique, donc rien ne peut differer de l original.
   * @returns {import('react').ReactElement} Les quatre bandes, ou un voile plein.
   */
  const renderVoile = () => {
    if (!anchor) {
      return (
        <Pressable
          accessibilityLabel={t('common.close', 'Fermer')}
          onPress={fermer}
          style={{ backgroundColor: VOILE, flex: 1 }}
        />
      );
    }

    const basDeLaBulle = anchor.y + anchor.height;
    // Le type est ecrit : sans lui, `position` est vu comme une chaine quelconque
    // et TypeScript refuse le style (TS2322).
    const bande = /** @type {import('react-native').ViewStyle} */ ({
      backgroundColor: VOILE, position: 'absolute',
    });

    return (
      <>
        <Pressable
          accessibilityLabel={t('common.close', 'Fermer')}
          onPress={fermer}
          style={[bande, {
            height: Math.max(0, anchor.y), left: 0, right: 0, top: 0,
          }]}
          testID="WHATSAPP-voile-haut"
        />
        <Pressable
          onPress={fermer}
          style={[bande, {
            bottom: 0, height: Math.max(0, hauteurEcran - basDeLaBulle), left: 0, right: 0,
          }]}
          testID="WHATSAPP-voile-bas"
        />
        <Pressable
          onPress={fermer}
          style={[bande, {
            height: anchor.height, left: 0, top: anchor.y, width: Math.max(0, anchor.x),
          }]}
          testID="WHATSAPP-voile-gauche"
        />
        <Pressable
          onPress={fermer}
          style={[bande, {
            height: anchor.height,
            left: anchor.x + anchor.width,
            top: anchor.y,
            width: Math.max(0, largeurEcran - anchor.x - anchor.width),
          }]}
          testID="WHATSAPP-voile-droite"
        />
      </>
    );
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={fermer}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      {/*
        ♿ LES TROIS ISSUES, POUR QUI NE VOIT PAS L ECRAN. « Annuler » a disparu
        avec la feuille du bas : on ferme en appuyant a cote. Mais « a cote »
        n existe pas au lecteur d ecran — le doigt balaie des elements, il ne
        vise pas une zone vide. Sans issue declaree, la personne reste ENFERMEE.
          · `accessibilityViewIsModal` : VoiceOver cesse d annoncer la
            conversation derriere et ne propose plus que le calque ;
          · `onAccessibilityEscape` : le geste d echappement d iOS (deux doigts
            en Z) ferme ;
          · `onRequestClose` du Modal : le bouton retour d Android ferme aussi.
        Le voile, lui, porte deja le libelle « Fermer » : c est une quatrieme
        sortie, celle-la atteignable au balayage.
      */}
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={fermer}
        style={{ flex: 1 }}
        testID="WHATSAPP-calque"
      >
        {renderVoile()}

        {!clavierOuvert ? (
          <>
            <View
              accessibilityLabel={t('conversation.reactions.pick', 'Choisir une réaction')}
              accessibilityRole="menu"
              style={{
                alignItems: 'center',
                backgroundColor: Colors.neutral800,
                borderColor: Colors.neutral600,
                borderRadius: 999,
                borderWidth: 1,
                flexDirection: 'row',
                gap: ECART,
                height: REACTION_PILL_HEIGHT,
                left: place.pill.left,
                padding: MARGE_INTERNE,
                position: 'absolute',
                top: place.pill.top,
                width: REACTION_PILL_WIDTH,
              }}
              testID="WHATSAPP-pilule"
            >
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  accessibilityLabel={emoji}
                  accessibilityRole="button"
                  accessibilityState={{ selected: myEmoji === emoji }}
                  activeOpacity={0.6}
                  key={`pilule-${emoji}`}
                  onPress={() => choisir(emoji)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: myEmoji === emoji ? Colors.primary700 : Colors.transparent,
                    borderRadius: 999,
                    height: BOUTON,
                    justifyContent: 'center',
                    width: BOUTON,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                accessibilityLabel={t('conversation.reactions.more', "Plus d'emojis")}
                accessibilityRole="button"
                activeOpacity={0.6}
                onPress={() => setClavierOuvert(true)}
                style={{
                  alignItems: 'center',
                  backgroundColor: Colors.neutral700,
                  borderRadius: 999,
                  height: BOUTON,
                  justifyContent: 'center',
                  width: BOUTON,
                }}
                testID="WHATSAPP-plus"
              >
                <Text style={{ color: Colors.neutral00, fontSize: 24, lineHeight: 28 }}>+</Text>
              </TouchableOpacity>
            </View>

            <View
              accessibilityRole="menu"
              style={{
                backgroundColor: Colors.neutral800,
                borderColor: Colors.neutral600,
                borderRadius: 14,
                borderWidth: 1,
                left: place.menu.left,
                paddingVertical: MENU_MARGE,
                position: 'absolute',
                top: place.menu.top,
                width: MENU_WIDTH,
              }}
              testID="WHATSAPP-menu"
            >
              {actions.map((action) => (
                <TouchableOpacity
                  accessibilityLabel={t(action.labelKey, action.fallback)}
                  accessibilityRole="menuitem"
                  activeOpacity={0.6}
                  key={action.key}
                  onPress={() => onAction(action.key)}
                  style={{
                    height: MENU_LIGNE,
                    justifyContent: 'center',
                    paddingHorizontal: 16,
                  }}
                  testID={`WHATSAPP-action-${action.key}`}
                >
                  <Text
                    style={{
                    // 🔴 « Supprimer » est la seule action qui detruit : elle porte la
                    // couleur d alerte, et elle est la derniere de la liste.
                      color: action.destructive ? Colors.error500 : Colors.neutral00,
                      fontSize: 16,
                      lineHeight: 22,
                    }}
                  >
                    {t(action.labelKey, action.fallback)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {clavierOuvert ? (
          <View
            style={{
              backgroundColor: Colors.neutral800,
              borderTopLeftRadius: RAYON_FEUILLE,
              borderTopRightRadius: RAYON_FEUILLE,
              bottom: 0,
              height: hauteurEcran * RATIO_CLAVIER,
              left: 0,
              paddingBottom: insets.bottom,
              position: 'absolute',
              right: 0,
            }}
            testID="WHATSAPP-clavier"
          >
            {/*
            🩹 LES TITRES DE FAMILLES NE SONT PLUS COUPES. Le defaut etait double :
            le `paddingVertical` vivait dans `style` (sur un ScrollView, il faut le
            mettre dans `contentContainerStyle`, sinon la hauteur se calcule sans
            lui et le contenu est rogne), et 10 px ne suffisaient pas a sortir de
            la courbe des coins. Les deux sont corriges ici.
          */}
            <ScrollView
              contentContainerStyle={{
                alignItems: 'center',
                paddingBottom: 8,
                paddingHorizontal: 8,
                paddingTop: ESPACE_SOUS_LE_BORD,
              }}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
            >
              {EMOJI_CATALOG.map((categorie) => (
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: famille === categorie.key }}
                  activeOpacity={0.6}
                  key={categorie.key}
                  onPress={() => setFamille(categorie.key)}
                  style={{
                    backgroundColor: famille === categorie.key
                      ? Colors.primary700
                      : Colors.transparent,
                    borderRadius: 999,
                    justifyContent: 'center',
                    marginHorizontal: 4,
                    minHeight: BOUTON,
                    paddingHorizontal: 14,
                  }}
                >
                  <Text style={{ color: Colors.neutral00, fontSize: 14, lineHeight: 20 }}>
                    {t(`conversation.reactions.categories.${categorie.key}`, categorie.key)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FlatList
              data={emojisDeLaFamille}
              initialNumToRender={64}
              keyExtractor={(emoji) => emoji}
              numColumns={COLONNES}
              renderItem={({ item }) => (
                <TouchableOpacity
                  accessibilityLabel={item}
                  accessibilityRole="button"
                  activeOpacity={0.6}
                  onPress={() => choisir(item)}
                  style={{ alignItems: 'center', flex: 1 / COLONNES, paddingVertical: 8 }}
                >
                  <Text style={{ fontSize: 26 }}>{item}</Text>
                </TouchableOpacity>
              )}
              style={{ paddingHorizontal: 8 }}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export default MessageReactionOverlay;
