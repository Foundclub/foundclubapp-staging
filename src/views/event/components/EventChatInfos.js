import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

// ==========================================================================
// CONVERSATION-EVENEMENT-2 (10/11/2026, « 215- B ») — LE FIL DU CHAT DE L'EVENEMENT, d'apres la
// maquette validee « 193 » :
//   · E — sous le nom, « sam. 15 nov. · 14:00 · 17 membres », puis un bandeau « lieu · RDV » qui
//     ramene a la fiche (« Voir l'événement ») ;
//   · F — l'ecran « Infos » : Staff, Convoques (ou Invites), Parents ; ni ajout ni renommage, le
//     nom vient de l'evenement et la liste de la convocation.
// Le serveur decide tout (`GET /chats/event-chat/:chatId`) : les noms ne lui sortent que pour un
// membre. Partage par le telephone (Conversation.js) et le site (Conversation.web.js).
// ==========================================================================

// eslint-disable-next-line global-require -- chargement differe, comme EventChatRow
const service = () => require('@/services/chat/chatService');

const PARIS = 'Europe/Paris';
const K = 'eventDetails.eventChat';
const APERCU = 3;
const TITRE_DE_GROUPE = { letterSpacing: 0.6, textTransform: 'uppercase' };

/**
 * L'etat du chat d'evenement vu depuis son fil. Rien pour un autre type de chat.
 * @param {string | null | undefined} chatId - Le chat.
 * @param {boolean} estUnChatDEvenement - Le fil est-il celui d'un evenement ?
 * @returns {[object | null, () => void]} L'etat, et de quoi le relire.
 */
export const useChatDeLEvenement = (chatId, estUnChatDEvenement) => {
  const [info, setInfo] = useState(null);
  const [tour, setTour] = useState(0);
  useEffect(() => {
    if (!chatId || !estUnChatDEvenement) return undefined;
    let vivant = true;
    Promise.resolve()
      .then(() => service().getEventChatOfChat(chatId))
      .then((lu) => { if (vivant) setInfo(lu || null); })
      // Hors ligne ou refuse : le fil s'affiche comme avant, sans en-tete d'evenement.
      .catch(() => {});
    return () => { vivant = false; };
  }, [chatId, estUnChatDEvenement, tour]);
  const relire = useCallback(() => setTour((n) => n + 1), []);
  return [info, relire];
};

const premiereMajuscule = (texte) => (texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : '');

/**
 * « Sam. 15 nov. » et « 14:00 », a l'heure de Paris (l'heure saisie, `startTime`, d'abord).
 * @param {{ date?: string | null, startTime?: string | null } | null | undefined} evenement
 *   L'evenement.
 * @returns {{ jour: string, heure: string }} Les deux morceaux, vides s'ils manquent.
 */
export const quandDeLEvenement = (evenement) => {
  const date = evenement?.date ? new Date(evenement.date) : null;
  const valide = date && !Number.isNaN(date.getTime());
  const jour = valide ? premiereMajuscule(new Intl.DateTimeFormat(localeDesFormats(), {
    day: 'numeric', month: 'short', timeZone: PARIS, weekday: 'short',
  }).format(date)) : '';
  const saisie = /^(\d{2}):(\d{2})/.exec(String(evenement?.startTime || ''));
  let heure = '';
  if (saisie) heure = `${saisie[1]}:${saisie[2]}`;
  else if (valide) {
    heure = new Intl.DateTimeFormat(localeDesFormats(), {
      hour: '2-digit', hour12: false, minute: '2-digit', timeZone: PARIS,
    }).format(date);
  }
  return { heure, jour };
};

/**
 * Le nombre de membres, staff compris.
 * @param {object | null | undefined} info - L'etat du serveur.
 * @returns {number} Le nombre.
 */
export const nombreDeMembres = (info) => (
  (Number(info?.nombre?.membres) || 0) + (Number(info?.nombre?.staff) || 0)
);

/**
 * E — la ligne sous le nom du fil : « Sam. 15 nov. · 14:00 · 17 membres ».
 * @param {object | null | undefined} info - L'etat du serveur.
 * @param {(cle: string, repli: string, valeurs?: object) => string} t - La traduction.
 * @returns {string} La ligne, vide sans etat.
 */
export const sousTitreDuChatDEvenement = (info, t) => {
  if (!info) return '';
  const { heure, jour } = quandDeLEvenement(info.evenement);
  const membres = t('eventDetails.eventChat.members', '{{count}} membres', {
    count: nombreDeMembres(info),
    ...SANS_ECHAPPEMENT,
  });
  return [jour, heure, membres].filter(Boolean).join(' · ');
};

