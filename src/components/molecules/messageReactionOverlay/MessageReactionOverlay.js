import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { LIGNE_DE_MENU } from '@/components/molecules/bulleDuFil/typographieDuFil';

import useReduceMotion from '@/hooks/useReduceMotion';

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
// MSG1A (§3.2) — le pack serre l'ecart a 2 et pose des marges de 6 / 8 (SPECS.md §2) :
// 7 x 44 + 6 x 2 + 16 = 336, toujours sous la largeur utile d'un iPhone SE (359).
const ECART = 2;
const MARGE_VERTICALE = 6;
const MARGE_HORIZONTALE = 8;

/** 6 raccourcis + le « + » : sept boutons, leurs ecarts, le cadre. */
export const REACTION_PILL_WIDTH = (BOUTON * 7) + (ECART * 6) + (MARGE_HORIZONTALE * 2);
export const REACTION_PILL_HEIGHT = BOUTON + (MARGE_VERTICALE * 2);

/** Le menu d actions du pack : 236 de large, une rangee de 48 par action (SPECS.md §2). */
const MENU_WIDTH = 236;
const MENU_LIGNE = 48;
/** Le filet qui precede la premiere action rouge. */
const MENU_FILET = 1;

/** « pop » du pack : de 0,6 a 1 en 220 ms, courbe `cubic-bezier(.2,.9,.3,1.2)`. */
const POP_MS = 220;
const POP_DEPART = 0.6;

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
const RAYON_FEUILLE = 22;
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
 * @param {boolean} [props.canReply] Puis-je ecrire dans ce fil ? Non (canal d'annonce) :
 *   pas de « Repondre ».
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
  canReply = true,
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
  const reduireLesAnimations = useReduceMotion();
  const pop = useRef(new Animated.Value(1)).current;

  const actions = useMemo(
    () => getMessageActions({
      canCopy, canEdit, canEditComposition, canReply, isMine,
    }),
    [canCopy, canEdit, canEditComposition, canReply, isMine],
  );
  // Le filet rouge ne se pose que si une action rouge suit une action ordinaire.
  const indexDuFilet = actions.findIndex((action, index) => action.alerte && index > 0);

  const hauteurMenu = (actions.length * MENU_LIGNE) + (indexDuFilet > 0 ? MENU_FILET : 0);

  // MSG1A (§3.2) — la barre et le menu « poussent » a l'ouverture (sauf si le systeme
  // demande de reduire les animations).
  useEffect(() => {
    if (!visible) return undefined;
    if (reduireLesAnimations) {
      pop.setValue(1);
      return undefined;
    }
    pop.setValue(0);
    const animation = Animated.timing(pop, {
      duration: POP_MS,
      easing: Easing.bezier(0.2, 0.9, 0.3, 1.2),
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [pop, reduireLesAnimations, visible]);
  // 👆 La PILULE apparait en fondu SEUL : ses boutons sont des cibles tactiles, ils doivent
  // mesurer 44 des la premiere image (rouge de la recolte 3a : 40,4 px mesures pendant
  // l'agrandissement, whatsapp2-menu.spec.ts:124). Le MENU garde l'effet du pack.
  const styleFondu = {
    opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
  };
  const stylePop = {
    ...styleFondu,
    transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [POP_DEPART, 1] }) }],
  };

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

  // MSG1A (§3.2) — le voile du pack, `rgba(0,6,9,0.55)`, lu sur l'encre primary900.
  const VOILE = withAlpha(Colors.primary900, 0.55);

  // ⚖️ MSG1A (§3.2) — LE FLOU DU PACK (14) N'EST PAS POSE, et c'est un choix mesure :
  // `@sbaiahmed1/react-native-blur` n'est pas transformable par jest (il ferait tomber les
  // 13 suites de l'ecran de conversation), et sur Android un flou pose DANS la fenetre du
  // `Modal` ne voit pas l'ecran d'en dessous. Le voile du pack, seul, garde le message net
  // et en avant (il est decoupe autour de lui).

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
      backgroundColor: VOILE,
      position: 'absolute',
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
            {/* MSG1A (§3.2) — la barre des 6 reactions du pack : pilule `chatMenu`, marges
                6 / 8, boutons de 44, emoji de 27, ma reaction sur un fond clair a 18 %. Le
                « + » du clavier d'emojis (lot WHATSAPP) reste : le pack ne le dessine pas,
                mais il marche, et le serveur accepte ses 1 069 emojis. */}
            <Animated.View
              accessibilityLabel={t('conversation.reactions.pick', 'Choisir une réaction')}
              accessibilityRole="menu"
              style={[
                styles.pilule,
                {
                  backgroundColor: Colors.chatMenu,
                  borderColor: withAlpha(Colors.neutral00, 0.08),
                  left: place.pill.left,
                  shadowColor: Colors.neutral900,
                  top: place.pill.top,
                  transformOrigin: isMine ? 'right bottom' : 'left bottom',
                },
                styleFondu,
              ]}
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
                  style={[
                    styles.boutonDeLaPilule,
                    {
                      backgroundColor: myEmoji === emoji
                        ? withAlpha(Colors.neutral00, 0.18)
                        : Colors.transparent,
                    },
                  ]}
                >
                  <Text style={styles.emojiDeLaPilule}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                accessibilityLabel={t('conversation.reactions.more', "Plus d'emojis")}
                accessibilityRole="button"
                activeOpacity={0.6}
                onPress={() => setClavierOuvert(true)}
                style={[
                  styles.boutonDeLaPilule,
                  { backgroundColor: withAlpha(Colors.neutral00, 0.12) },
                ]}
                testID="WHATSAPP-plus"
              >
                <GlyphIcon color={Colors.neutral00} name="plus2" size={22} />
              </TouchableOpacity>
            </Animated.View>

            {/* MSG1A (§3.2) — le menu compact du pack : 236 de large, rangees de 48 (icone 20
                + libelle 15,5), Supprimer / Signaler en rouge, precedes d'un filet. */}
            <Animated.View
              accessibilityRole="menu"
              style={[
                styles.menu,
                {
                  backgroundColor: Colors.chatMenu,
                  borderColor: withAlpha(Colors.neutral00, 0.08),
                  left: place.menu.left,
                  shadowColor: Colors.neutral900,
                  top: place.menu.top,
                  transformOrigin: isMine ? 'right top' : 'left top',
                },
                stylePop,
              ]}
              testID="WHATSAPP-menu"
            >
              {actions.map((action, index) => {
                const couleur = action.alerte ? Colors.chatDanger : Colors.neutral00;
                return (
                  <View key={action.key}>
                    {index === indexDuFilet ? (
                      <View
                        style={[
                          styles.filet,
                          { backgroundColor: withAlpha(Colors.neutral00, 0.08) },
                        ]}
                      />
                    ) : null}
                    <TouchableOpacity
                      accessibilityLabel={t(action.labelKey, action.fallback)}
                      accessibilityRole="menuitem"
                      activeOpacity={0.6}
                      onPress={() => onAction(action.key)}
                      style={styles.ligneDuMenu}
                      testID={`WHATSAPP-action-${action.key}`}
                    >
                      <GlyphIcon color={couleur} name={action.icone} size={20} />
                      <Text style={[LIGNE_DE_MENU, { color: couleur }]}>
                        {t(action.labelKey, action.fallback)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Animated.View>
          </>
        ) : null}

        {clavierOuvert ? (
          <View
            style={{
              // MSG1A (§3.2) — la feuille du pack (`chatSheet`, rayon 22).
              backgroundColor: Colors.chatSheet,
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

const styles = StyleSheet.create({
  boutonDeLaPilule: {
    alignItems: 'center',
    borderRadius: 999,
    height: BOUTON,
    justifyContent: 'center',
    width: BOUTON,
  },
  emojiDeLaPilule: {
    fontSize: 27,
    lineHeight: 32,
  },
  filet: {
    height: MENU_FILET,
    marginHorizontal: 16,
  },
  ligneDuMenu: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    height: MENU_LIGNE,
    paddingHorizontal: 18,
  },
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    elevation: 12,
    overflow: 'hidden',
    position: 'absolute',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    width: MENU_WIDTH,
  },
  pilule: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 10,
    flexDirection: 'row',
    gap: ECART,
    height: REACTION_PILL_HEIGHT,
    paddingHorizontal: MARGE_HORIZONTALE,
    paddingVertical: MARGE_VERTICALE,
    position: 'absolute',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    width: REACTION_PILL_WIDTH,
  },
});

export default MessageReactionOverlay;
