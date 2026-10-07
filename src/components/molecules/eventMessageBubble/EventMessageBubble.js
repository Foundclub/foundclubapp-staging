import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { lieuAOuvrir, presenceDansLeFil, resumeDesParticipants } from '@/domains/messaging/evenementDansLeFil';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';
import {
  formatEventDateLabel,
  getBackgroundImage,
  getHeaderTitle,
  getTypeAccentColor,
} from '@/components/molecules/eventCard/EventCardNew';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent } from '@/services/event/eventQueries';

import { resolveExternalMatchDisplay, resolveExternalMatchLocation } from '@/utils/externalMatchDisplay';
import { getShortAddress } from '@/utils/location';

/** Au-dela, l'appui allume se rend : le serveur n'a pas repondu (erreur deja dite). */
const DUREE_MAX_DE_L_APPUI_MS = 10000;

/**
 * L'heure affichee a cote de la date : celle saisie, sinon celle de la date.
 * @param {any} evenement
 * @returns {string}
 */
const heureDeLEvenement = (evenement) => {
  if (evenement?.startTime) return String(evenement.startTime).substring(0, 5);
  const date = new Date(evenement?.date);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'HH:mm');
};

/**
 * MSG1A (§3.8 / §3.9) — L'EVENEMENT PARTAGE DANS LE FIL, au dessin du pack : bandeau du
 * type, « Evenement partage », titre, date, equipe, lieu, ligne « Participants »,
 * selecteur « Present | Absent » quand l'evenement demande une reponse, puis l'heure et
 * le pied « Ouvrir l'evenement ». Pose DANS `BulleDuFil` (cadre, queue, nom).
 *
 * ⛔ `EventCardNew` n'est plus monte ici : en `mode="share"` il cachait ses boutons, et
 * la feuille « Evenements de mon planning » le garde tel quel (README §3.8, refus de
 * l'equipe). Ses quatre fonctions d'affichage sont reprises, pas recopiees.
 *
 * La bulle relit l'evenement COMPLET (`useGetEvent`, cle `['event', id]`) : le message
 * n'en porte qu'un apercu, sans les reponses. La meme cle est rafraichie apres chaque
 * reponse (`invalidateAfterAction('answerEvent')`) — deux bulles du meme evenement
 * montrent donc la meme reponse (README : « rattachee a l'evenement »).
 * @param {object} props
 * @param {any} props.event - L'apercu porte par le message.
 * @param {boolean} [props.isMe] - Message envoye par moi (le fil le passe ; le dessin est le meme).
 * @param {import('react').ReactNode} [props.meta] - L'heure et les coches, avant le pied.
 * @param {() => any} [props.onDecline] - « Absent ».
 * @param {() => any} [props.onJoin] - Garde pour le contrat du fil : la bulle du pack n'offre
 *   rien a qui n'est pas convie, il passe par « Ouvrir l'evenement ».
 * @param {(cible: { label: string, latitude?: any, longitude?: any }) => void} [props.onOpenAddress]
 *   - MSG1A (§3.18) : le lieu devient un lien.
 * @param {() => any} [props.onParticipate] - « Present ».
 * @param {(personne: any) => string} [props.resolveAvatar] - L'adresse de la photo d'une personne.
 * @returns {import('react').ReactElement | null}
 */
