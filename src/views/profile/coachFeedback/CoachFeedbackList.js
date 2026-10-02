import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import { feedbackMetaLine } from '@/views/profile/coachFeedback/coachFeedbackModel';

/**
 * ST-RETOURS (02/10) — « RETOURS DU COACH », planche 19 du design valide des statistiques.
 *
 * Une carte par retour : le match (et « Nouveau » tant qu il n a pas ete lu), l equipe, le
 * jour DU MATCH, le resultat et qui a ecrit ; la note sur 10 s il y en a une (jamais « 0/10 ») ;
 * le mot, en entier ; « Ouvrir le match » pour le joueur. Sous la liste, qui peut la lire.
 * La meme carte sert la fiche de l enfant, vue par son parent (planche 22, « Dernier retour »).
 */

/**
 * La ligne « qui peut lire » : un cadenas, et la phrase.
 * @param {object} props - Les proprietes.
 * @param {string} props.text - La phrase.
 * @param {string} [props.testID] - Le reperage des temoins.
 * @returns {import('react').ReactElement} - La ligne.
 */
export function WhoCanReadLine({ testID, text }) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <View style={[Alignments.row, Alignments.alignStart, { gap: 8 }]} testID={testID}>
      <Icone
        color={Colors.neutral300}
        height={14}
        name="shield"
        style={{ marginTop: 2 }}
        width={14}
      />
      <Text style={[Fonts.p3, Fonts.neutral300, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

/**
 * La pastille « Nouveau ».
 * @param {object} props - Les proprietes.
 * @param {string} props.label - Le texte.
 * @returns {import('react').ReactElement} - La pastille.
 */
export function NewPill({ label }) {
  const { Colors, Fonts } = useTheme();
  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary500, 0.12),
        borderColor: withAlpha(Colors.primary500, 0.45),
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}
    >
      <Text style={[Fonts.p4Bold, Fonts.primary200]}>{label}</Text>
    </View>
  );
}

/**
 * Le style d une carte « carte-bloc » ; vive (bord plein) quand elle est neuve.
 * @param {any} Colors - Les couleurs du theme.
 * @param {boolean} isVivid - Bord plein.
 * @returns {object} - Le style.
 */
export const feedbackCardStyle = (Colors, isVivid) => ({
  backgroundColor: withAlpha(Colors.primary700, 0.55),
  borderColor: isVivid ? Colors.primary500 : withAlpha(Colors.primary500, 0.24),
  borderRadius: 24,
  borderWidth: 1,
  gap: 12,
  padding: 16,
});

/**
 * Le mot de l entraineur, avec son filet a gauche.
 * @param {object} props - Les proprietes.
 * @param {string} props.text - Le mot.
 * @param {number} [props.numberOfLines] - Coupe, ou rien (vue dediee : tout se lit).
 * @returns {import('react').ReactElement} - Le bloc.
 */
export function CoachWords({ numberOfLines, text }) {
  const { Colors, Fonts } = useTheme();
  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.neutral00, 0.05),
        borderBottomRightRadius: 12,
        borderLeftColor: Colors.primary500,
        borderLeftWidth: 2,
        borderTopRightRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text numberOfLines={numberOfLines} style={[Fonts.p2, Fonts.neutral100]}>{text}</Text>
    </View>
  );
}

/**
 * Une carte de retour.
 * @param {object} props - Les proprietes.
 * @param {any} props.item - Le retour, tel que le serveur le rend.
 * @param {boolean} [props.isNew] - Pas encore lu.
 * @param {(item: any) => void} [props.onOpenMatch] - « Ouvrir le match » (le joueur seulement).
 * @param {boolean} [props.showFullComment] - Ne rien couper.
 * @returns {import('react').ReactElement} - La carte.
 */