/**
 * E — le bandeau sous l'en-tete : le lieu, le rendez-vous, et le retour a la fiche.
 * @param {object} props
 * @param {object | null} props.info - L'etat du serveur.
 * @param {(eventId: string) => void} props.onVoirLEvenement - Ouvre la fiche.
 * @returns {JSX.Element | null}
 */
export function BandeauDuChatDEvenement({ info, onVoirLEvenement }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const evenement = info?.evenement;
  if (!evenement?.documentId) return null;
  const rdv = evenement.rendezVous;
  const morceaux = [
    evenement.lieu || t('eventDetails.eventChat.placeUnknown', 'Lieu non précisé'),
    rdv?.time ? t(`${K}.rdv`, 'RDV {{time}}', { time: rdv.time, ...SANS_ECHAPPEMENT }) : '',
    rdv?.place || '',
  ].filter(Boolean);
  const voir = t('eventDetails.eventChat.seeEvent', 'Voir l’événement');
  return (
    <View
      style={[
        Spaces.gap[8],
        {
          alignItems: 'center',
          backgroundColor: withAlpha(Colors.primary700, 0.55),
          borderBottomColor: withAlpha(Colors.primary500, 0.18),
          borderBottomWidth: 1,
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 10,
        },
      ]}
      testID="event-chat-banner"
    >
      <SvgIcon color={Colors.primary200} height={16} name="location-pin-alt-1" width={16} />
      <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral100, { flex: 1, minWidth: 0 }]}>
        {morceaux.join(' · ')}
      </Text>
      <TouchableOpacity
        accessibilityRole="link"
        hitSlop={{
          bottom: 12, left: 12, right: 12, top: 12,
        }}
        onPress={() => onVoirLEvenement(evenement.documentId)}
        testID="event-chat-banner-see-event"
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>{voir}</Text>
      </TouchableOpacity>
    </View>
  );
}

const initiales = (nom) => String(nom || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((mot) => mot.charAt(0).toUpperCase())
  .join('');

/**
 * Une ligne de membre : l'avatar en initiales, le nom, et ce qu'il est dans le chat.
 * @param {object} props
 * @param {string} props.nom - « Karim B. ».
 * @param {string} props.precision - « Coach », « Titulaire », « parent : Rayan, 12 ans ».
 * @returns {JSX.Element}
 */
function Membre({ nom, precision }) {
  const { Colors, Fonts, Spaces } = useTheme();
  return (
    <View style={[Spaces.gap[12], { alignItems: 'center', flexDirection: 'row', minHeight: 44 }]}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: withAlpha(Colors.primary500, 0.16),
          borderRadius: 18,
          height: 36,
          justifyContent: 'center',
          width: 36,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>{initiales(nom)}</Text>
      </View>
      <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1, minWidth: 0 }]}>
        {nom}
      </Text>
      {precision ? (
        <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>{precision}</Text>
      ) : null}
    </View>
  );
}

/**
 * Un groupe de l'ecran Infos, avec « Voir les N autres » au-dela de trois.
 * @param {object} props
 * @param {string} props.titre - « Staff · 2 ».
 * @param {Array<{ documentId: string, nom: string, precision: string }>} props.lignes
 *   Les membres.
 * @param {string} props.testID - L'ancre du groupe.
 * @returns {JSX.Element | null}
 */