function EventMessageBubble({
  event,
  meta = null,
  onDecline = () => {},
  onOpenAddress = undefined,
  onParticipate = () => {},
  resolveAvatar = () => '',
}) {
  const { Colors, Images } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { userData } = useAuth();
  const { data: complet, dataUpdatedAt } = useGetEvent(event?.documentId || '');

  // 🕐 T2/D5 — l'option appuyee s'allume TOUT DE SUITE, puis la reponse du serveur reprend
  // la main des que l'evenement est relu. Pas d'etat optimiste (meme regle qu'`EventAnswerButtons`).
  const [appui, setAppui] = useState(/** @type {{ choix: string, depuis: number } | null} */ (null));
  useEffect(() => {
    if (appui && dataUpdatedAt !== appui.depuis) setAppui(null);
  }, [appui, dataUpdatedAt]);
  useEffect(() => {
    if (!appui) return undefined;
    const minuterie = setTimeout(() => setAppui(null), DUREE_MAX_DE_L_APPUI_MS);
    return () => clearTimeout(minuterie);
  }, [appui]);

  if (!event) return null;

  const evenement = complet || event;
  const typeName = evenement?.type?.name || '';
  const estUnStage = String(evenement?.eventFormat || '').toLowerCase().startsWith('stage');
  const estUnMatch = typeName.toLowerCase().includes('match');
  const couleurDuType = getTypeAccentColor(typeName, estUnStage, Colors);
  const titre = (estUnMatch && resolveExternalMatchDisplay(evenement)?.title)
    || evenement?.name
    || t('conversation.eventBubble.untitled', 'Événement');
  const quand = [formatEventDateLabel(evenement?.date), heureDeLEvenement(evenement)]
    .filter(Boolean)
    .join(' · ');
  const equipe = evenement?.team?.name || '';
  const lieu = evenement?.facility?.name
    || getShortAddress(evenement?.locationDetails)
    || getShortAddress(evenement?.location)
    || (estUnMatch ? resolveExternalMatchLocation(evenement) : '')
    || '';

  const presence = presenceDansLeFil({ evenement, utilisateur: userData });
  const reponse = appui ? appui.choix : presence?.reponse || null;
  const resume = resumeDesParticipants(evenement);

  const sousTexte = withAlpha(Colors.neutral00, 0.72);
  const filet = withAlpha(Colors.neutral00, 0.14);

  const ouvrirLEvenement = () => {
    // @ts-ignore
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: evenement.documentId || event.documentId },
      screen: RouteNames.EventDetails,
    });
  };

  const repondre = (/** @type {'present' | 'absent'} */ choix) => {
    setAppui({ choix, depuis: dataUpdatedAt });
    if (choix === 'present') onParticipate();
    else onDecline();
  };

  const ligne = (/** @type {any} */ icone, /** @type {string} */ texte, /** @type {string} */ testID) => (
    <View style={styles.ligne} testID={testID}>
      <GlyphIcon color={sousTexte} name={icone} size={15} />
      <Text numberOfLines={2} style={[styles.ligneTexte, { color: sousTexte }]}>{texte}</Text>
    </View>
  );

  const resumeTexte = resume
    ? [
      resume.presents ? t('conversation.eventBubble.present', { count: resume.presents }) : null,
      resume.absents ? t('conversation.eventBubble.absent', { count: resume.absents }) : null,
      resume.sansReponse
        ? t('conversation.eventBubble.noAnswer', { count: resume.sansReponse })
        : null,
    ].filter(Boolean).join(' · ')
    : '';

  const option = (/** @type {'present' | 'absent'} */ cle, /** @type {string} */ libelle) => {
    const choisie = reponse === cle;
    let fond = 'transparent';
    if (choisie) fond = cle === 'present' ? Colors.primary500 : Colors.chatDanger;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: choisie }}
        activeOpacity={0.85}
        disabled={choisie}
        onPress={() => repondre(cle)}
        style={[styles.option, { backgroundColor: fond }]}
        testID={`evenement-presence-${cle}`}
      >
        {choisie ? <GlyphIcon color={Colors.primary900} name="check" size={15} /> : null}
        <Text style={[styles.optionTexte, { color: choisie ? Colors.primary900 : Colors.neutral00 }]}>
          {libelle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.contenu} testID="bulle-evenement">
      <View style={[styles.bandeau, { backgroundColor: Colors.primary800 }]}>
        <Image
          resizeMode="cover"
          source={getBackgroundImage(typeName, Images, estUnStage)}
          style={styles.bandeauImage}
        />
        <View style={[styles.puce, { backgroundColor: withAlpha(Colors.chatBar, 0.82) }]}>
          <View style={[styles.pucePoint, { backgroundColor: couleurDuType }]} />
          <Text numberOfLines={1} style={[styles.puceTexte, { color: couleurDuType }]}>
            {getHeaderTitle(typeName, evenement).toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={[styles.surtitre, { color: Colors.primary500 }]}>
        {t('conversation.eventBubble.shared', 'Événement partagé')}
      </Text>
      <Text numberOfLines={2} style={[styles.titre, { color: Colors.neutral00 }]}>{titre}</Text>
      {quand ? ligne('calendar', quand, 'evenement-date') : null}
      {equipe
        ? ligne('users', t('conversation.eventBubble.team', { name: equipe, ...SANS_ECHAPPEMENT }), 'evenement-equipe')
        : null}
      {lieu && onOpenAddress ? (
        <TouchableOpacity
          accessibilityHint={t('conversation.address.hint', 'Ouvre le choix de l’application de cartes')}
          accessibilityRole="link"
          onPress={() => onOpenAddress(lieuAOuvrir(evenement, lieu))}
          style={styles.ligne}
          testID="evenement-lieu"
        >
          <GlyphIcon color={Colors.primary500} name="locationPin" size={15} />
          <Text numberOfLines={2} style={[styles.ligneTexte, styles.lien, { color: Colors.primary500 }]}>
            {lieu}
          </Text>
        </TouchableOpacity>
      ) : null}
      {lieu && !onOpenAddress ? ligne('locationPin', lieu, 'evenement-lieu') : null}

      {resume ? (
        <TouchableOpacity
          accessibilityLabel={`${t('conversation.eventBubble.participants', 'Participants')}, ${resumeTexte}`}
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={ouvrirLEvenement}
          style={[styles.participants, { backgroundColor: withAlpha(Colors.neutral900, 0.22) }]}
          testID="evenement-participants"
        >
          {resume.visages.length ? (
            <View style={styles.visages}>
              {resume.visages.map((personne, index) => (
                <View
                  key={String(personne?.documentId || personne?.id || index)}
                  style={[
                    styles.visage,
                    index ? styles.visageSuivant : null,
                    { borderColor: Colors.chatSheet },
                  ]}
                >
                  <ProfileAvatar
                    enablePreview={false}
                    imageUrl={resolveAvatar(personne) || undefined}
                    name={[personne?.firstname, personne?.lastname].filter(Boolean).join(' ')}
                    size={24}
                  />
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.participantsTextes}>
            <Text style={[styles.participantsTitre, { color: Colors.primary500 }]}>
              {t('conversation.eventBubble.participants', 'Participants')}
            </Text>
            <Text numberOfLines={2} style={[styles.participantsResume, { color: withAlpha(Colors.neutral00, 0.82) }]}>
              {resumeTexte}
            </Text>
          </View>
          <GlyphIcon color={withAlpha(Colors.neutral00, 0.6)} name="chevronRight" size={18} />
        </TouchableOpacity>
      ) : null}

      {presence ? (
        <View style={styles.presence} testID="evenement-presence">
          <Text style={[styles.presenceLibelle, { color: sousTexte }]}>
            {reponse
              ? t('conversation.eventBubble.yourAnswer', 'Ta réponse')
              : t('conversation.eventBubble.yourPresence', 'Ta présence')}
          </Text>
          <View style={[styles.piste, { backgroundColor: withAlpha(Colors.neutral900, 0.28) }]}>
            {option('present', t('conversation.eventBubble.answerPresent', 'Présent'))}
            {option('absent', t('conversation.eventBubble.answerAbsent', 'Absent'))}
          </View>
        </View>
      ) : null}

      {meta ? <View style={styles.meta}>{meta}</View> : null}

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={ouvrirLEvenement}
        style={[styles.pied, { borderTopColor: filet }]}
        testID="evenement-ouvrir"
      >
        <Text style={[styles.piedTexte, { color: Colors.primary500 }]}>
          {t('conversation.eventBubble.open', 'Ouvrir l’événement')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    borderRadius: 12,
    height: 96,
    marginTop: 2,
    overflow: 'hidden',
  },
  bandeauImage: {
    height: '100%',
    width: '100%',
  },
  contenu: {
    width: 276,
  },
  lien: {
    textDecorationLine: 'underline',
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  ligneTexte: {
    flex: 1,
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  option: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 38,
    justifyContent: 'center',
  },
  optionTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 14,
    lineHeight: 18,
  },
  participants: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  participantsResume: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 1,
  },
  participantsTextes: {
    flex: 1,
    minWidth: 0,
  },
  participantsTitre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 12,
    lineHeight: 16,
  },
  pied: {
    alignItems: 'center',
    borderTopWidth: 1,
    marginBottom: -7,
    marginHorizontal: -10,
    marginTop: 7,
    paddingBottom: 12,
    paddingTop: 11,
  },
  piedTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
    lineHeight: 20,
  },
  piste: {
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    padding: 3,
  },
  presence: {
    marginTop: 12,
  },
  presenceLibelle: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 6,
  },
  puce: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    left: 8,
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    top: 8,
  },
  pucePoint: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  puceTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 11,
    letterSpacing: 1.4,
    lineHeight: 14,
  },
  surtitre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 9,
  },
  titre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15.5,
    lineHeight: 20,
    marginTop: 3,
  },
  visage: {
    borderRadius: 14,
    borderWidth: 2,
  },
  visages: {
    flexDirection: 'row',
  },
  visageSuivant: {
    marginLeft: -8,
  },
});

export default EventMessageBubble;