export function CoachFeedbackCard({
  isNew = false,
  item,
  onOpenMatch,
  showFullComment = false,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts,
  } = useTheme();
  const meta = feedbackMetaLine(t, item, 'list');
  const comment = String(item?.comment || '').trim();
  const hasRating = typeof item?.rating === 'number';
  const matchLabel = item?.matchLabel || t('stRetours.feedback.matchFallback');

  return (
    <View
      accessibilityLabel={t('stRetours.feedback.cardLabel', {
        match: matchLabel,
        status: isNew ? t('stRetours.feedback.new') : '',
        ...SANS_ECHAPPEMENT,
      }).trim()}
      style={feedbackCardStyle(Colors, isNew)}
      testID="coach-feedback-card"
    >
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{matchLabel}</Text>
        {isNew ? <NewPill label={t('stRetours.feedback.new')} /> : null}
      </View>
      {meta ? <Text style={[Fonts.p3, Fonts.neutral300]}>{meta}</Text> : null}
      {hasRating ? (
        <Text style={[Fonts.h1Black, Fonts.neutral00]}>
          {`${item.rating}/10`}
        </Text>
      ) : null}
      {comment ? (
        <CoachWords numberOfLines={showFullComment ? undefined : 3} text={comment} />
      ) : null}
      {onOpenMatch && item?.sourceDocumentId ? (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => onOpenMatch(item)}
          style={[Alignments.row, Alignments.alignCenter, { gap: 8, minHeight: 44 }]}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>{t('stRetours.feedback.openMatch')}</Text>
          <Icone color={Colors.primary500} height={12} name="arrow-right" width={12} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * La liste des retours.
 * @param {object} props - Les proprietes.
 * @param {any[]} props.items - Les retours, le plus recent en haut.
 * @param {Set<string>} [props.newKeys] - Les clefs pas encore lues.
 * @param {(item: any) => void} [props.onOpenMatch] - « Ouvrir le match ».
 * @param {boolean} [props.showFullComments] - Vue dediee : rien n est coupe.
 * @returns {import('react').ReactElement} - La liste.
 */
function CoachFeedbackList({
  items,
  newKeys,
  onOpenMatch,
  showFullComments = false,
}) {
  return (
    <View style={{ gap: 16 }}>
      {(Array.isArray(items) ? items : []).map((item, index) => (
        <CoachFeedbackCard
          isNew={Boolean(newKeys?.has(String(item?.feedbackKey || '')))}
          item={item}
          key={String(item?.feedbackKey || `${item?.sourceDocumentId || 'retour'}-${index}`)}
          onOpenMatch={onOpenMatch}
          showFullComment={showFullComments}
        />
      ))}
    </View>
  );
}

/**
 * La vue « Retours du coach » sous l en-tete : chargement, panne, vide, ou la liste — puis
 * qui peut la lire.
 * @param {object} props - Les proprietes.
 * @param {any[]} props.items - Les retours.
 * @param {boolean} props.isLoading - Premiere lecture en cours.
 * @param {boolean} props.hasError - La lecture a echoue.
 * @param {() => void} props.onRetry - « Reessayer ».
 * @param {Set<string>} [props.newKeys] - Les clefs pas encore lues.
 * @param {(item: any) => void} [props.onOpenMatch] - « Ouvrir le match » (le joueur).
 * @param {'parent' | 'self'} props.viewer - Qui lit.
 * @param {string} [props.childFirstname] - L enfant (vue du parent).
 * @param {boolean} [props.hasParentLink] - Le joueur a un parent relie.
 * @returns {import('react').ReactElement} - Le corps de la vue.
 */
export function CoachFeedbackViewBody({
  childFirstname = '',
  hasError,
  hasParentLink = false,
  isLoading,
  items,
  newKeys,
  onOpenMatch,
  onRetry,
  viewer,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts,
  } = useTheme();
  const list = Array.isArray(items) ? items : [];
  const isParent = viewer === 'parent';

  if (isLoading && !list.length) {
    return (
      <View accessibilityState={{ busy: true }} style={{ gap: 16 }} testID="coach-feedback-loading">
        {[230, 180].map((height) => (
          <View
            key={height}
            style={{ backgroundColor: withAlpha(Colors.neutral00, 0.08), borderRadius: 24, height }}
          />
        ))}
      </View>
    );
  }

  if (hasError && !list.length) {
    return (
      <View
        accessibilityRole="alert"
        style={{
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.35),
          borderRadius: 16,
          borderWidth: 1,
          gap: 12,
          padding: 24,
        }}
        testID="coach-feedback-error"
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{t('stRetours.feedback.errorTitle')}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{t('stRetours.feedback.errorHint')}</Text>
        <Button onPress={onRetry} title={t('stRetours.feedback.retry')} variant="Secondary" />
      </View>
    );
  }

  if (!list.length) {
    return (
      <View
        style={[
          Alignments.alignCenter,
          {
            backgroundColor: Colors.primary900,
            borderRadius: 16,
            gap: 16,
            padding: 24,
          },
        ]}
        testID="coach-feedback-empty"
      >
        <Icone color={Colors.primary200} height={40} name="message-circle" width={40} />
        <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
          {t('stRetours.feedback.emptyTitle')}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter]}>
          {isParent ? t('stRetours.parent.emptyHint') : t('stRetours.feedback.emptyHint')}
        </Text>
      </View>
    );
  }

  let whoCanRead = t('stRetours.feedback.visibleSelfOnly');
  if (isParent) {
    whoCanRead = t('stRetours.parent.visibleChildAndYou', {
      firstname: childFirstname,
      ...SANS_ECHAPPEMENT,
    });
  } else if (hasParentLink) {
    whoCanRead = t('stRetours.feedback.visibleSelfAndParents');
  }

  return (
    <View style={{ gap: 16 }}>
      <CoachFeedbackList
        items={list}
        newKeys={newKeys}
        onOpenMatch={isParent ? undefined : onOpenMatch}
        showFullComments
      />
      <WhoCanReadLine testID="coach-feedback-who-can-read" text={whoCanRead} />
    </View>
  );
}

export default CoachFeedbackList;
