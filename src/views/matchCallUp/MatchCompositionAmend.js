import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
// eslint-disable-next-line max-len
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetEventTeamComposition } from '@/services/event/eventQueries';
import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import { getImageUrl } from '@/utils/imageUrl';

import { buildMatchCompositionPack } from './matchCompositionUtils';
import {
  buildAmendedPlacements,
  buildConvocationRoster,
  buildPlayerIndex,
  getWithdrawnStarters,
  proposeReplacements,
} from './matchConvocationUtils';

/**
 * C-B — ECRAN 8 du pack composition : « Modifier une compo publiee ».
 *
 * 🎯 CE QUE CET ECRAN FAIT, EN UNE PHRASE : un titulaire s'est declare absent
 * APRES la publication ; l'ecran montre qui sort, propose qui entre, et
 * republie — sans jamais toucher aux reponses deja donnees.
 *
 * ♻️ CE QUI EST REPRIS, PAS REECRIT (§1 bis) :
 *   · `buildConvocationRoster` / `getWithdrawnStarters` / `proposeReplacements`
 *     / `buildAmendedPlacements` — tout le calcul vit dans `matchConvocationUtils`,
 *     ou il est teste sans rendu.
 *   · `buildMatchCompositionPack` — le MEME constructeur de charge que l'ecran 6.
 *     Republier n'est pas un geste different de publier, c'est le meme.
 *   · `useGetEventTeamComposition`, `ProfileAvatar`, `SubscriptionPaywallSheet`.
 *
 * 🔒 LA REGLE QUI NE DOIT JAMAIS CASSER : republier n'efface AUCUNE reponse.
 * Elle tient PAR CONSTRUCTION cote serveur — la reponse vit dans
 * `event.participations` / `event.missings`, et publier n'ecrit que
 * `event.composition`. Cet ecran n'envoie qu'une composition : il lui est
 * IMPOSSIBLE d'ecrire une reponse. Le temoin est dans
 * `__tests__/matchConvocationUtils.test.js`.
 *
 * ⚠️ CE QUE LE PACK DEMANDE ET QUE LE SERVEUR NE SAIT PAS FAIRE : les 3
 * interrupteurs du haut de la maquette (« Prevenir toute l'equipe », « Notifier
 * les 2 concernes », « Redemander une reponse ») n'ont AUCUN destinataire cote
 * serveur — `requireResponse` voyage deja sans etre lu par personne, et il
 * n'existe pas de notification ciblee « les 2 concernes ». Les afficher
 * laisserait croire a un reglage qui ne regle rien : ils sont donc absents, et
 * la carte « Renvoyer la convocation » dit en clair ce qui va reellement partir.
 * @returns {import('react').ReactElement}
 */
