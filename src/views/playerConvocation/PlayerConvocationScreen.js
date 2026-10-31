/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { resolveEventDisplayName } from '@/domains/event/eventDisplayName';
import { isRsvpEnabled } from '@/domains/event/presenceRule';
import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Loader from '@/components/atoms/loader/Loader';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import Tag from '@/components/atoms/tag/Tag';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import PlayerHeadToken from '@/components/tactical/PlayerHeadToken';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent, useGetEventConvocation } from '@/services/event/eventQueries';
import { respondToEventRsvp } from '@/services/event/eventService';

import { getCompositionPlayerInitials } from '@/utils/compositionPlayer';
import { getAddressText } from '@/utils/facilityAddressLabel';
import { getImageUrl } from '@/utils/imageUrl';
import { getLocationCoordinates } from '@/utils/location';
import { getTacticalFieldAspectRatio } from '@/utils/tacticalField';
import texteInsecable from '@/utils/texteInsecable';

import {
  buildConvocationFieldTokens,
  buildPlayerConvocationView,
  buildPublishedBoardTarget,
  CONVOCATION_ROLE_STARTER,
  formatConvocationDay,
  formatConvocationTime,
  getConvocationPlayerResponse,
  getPlayerConvocationResponse,
  ligneDeRendezVous,
  lireRendezVous,
  resolveConvocationNote,
} from './playerConvocationUtils';
// `import/order` veut l'alias `@/` avant les freres `./`, `perfectionist/sort-imports`
// le veut apres : on suit perfectionist, comme `adminClubContentService.js`.
// eslint-disable-next-line import/order
import { openExternalMap } from '@/platform/maps/externalMap';

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
 * `locationDetails` — pas de `meetingTime`, mesure du 2026-08-15, remesure le
 * 2026-09-23).
 * 🔄 COMPOMSG (23/09) — la colonne affichait « Non précisé »… alors que la carte
 * du fil, pour le meme match, affichait « RDV 19h30 au stade de Pelisanne » :
 * c'est le TEXTE LIBRE de l'evenement, ou l'entraineur ecrit son rendez-vous.
 * La colonne RDV cede donc sa place a la DATE (l'ecran n'ecrivait que l'heure),
 * et ce texte s'affiche tel quel sous les colonnes (« Infos »). Toujours rien
 * d'invente : on montre ce que l'entraineur a ecrit, ou rien.
 * 🕐 CONVOC-RDV (08/10) — le serveur range desormais le rendez-vous dans la
 * convocation (`published.rendezVous`, choisi a l'etape 4 de l'assistant du fil) :
 * il s'affiche sous les colonnes, « RDV · 13:30 · Au club ». Sans lui, rien.
 *
 * 🔎 COMPOMSG — LE TERRAIN : les jetons portent la PHOTO (`PlayerHeadToken`, le
 * meme jeton que la carte du fil — la cause des photos absentes etait un dessin
 * a part, qui n'ecrivait que des initiales), et le terrain entier est un bouton
 * vers le plein ecran en lecture seule.
 */

/** Diametre du jeton du terrain, et celui — grossi — du jeton du lecteur. */
const TOKEN_SIZE = 24;
const TOKEN_SIZE_MINE = 30;

/** Hauteur du terrain de l'ecran 10, reprise du pack. */
const FIELD_HEIGHT = 300;

/** CONVOC — les trois reponses, dans l'ordre de la legende. */
const RESPONSE_KEYS = Object.freeze(['present', 'absent', 'pending']);

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

  // CONVOC (26/09) — LA REPONSE DOIT ETRE JUSTE DES L'OUVERTURE. La requete
  // porte `refetchOnMount: false` par defaut (eventQueries.js) : une convocation
  // deja lue etait RESSERVIE telle quelle, meme apres une reponse donnee depuis la
  // fiche ou une liste — react-query ne relit une requete invalidee qu'a son
  // prochain montage, et c'est ce montage qui refusait. `true` ne relit que la
  // copie perimee (30 s) ou invalidee par une reponse, pas a chaque ouverture.
  const convocationQuery = useGetEventConvocation(eventId, teamId, {
    enabled: Boolean(eventId),
    refetchOnMount: true,
  });
  const eventQuery = useGetEvent(eventId, { enabled: Boolean(eventId) });
  // POINTAGE (29/09) — « Les participants repondent » decochee : pas de barre de
  // reponse. ponytail: tant que l evenement n est pas relu, la barre s affiche
  // (charge de convocation sans l option) ; elle disparait a la relecture.
  const reponsesOuvertes = isRsvpEnabled(eventQuery.data);
  // CORR-EVENEMENTS 120 : un match annulé garde sa convocation lisible, sous un bandeau, et
  // Présent / Absent ne répondent plus (même lecture que la fiche : `status === 'cancelled'`).
  const estAnnule = eventQuery.data?.status === 'cancelled';

  const convocation = convocationQuery.data;
  const viewerId = String(userData?.documentId || userData?.id || '').trim();

  const view = useMemo(
    () => buildPlayerConvocationView({ convocation, userId: viewerId }),
    [convocation, viewerId],
  );

  // BH05 · P6-17 — `isSuccess` : un corps vide (null) est une reponse arrivee,
  // pas un chargement ; sans lui, le rond tournait sans fin.
  const isSettled = convocationQuery.isError
    || convocationQuery.isSuccess
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
  // CONVOC — « Tu as repondu Present », comme la fiche de l'evenement le dit
  // (`EventAnswerButtons`). Sans reponse, on n'affirme rien.
  const answerLabel = answer === 'present' || answer === 'absent'
    ? t(`playerConvocation.answer.${answer}`)
    : '';

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
    // CONVOC — la liste COMMUNE de ce qu'une reponse rend faux (T08) : la fiche,
    // les listes, le planning, l'accueil, et cette convocation. Les deux cles
    // ecrites ici a la main laissaient les autres ecrans sur l'ancienne reponse.
    onSuccess: () => {
      invalidateAfterAction(queryClient, 'answerEvent').catch(() => {});
    },
  });

  // AC08 — LE VOYANT SUR LE BON BOUTON. Il se lisait sur `answer`, qui est la
  // reponse DEJA enregistree : sans reponse anterieure, appuyer sur « Absent »
  // faisait tourner « Present ». Ce qui doit clignoter, c'est le geste en cours.
  const pendingAnswer = rsvpMutation.isPending ? rsvpMutation.variables : null;

  const handleAnswer = useCallback((/** @type {'present' | 'absent'} */ nextAnswer) => {
    if (!eventId || rsvpMutation.isPending || estAnnule) return;
    rsvpMutation.mutate(nextAnswer);
  }, [estAnnule, eventId, rsvpMutation]);

  const fieldTokens = useMemo(() => buildConvocationFieldTokens({
    placements: view?.placements,
    snapshotPlayers: view?.snapshotPlayers,
  }), [view?.placements, view?.snapshotPlayers]);

  // AC08 — ⛔ PLUS DE CUL-DE-SAC. L'ecran d'attente n'avait qu'un rond qui
  // tourne : quand la charge arrivait vide (aucune composition publiee, requete
  // en erreur, reseau coupe), la redirection ne partait jamais et le joueur
  // restait enferme, sans bouton, sans geste de retour. Le retour existe
  // desormais DES la premiere image.
  if (!view) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTexts}>
            {/* ⛔ JAMAIS « Tu es convoque » ici : tant qu'on ne sait pas, on ne
                le promet pas — et quand on sait que non, on le dit. */}
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
              {t('playerConvocation.empty.title')}
            </Text>
          </View>
        </View>
        <View style={styles.loaderBox}>
          {isSettled ? (
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {t('playerConvocation.empty.message')}
            </Text>
          ) : <Loader />}
        </View>
      </ScreenContainer>
    );
  }

  const event = eventQuery.data || convocation?.event || null;
  const day = formatConvocationDay(event?.date || convocation?.event?.date);
  const kickOff = formatConvocationTime(event?.startTime || convocation?.event?.date);
  // LIEU — `location` est l objet des coordonnees `{ lat, lng }` (event/schema.json,
  // type json) : `String()` le rendait « [object Object] ». L adresse lisible vit
  // dans `locationDetails` (chaine JSON `{"address":…}`). `getAddressText` descend
  // dans l objet et ne rend jamais que du texte, ou ''.
  const place = getAddressText(event?.locationDetails)
    || getAddressText(event?.location)
    || getAddressText(event?.facility?.name);
  // CONVOC (demande d'Adel du 26/09) — le lieu s'ouvre dans l'appli GPS choisie
  // (Plans, Google Maps, Waze), comme sur la fiche : la meme aide, le meme choix.
  // Les coordonnees sont lues comme la fiche les lit (`EventHeader`).
  const placeCoordinates = getLocationCoordinates(event?.location)
    || getLocationCoordinates(event?.locationDetails);
  const openPlace = () => {
    openExternalMap({
      label: place,
      latitude: placeCoordinates?.lat,
      longitude: placeCoordinates?.lng,
    });
  };

  // Y02 — LA CONVOCATION DIT ENFIN DE QUOI IL S'AGIT. Constat d'Adel du
  // 2026-08-19, point 8 : « il manque le nom du type d'evenement ». La carte
  // n'annoncait que l'equipe et l'heure — un joueur convoque ne savait pas s'il
  // etait attendu pour un match ou pour un entrainement.
  // Un match dont on connait l'adversaire s'annonce « Match vs X ».
  const eventDisplayName = resolveEventDisplayName(
    event || convocation?.event,
    '',
  );

  // COMPOMSG — l'heure quitte le sous-titre : elle est dans les colonnes, avec
  // la date qui manquait.
  const subtitle = [
    eventDisplayName || null,
    view.teamName,
  ].filter(Boolean).join(' · ');

  // COMPOMSG — le texte de l'entraineur (souvent le RDV), tel qu'il l'a ecrit.
  // Deja a l'ecran sous forme de nom du match ? On ne le repete pas.
  const note = resolveConvocationNote(event, [eventDisplayName]);
  // CONVOC-RDV — le rendez-vous de la convocation, la ou la carte du fil l'affiche aussi.
  const rendezVous = ligneDeRendezVous(lireRendezVous(view.published?.rendezVous));

  // COMPOMSG — le plein ecran recoit le pack de CET ecran, deja a jour : pas de
  // relecture a demander. `null` quand il n'y a rien a dessiner (garde D6).
  const fullScreenTarget = buildPublishedBoardTarget(view.published, {
    sport: view.sport,
    teamName: view.teamName,
  });
  const openFullScreen = () => {
    if (!fullScreenTarget) return;
    // @ts-ignore — les parametres de la pile Evenement ne sont pas types.
    navigation.navigate(RouteNames.MatchCompositionBoard, {
      ...fullScreenTarget,
      canEdit: false,
      eventId,
      eventLabel: eventDisplayName,
      readOnly: true,
      // URL-BOOLEENS (29/09) — sur le SITE, le pack (des objets) ne voyage pas
      // dans l'adresse : le plein ecran arrivait VIDE. Il y relit donc la compo ;
      // le telephone garde l'economie de COMPOMSG (aucune relecture).
      ...(Platform.OS === 'web' ? { refreshFromServer: true } : {}),
      teamId: view.teamId || teamId,
    });
  };
  const versionNumber = Number(view.published?.version) || 0;

  // CONVOC (demande d'Adel du 26/09) — QUI A REPONDU, sur la compo. Les couleurs
  // sont celles de l'ecran du coach (`MatchConvocationPublished`) : le pack
  // interdit d'inventer un vert ou un rouge. Sans reponses dans la charge
  // (ancienne forme), ni marque ni legende.
  const responseTone = (/** @type {string | null} */ response) => ({
    absent: Colors.error500,
    pending: Colors.neutral300,
    present: Colors.success500,
  })[String(response)] || Colors.neutral300;
  const hasResponses = Object.keys(view.responsesByPlayerId).length > 0;
  // CONVLISTE — en liste, ni titulaire ni remplacant : « Convoqué ».
  let roleLabel = t('playerConvocation.roles.substitute');
  if (view.isList) roleLabel = t('playerConvocation.roles.calledUp');
  else if (view.role === CONVOCATION_ROLE_STARTER) roleLabel = t('playerConvocation.roles.starter');

  const identityLine = [
    view.positionLabel
      ? t('playerConvocation.card.position', { position: view.positionLabel })
      : '',
    view.jerseyNumber ? t('playerConvocation.card.number', { number: view.jerseyNumber }) : '',
  ].filter(Boolean).join(' · ');

  const columns = [
    { key: 'day', value: day || t('playerConvocation.columns.notSpecified') },
    { key: 'kickOff', value: kickOff || t('playerConvocation.columns.notSpecified') },
    {
      key: 'place',
      onPress: place ? openPlace : undefined,
      value: place || t('playerConvocation.columns.notSpecified'),
    },
  ];

  const renderColumnTexts = (/** @type {{ key: string, value: string }} */ column) => (
    <>
      <Text style={[Fonts.p4Bold, styles.columnLabel, { color: Colors.neutral300 }]}>
        {t(`playerConvocation.columns.${column.key}`).toUpperCase()}
      </Text>
      <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{column.value}</Text>
    </>
  );

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
            {roleLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        {estAnnule ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.cancelledBanner,
              {
                backgroundColor: withAlpha(Colors.error500, 0.12),
                borderColor: withAlpha(Colors.error500, 0.4),
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {t('playerConvocation.cancelled.title', 'Match annulé')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              {t(
                'playerConvocation.cancelled.text',
                'L’organisateur a annulé ce match : il n’y a plus rien à répondre.',
              )}
            </Text>
          </View>
        ) : null}
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
                  {t('playerConvocation.card.calledUpBy', {
                    name: view.publishedByName, ...SANS_ECHAPPEMENT,
                  })}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.columns, { borderTopColor: withAlpha(Colors.neutral00, 0.1) }]}>
            {columns.map((column) => (column.onPress ? (
              <TouchableOpacity
                accessibilityLabel={`${t('common.openInGps')} : ${column.value}`}
                accessibilityRole="button"
                key={column.key}
                onPress={column.onPress}
                style={styles.column}
              >
                {renderColumnTexts(column)}
                <Text style={[Fonts.p4, { color: Colors.primary100 }]}>
                  {t('common.openInGps')}
                </Text>
              </TouchableOpacity>
            ) : (
              <View key={column.key} style={styles.column}>{renderColumnTexts(column)}</View>
            )))}
          </View>

          {rendezVous ? (
            <View
              style={[styles.note, { borderTopColor: withAlpha(Colors.neutral00, 0.1) }]}
              testID="convocation-rendez-vous"
            >
              <Text style={[Fonts.p4Bold, styles.columnLabel, { color: Colors.neutral300 }]}>
                {t('playerConvocation.columns.meeting').toUpperCase()}
              </Text>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{rendezVous}</Text>
            </View>
          ) : null}

          {/* COMPOMSG — le texte de l'entraineur, la ou la carte du fil l'affiche
              aussi. Sans texte, aucune ligne vide. */}
          {note ? (
            <View style={[styles.note, { borderTopColor: withAlpha(Colors.neutral00, 0.1) }]}>
              <Text style={[Fonts.p4Bold, styles.columnLabel, { color: Colors.neutral300 }]}>
                {t('playerConvocation.note.title').toUpperCase()}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>{note}</Text>
            </View>
          ) : null}
        </View>

        {/* CONVLISTE — une convocation en liste n'a pas de terrain (planche B6). */}
        {view.isList ? null : (
          <>
            <View style={styles.sectionRow}>
              <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
                {t('playerConvocation.compositionTitle').toUpperCase()}
              </Text>
              {/* COMPOMSG — une compo modifiee le dit, avec le meme mot que la carte
                  du fil ; la premiere publication n'affiche rien de technique. */}
              {versionNumber > 1 ? (
                <View
                  style={[styles.versionChip, { borderColor: withAlpha(Colors.primary500, 0.45) }]}
                >
                  {/* FINITIONS (recette Android 16 du 28/09) — « Version » sans son
                      numéro : une pastille épouse son texte, et un texte gras de
                      plusieurs mots y perdait son dernier mot. Espaces insécables. */}
                  <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
                    {texteInsecable(t('playerConvocation.version', { version: versionNumber }))}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* 🔎 COMPOMSG — TOUCHER LE TERRAIN OUVRE LE PLEIN ECRAN, en lecture
                seule, avec les photos et les prenoms. La pastille « Agrandir » le
                dit. */}
            <TouchableOpacity
              accessibilityLabel={t('playerConvocation.field.openFullScreen')}
              accessibilityRole="button"
              activeOpacity={0.85}
              disabled={!fullScreenTarget}
              onPress={openFullScreen}
              style={styles.fieldTouch}
            >
              <RenderedTacticalField
                sport={view.sport}
                style={[styles.field, { aspectRatio: 1 / getTacticalFieldAspectRatio(view.sport) }]}
              >
                {fieldTokens.map((/** @type {any} */ { placement, player }) => {
                  const isMine = String(placement?.playerId || '') === view.playerId;
                  const size = isMine ? TOKEN_SIZE_MINE : TOKEN_SIZE;
                  const response = getConvocationPlayerResponse(view, placement?.playerId);
                  return (
                    <View
                      key={placement.playerId}
                      style={[
                        styles.token,
                        {
                          left: `${placement.positionX}%`,
                          marginLeft: -(size / 2),
                          marginTop: -(size / 2),
                          top: `${placement.positionY}%`,
                        },
                      ]}
                    >
                      <PlayerHeadToken isHighlighted={isMine} player={player} size={size} />
                      {response ? (
                        <View
                          accessibilityLabel={t(`playerConvocation.responses.${response}`)}
                          style={[
                            styles.responseDot,
                            {
                              backgroundColor: responseTone(response),
                              borderColor: Colors.neutral900,
                            },
                          ]}
                          testID={`reponse-${placement.playerId}`}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </RenderedTacticalField>
              {fullScreenTarget ? (
                <View
                  style={[
                    styles.expandPill,
                    { backgroundColor: withAlpha(Colors.neutral900, 0.72) },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                    {t('playerConvocation.field.expand')}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </>
        )}

        {hasResponses ? (
          <View style={styles.legend}>
            {RESPONSE_KEYS.map((response) => (
              <View key={response} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: responseTone(response) }]} />
                <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                  {t(`playerConvocation.responses.${response}`)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* AC08 — LE BANC. Mesure du 2026-08-21 : `reservePlayerIds` et
            `reserveSnapshotPlayers` voyagent dans la charge depuis toujours, et
            AUCUN ecran ne les montrait — un remplacant n'avait nulle part ou se
            voir. Aucune donnee neuve : seulement celle qui dormait. */}
        {view.reservePlayers.length ? (
          <>
            <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
              {t(view.isList
                ? 'playerConvocation.reserve.titleList'
                : 'playerConvocation.reserve.title').toUpperCase()}
            </Text>
            <View style={styles.reserveList}>
              {view.reservePlayers.map((/** @type {any} */ { id, player }) => {
                const isMine = id === view.playerId;
                const reserveResponse = getConvocationPlayerResponse(view, id);
                const reserveTone = responseTone(reserveResponse);
                return (
                  <View
                    key={id}
                    style={[
                      styles.reserveRow,
                      {
                        backgroundColor: withAlpha(Colors.primary500, isMine ? 0.16 : 0.06),
                        borderColor: withAlpha(Colors.primary500, isMine ? 0.45 : 0.16),
                      },
                    ]}
                  >
                    <ProfileAvatar
                      enablePreview={false}
                      imageUrl={getImageUrl(player?.avatar?.url || player?.avatar)}
                      name={[player?.firstname, player?.lastname].filter(Boolean).join(' ')}
                      size={32}
                    />
                    {/* MARQUEE — le nom du remplaçant se lit en entier. */}
                    <MarqueeText
                      containerStyle={styles.reserveName}
                      style={[Fonts.p3Bold, { color: Colors.neutral00 }]}
                      text={[player?.firstname, player?.lastname].filter(Boolean).join(' ')
                        || getCompositionPlayerInitials(player)}
                    />
                    {player?.number === 0 || player?.number ? (
                      <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                        {t('playerConvocation.card.number', { number: String(player.number) })}
                      </Text>
                    ) : null}
                    {reserveResponse ? (
                      <View
                        style={[
                          styles.responsePill,
                          {
                            backgroundColor: withAlpha(reserveTone, 0.14),
                            borderColor: withAlpha(reserveTone, 0.45),
                          },
                        ]}
                        testID={`reponse-banc-${id}`}
                      >
                        {/* FINITIONS — même pastille, même parade : « Sans réponse ». */}
                        <Text style={[Fonts.p4Bold, { color: reserveTone }]}>
                          {texteInsecable(t(`playerConvocation.responses.${reserveResponse}`))}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* COACH1 (decision d'Adel du 21/09) — L'ENCADREMENT. Les entraineurs
            qui ont repondu Present au match : une partie a part, jamais sur le
            terrain ni sur le banc. Le serveur les envoie (`branch.staff`) ;
            sans personne, pas de titre vide. */}
        {view.staff.length ? (
          <>
            <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
              {t('playerConvocation.staff.title').toUpperCase()}
            </Text>
            <View style={styles.reserveList}>
              {view.staff.map((/** @type {any} */ { id, person }) => (
                <View
                  key={id}
                  style={[
                    styles.reserveRow,
                    {
                      backgroundColor: withAlpha(Colors.primary500, 0.06),
                      borderColor: withAlpha(Colors.primary500, 0.16),
                    },
                  ]}
                >
                  <ProfileAvatar
                    enablePreview={false}
                    imageUrl={getImageUrl(person?.avatar?.url || person?.avatar)}
                    name={[person?.firstname, person?.lastname].filter(Boolean).join(' ')}
                    size={32}
                  />
                  <MarqueeText
                    containerStyle={styles.reserveName}
                    style={[Fonts.p3Bold, { color: Colors.neutral00 }]}
                    text={[person?.firstname, person?.lastname].filter(Boolean).join(' ')}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Barre presence / absence. Elle porte la reponse DEJA donnee — le serveur
          la calcule (`responses.byPlayerId`), l'app ne la recalcule pas. */}
      {reponsesOuvertes ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {answerLabel ? <Tag text={answerLabel} textStyle={Fonts.p1Bold} /> : null}
          <View style={styles.footerRow}>
            <Button
              disabled={estAnnule}
              isLoading={pendingAnswer === 'present'}
              onPress={() => handleAnswer('present')}
              style={styles.footerCta}
              title={t('playerConvocation.actions.present')}
              variant={answer === 'present' ? 'Primary' : 'Secondary'}
            />
            <Button
              disabled={estAnnule}
              isLoading={pendingAnswer === 'absent'}
              onPress={() => handleAnswer('absent')}
              style={styles.footerCta}
              title={t('playerConvocation.actions.absent')}
              variant={answer === 'absent' ? 'Primary' : 'Secondary'}
            />
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cancelledBanner: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    marginBottom: 12,
    padding: 14,
  },
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
  expandPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  field: {
    borderRadius: 16,
    height: FIELD_HEIGHT,
  },
  // Le bouton epouse le terrain (sinon la pastille « Agrandir » irait se poser
  // au bord de l'ecran), et le terrain se centre, comme sur la maquette.
  fieldTouch: {
    alignSelf: 'center',
  },
  footer: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCta: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
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
  note: {
    borderTopWidth: 1,
    gap: 2,
    marginTop: 16,
    paddingTop: 16,
  },
  reserveList: {
    gap: 8,
  },
  reserveName: {
    flex: 1,
  },
  reserveRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // CONVOC — la marque de reponse, posee dans le coin du jeton (qui la porte).
  responseDot: {
    borderRadius: 5,
    borderWidth: 1,
    bottom: -2,
    height: 10,
    position: 'absolute',
    right: -2,
    width: 10,
  },
  responsePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 18,
  },
  token: {
    position: 'absolute',
  },
  versionChip: {
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});

export default PlayerConvocationScreen;
