import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { RouteNames } from '@/navigation/routeNames';

// CHAT-EVT-T9 (12/11, M1205) : le service des messages, charge A L'APPEL, par le chargeur partage.
// L'app et jest prennent complexeChargeurs.js (un `require` a l'appel : la fiche se monte sans
// lui dans les bancs sans `.env`) ; le site prend complexeChargeurs.web.js, qui l'importe en tete.
// Avant, un `require` ecrit ici : au site, Vite n'en fait pas un module (au serveur de dev
// `require` n'existe pas, au site construit il rend `undefined`), l'erreur etait avalee et la
// rangee n'est jamais apparue sur le site (trains 8 et 9). Temoins : site.sansRequire.test.js et
// web/tests/components/chat-evt-t9-rangee.spec.ts.
// ponytail: le chargeur porte le nom du chantier complexe ; s'il change de forme, le temoin
// RESA-L7-1 (memes exports app / site) le dira. Sortie : un chargeur de messagerie a part.
import { messages as service } from '@/services/complexe/complexeChargeurs';

import { createLogger } from '@/utils/logger/logger';

// ==========================================================================
// CONVERSATION-EVENEMENT (10/11/2026, decisions d Adel « 192 » et reponses du 10/11) —
// LA RANGEE « Ouvrir le chat de l'événement » DE LA FICHE (maquette validee, ecrans A a G).
//
// Le serveur decide tout (`GET /chats/event/:id`) : qui peut ouvrir (le staff de l equipe de
// l evenement), qui est membre, combien ils sont. La rangee ne fait qu afficher :
//   · staff, pas encore de chat : « Ouvrir le chat de l'événement » + qui sera dedans ;
//   · chat ouvert (staff ou membre) : « Chat de l'événement » + le nombre de membres ;
//   · ni staff, ni membre d un chat ouvert : rien (un joueur ne voit jamais le bouton).
// Un 2e appui ouvre le meme chat : le serveur retrouve celui qui existe.
// ==========================================================================

const journal = createLogger('event-chat-row');

/**
 * Ce que `GET /chats/event/:id` renvoie.
 * @typedef {object} EtatChatEvenement
 * @property {{ documentId: string, title?: string, nonLus?: number, ouvertPar?: string | null }
 *   | null} chat - Le chat ouvert, s'il existe (CONVERSATION-EVENEMENT-2 : non-lus, ouvert par).
 * @property {boolean} estMembre - Le lecteur est dans le chat.
 * @property {boolean} estUnMatch - L'evenement est un match.
 * @property {{ membres: number, staff: number }} nombre - Combien ils sont.
 * @property {boolean} peutOuvrir - Le lecteur est du staff de l'equipe.
 */

/**
 * La rangee du chat de l'evenement, sous la carte de la fiche.
 * @param {object} props
 * @param {string} props.eventDocumentId - L'evenement.
 * @param {{
 *   navigate: (route: string, params?: object) => void,
 *   addListener?: (evenement: string, rappel: () => void) => (() => void) | void,
 * }} props.navigation - La navigation (`focus` relit la rangee au retour du chat).
 * @returns {import('react').ReactElement | null}
 */
