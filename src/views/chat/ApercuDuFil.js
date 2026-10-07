import { useTranslation } from 'react-i18next';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  couleurDuNom, estUnTeteATete, extraitDuMessageCite,
} from '@/domains/messaging/habillageDuFil';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import {
  GRAS_FAMILLE,
  LIGNE_DE_MENU,
  REGULIER_FAMILLE,
} from '@/components/molecules/bulleDuFil/typographieDuFil';
import AvatarDuFil from '@/views/chat/AvatarDuFil';

import { useGetChatMessages } from '@/services/chat/chatQueriesCompat';

/** Combien de messages l'apercu montre (les plus recents). */
const MESSAGES_DE_L_APERCU = 12;

/** Mesures du pack (SPECS.md §4, « Aperçu de conversation »). */
const HAUT_DE_LA_CARTE = 64;
const HAUTEUR_DE_LA_CARTE = 470;
const LIGNE_DU_MENU = 50;
const ECART_CARTE_MENU = 12;

/**
 * @typedef {object} EntreeDeLApercu
 * @property {string} cle - Stable, sert de `testID` (`apercu-du-fil-<cle>`).
 * @property {string} libelle
 * @property {any} icone - Un glyphe de `GlyphIcon`.
 * @property {() => void} onPress
 */

/**
 * MSG1BA (§3.14) — L'APERÇU D'UNE CONVERSATION, PAR APPUI LONG SUR SA LIGNE.
 *
 * Le fil en LECTURE SEULE, sans le marquer comme lu : l'apercu ne rejoint pas le fil et
 * n'emet pas `read-message` (contrat 1B §3 : la lecture des messages n'ecrit pas le curseur).
 * Toucher la carte ouvre la conversation — c'est la seulement qu'elle passe en lu. Le menu
 * dessous porte les gestes de la ligne (« Marquer comme lu / non lu », « Épingler »...).
 *
 * ⚖️ Le flou du pack (16) n'est pas pose, pour la raison mesuree par MSG1A (§3.2,
 * `MessageReactionOverlay`) : sur Android, un flou pose dans la fenetre d'un `Modal` ne voit
 * pas l'ecran d'en dessous. Le voile du pack reste.
 * @param {object} props
 * @param {any} props.chat - La ligne de la liste (`documentId`, `type`...).
 * @param {EntreeDeLApercu[]} props.entrees - Le menu sous la carte.
 * @param {boolean} [props.espaceVille]
 * @param {string} props.meId
 * @param {any[]} [props.myTeams]
 * @param {boolean} props.nonLu - La conversation a des non-lus : « Aperçu : reste non lu ».
 * @param {() => void} props.onClose
 * @param {() => void} props.onOuvrir - Toucher la carte.
 * @param {string} props.titre
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function ApercuDuFil({
  chat,
  entrees,
  espaceVille = false,
  meId,
  myTeams = [],
  nonLu,
  onClose,
  onOuvrir,
  titre,
  visible,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { height: hauteurEcran } = useWindowDimensions();
  const chatId = String(chat?.documentId || '');
  const { data: pages } = useGetChatMessages({ chatId }, { enabled: visible && Boolean(chatId) });

  // Les pages arrivent du plus recent au plus ancien : on garde les derniers, du plus
  // ancien (en haut) au plus recent (en bas), comme le fil.
  const recus = /** @type {any[]} */ ((/** @type {any} */ (pages)?.pages || [])
    .flatMap((/** @type {any} */ page) => (Array.isArray(page?.data) ? page.data : [])))
    .slice(0, MESSAGES_DE_L_APERCU)
    .reverse();
  const montreLesNoms = !estUnTeteATete(chat?.type);

  // La carte se raccourcit sur un petit ecran : le menu doit rester entierement visible.
  const hauteurDuMenu = entrees.length * LIGNE_DU_MENU;
  const hauteurCarte = Math.max(
    200,
    Math.min(
      HAUTEUR_DE_LA_CARTE,
      hauteurEcran - HAUT_DE_LA_CARTE - ECART_CARTE_MENU - hauteurDuMenu - bottom - 16,
    ),
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel={t('common.close', 'Fermer')}
        onPress={onClose}
        style={[styles.fond, { backgroundColor: withAlpha(Colors.primary900, 0.6) }]}
        testID="apercu-du-fil-fond"
      >
        <Pressable
          accessibilityLabel={t('messaging.preview.openLabel', {
            defaultValue: 'Ouvrir {{title}}',
            title: titre,
          })}
          accessibilityRole="button"
          onPress={onOuvrir}
          style={[
            styles.carte,
            {
              backgroundColor: Colors.chatBackground,
              borderColor: withAlpha(Colors.neutral00, 0.08),
              height: hauteurCarte,
              top: HAUT_DE_LA_CARTE,
            },
          ]}
          testID="apercu-du-fil-carte"
        >
          <View
            style={[
              styles.enTete,
              {
                backgroundColor: Colors.chatBar,
                borderBottomColor: withAlpha(Colors.neutral00, 0.06),
              },
            ]}
          >
            <AvatarDuFil
              chat={chat}
              espaceVille={espaceVille}
              meId={meId}
              myTeams={myTeams}
              size={38}
            />
            <Text numberOfLines={1} style={[styles.titre, { color: Colors.neutral00 }]}>
              {titre}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.fil}
            pointerEvents="none"
            ref={(vue) => { vue?.scrollToEnd?.({ animated: false }); }}
          >
            {recus.map((/** @type {any} */ message, /** @type {number} */ rang) => {
              const auteur = String(message?.sender?.documentId || '');
              const cle = `${String(message?.documentId || message?.id || '')}:${rang}`;
              if (!message?.sender) {
                // Une ligne sans expediteur (notice de groupe, message systeme) : discrete.
                return (
                  <Text
                    key={cle}
                    style={[
                      styles.notice,
                      {
                        backgroundColor: withAlpha(Colors.chatBar, 0.55),
                        color: withAlpha(Colors.neutral00, 0.62),
                      },
                    ]}
                  >
                    {String(message?.message || '')}
                  </Text>
                );
              }
              const estAMoi = auteur === meId;
              const { icone, texte } = extraitDuMessageCite(message, t);
              const nom = montreLesNoms && !estAMoi
                ? String(message?.sender?.firstname || '').trim()
                : '';
              return (
                <View
                  key={cle}
                  style={[
                    styles.bulle,
                    estAMoi ? styles.bulleAMoi : styles.bulleRecue,
                    { backgroundColor: estAMoi ? Colors.chatBubbleMine : Colors.primary700 },
                  ]}
                >
                  {nom ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.nom, { color: couleurDuNom(Colors, auteur) }]}
                    >
                      {nom}
                    </Text>
                  ) : null}
                  <View style={styles.ligneDuTexte}>
                    {icone ? (
                      <GlyphIcon
                        color={withAlpha(Colors.neutral00, 0.72)}
                        name={icone}
                        size={14}
                      />
                    ) : null}
                    <Text numberOfLines={4} style={[styles.texte, { color: Colors.neutral00 }]}>
                      {texte}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          {nonLu ? (
            <View pointerEvents="none" style={styles.piluleRangee}>
              <View
                style={[
                  styles.pilule,
                  {
                    backgroundColor: withAlpha(Colors.chatBar, 0.92),
                    borderColor: withAlpha(Colors.primary500, 0.35),
                  },
                ]}
                testID="apercu-du-fil-reste-non-lu"
              >
                <GlyphIcon color={Colors.primary500} name="eye" size={15} />
                <Text style={[styles.piluleTexte, { color: Colors.neutral00 }]}>
                  {t('messaging.preview.staysUnread', 'Aperçu : reste non lu')}
                </Text>
              </View>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => {}}
          style={[
            styles.menu,
            {
              backgroundColor: Colors.chatSheet,
              borderColor: withAlpha(Colors.neutral00, 0.08),
              top: HAUT_DE_LA_CARTE + hauteurCarte + ECART_CARTE_MENU,
            },
          ]}
          testID="apercu-du-fil-menu"
        >
          {entrees.map((entree, rang) => (
            <Pressable
              accessibilityRole="button"
              key={entree.cle}
              onPress={() => {
                onClose();
                entree.onPress();
              }}
              style={[
                styles.ligneDuMenu,
                rang
                  ? { borderTopColor: withAlpha(Colors.neutral00, 0.07), borderTopWidth: 1 }
                  : null,
              ]}
              testID={`apercu-du-fil-${entree.cle}`}
            >
              <GlyphIcon color={Colors.neutral00} name={entree.icone} size={20} />
              <Text style={[LIGNE_DE_MENU, { color: Colors.neutral00 }]}>{entree.libelle}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bulle: {
    borderRadius: 18,
    marginTop: 4,
    maxWidth: '80%',
    paddingBottom: 7,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  bulleAMoi: {
    alignSelf: 'flex-end',
  },
  bulleRecue: {
    alignSelf: 'flex-start',
  },
  carte: {
    borderRadius: 22,
    borderWidth: 1,
    left: 16,
    overflow: 'hidden',
    position: 'absolute',
    right: 16,
  },
  enTete: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 56,
    paddingHorizontal: 12,
  },
  fil: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 44,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  fond: {
    flex: 1,
  },
  ligneDuMenu: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    height: LIGNE_DU_MENU,
    paddingHorizontal: 18,
  },
  ligneDuTexte: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    left: 16,
    overflow: 'hidden',
    position: 'absolute',
    width: 250,
  },
  nom: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 13,
    lineHeight: 17,
  },
  notice: {
    alignSelf: 'center',
    borderRadius: 8,
    fontFamily: REGULIER_FAMILLE,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 6,
    maxWidth: 280,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    textAlign: 'center',
  },
  pilule: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  piluleRangee: {
    alignItems: 'center',
    bottom: 12,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  piluleTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 12.5,
    lineHeight: 16,
  },
  texte: {
    flexShrink: 1,
    fontFamily: REGULIER_FAMILLE,
    fontSize: 15,
    lineHeight: 20,
  },
  titre: {
    flex: 1,
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 20,
  },
});

export default ApercuDuFil;