function MatchCompositionAmend() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // 🧨 Fige les parametres : `route?.params || {}` fabrique un objet NEUF a
  // chaque rendu et relancerait tout `useCallback` qui en depend.
  const params = useMemo(() => /** @type {any} */ (route?.params || {}), [route?.params]);
  const {
    eventId, eventLabel, sport, teamId, teamName,
  } = params;

  const [isBusy, setIsBusy] = useState(false);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(
    /** @type {any} */ (null),
  );

  const { data: composition } = useGetEventTeamComposition(eventId, teamId);
  const published = composition?.published || null;
  const responses = composition?.responses || null;

  const roster = useMemo(
    () => buildConvocationRoster({ published, responses }),
    [published, responses],
  );
  const withdrawn = useMemo(() => getWithdrawnStarters(roster), [roster]);
  const replacements = useMemo(() => proposeReplacements({ roster }), [roster]);

  const resolvedTeamName = composition?.team?.name || teamName || '';
  const nextVersion = Number(published?.version || 1) + 1;

  const nomDe = useCallback((/** @type {any} */ player) => {
    const nom = `${player?.firstname || ''} ${player?.lastname || ''}`.trim();
    return nom || t('matchConvocation.amend.unknownPlayer');
  }, [t]);

  const handleActionError = useCallback((/** @type {any} */ error) => {
    const decision = extractSubscriptionDecisionFromError(error);
    if (decision) {
      setSubscriptionPaywallDecision(decision);
      return;
    }
    Alert.alert(
      t('matchConvocation.amend.alerts.error.title'),
      t('matchConvocation.amend.alerts.error.message'),
    );
  }, [t]);

  /**
   * REPUBLIER — enregistrer la composition amendee, puis publier.
   *
   * 🧨 Les DEUX gestes sont necessaires et dans cet ordre : le serveur publie ce
   * qu'il a en brouillon (`POST /composition/publish` ne porte que `teamId`).
   * C'est exactement ce que fait l'ecran 6, repris tel quel.
   */
  const republish = useCallback(async () => {
    if (!eventId || !teamId || isBusy || replacements.length === 0) return;
    setIsBusy(true);
    try {
      const index = buildPlayerIndex(published);
      const sortants = new Set(replacements.map((pair) => pair.outRow.playerId));
      // Le joueur qui se desiste quitte la convocation ; tous les autres
      // convoques restent, a leur place, avec leur reponse.
      const players = roster
        .filter((row) => !sortants.has(row.playerId))
        .map((row) => row.player || index.get(row.playerId))
        .filter(Boolean);

      const pack = buildMatchCompositionPack({
        basePack: published,
        manualPlayers: published?.manualPlayers || [],
        placements: buildAmendedPlacements({ published, replacements }),
        players,
        requireResponse: published?.requireResponse !== false,
        sport: sport || published?.sportContext,
        teamName: resolvedTeamName,
        visibility: published?.visibility,
      });

      await saveEventCompositionDraft(eventId, { draft: pack, teamId });
      await publishEventConvocation(eventId, { teamId });

      Alert.alert(
        t('matchConvocation.amend.alerts.republished.title'),
        t('matchConvocation.amend.alerts.republished.message'),
      );
      navigation.goBack();
    } catch (error) {
      handleActionError(error);
    } finally {
      setIsBusy(false);
    }
  }, [
    eventId, handleActionError, isBusy, navigation, published, replacements,
    resolvedTeamName, roster, sport, t, teamId,
  ]);

  const renderMoveRow = (/** @type {any} */ pair, /** @type {boolean} */ isLeaving) => {
    const row = isLeaving ? pair.outRow : pair.inRow;
    const tone = isLeaving ? Colors.error500 : Colors.success500;

    return (
      <View
        key={`${isLeaving ? 'out' : 'in'}-${row.playerId}`}
        style={[
          styles.moveRow,
          {
            backgroundColor: withAlpha(Colors.neutral00, 0.035),
            borderColor: withAlpha(tone, 0.4),
          },
        ]}
      >
        <ProfileAvatar
          enablePreview={false}
          imageUrl={getImageUrl(row.player?.avatar)}
          name={nomDe(row.player)}
          size={36}
          style={[styles.moveAvatar, { borderColor: tone }]}
        />
        <View style={styles.moveTexts}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {nomDe(row.player)}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p4Bold, { color: tone }]}>
            {isLeaving
              ? t('matchConvocation.amend.moves.starterToAbsent')
              : t('matchConvocation.amend.moves.benchToStarter')}
          </Text>
        </View>
        <View style={[styles.moveBadge, { backgroundColor: tone }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
            {isLeaving
              ? t('matchConvocation.amend.badges.leaving')
              : t('matchConvocation.amend.badges.entering')}
          </Text>
        </View>
      </View>
    );
  };

  // Aucun desistement : l'ecran le DIT plutot que d'afficher un diff vide. Un
  // coach qui arrive ici sans rien a changer doit comprendre pourquoi.
  const aQuelqueChoseAMontrer = withdrawn.length > 0;

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={styles.screen}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('matchConvocation.amend.title')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {[eventLabel, resolvedTeamName].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View
          style={[
            styles.versionChip,
            { backgroundColor: withAlpha(Colors.primary500, 0.12), borderColor: Colors.primary500 },
          ]}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
            {t('matchConvocation.amend.versionChip', { version: nextVersion })}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {aQuelqueChoseAMontrer ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: withAlpha(Colors.warning500, 0.09),
                borderColor: withAlpha(Colors.warning500, 0.34),
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, styles.cardLabel, { color: Colors.warning500 }]}>
              {t('matchConvocation.amend.withdrawal.label').toUpperCase()}
            </Text>
            <Text style={[Fonts.p2Bold, styles.cardTitle, { color: Colors.neutral00 }]}>
              {t('matchConvocation.amend.withdrawal.message', {
                count: withdrawn.length, name: nomDe(withdrawn[0]?.player),
              })}
            </Text>
            <Text style={[Fonts.p4, styles.cardBody, { color: Colors.neutral300 }]}>
              {t('matchConvocation.amend.withdrawal.hint', { count: withdrawn.length })}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.card,
              {
                backgroundColor: withAlpha(Colors.neutral00, 0.035),
                borderColor: withAlpha(Colors.neutral00, 0.09),
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {t('matchConvocation.amend.empty.title')}
            </Text>
            <Text style={[Fonts.p4, styles.cardBody, { color: Colors.neutral300 }]}>
              {t('matchConvocation.amend.empty.message')}
            </Text>
          </View>
        )}

        {aQuelqueChoseAMontrer ? (
          <>
            <Text style={[Fonts.p4Bold, styles.sectionLabel, { color: Colors.neutral300 }]}>
              {t('matchConvocation.amend.sections.changes').toUpperCase()}
            </Text>
            {replacements.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.warning500 }]}>
                {t('matchConvocation.amend.noReplacement')}
              </Text>
            ) : (
              <View style={styles.moves}>
                {replacements.flatMap((pair) => [
                  renderMoveRow(pair, true),
                  renderMoveRow(pair, false),
                ])}
              </View>
            )}

            <Text style={[Fonts.p4Bold, styles.sectionLabel, { color: Colors.neutral300 }]}>
              {t('matchConvocation.amend.sections.resend').toUpperCase()}
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: withAlpha(Colors.neutral00, 0.035),
                  borderColor: withAlpha(Colors.neutral00, 0.09),
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                {t('matchConvocation.amend.resend.title')}
              </Text>
              <Text style={[Fonts.p4, styles.cardBody, { color: Colors.neutral300 }]}>
                {t('matchConvocation.amend.resend.body', { teamName: resolvedTeamName })}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          onPress={() => navigation.goBack()}
          style={styles.footerCancel}
          title={t('matchConvocation.amend.actions.cancel')}
          variant="Secondary"
        />
        <Button
          disabled={isBusy || replacements.length === 0}
          onPress={republish}
          style={styles.footerRepublish}
          title={t('matchConvocation.amend.actions.republish')}
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
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardBody: {
    marginTop: 4,
  },
  cardLabel: {
    letterSpacing: 1,
  },
  cardTitle: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCancel: {
    flexBasis: 108,
    flexGrow: 0,
  },
  footerRepublish: {
    flex: 1,
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
  moveAvatar: {
    borderWidth: 2,
  },
  moveBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  moveRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  moves: {
    gap: 8,
  },
  moveTexts: {
    flex: 1,
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
  versionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});

export default MatchCompositionAmend;
