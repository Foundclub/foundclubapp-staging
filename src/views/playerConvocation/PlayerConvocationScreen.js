/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Loader from '@/components/atoms/loader/Loader';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { getCompositionPlayerInitials } from '@/utils/compositionPlayer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent, useGetEventConvocation } from '@/services/event/eventQueries';
import { respondToEventRsvp } from '@/services/event/eventService';

import { getImageUrl } from '@/utils/imageUrl';
import { getTacticalFieldAspectRatio } from '@/utils/tacticalField';

import {
  buildConvocationFieldTokens,
  buildPlayerConvocationView,
  CONVOCATION_ROLE_STARTER,
  formatConvocationTime,
  getPlayerConvocationResponse,
} from './playerConvocationUtils';

/**
 * C-C — ECRAN 10 du pack composition : la moitie que le joueur voit.
 *
 * Jusqu'ici, le coach convoquait, publiait… et le joueur n'avait AUCUN ecran qui
 * le lui disait : la notification atterrissait sur la page de l'evenement, et la
 * seule trace de sa place etait une phrase perdue dans l'ancien terrain en
 * lecture seule.
 *
 * 🚦 CE QUI DECIDE DE TOUT : `buildPlayerConvocationView` rend `null` quand la
 * personne n'est pas convoquee. Le serveur envoie la meme notification a
 * l'entraineur, a l'organisateur et aux non-retenus — cet ecran les REPOSE donc
 * sur la page de l'evenement (`navigation.replace`), il ne leur montre jamais une
 * convocation qui n'est pas la leur.
 *
 * ♻️ CE QUI EST REPRIS, PAS REECRIT :
 *   · `RenderedTacticalField` — les traces de terrain et leurs couleurs.
 *   · `ProfileAvatar` — l'avatar du design system, initiales comprises.
 *   · `respondToEventRsvp` — le MEME appel que la barre presence de la liste
 *     d'evenements. Deux chemins pour repondre « present » finiraient par
 *     diverger ; il n'y en a qu'un.
 *   · `getMatchPositionLabels` du pack — les postes par sport, deja transcrits.
 *
 * 🧾 CE QUE LA MESURE A CONTREDIT DANS LE PACK : le pack dessine 3 colonnes
 * « RDV · Coup d'envoi · Lieu ». **Le modele serveur n'a AUCUN champ d'heure de
 * rendez-vous** (`event/schema.json` : `date`, `startTime`, `endTime`, `location`,
 * `locationDetails` — pas de `meetingTime`, mesure du 2026-08-15). La colonne
 * existe donc, mais elle affiche « Non précisé » plutot qu'une heure inventee :
 * le pack interdit lui-meme les promesses fausses.
 */

/** Diametre du jeton du terrain, et celui — grossi — du jeton du lecteur. */
const TOKEN_SIZE = 24;
const TOKEN_SIZE_MINE = 30;

/** Hauteur du terrain de l'ecran 10, reprise du pack. */
const FIELD_HEIGHT = 300;

