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
import { computeReactionPillPlacement } from '@/domains/messaging/reactionPillPlacement';
import { REACTION_EMOJIS } from '@/domains/messaging/reactionUseCases';
import useTheme from '@/theme/themeContext';

/** Le cote d un bouton d emoji dans la pilule, et la pilule qui en decoule. */
const BOUTON = 38;
const ECART = 2;
const MARGE_INTERNE = 5;

/** 6 raccourcis + le « + » : sept boutons, leurs ecarts, le cadre. */
export const REACTION_PILL_WIDTH = (BOUTON * 7) + (ECART * 6) + (MARGE_INTERNE * 2);
export const REACTION_PILL_HEIGHT = BOUTON + (MARGE_INTERNE * 2);

/** Le clavier d emojis occupe un peu plus de la moitie de l ecran, comme sur WhatsApp. */
const RATIO_CLAVIER = 0.55;
const COLONNES = 8;

/**
 * WHATSAPP — LE CALQUE DE L APPUI LONG.
 *
 * 🎈 CE QU IL CHANGE, A L ECRAN. Avant, l appui long faisait monter du bas une
 * feuille qui RECOUVRAIT la conversation : la rangee d emojis etait tout en
 * haut, et le message auquel on reagissait avait disparu sous la feuille.
 * Maintenant la rangee sort en PILULE, juste au-dessus du message vise, qui
 * reste lisible dessous — c est le geste de WhatsApp.
 *
 * 🧱 UN SEUL CALQUE, ET C EST LA DECISION STRUCTURANTE DE CE COMPOSANT. La
 * feuille d actions (`BottomModal`) est un portail `@gorhom/bottom-sheet` ; un
 * `Modal` natif ouvert PAR-DESSUS capturerait tous les appuis de l ecran, et son
 * voile assombrirait la pilule. Les deux vivent donc dans le MEME `Modal` : la
 * pilule ancree sur la bulle, les actions en bas — exactement ou elles etaient.
 * Aucune superposition, donc aucun comportement a departager a l oeil sur deux
 * systemes.
 *
 * 🫱 LE « + » OUVRE LE CLAVIER dans ce meme calque : il remplace la pilule par la
 * grille des 811 emojis, rangee par famille. Un appui pose la reaction et
 * referme tout, comme les six raccourcis.
 * @param {object} props Les proprietes.
 * @param {{height: number, width: number, x: number, y: number} | null} [props.anchor]
 *   La bulle visee, mesuree a l ecran (`measureInWindow`).
 * @param {React.ReactNode} [props.children] Les actions « Repondre / Copier / … », telles quelles.
 * @param {boolean} [props.isMine] Vrai si la bulle est a moi : la pilule se range a droite.
 * @param {string} [props.myEmoji] L emoji que j ai deja pose sur ce message.
 * @param {() => void} props.onClose Ferme le calque.
 * @param {(emoji: string) => void} props.onSelect Appelee avec l emoji choisi.
 * @param {boolean} props.visible Vrai quand le calque est ouvert.
 * @returns {import('react').ReactElement} Le calque.
 */
function MessageReactionOverlay({
  anchor = null,
  children,
  isMine = false,
  myEmoji = '',
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

  const place = useMemo(() => computeReactionPillPlacement({
    alignEnd: isMine,
    anchor,
    insets: { bottom: insets.bottom, top: insets.top },
    pill: { height: REACTION_PILL_HEIGHT, width: REACTION_PILL_WIDTH },
    window: { height: hauteurEcran, width: largeurEcran },
  }), [anchor, hauteurEcran, insets.bottom, insets.top, isMine, largeurEcran]);

  const emojisDeLaFamille = useMemo(() => (
    EMOJI_CATALOG.find((categorie) => categorie.key === famille)?.emojis ?? []
  ), [famille]);

  const fermer = () => {
    setClavierOuvert(false);
    onClose();
  };

  /** @param {string} emoji L emoji choisi, raccourci ou venu du clavier. */
  const choisir = (emoji) => {
    setClavierOuvert(false);
    onSelect(emoji);
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
        Le voile. Il est volontairement LEGER : son role n est pas de cacher la
        conversation mais de dire « on est en train de choisir ». Le message vise
        doit rester lisible — c est tout l objet du lot.
      */}
      <Pressable
        accessibilityLabel={t('common.close', 'Fermer')}
        onPress={fermer}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', flex: 1 }}
      />

      {!clavierOuvert && anchor ? (
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
            left: place.left,
            padding: MARGE_INTERNE,
            position: 'absolute',
            top: place.top,
            width: REACTION_PILL_WIDTH,
          }}
          testID="WHATSAPP-pilule"
        >
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity
              accessibilityLabel={emoji}
              accessibilityRole="button"
              accessibilityState={{ selected: myEmoji === emoji }}
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
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            accessibilityLabel={t('conversation.reactions.more', "Plus d'emojis")}
            accessibilityRole="button"
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
            <Text style={{ color: Colors.neutral00, fontSize: 22, lineHeight: 26 }}>+</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {clavierOuvert ? (
        <View
          style={{
            backgroundColor: Colors.neutral800,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            bottom: 0,
            height: hauteurEcran * RATIO_CLAVIER,
            left: 0,
            paddingBottom: insets.bottom,
            position: 'absolute',
            right: 0,
          }}
          testID="WHATSAPP-clavier"
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, paddingVertical: 10 }}
          >
            {EMOJI_CATALOG.map((categorie) => (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: famille === categorie.key }}
                key={categorie.key}
                onPress={() => setFamille(categorie.key)}
                style={{
                  backgroundColor: famille === categorie.key
                    ? Colors.primary700
                    : Colors.transparent,
                  borderRadius: 999,
                  marginHorizontal: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: Colors.neutral00, fontSize: 13 }}>
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

      {!clavierOuvert && children ? (
        <View
          style={{
            backgroundColor: Colors.neutral800,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            bottom: 0,
            left: 0,
            paddingBottom: insets.bottom + 8,
            paddingHorizontal: 16,
            position: 'absolute',
            right: 0,
          }}
          testID="WHATSAPP-actions"
        >
          {children}
        </View>
      ) : null}
    </Modal>
  );
}

export default MessageReactionOverlay;