function EventChatRow({ eventDocumentId, navigation }) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  /** @type {[EtatChatEvenement | null, (v: any) => void]} */
  const [etat, setEtat] = useState(/** @type {EtatChatEvenement | null} */ (null));
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!eventDocumentId) return undefined;
    let vivant = true;
    const lire = () => Promise.resolve()
      .then(() => service().getEventChatState(eventDocumentId))
      .then((lu) => { if (vivant) setEtat(lu || null); })
      // Pas de reponse (hors ligne, droit absent) : la rangee reste vide, mais le dit
      // (CHAT-EVT-T9 : avalee sans trace, la panne du site a dure deux trains).
      .catch((erreur) => {
        journal.warn('etat du chat illisible, rangee masquee', {
          erreur: String(erreur?.message || erreur),
          eventDocumentId,
        });
      });
    lire();
    // CONVERSATION-EVENEMENT-2 (G) — au retour du chat, les non-lus se relisent.
    const quitter = navigation?.addListener?.('focus', lire);
    return () => {
      vivant = false;
      if (typeof quitter === 'function') quitter();
    };
  }, [eventDocumentId, navigation]);

  /**
   * Ouvre la conversation du chat.
   * @param {{ documentId: string, title?: string }} chat - Le chat à ouvrir.
   * @returns {void}
   */
  const aller = (chat) => navigation.navigate(RouteNames.Conversation, {
    chatId: chat.documentId,
    chatType: 'event',
    title: chat.title || t('eventDetails.eventChat.opened', 'Chat de l’événement'),
  });

  const ouvrir = async () => {
    setEnCours(true);
    try {
      const resultat = await service().openEventChat(eventDocumentId);
      if (resultat?.chat?.documentId) {
        setEtat((/** @type {EtatChatEvenement} */ avant) => ({
          ...avant, chat: resultat.chat, estMembre: true,
        }));
        aller(resultat.chat);
      }
    } catch (_error) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('eventDetails.eventChat.error', 'Impossible d’ouvrir le chat pour le moment.'),
      );
    } finally {
      setEnCours(false);
    }
  };

  if (!etat) return null;
  const chat = etat.chat || null;
  if (!etat.peutOuvrir && !(etat.estMembre && chat)) return null;

  const membres = Number(etat?.nombre?.membres) || 0;
  const titre = chat
    ? t('eventDetails.eventChat.opened', 'Chat de l’événement')
    : t('eventDetails.eventChat.open', 'Ouvrir le chat de l’événement');
  let sousTitre;
  const nonLus = chat ? Number(chat.nonLus) || 0 : 0;
  if (chat) {
    const nombre = membres + (Number(etat?.nombre?.staff) || 0);
    // CONVERSATION-EVENEMENT-2 (G) — « Ouvert par Karim · 17 membres ».
    sousTitre = chat.ouvertPar
      ? t('eventDetails.eventChat.openedBy', 'Ouvert par {{name}} · {{count}} membres', {
        count: nombre,
        name: chat.ouvertPar,
        ...SANS_ECHAPPEMENT,
      })
      : t('eventDetails.eventChat.members', '{{count}} membres', {
        count: nombre,
        ...SANS_ECHAPPEMENT,
      });
  } else if (etat.estUnMatch && membres === 0) {
    sousTitre = t(
      'eventDetails.eventChat.staffOnly',
      'Le staff seulement pour l’instant : les convoqués entreront à la publication',
    );
  } else if (etat.estUnMatch) {
    const repli = 'Avec le staff et les {{count}} convoqués';
    sousTitre = t('eventDetails.eventChat.withConvoked', repli, {
      count: membres,
      ...SANS_ECHAPPEMENT,
    });
  } else {
    const repli = 'Avec le staff et les {{count}} invités, qu’ils aient répondu ou non';
    sousTitre = t('eventDetails.eventChat.withInvited', repli, {
      count: membres,
      ...SANS_ECHAPPEMENT,
    });
  }

  return (
    <TouchableOpacity
      accessibilityLabel={`${titre}. ${sousTitre}`}
      accessibilityRole="button"
      accessibilityState={{ busy: enCours, disabled: enCours }}
      disabled={enCours}
      onPress={() => (chat ? aller(chat) : ouvrir())}
      style={[
        Spaces.gap[12], Spaces.padding[16], ApplicationStyle.borderRadius16,
        {
          alignItems: 'center',
          backgroundColor: withAlpha(Colors.primary700, 0.55),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderWidth: 1,
          flexDirection: 'row',
          minHeight: 64,
        },
      ]}
      testID="event-chat-row"
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: withAlpha(Colors.primary500, 0.16),
          borderRadius: 20,
          height: 40,
          justifyContent: 'center',
          width: 40,
        }}
      >
        <SvgIcon color={Colors.primary500} height={20} name="message-circle" width={20} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{titre}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{sousTitre}</Text>
      </View>
      {nonLus > 0 ? (
        <View
          accessibilityLabel={t('eventDetails.eventChat.unread', '{{count}} messages non lus', {
            count: nonLus,
            ...SANS_ECHAPPEMENT,
          })}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderRadius: 11,
            height: 22,
            justifyContent: 'center',
            minWidth: 22,
            paddingHorizontal: 6,
          }}
          testID="event-chat-row-unread"
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary900 }]}>
            {nonLus > 99 ? '99+' : String(nonLus)}
          </Text>
        </View>
      ) : null}
      <SvgIcon color={Colors.primary500} height={14} name="arrow-right" width={14} />
    </TouchableOpacity>
  );
}

export default EventChatRow;
