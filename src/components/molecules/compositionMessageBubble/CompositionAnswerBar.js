import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { isRsvpEnabled } from '@/domains/event/presenceRule';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { useEventAnswerMutations } from '@/views/event/hooks/useEventAnswerMutations';
import {
  findPublishedBranchForTeam,
  getConvocationPlayerResponse,
  getViewerConvocationRole,
} from '@/views/playerConvocation/playerConvocationUtils';

import { useGetEventConvocation } from '@/services/event/eventQueries';

/**
 * BULLE (decision d'Adel du 29/09, « bulle A ») — LA CARTE « COMPOSITION
 * PUBLIEE » PORTE LA QUESTION QU'ELLE ANNONCE.
 *
 * 🔍 Constat de recette (tournee 3, 28/09, defaut 2) : l'entraineur publie en
 * cochant « Demander une reponse — Present / absent dans le canal »… et la carte
 * n'avait AUCUN bouton : il fallait « Ouvrir » puis « Tu es convoque ».
 *
 * 🧮 UNE SEULE SOURCE DE VERITE, et c'est celle de « Tu es convoque » : la
 * requete `['eventConvocation', eventId, 'auto']` (`GET /events/:id/convocation`).
 * La carte n'a PAS de deuxieme etat, et elle ne recalcule rien : la reponse est
 * celle que le serveur range dans `responses.byPlayerId`, la version et la
 * demande de reponse sont celles du pack publie EN COURS.
 *
 * 🪤 LE PIEGE DE CE LOT — GiftedChat memorise chaque bulle et ne la redessine
 * que si l'objet message change (`piege-giftedchat-memo-ignore-etat-externe`).
 * Une reponse passee par les props depuis `Conversation.js` resterait FIGEE.
 * La barre s'abonne donc ELLE-MEME a la requete : react-query la redessine
 * directement, quoi que decide la memoisation au-dessus d'elle.
 *
 * 🔄 TOUJOURS A JOUR :
 *   · une reponse donnee sur ce telephone (fiche, « Tu es convoque », liste)
 *     invalide `['eventConvocation']` (registre `answerEvent`) ;
 *   · une reponse donnee sur un AUTRE appareil se relit au retour dans le
 *     canal : la requete n'est active que canal a l'ecran (`useIsFocused`), et
 *     react-query relit une copie perimee (30 s) ou invalidee a sa reactivation.
 *     Hors de l'ecran, elle ne coute rien.
 *
 * 🚪 LA MEME PORTE QUE PARTOUT : `useEventAnswerMutations` — celle des cartes de
 * liste et du fil — donc `POST /events/:id/rsvp`, la meme invalidation, et le
 * refus du serveur (match passe, compte non convoque…) dit tel quel.
 */

/**
 * Ce que la carte propose au lecteur, lu dans la convocation EN COURS.
 *
 * ⛔ Aucun bouton (`canAnswer: false`) dans cinq cas, tous lus au serveur :
 *   · la convocation n'est pas encore arrivee (on n'invente pas de boutons) ;
 *   · le lecteur n'est pas dans le pack de cette equipe (entraineur, joueur
 *     ecarte, parent) — la meme regle que « Tu es convoque » ;
 *   · la publication n'a pas demande de reponse (`requireResponse === false`,
 *     la valeur par defaut du serveur est `true`) ;
 *   · FINITIONS5 (tournee 7, defaut 2) — l'organisateur a COUPE les reponses de
 *     l'evenement (`event.rsvpEnabled === false`). La carte proposait Present /
 *     Absent et le serveur repondait 400 (`EVENT_RSVP_DISABLED`). Meme regle
 *     que « Tu es convoque » (`isRsvpEnabled`). Un serveur d'avant FINITIONS5
 *     ne joint pas le champ : la carte garde alors son comportement d'avant ;
 *   · la carte est DEPASSEE : sa version n'est plus celle publiee. C'est le
 *     choix le plus sur — repondre depuis une compo perimee, c'est repondre a
 *     une convocation qui n'existe plus ; la carte en cours, elle, repond.
 * @param {object} input
 * @param {any} [input.convocation] Charge de `GET /events/:id/convocation`.
 * @param {number | string | null} [input.publishedVersion] Version portee par la carte.
 * @param {string} [input.teamId] Equipe de la carte.
 * @param {string} [input.viewerId] `documentId` du lecteur.
 * @returns {{
 *   answer: 'present' | 'absent' | 'pending',
 *   canAnswer: boolean,
 *   currentVersion: number,
 * }} `currentVersion` : la version publiee selon la copie (0 = inconnue).
 */
