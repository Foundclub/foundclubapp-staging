import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
// eslint-disable-next-line max-len
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTeamComposition } from '@/services/event/eventQueries';
import { publishEventConvocation } from '@/services/event/eventService';

import { getImageUrl } from '@/utils/imageUrl';

import {
  buildConvocationRoster,
  CONVOCATION_RESPONSE_ABSENT,
  CONVOCATION_RESPONSE_PRESENT,
  CONVOCATION_ROLE_STARTER,
  getConvocationCounts,
  getWithdrawnStarters,
} from './matchConvocationUtils';

/**
 * C-B — ECRAN 7 du pack composition : « Convocation publiee », vue du coach.
 *
 * 🚨 CE QUE CET ECRAN BRANCHE, ET QUI EXISTAIT DEJA : le serveur calcule les
 * reponses des convoques (`responses: { byPlayerId, counts }`) et les envoie a
 * chaque lecture de `GET /events/:id/composition`. Avant ce lot, AUCUN fichier
 * de l'app ne les lisait — la donnee etait calculee, transmise, et jetee.
 * Cet ecran ne demande donc rien de neuf au serveur.
 *
 * ♻️ CE QUI EST REPRIS, PAS REECRIT :
 *   · `ProfileAvatar` — l'avatar et son repli en initiales.
 *   · `useGetEventTeamComposition` — la requete existe deja, avec son cache.
 *   · `SubscriptionPaywallSheet` — le mur payant branche par le lot C-A.
 *   · `ScreenContainer` / `HeaderBackButton` / `Button` — le gabarit d'ecran.
 *
 * ⚠️ « Relancer » n'a PAS de geste serveur dedie : la seule action existante est
 * `POST /events/:id/composition/publish`, qui renvoie exactement la meme
 * convocation (meme canal, meme push, meme demande de reponse) et incremente
 * `version`. C'est ce que le pack appelle republier — donc relancer, c'est
 * republier a l'identique. La fenetre de confirmation dit ce qui va se passer,
 * plutot que de laisser croire a un rappel silencieux.
 * @returns {import('react').ReactElement}
 */