function Groupe({ lignes, testID, titre }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const [tout, setTout] = useState(false);
  if (!lignes.length) return null;
  const vus = tout ? lignes : lignes.slice(0, APERCU);
  const reste = lignes.length - vus.length;
  return (
    <View
      style={[Spaces.gap[4], {
        borderTopColor: withAlpha(Colors.primary500, 0.14), borderTopWidth: 1, paddingTop: 12,
      }]}
      testID={testID}
    >
      <Text style={[Fonts.p3Bold, Fonts.neutral200, TITRE_DE_GROUPE]}>
        {titre}
      </Text>
      {vus.map((ligne) => (
        <Membre key={ligne.documentId} nom={ligne.nom} precision={ligne.precision} />
      ))}
      {reste > 0 ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setTout(true)}
          style={{ justifyContent: 'center', minHeight: 44 }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {t(`${K}.infos.seeMore`, 'Voir les {{count}} autres', {
              count: reste,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * F — les groupes de l'ecran Infos, prets a afficher.
 * @param {object | null | undefined} info - L'etat du serveur (avec `membres`).
 * @param {(cle: string, repli: string, valeurs?: object) => string} t - La traduction.
 * @returns {{ staff: object[], comptes: object[], parents: object[] }} Les lignes de chaque groupe.
 */
export const groupesDesInfos = (info, t) => {
  const membres = info?.membres || {};
  const role = (r) => (r === 'coach'
    ? t('eventDetails.eventChat.infos.coach', 'Coach')
    : t('eventDetails.eventChat.infos.leader', 'Dirigeant'));
  const statut = (s) => {
    if (s === 'titulaire') return t('eventDetails.eventChat.infos.starter', 'Titulaire');
    if (s === 'remplacant') return t('eventDetails.eventChat.infos.substitute', 'Remplaçant');
    return '';
  };
  const enfant = (e) => (typeof e?.age === 'number'
    ? t(`${K}.infos.child`, '{{name}}, {{age}} ans', {
      age: e.age,
      name: e.prenom,
      ...SANS_ECHAPPEMENT,
    })
    : String(e?.prenom || ''));
  return {
    comptes: (membres.comptes || []).map((m) => ({ ...m, precision: statut(m.statut) })),
    parents: (membres.parents || []).map((m) => ({
      ...m,
      precision: t('eventDetails.eventChat.infos.parentOf', 'parent : {{children}}', {
        children: (m.enfants || []).map(enfant).join(', '),
        ...SANS_ECHAPPEMENT,
      }),
    })),
    staff: (membres.staff || []).map((m) => ({ ...m, precision: role(m.role) })),
  };
};

/**
 * F — l'ecran « Infos » du chat de l'evenement.
 * @param {object} props
 * @param {object | null} props.info - L'etat du serveur.
 * @param {string} props.titre - Le nom du chat (celui de l'evenement).
 * @param {boolean} props.visible - Ouvert ?
 * @param {() => void} props.onClose - Le referme.
 * @returns {JSX.Element}
 */
export function InfosDuChatDEvenement({
  info, onClose, titre, visible,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const groupes = groupesDesInfos(info, t);
  const estUnMatch = info?.evenement?.estUnMatch ?? info?.estUnMatch;
  const regle = estUnMatch
    ? t(
      `${K}.infos.ruleMatch`,
      'La liste suit la convocation. Un joueur ajouté à la convocation rejoint le chat ; '
        + 'un joueur retiré le quitte. Personne ne s’ajoute à la main.',
    )
    : t(
      `${K}.infos.ruleOther`,
      'La liste suit les invités de l’événement. Un invité ajouté rejoint le chat ; '
        + 'un invité retiré le quitte. Personne ne s’ajoute à la main.',
    );
  const compte = (cle, repli, liste) => t(cle, repli, { count: liste.length, ...SANS_ECHAPPEMENT });
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent={false} visible={visible}>
      <View style={{ backgroundColor: Colors.chatBackground, flex: 1 }} testID="event-chat-infos">
        <View style={[Spaces.gap[12], {
          alignItems: 'center', flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
        }]}
        >
          <TouchableOpacity
            accessibilityLabel={t('eventDetails.eventChat.infos.close', 'Fermer')}
            accessibilityRole="button"
            onPress={onClose}
            style={{
              alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
            }}
            testID="event-chat-infos-close"
          >
            <SvgIcon color={Colors.primary500} height={20} name="arrow-left" width={20} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={[Fonts.h5, Fonts.neutral00]}>
            {t('eventDetails.eventChat.infos.title', 'Infos')}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={[Spaces.gap[16], { paddingBottom: 32, paddingHorizontal: 16 }]}
        >
          <View style={[Spaces.gap[4], { alignItems: 'center', paddingVertical: 12 }]}>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: withAlpha(Colors.primary500, 0.16),
                borderRadius: 32,
                height: 64,
                justifyContent: 'center',
                width: 64,
              }}
            >
              <SvgIcon color={Colors.primary500} height={30} name="calendar" width={30} />
            </View>
            <Text style={[Fonts.p1Bold, Fonts.neutral00, { textAlign: 'center' }]}>{titre}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
              {sousTitreDuChatDEvenement(info, t)}
            </Text>
          </View>
          <Text
            style={[Fonts.p3, Fonts.neutral100, Spaces.padding[12], {
              backgroundColor: withAlpha(Colors.primary700, 0.55),
              borderRadius: 12,
            }]}
            testID="event-chat-infos-rule"
          >
            {regle}
          </Text>
          <Groupe
            lignes={groupes.staff}
            testID="event-chat-infos-staff"
            titre={compte(`${K}.infos.staff`, 'Staff · {{count}}', groupes.staff)}
          />
          <Groupe
            lignes={groupes.comptes}
            testID="event-chat-infos-members"
            titre={estUnMatch
              ? compte(`${K}.infos.convoked`, 'Convoqués · {{count}}', groupes.comptes)
              : compte(`${K}.infos.invited`, 'Invités · {{count}}', groupes.comptes)}
          />
          <Groupe
            lignes={groupes.parents}
            testID="event-chat-infos-parents"
            titre={compte(`${K}.infos.parents`, 'Parents · {{count}}', groupes.parents)}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