export const resolveCompositionAnswer = ({
  convocation = null,
  publishedVersion = null,
  teamId = '',
  viewerId = '',
} = {}) => {
  const branch = findPublishedBranchForTeam(convocation, teamId);
  const published = branch?.published;
  const versionEnCours = Number(published?.version) || 0;

  const canAnswer = Boolean(published)
    && Boolean(getViewerConvocationRole({ published }, viewerId))
    && isRsvpEnabled(convocation?.event)
    && published.requireResponse !== false
    && versionEnCours > 0
    && versionEnCours === (Number(publishedVersion) || 0);

  const response = getConvocationPlayerResponse(
    { responsesByPlayerId: branch?.responses?.byPlayerId },
    viewerId,
  );

  return {
    answer: response === 'present' || response === 'absent' ? response : 'pending',
    canAnswer,
    currentVersion: versionEnCours,
  };
};

/**
 * Les boutons Present / Absent sous la carte, et la reponse deja donnee.
 * @param {object} props
 * @param {string} props.eventId
 * @param {number | string | null} [props.publishedVersion]
 * @param {string} [props.teamId]
 * @param {string} props.viewerId
 * @returns {import('react').ReactElement | null}
 */
function CompositionAnswerBar({
  eventId,
  publishedVersion = null,
  teamId = '',
  viewerId,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const isFocused = useIsFocused();

  // `teamId` absent : la MEME cle que « Tu es convoque », que la carte ouvre
  // avec le seul `eventId`. Le serveur ne lit pas l'equipe (`getConvocation`).
  const convocationQuery = useGetEventConvocation(eventId, undefined, {
    enabled: Boolean(eventId) && isFocused,
    refetchOnMount: true,
  });
  const {
    respondToEventRsvpMutation,
    submittingAnswer,
    submittingEventId,
  } = useEventAnswerMutations();

  const { answer, canAnswer, currentVersion } = resolveCompositionAnswer({
    convocation: convocationQuery.data,
    publishedVersion,
    teamId,
    viewerId,
  });

  // 🔁 L'ENTRAINEUR REPUBLIE PENDANT QUE LE JOUEUR LIT LE CANAL : la carte
  // neuve arrive alors que la copie dit encore l'ancienne version (fraiche de
  // moins de 30 s, elle ne serait pas relue). Une carte PLUS RECENTE que la
  // copie prouve que la copie a vieilli : on relit, une seule fois par version
  // — sans quoi la carte neuve resterait sans boutons et l'ancienne les
  // garderait. Toutes les cartes du meme match partagent la copie relue.
  const hasData = convocationQuery.data !== undefined;
  const { refetch } = convocationQuery;
  const cardVersion = Number(publishedVersion) || 0;
  const refetchedForVersion = useRef(0);
  useEffect(() => {
    if (!hasData || !isFocused || cardVersion <= currentVersion) return;
    if (refetchedForVersion.current >= cardVersion) return;
    refetchedForVersion.current = cardVersion;
    refetch();
  }, [cardVersion, currentVersion, hasData, isFocused, refetch]);

  if (!canAnswer) return null;

  const pendingAnswer = submittingEventId === String(eventId) ? submittingAnswer : '';
  const answerLabel = answer === 'present' || answer === 'absent'
    ? t(`playerConvocation.answer.${answer}`)
    : '';

  const handleAnswer = (/** @type {'present' | 'absent'} */ nextAnswer) => {
    if (respondToEventRsvpMutation.isPending) return;
    respondToEventRsvpMutation.mutate({ answer: nextAnswer, eventId });
  };

  return (
    <View style={[styles.bar, { borderTopColor: withAlpha(Colors.neutral00, 0.1) }]}>
      {answerLabel ? (
        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{answerLabel}</Text>
      ) : null}
      <View style={styles.row}>
        <Button
          isLoading={pendingAnswer === 'present'}
          onPress={() => handleAnswer('present')}
          size="sm"
          style={styles.cta}
          title={t('playerConvocation.actions.present')}
          variant={answer === 'present' ? 'Primary' : 'Secondary'}
        />
        <Button
          isLoading={pendingAnswer === 'absent'}
          onPress={() => handleAnswer('absent')}
          size="sm"
          style={styles.cta}
          title={t('playerConvocation.actions.absent')}
          variant={answer === 'absent' ? 'Primary' : 'Secondary'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  cta: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});

export default CompositionAnswerBar;