function MatchConvocationPublished() {
  const { Colors, Fonts, Images } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // 🧨 Fige les parametres de route : `route?.params || {}` fabrique un objet
  // NEUF a chaque rendu, ce qui relance tout `useCallback` qui en depend.
  const params = useMemo(() => /** @type {any} */ (route?.params || {}), [route?.params]);
  const {
    eventId, eventLabel, teamId, teamName,
  } = params;

  const [isBusy, setIsBusy] = useState(false);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(
    /** @type {any} */ (null),
  );

  const { data: composition, isFetching } = useGetEventTeamComposition(eventId, teamId);
  const published = composition?.published || null;
  const responses = composition?.responses || null;

  const roster = useMemo(
    () => buildConvocationRoster({ published, responses }),
    [published, responses],
  );
  const counts = useMemo(
    () => getConvocationCounts({ responses, roster }),
    [responses, roster],
  );
  // 🚪 LA PORTE DE L'ECRAN 8. Elle n'apparait QUE s'il y a un desistement :
  // proposer « remplacer l'absent » quand personne n'est absent ouvrirait un
  // ecran qui n'aurait rien a montrer.
  const withdrawn = useMemo(() => getWithdrawnStarters(roster), [roster]);

  const resolvedTeamName = composition?.team?.name || teamName || '';

  // Le pack ecrit « Envoyee dans le canal Senior 1 · 18:02 ». L'heure vient de
  // la publication elle-meme ; sans elle, on n'invente pas un horaire.
  const publishedAtLabel = useMemo(() => {
    if (!published?.publishedAt) return '';
    const date = new Date(published.publishedAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }, [published?.publishedAt]);

  const handleActionError = useCallback((/** @type {any} */ error) => {
    const decision = extractSubscriptionDecisionFromError(error);
    if (decision) {
      setSubscriptionPaywallDecision(decision);
      return;
    }
    Alert.alert(
      t('matchConvocation.published.alerts.error.title'),
      t('matchConvocation.published.alerts.error.resend'),
    );
  }, [t]);

  const resendConvocation = useCallback(async () => {
    if (!eventId || !teamId || isBusy) return;
    setIsBusy(true);
    try {
      await publishEventConvocation(eventId, { teamId });

      // 🧨 AB03 — MEME CAUSE QUE SES DEUX ECRANS FRERES. Renvoyer la convocation
      // change `publishedAt` et remet les reponses a zero cote serveur : sans
      // cette ligne, l'ecran continuait d'afficher l'ancienne date d'envoi et
      // les anciennes reponses, ici comme sur `EventDetails`.
      // ⚠️ Non attendu : le marquage est SYNCHRONE, seule la relecture ne l'est
      //    pas — et l'ecran reste monte pour la recevoir.
      invalidateAfterAction(queryClient, 'publishComposition').catch(() => {});

      Alert.alert(
        t('matchConvocation.published.alerts.resent.title'),
        t('matchConvocation.published.alerts.resent.message'),
      );
    } catch (error) {
      handleActionError(error);
    } finally {
      setIsBusy(false);
    }
  }, [eventId, handleActionError, isBusy, queryClient, t, teamId]);

  const handleResend = useCallback(() => {
    Alert.alert(
      t('matchConvocation.published.alerts.resendConfirm.title'),
      t('matchConvocation.published.alerts.resendConfirm.message', { teamName: resolvedTeamName }),
      [
        { style: 'cancel', text: t('matchConvocation.published.alerts.resendConfirm.cancel') },
        {
          onPress: resendConvocation,
          text: t('matchConvocation.published.alerts.resendConfirm.confirm'),
        },
      ],
    );
  }, [resendConvocation, resolvedTeamName, t]);

  // « Modifier la composition » — le CTA principal du pack. Il rouvre le
  // parcours a l'ecran 1, la ou le coach choisit ses convoques : c'est le meme
  // chemin que la premiere fois, la compo publiee servant de point de depart.
  // « Remplacer » — l'ecran 8, le chemin GUIDE. Il ne remplace pas « Modifier
  // la composition » : celui-la rouvre tout le parcours, celui-ci ne traite que
  // le desistement.
  const handleAmend = useCallback(() => {
    // @ts-ignore
    navigation.navigate(RouteNames.MatchCompositionAmend, params);
  }, [navigation, params]);

  const handleEdit = useCallback(() => {
    // @ts-ignore
    navigation.navigate(RouteNames.MatchCallUpSelection, {
      ...params,
      existingComposition: published,
      publishedComposition: published,
    });
  }, [navigation, params, published]);

  const renderCountChip = (/** @type {string} */ key, /** @type {number} */ value) => {
    const isPresent = key === CONVOCATION_RESPONSE_PRESENT;
    return (
      <View
        key={key}
        style={[
          styles.countChip,
          {
            backgroundColor: isPresent ? withAlpha(Colors.primary500, 0.12) : Colors.transparent,
            borderColor: isPresent ? Colors.primary500 : withAlpha(Colors.neutral00, 0.28),
          },
        ]}
      >
        <Text style={[Fonts.p4Bold, { color: isPresent ? Colors.primary500 : Colors.neutral00 }]}>
          {t(`matchConvocation.published.counts.${key}`, { count: value })}
        </Text>
      </View>
    );
  };

  // La pastille de statut, sous la rangee. Les couleurs sont celles du theme —
  // le pack interdit d'inventer un vert ou un rouge pour l'occasion.
  const renderResponsePill = (/** @type {string | null} */ response) => {
    if (!response) return null;
    const tone = {
      absent: Colors.error500,
      pending: Colors.neutral300,
      present: Colors.success500,
    }[response] || Colors.neutral300;

    return (
      <View
        style={[
          styles.responsePill,
          { backgroundColor: withAlpha(tone, 0.14), borderColor: withAlpha(tone, 0.45) },
        ]}
      >
        <Text style={[Fonts.p4Bold, { color: tone }]}>
          {t(`matchConvocation.published.responses.${response}`)}
        </Text>
      </View>
    );
  };

  const renderRow = (/** @type {any} */ row) => {
    const player = row?.player || {};
    const name = `${player?.firstname || ''} ${player?.lastname || ''}`.trim();
    const roleLabel = row.role === CONVOCATION_ROLE_STARTER
      ? t('matchConvocation.published.roles.starter')
      : t('matchConvocation.published.roles.substitute');
    const meta = player?.number
      ? t('matchConvocation.published.meta.roleAndNumber', {
        number: player.number, role: roleLabel,
      })
      : roleLabel;

    return (
      <View
        key={row.playerId}
        style={[
          styles.playerRow,
          {
            backgroundColor: withAlpha(Colors.neutral00, 0.035),
            borderColor: withAlpha(Colors.neutral00, 0.08),
          },
        ]}
      >
        <View style={styles.playerHead}>
          <ProfileAvatar
            enablePreview={false}
            imageUrl={getImageUrl(player?.avatar)}
            name={name}
            size={34}
            style={[
              styles.playerAvatar,
              {
                borderColor: row.response === CONVOCATION_RESPONSE_PRESENT
                  ? Colors.primary500
                  : withAlpha(Colors.neutral00, 0.16),
              },
            ]}
          />
          <View style={styles.playerTexts}>
            <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {name || t('matchConvocation.published.unknownPlayer')}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
              {meta}
            </Text>
          </View>
        </View>
        {row.isManual ? (
          <Text style={[Fonts.p4, styles.playerNote, { color: Colors.warning500 }]}>
            {t('matchConvocation.published.offAppNote')}
          </Text>
        ) : renderResponsePill(row.response)}
      </View>
    );
  };

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('matchConvocation.published.title')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {[eventLabel || t('matchCallUp.selection.defaultEventType'), resolvedTeamName]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View
          style={[
            styles.stateChip,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.12),
              borderColor: Colors.primary500,
            },
          ]}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
            {t('matchConvocation.published.stateChip')}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {/* La carte de recap. Le degrade cyan du pack est rendu par le meme
            composant que les cartes d'evenement — aucun hex neuf.
            🧨 S04 — ET LE DEGRADE N'EST PAS LA CARTE. Il l'etait : il portait
            l'arrondi, la bordure et les marges, donc il devait se dimensionner
            sur ses enfants, et iOS tranchait le carre (le meme defaut deja paye
            sur les cartes evenement et club). Motif repris tel quel de
            `ClubCardSurface.js:37-51`, POINT DE VERITE UNIQUE des cartes club :
            un conteneur ordinaire porte la taille et decoupe les coins, le
            degrade est POSE DERRIERE en `absoluteFill`, sans enfant. */}
        <View style={[styles.recapCard, { borderColor: withAlpha(Colors.primary500, 0.3) }]}>
          <LinearGradient
            colors={[withAlpha(Colors.primary500, 0.16), withAlpha(Colors.primary900, 0.6)]}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.recapBadge, { backgroundColor: Colors.primary500 }]}>
            <Image
              source={Images.check}
              style={[styles.recapCheck, { tintColor: Colors.primary900 }]}
            />
          </View>
          <Text style={[Fonts.h4Bold, styles.recapTitle, { color: Colors.neutral00 }]}>
            {t('matchConvocation.published.recap.title')}
          </Text>
          <Text style={[Fonts.p4, styles.recapSubtitle, { color: Colors.neutral300 }]}>
            {publishedAtLabel
              ? t('matchConvocation.published.recap.sentAt', {
                teamName: resolvedTeamName, time: publishedAtLabel,
              })
              : t('matchConvocation.published.recap.sent', { teamName: resolvedTeamName })}
          </Text>
          <Text style={[styles.recapNumber, { color: Colors.neutral00 }]}>
            {counts.calledUp}
          </Text>
          <Text style={[Fonts.p4Bold, styles.recapNumberLabel, { color: Colors.primary500 }]}>
            {t('matchConvocation.published.recap.calledUp').toUpperCase()}
          </Text>
          <View style={styles.countChips}>
            {renderCountChip(CONVOCATION_RESPONSE_PRESENT, counts.present)}
            {renderCountChip('pending', counts.pending)}
            {renderCountChip(CONVOCATION_RESPONSE_ABSENT, counts.absent)}
          </View>
        </View>

        {withdrawn.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAmend}
            style={[
              styles.withdrawalBanner,
              {
                backgroundColor: withAlpha(Colors.warning500, 0.09),
                borderColor: withAlpha(Colors.warning500, 0.34),
              },
            ]}
          >
            <View style={styles.withdrawalTexts}>
              <Text style={[Fonts.p4Bold, styles.cardLabel, { color: Colors.warning500 }]}>
                {t('matchConvocation.published.withdrawal.label').toUpperCase()}
              </Text>
              <Text style={[Fonts.p2Bold, styles.cardTitle, { color: Colors.neutral00 }]}>
                {t('matchConvocation.published.withdrawal.message', { count: withdrawn.length })}
              </Text>
            </View>
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              {t('matchConvocation.published.withdrawal.cta')}
            </Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[Fonts.p4Bold, styles.sectionLabel, { color: Colors.neutral300 }]}>
          {t('matchConvocation.published.sections.responses').toUpperCase()}
        </Text>

        {roster.length === 0 ? (
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {isFetching
              ? t('matchConvocation.published.loading')
              : t('matchConvocation.published.empty')}
          </Text>
        ) : (
          <View style={styles.rows}>{roster.map(renderRow)}</View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          disabled={isBusy}
          onPress={handleResend}
          style={styles.footerResend}
          title={t('matchConvocation.published.actions.resend')}
          variant="Secondary"
        />
        <Button
          onPress={handleEdit}
          style={styles.footerEdit}
          title={t('matchConvocation.published.actions.edit')}
          variant="Primary"
        />
      </View>

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={subscriptionPaywallDecision?.clubDocumentId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardLabel: {
    letterSpacing: 1,
  },
  cardTitle: {
    marginTop: 4,
  },
  countChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerEdit: {
    flex: 1,
  },
  footerResend: {
    flexBasis: 128,
    flexGrow: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerTexts: {
    flex: 1,
  },
  playerAvatar: {
    borderWidth: 2,
  },
  playerHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  playerNote: {
    marginTop: 8,
  },
  playerRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  playerTexts: {
    flex: 1,
  },
  recapBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  recapCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    // Le degrade est en absoluteFill DERRIERE le contenu : sans cette decoupe
    // il deborderait des coins arrondis (`ClubCardSurface.js:62`).
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  recapCheck: {
    height: 22,
    resizeMode: 'contain',
    width: 22,
  },
  recapNumber: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 12,
  },
  recapNumberLabel: {
    letterSpacing: 0.8,
  },
  recapSubtitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  recapTitle: {
    marginTop: 8,
    textAlign: 'center',
  },
  responsePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  rows: {
    gap: 8,
  },
  screen: {
    paddingHorizontal: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: -8,
  },
  stateChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  withdrawalBanner: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  withdrawalTexts: {
    flex: 1,
  },
});

export default MatchConvocationPublished;