function PlayerConvocationScreen() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { userData } = useAuth();

  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const { eventId, teamId } = params;

  const convocationQuery = useGetEventConvocation(eventId, teamId, {
    enabled: Boolean(eventId),
  });
  const eventQuery = useGetEvent(eventId, { enabled: Boolean(eventId) });

  const convocation = convocationQuery.data;
  const viewerId = String(userData?.documentId || userData?.id || '').trim();

  const view = useMemo(
    () => buildPlayerConvocationView({ convocation, userId: viewerId }),
    [convocation, viewerId],
  );

  const isSettled = convocationQuery.isError
    || (!convocationQuery.isLoading && Boolean(convocation));

  // 🔒 Le garde-fou, cote navigation. On ne redirige QUE quand la reponse du
  // serveur est arrivee : rediriger pendant le chargement renverrait tout le
  // monde, convoques compris.
  useEffect(() => {
    if (!isSettled || view) return;
    // @ts-ignore — `replace` existe sur un ecran de pile.
    navigation.replace(RouteNames.EventDetails, { eventId });
  }, [eventId, isSettled, navigation, view]);

  const answer = getPlayerConvocationResponse(convocation, viewerId);

  const rsvpMutation = useMutation({
    mutationFn: (/** @type {'present' | 'absent'} */ nextAnswer) => (
      respondToEventRsvp(eventId, nextAnswer, /** @type {any} */ ({
        eventName: convocation?.event?.name || '',
      }))
    ),
    onError: () => {
      Alert.alert(
        t('playerConvocation.alerts.error.title'),
        t('playerConvocation.alerts.error.message'),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventConvocation', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });

  const handleAnswer = useCallback((/** @type {'present' | 'absent'} */ nextAnswer) => {
    if (!eventId || rsvpMutation.isPending) return;
    rsvpMutation.mutate(nextAnswer);
  }, [eventId, rsvpMutation]);

  const fieldTokens = useMemo(() => buildConvocationFieldTokens({
    placements: view?.placements,
    snapshotPlayers: convocation?.published?.snapshotPlayers,
  }), [convocation?.published?.snapshotPlayers, view?.placements]);

  if (!view) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
        <View style={styles.loaderBox}>
          <Loader />
        </View>
      </ScreenContainer>
    );
  }

  const event = eventQuery.data || convocation?.event || null;
  const kickOff = formatConvocationTime(event?.startTime || convocation?.event?.date);
  const place = String(event?.location || event?.facility?.name || '').trim();

  const subtitle = [
    view.teamName,
    formatConvocationTime(convocation?.event?.date) || null,
  ].filter(Boolean).join(' · ');

  const identityLine = [
    view.positionLabel
      ? t('playerConvocation.card.position', { position: view.positionLabel })
      : '',
    view.jerseyNumber ? t('playerConvocation.card.number', { number: view.jerseyNumber }) : '',
  ].filter(Boolean).join(' · ');

  const columns = [
    { key: 'meeting', value: t('playerConvocation.columns.notSpecified') },
    { key: 'kickOff', value: kickOff || t('playerConvocation.columns.notSpecified') },
    { key: 'place', value: place || t('playerConvocation.columns.notSpecified') },
  ];

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('playerConvocation.title')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {subtitle}
          </Text>
        </View>
        <View
          style={[
            styles.roleChip,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.16),
              borderColor: withAlpha(Colors.primary500, 0.45),
            },
          ]}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
            {view.role === CONVOCATION_ROLE_STARTER
              ? t('playerConvocation.roles.starter')
              : t('playerConvocation.roles.substitute')}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.14),
              borderColor: withAlpha(Colors.primary500, 0.3),
            },
          ]}
        >
          <View style={styles.identityRow}>
            <ProfileAvatar
              enablePreview={false}
              imageUrl={getImageUrl(view.viewerPlayer?.avatar?.url || view.viewerPlayer?.avatar)}
              name={[view.viewerPlayer?.firstname, view.viewerPlayer?.lastname]
                .filter(Boolean).join(' ')}
              size={48}
            />
            <View style={styles.identityTexts}>
              {identityLine ? (
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{identityLine}</Text>
              ) : null}
              {view.publishedByName ? (
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                  {t('playerConvocation.card.calledUpBy', { name: view.publishedByName })}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.columns, { borderTopColor: withAlpha(Colors.neutral00, 0.1) }]}>
            {columns.map((column) => (
              <View key={column.key} style={styles.column}>
                <Text style={[Fonts.p4Bold, styles.columnLabel, { color: Colors.neutral300 }]}>
                  {t(`playerConvocation.columns.${column.key}`).toUpperCase()}
                </Text>
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{column.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
          {t('playerConvocation.compositionTitle').toUpperCase()}
        </Text>

        <RenderedTacticalField
          sport={view.sport}
          style={[styles.field, { aspectRatio: 1 / getTacticalFieldAspectRatio(view.sport) }]}
        >
          {fieldTokens.map((/** @type {any} */ { placement, player }) => {
            const isMine = String(placement?.playerId || '') === view.playerId;
            const size = isMine ? TOKEN_SIZE_MINE : TOKEN_SIZE;
            return (
              <View
                key={placement.playerId}
                style={[
                  styles.token,
                  {
                    backgroundColor: withAlpha(Colors.primary500, isMine ? 0.95 : 0.75),
                    borderColor: isMine ? Colors.neutral00 : Colors.primary100,
                    borderRadius: size / 2,
                    height: size,
                    left: `${placement.positionX}%`,
                    marginLeft: -(size / 2),
                    marginTop: -(size / 2),
                    top: `${placement.positionY}%`,
                    width: size,
                  },
                ]}
              >
                <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                  {getCompositionPlayerInitials(player)}
                </Text>
              </View>
            );
          })}
        </RenderedTacticalField>
      </ScrollView>

      {/* Barre presence / absence. Elle porte la reponse DEJA donnee — le serveur
          la calcule (`responses.byPlayerId`), l'app ne la recalcule pas. */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          isLoading={rsvpMutation.isPending && answer !== 'present'}
          onPress={() => handleAnswer('present')}
          style={styles.footerCta}
          title={t('playerConvocation.actions.present')}
          variant={answer === 'present' ? 'Primary' : 'Secondary'}
        />
        <Button
          isLoading={rsvpMutation.isPending && answer === 'present'}
          onPress={() => handleAnswer('absent')}
          style={styles.footerCta}
          title={t('playerConvocation.actions.absent')}
          variant={answer === 'absent' ? 'Primary' : 'Secondary'}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
  },
  columnLabel: {
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  columns: {
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  field: {
    borderRadius: 16,
    height: FIELD_HEIGHT,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCta: {
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
  identityCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  identityTexts: {
    flex: 1,
  },
  // Meme idiome que les ecrans 4 et 5 du pack : `flex: 1` BORNE la zone qui
  // defile, sinon le contenu pousse la barre du bas hors de l'ecran (D84).
  list: {
    flex: 1,
  },
  loaderBox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  screen: {
    paddingHorizontal: 0,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 18,
  },
  token: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
  },
});

export default PlayerConvocationScreen;
