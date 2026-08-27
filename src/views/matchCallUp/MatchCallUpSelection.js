/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Tag from '@/components/atoms/tag/Tag';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent } from '@/services/event/eventQueries';
import { useGetTeams } from '@/services/team/teamQueries';

import {
  getCompositionPlayerId,
  getCompositionPlayerLabel,
} from '@/utils/compositionPlayer';

import {
  buildRsvpAnswersByPlayerId,
  getCallUpCounters,
  getPlayerUnavailability,
  hasSilentCallUp,
  isManualCallUpPlayer,
} from './matchCallUpUtils';
import { resumeFieldForSelection } from './matchCompositionUtils';

/**
 * D77 — ECRANS 1 et 2 du pack composition : « Selection des convoques » et
 * « Convoquer hors equipe ».
 *
 * Le pack dit « meme ecran » pour les deux : c'est donc UN seul ecran, avec
 * 3 onglets. L'onglet 1 est l'ecran 1 (recherche + effectif), l'onglet 2 les
 * renforts du club, l'onglet 3 les joueurs hors app.
 *
 * ⛔ Rien de neuf ne circule : la selection sort d'ici sous la forme
 * `selectedPlayers`, exactement celle que `TacticalSelection` produit deja et
 * que le board (`TacticalBoardV2`) sait lire.
 */

const TAB_SQUAD = 'squad';
const TAB_OTHERS = 'others';
const TAB_OFF_APP = 'offApp';

/** @type {any[]} */
const EMPTY_LIST = [];

/**
 * AC09 — comment chacun des 4 etats se montre.
 *
 * 🚨 `sign` N'EST PAS UNE DECORATION. La couleur seule laisserait un daltonien
 * (8 % des hommes) convoquer un absent sans le voir : chaque etat porte donc un
 * MOT (le libelle traduit) ET un signe qui n'appartient qu'a lui. L'etat reste
 * lisible en niveaux de gris, et meme sans lire le mot.
 * @type {Readonly<Record<string, {
 *   color: import('@/theme/types').ColorNames, sign: string,
 * }>>}
 */
const RSVP_BADGES = Object.freeze({
  absent: { color: 'error500', sign: '\u2715' },
  none: { color: 'neutral400', sign: '\u2013' },
  pending: { color: 'warning500', sign: '\u2026' },
  present: { color: 'success500', sign: '\u2713' },
});

const capitalizeFirst = (/** @type {any} */ value) => {
  const text = String(value || '');
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
};

const formatEventMoment = (/** @type {any} */ rawDate) => {
  if (!rawDate) return '';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return capitalizeFirst(format(parsed, "EEE. HH'h'mm"));
};

const normalizePlayer = (/** @type {any} */ player, /** @type {any} */ extra = {}) => {
  const documentId = String(player?.documentId || player?.id || '').trim();
  if (!documentId) return null;
  return {
    avatar: player?.avatar || null,
    documentId,
    firstname: player?.firstname || '',
    id: documentId,
    lastname: player?.lastname || '',
    number: player?.number,
    position: player?.position || player?.appliedPosition || '',
    suspensionMatches: player?.suspensionMatches,
    unavailabilityReason: player?.unavailabilityReason,
    ...extra,
  };
};

function MatchCallUpSelection() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // Fige : `route.params || {}` fabriquerait un objet neuf a chaque rendu, et
  // les rappels qui le transmettent (ecran 3, terrain) changeraient avec lui.
  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    clubId: clubIdParam,
    eventId,
    eventTypeLabel = null,
    existingComposition = null,
    pendingManualPlayer = null,
    players: playersParam = EMPTY_LIST,
    selectedPlayers: convoquesRecus = null,
    sport = 'football',
    teamId,
    teamName = '',
  } = params;

  // AC09 — 🚨 CETTE REQUETE N'EST PLUS CONDITIONNELLE, ET C'EST TOUT LE LOT.
  //
  // Elle ne partait qu'a defaut : quand l'appelant ne passait ni `players` ni
  // `clubId`. Or l'appelant reel (`EventDetails.js:3402`) passe TOUJOURS les
  // deux — l'ecran n'avait donc, dans le vrai parcours, QUE la liste des
  // joueurs. Aucune reponse. On convoquait a l'aveugle faute d'avoir demande.
  //
  // 🧩 La donnee existait deja : `getEventById` peuple `missings`,
  // `participations` et `participationRequests.user` (`eventService.js:307-310`).
  // ⛔ AUCUNE correction serveur n'etait necessaire.
  //
  // 💸 Et ca ne coute pas un appel de plus : la fiche de l'evenement d'ou l'on
  // arrive interroge la MEME clef react-query (`['event', eventId]`,
  // `eventQueries.js:43`) avec 30 s de fraicheur. Le cache repond.
  const { data: eventFromApi } = useGetEvent(eventId || '', {
    enabled: Boolean(eventId),
  });

  const clubId = clubIdParam || eventFromApi?.team?.club?.documentId || '';

  // Les renforts : les AUTRES equipes du club, avec leurs joueurs. C'est la
  // seule requete neuve de l'ecran, et elle ne part que si le club est connu.
  const { data: clubTeamsPages } = useGetTeams(
    { clubId, pageSize: 50 },
    { enabled: Boolean(clubId) },
  );

  const [selectedIds, setSelectedIds] = useState(() => /** @type {Set<string>} */ (new Set()));
  const [manualPlayers, setManualPlayers] = useState(/** @type {any[]} */ (EMPTY_LIST));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(TAB_SQUAD);
  const [bootstrapped, setBootstrapped] = useState(false);
  // AC09 — les absents coches en attente de confirmation. `null` = fenetre
  // fermee. On garde les JOUEURS, pas un booleen : la fenetre les nomme.
  const [absentsToConfirm, setAbsentsToConfirm] = useState(/** @type {any[] | null} */ (null));

  const squadPlayers = useMemo(() => {
    /** @type {any[]} */
    const source = Array.isArray(playersParam) && playersParam.length > 0
      ? playersParam
      : (eventFromApi?.team?.players || EMPTY_LIST);
    return source.map((player) => normalizePlayer(player)).filter(Boolean);
  }, [eventFromApi?.team?.players, playersParam]);

  const reinforcementPlayers = useMemo(() => {
    /** @type {any[]} */
    const teams = (clubTeamsPages?.pages || EMPTY_LIST)
      .flatMap((/** @type {any} */ page) => page?.data || EMPTY_LIST);
    const squadIds = new Set(squadPlayers.map(getCompositionPlayerId));

    return teams
      .filter((team) => String(team?.documentId || '') !== String(teamId || ''))
      .flatMap((team) => (team?.players || EMPTY_LIST)
        .map((/** @type {any} */ player) => normalizePlayer(player, {
          fromTeamName: team?.name || '',
        })))
      .filter(Boolean)
      .filter((player) => !squadIds.has(getCompositionPlayerId(player)));
  }, [clubTeamsPages?.pages, squadPlayers, teamId]);

  // AC09 — LA REPONSE DE CHACUN, calculee UNE fois pour toute la liste.
  // ⛔ Aucune echelle neuve : `buildRsvpAnswersByPlayerId` ne fait qu'appeler
  // `getCurrentUserEventParticipationState` puis `resolveRsvpAnswer`, les deux
  // memes briques que les boutons de reponse et le bandeau de l'accueil.
  const rsvpAnswers = useMemo(
    () => buildRsvpAnswersByPlayerId({
      event: eventFromApi,
      players: [...squadPlayers, ...reinforcementPlayers],
    }),
    [eventFromApi, reinforcementPlayers, squadPlayers],
  );

  // Pre-cochage depuis la composition existante : meme lecture que
  // `TacticalSelection` (placements + selectedPlayerIds + reservePlayerIds),
  // pour qu'ouvrir l'un ou l'autre montre la meme selection.
  //
  // 🧨 COMPOMODIF (M4) — ET SURTOUT : QUELLE SOURCE DIT LA VERITE.
  //
  // 🗣️ Adel, 27/08 : « quand on ajoute des joueurs de la liste, ca efface de la
  // liste les anciens ». Mesure : le 1er tour etait bon, le 2e perdait tout.
  //
  // `existingComposition` est le pack PUBLIE — il ne bouge plus. La porte
  // « Modifier » du plateau renvoie ici ce MEME pack fige a chaque tour, et cet
  // ecran se remonte a neuf a chaque fois (`navigate` depile, il ne garde pas
  // l'ecran). Amorcer depuis le pack, c'est donc RECOMMENCER a la compo
  // d'origine : le joueur ajoute au tour precedent disparait, et celui qu'on
  // venait de retirer revient tout seul.
  //
  // ♻️ La verite du moment voyageait DEJA : `selectedPlayers`, la liste que
  // l'ecran du terrain renvoie a chaque aller-retour (`:318`). Rien de neuf
  // n'est cree — on lit un parametre qui etait transmis et jamais relu.
  useEffect(() => {
    if (bootstrapped) return;
    const convoquesDuMoment = Array.isArray(convoquesRecus) ? convoquesRecus : null;
    if (!convoquesDuMoment && (!existingComposition || typeof existingComposition !== 'object')) {
      return;
    }

    /** @type {any[]} */
    const placements = existingComposition?.placements
      || (existingComposition?.teams || EMPTY_LIST)
        .flatMap((/** @type {any} */ team) => team?.placements || EMPTY_LIST);
    /** @type {any[]} */
    const selected = existingComposition?.selectedPlayerIds || EMPTY_LIST;
    /** @type {any[]} */
    const reserve = existingComposition?.reservePlayerIds || EMPTY_LIST;
    const knownIds = convoquesDuMoment
      ? convoquesDuMoment.map(getCompositionPlayerId).filter(Boolean)
      : [
        ...placements.map((placement) => String(placement?.playerId || '').trim()),
        ...selected.map((value) => String(value || '').trim()),
        ...reserve.map((value) => String(value || '').trim()),
      ].filter(Boolean);

    // ⚠️ LES JOUEURS HORS APP SE PERDENT EN PREMIER : aucun effectif ne les
    // porte, ils n'existent que dans le pack et dans la liste des convoques. On
    // reunit les deux sources, sans doublon, plutot que d'en choisir une.
    /** @type {any[]} */
    const horsApp = [];
    /** @type {Set<string>} */
    const horsAppVus = new Set();
    [
      ...(existingComposition?.manualPlayers || EMPTY_LIST),
      ...(convoquesDuMoment || EMPTY_LIST).filter(isManualCallUpPlayer),
    ].forEach((/** @type {any} */ player) => {
      const playerId = getCompositionPlayerId(player);
      if (!playerId || horsAppVus.has(playerId)) return;
      horsAppVus.add(playerId);
      horsApp.push(player);
    });

    setSelectedIds(new Set(knownIds));
    setManualPlayers(horsApp.length > 0 ? horsApp : EMPTY_LIST);
    setBootstrapped(true);
  }, [bootstrapped, convoquesRecus, existingComposition]);

  // Retour de l'ecran 3 : le joueur hors app arrive par les parametres, on le
  // range puis on efface le parametre pour qu'un re-rendu ne l'ajoute pas deux fois.
  //
  // 🧨 Le registre `consumedManualIds` n'est pas une precaution de style : sans
  // lui, un objet `navigation` recree a chaque rendu relance cet effet en
  // boucle, et `new Set(...)` fabrique un etat neuf a chaque tour — React
  // s'arrete alors sur « Maximum update depth exceeded ».
  const consumedManualIds = useRef(/** @type {Set<string>} */ (new Set()));
  useEffect(() => {
    if (!pendingManualPlayer) return;
    const manualId = getCompositionPlayerId(pendingManualPlayer);
    if (!manualId || consumedManualIds.current.has(manualId)) return;
    consumedManualIds.current.add(manualId);

    setManualPlayers((current) => (current.some(
      (/** @type {any} */ player) => getCompositionPlayerId(player) === manualId,
    )
      ? current
      : [...current, pendingManualPlayer]));
    setSelectedIds((current) => new Set([manualId, ...current]));
    setActiveTab(TAB_OFF_APP);
    // @ts-ignore — `setParams` est bien la sur un ecran de pile.
    navigation.setParams({ pendingManualPlayer: undefined });
  }, [navigation, pendingManualPlayer]);

  const toggleSelection = useCallback((/** @type {string} */ playerId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, []);

  const counters = useMemo(
    () => getCallUpCounters({
      manualPlayers, reinforcementPlayers, selectedIds, sport,
    }),
    [manualPlayers, reinforcementPlayers, selectedIds, sport],
  );

  const openManualPlayerScreen = useCallback(() => {
    // @ts-ignore
    navigation.navigate(RouteNames.MatchCallUpManualPlayer, {
      returnParams: params,
      teamName,
    });
  }, [navigation, params, teamName]);

  // 🧨 COMPOMODIF (M4) — LA 4e SOURCE, ET C'EST ELLE QUI EMPECHE LA PERTE.
  //
  // Un convoque coche doit ressortir d'ici, sinon il est efface EN SILENCE.
  // Trois listes seulement ne suffisent pas : un joueur hors app n'appartient a
  // aucun effectif, et un renfort disparait tant que la requete des equipes du
  // club n'est pas revenue. Les personnes qu'on nous a REMISES bouchent ce trou.
  //
  // ⚠️ Elles arrivent EN DERNIER et on ne garde que la premiere occurrence de
  // chaque identifiant : l'ordre des listes connues — donc le terrain et le banc
  // qui en decoulent — ne bouge pas d'un pouce.
  const selectedPlayers = useMemo(() => {
    /** @type {Map<string, any>} */
    const parIdentifiant = new Map();
    [
      ...squadPlayers,
      ...reinforcementPlayers,
      ...manualPlayers,
      ...(Array.isArray(convoquesRecus) ? convoquesRecus : EMPTY_LIST),
    ].forEach((/** @type {any} */ player) => {
      const playerId = getCompositionPlayerId(player);
      if (!playerId || parIdentifiant.has(playerId)) return;
      parIdentifiant.set(playerId, player);
    });

    return [...parIdentifiant.values()]
      .filter((player) => selectedIds.has(getCompositionPlayerId(player)));
  }, [convoquesRecus, manualPlayers, reinforcementPlayers, selectedIds, squadPlayers]);

  const goToComposition = useCallback(() => {
    setAbsentsToConfirm(null);

    // S04 — 🎯 UNE COMPO DEJA PLACEE NE REPASSE PAS PAR « Partir de… ».
    // Redemander « d'ou veux-tu partir ? » a quelqu'un qui a deja pose ses
    // 11 jetons, c'est exactement ce qui les effaçait : l'ecran 4 repartait
    // d'une rangee (terrain vide ou compo type) et ecrasait le travail a la
    // main. On rouvre donc le terrain tel qu'il etait, moins les decoches.
    const { placements, shouldResume } = resumeFieldForSelection({
      existingComposition,
      players: selectedPlayers,
      startPlacements: params.startPlacements ?? null,
    });

    // D79 — sans rien de place, « Suivant » mene bien a l'ecran 4
    // (« Partir de… »), qui ouvre ensuite le terrain de l'ecran 5. L'ancien
    // board (`TacticalBoardV2`) reste debout et joignable par son propre
    // chemin : le pack ne le supprime qu'une fois ses 17 ecrans livres.
    // @ts-ignore
    navigation.navigate(
      shouldResume ? RouteNames.MatchCompositionBoard : RouteNames.MatchCompositionStart,
      {
        ...params,
        pendingManualPlayer: undefined,
        selectedPlayers,
        ...(shouldResume ? { startPlacements: placements } : {}),
      },
    );
  }, [existingComposition, navigation, params, selectedPlayers]);

  // AC09 — LA FENETRE DE PREVENTION, ET LE MOMENT OU ELLE S'OUVRE.
  //
  // 🎯 UNE SEULE FOIS, A LA VALIDATION — pas a chaque case cochee. Un coach qui
  // compose avec 3 absents fermerait 3 fenetres pendant qu'il reflechit : au 3e
  // clic il ne lit plus, il ferme. Une fenetre qu'on ferme sans lire ne previent
  // personne. Ici elle arrive une fois, au dernier moment utile, et elle nomme
  // exactement qui pose probleme.
  //
  // 🔒 ELLE PREVIENT, ELLE N'INTERDIT PAS : « Convoquer quand meme » part avec
  // la selection INTACTE, absents compris. C'est la demande d'Adel, mot pour
  // mot — « en laissant la possibilite de convoquer les absents ».
  const handleNext = useCallback(() => {
    if (selectedIds.size === 0) {
      Alert.alert(
        t('matchCallUp.selection.alerts.noneSelected.title'),
        t('matchCallUp.selection.alerts.noneSelected.message'),
      );
      return;
    }

    const absents = selectedPlayers.filter(
      (player) => rsvpAnswers.get(getCompositionPlayerId(player)) === 'absent',
    );
    if (absents.length > 0) {
      setAbsentsToConfirm(absents);
      return;
    }

    goToComposition();
  }, [goToComposition, rsvpAnswers, selectedIds.size, selectedPlayers, t]);

  const absentNames = useMemo(
    () => (absentsToConfirm || EMPTY_LIST).map(getCompositionPlayerLabel).join(', '),
    [absentsToConfirm],
  );

  const subtitle = useMemo(() => [
    eventTypeLabel || t('matchCallUp.selection.defaultEventType'),
    teamName,
    formatEventMoment(eventFromApi?.date),
  ].filter(Boolean).join(' · '), [eventFromApi?.date, eventTypeLabel, t, teamName]);

  const filterBySearch = useCallback((/** @type {any[]} */ players) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) => getCompositionPlayerLabel(player)
      .toLowerCase()
      .includes(query)
      || String(player?.number || '').includes(query));
  }, [searchQuery]);

  const renderMeta = (/** @type {any} */ player) => {
    const unavailability = getPlayerUnavailability(player);
    if (unavailability) {
      // 🟡 On AVERTIT, on ne bloque pas : le motif remplace la meta, en jaune,
      // et la case a cocher reste active juste a cote.
      return (
        <Text style={[Fonts.p3, styles.metaText, { color: Colors.warning500 }]}>
          {t(`matchCallUp.selection.unavailability.${unavailability.reason}`, {
            count: unavailability.count,
          })}
        </Text>
      );
    }

    if (hasSilentCallUp(player)) {
      return (
        <Text style={[Fonts.p3, styles.metaText, { color: Colors.warning500 }]}>
          {t('matchCallUp.selection.noSms')}
        </Text>
      );
    }

    const number = player?.number;
    const position = player?.position;
    const metaLabel = (() => {
      if (number && position) {
        return t('matchCallUp.selection.meta.numberAndPosition', { number, position });
      }
      if (number) return t('matchCallUp.selection.meta.number', { number });
      return position || '';
    })();

    if (!metaLabel) return null;
    return (
      <Text style={[Fonts.p3, styles.metaText, { color: Colors.neutral300 }]}>{metaLabel}</Text>
    );
  };

  // AC09 — l'etiquette d'etat de la rangee. `null` dans deux cas, et les deux
  // sont des refus de dire du faux :
  //   · joueur HORS APP — il ne peut pas repondre, son etiquette
  //     « Previens-le toi-meme » dit deja tout ;
  //   · charge d'evenement pas encore la — la table est vide, on n'affiche rien
  //     plutot que d'annoncer « sans reponse » a tout le monde.
  const renderRsvpBadge = (/** @type {any} */ player) => {
    const answer = rsvpAnswers.get(getCompositionPlayerId(player));
    const badge = answer ? RSVP_BADGES[answer] : null;
    if (!badge) return null;

    const tone = Colors[badge.color];
    return (
      <View
        style={[
          styles.rsvpBadge,
          { backgroundColor: withAlpha(tone, 0.12), borderColor: withAlpha(tone, 0.45) },
        ]}
      >
        <Text numberOfLines={1} style={[Fonts.p4, { color: tone }]}>
          {`${badge.sign} ${t(`matchCallUp.selection.rsvp.${answer}`)}`}
        </Text>
      </View>
    );
  };

  const renderPlayerRow = (/** @type {any} */ player) => {
    const playerId = getCompositionPlayerId(player);
    const isSelected = selectedIds.has(playerId);
    const label = getCompositionPlayerLabel(player);
    const unavailability = getPlayerUnavailability(player);
    const rawAvatar = typeof player?.avatar === 'string' ? player.avatar : player?.avatar?.url;

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        activeOpacity={0.8}
        key={playerId}
        onPress={() => toggleSelection(playerId)}
        style={[
          styles.playerRow,
          {
            backgroundColor: isSelected
              ? withAlpha(Colors.primary500, 0.1)
              : withAlpha(Colors.neutral00, 0.035),
            borderColor: isSelected
              ? withAlpha(Colors.primary500, 0.45)
              : withAlpha(Colors.neutral00, 0.09),
            opacity: unavailability ? 0.62 : 1,
          },
        ]}
      >
        <ProfileAvatar
          enablePreview={false}
          imageUrl={isManualCallUpPlayer(player) ? null : rawAvatar}
          name={label}
          size={34}
        />
        <View style={styles.playerTexts}>
          <View style={styles.playerNameRow}>
            <Text
              numberOfLines={1}
              style={[Fonts.p2Bold, styles.playerName, { color: Colors.neutral00 }]}
            >
              {label}
            </Text>
            {isManualCallUpPlayer(player) ? (
              <Tag text={t('matchCallUp.selection.offAppTag')} />
            ) : null}
            {player?.fromTeamName ? <Tag text={player.fromTeamName} /> : null}
            {renderRsvpBadge(player)}
          </View>
          {renderMeta(player)}
        </View>
        <Checkbox
          disabled={false}
          onValueChange={() => toggleSelection(playerId)}
          value={isSelected}
        />
      </TouchableOpacity>
    );
  };

  const renderSectionTitle = (/** @type {string} */ label) => (
    <Text style={[Fonts.p4, styles.sectionTitle, { color: Colors.neutral300 }]}>
      {label.toUpperCase()}
    </Text>
  );

  const renderEmpty = (/** @type {string} */ label) => (
    <Text style={[Fonts.p3, styles.emptyText, { color: Colors.neutral300 }]}>{label}</Text>
  );

  const renderAddPlayerRow = () => (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={openManualPlayerScreen}
      style={[
        styles.addRow,
        {
          backgroundColor: withAlpha(Colors.primary500, 0.07),
          borderColor: Colors.primary500,
        },
      ]}
    >
      <View style={[styles.addBadge, { backgroundColor: Colors.primary500 }]}>
        <Text style={[Fonts.p1Bold, { color: Colors.primary900 }]}>+</Text>
      </View>
      <View style={styles.playerTexts}>
        <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
          {t('matchCallUp.selection.addPlayer.title')}
        </Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          {t('matchCallUp.selection.addPlayer.subtitle')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const squadTabLabel = teamName || t('matchCallUp.selection.tabs.squad');
  const tabs = [
    { key: TAB_SQUAD, label: squadTabLabel },
    { key: TAB_OTHERS, label: t('matchCallUp.selection.tabs.others') },
    { key: TAB_OFF_APP, label: t('matchCallUp.selection.tabs.offApp') },
  ];

  const visibleSquad = filterBySearch(squadPlayers);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('matchCallUp.selection.title')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>{subtitle}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.countPill, { backgroundColor: Colors.primary500 }]}>
            <Text style={[Fonts.p3Bold, { color: Colors.primary900 }]}>{counters.calledUp}</Text>
          </View>
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
            {t('matchCallUp.selection.progress', { current: 1, total: 2 })}
          </Text>
        </View>
      </View>

      {/* Barre de progression 1/2 : convoquer, puis placer. Le 2e segment
          s'allumera quand le lot suivant livrera l'ecran « Partir de… ». */}
      <View
        accessibilityLabel={t('matchCallUp.selection.progress', { current: 1, total: 2 })}
        accessibilityRole="progressbar"
        style={styles.progressRow}
      >
        <View style={[styles.progressSegment, { backgroundColor: Colors.primary500 }]} />
        <View
          style={[styles.progressSegment, { backgroundColor: withAlpha(Colors.neutral00, 0.12) }]}
        />
      </View>

      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              activeOpacity={0.8}
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabButton,
                {
                  backgroundColor: isActive ? Colors.primary500 : Colors.transparent,
                  borderColor: isActive ? Colors.primary500 : withAlpha(Colors.neutral00, 0.2),
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[Fonts.p3Bold, { color: isActive ? Colors.primary900 : Colors.neutral300 }]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === TAB_SQUAD ? (
        <View style={styles.searchWrapper}>
          <TextInput
            accessibilityLabel={t('matchCallUp.selection.search')}
            onChangeText={setSearchQuery}
            placeholder={t('matchCallUp.selection.search')}
            placeholderTextColor={Colors.neutral400}
            style={[
              styles.searchInput,
              Fonts.p2,
              {
                backgroundColor: withAlpha(Colors.neutral00, 0.06),
                borderColor: withAlpha(Colors.neutral00, 0.1),
                color: Colors.neutral00,
              },
            ]}
            value={searchQuery}
          />
        </View>
      ) : null}

      {/* D84 — `styles.list` (flex: 1) BORNE la zone qui defile. Sans lui, React
          Native mesure un ScrollView a la hauteur de ses enfants (son
          `flexShrink` vaut 0 par defaut) : la liste poussait la barre du bas
          hors de l'ecran des 6 joueurs, et le CTA « Suivant » devenait
          totalement inatteignable des 7. La barre, elle, etait deja au bon
          endroit — c'est bien le conteneur qui debordait, pas elle qui defilait. */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        {activeTab === TAB_SQUAD ? (
          <>
            {renderAddPlayerRow()}
            {renderSectionTitle(t('matchCallUp.selection.sections.squad', {
              count: squadPlayers.length,
              teamName: squadTabLabel,
            }))}
            {visibleSquad.length > 0
              ? visibleSquad.map(renderPlayerRow)
              : renderEmpty(searchQuery
                ? t('matchCallUp.selection.empty.search')
                : t('matchCallUp.selection.empty.squad'))}
          </>
        ) : null}

        {activeTab === TAB_OTHERS ? (
          <>
            {renderSectionTitle(t('matchCallUp.selection.sections.reinforcements', {
              count: reinforcementPlayers.length,
            }))}
            {reinforcementPlayers.length > 0
              ? reinforcementPlayers.map(renderPlayerRow)
              : renderEmpty(t('matchCallUp.selection.empty.reinforcements'))}
          </>
        ) : null}

        {activeTab === TAB_OFF_APP ? (
          <>
            {renderAddPlayerRow()}
            {renderSectionTitle(t('matchCallUp.selection.sections.offApp', {
              count: manualPlayers.length,
            }))}
            {manualPlayers.length > 0
              ? manualPlayers.map(renderPlayerRow)
              : renderEmpty(t('matchCallUp.selection.empty.offApp'))}
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerTexts}>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
            {t('matchCallUp.selection.footer.calledUp', { count: counters.calledUp })}
          </Text>
          {counters.calledUp > 0 ? (
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('matchCallUp.selection.footer.split', {
                bench: counters.bench,
                starters: counters.starters,
              })}
            </Text>
          ) : null}
          {counters.reinforcements > 0 || counters.offApp > 0 ? (
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('matchCallUp.selection.footer.extras', {
                offApp: counters.offApp,
                reinforcements: counters.reinforcements,
              })}
            </Text>
          ) : null}
        </View>
        <Button
          onPress={handleNext}
          style={styles.footerCta}
          title={t('matchCallUp.selection.footer.next')}
          variant="Primary"
        />
      </View>

      {/* AC09 — la fenetre de prevention.
          🌐 C'est `BottomModal` et PAS `Alert.alert` : cet ecran est AUSSI
          compile par le site (`web/src/routes/screenRegistry.tsx:66`), et
          `react-native-web` livre un `Alert.alert()` qui ne fait RIEN. Une
          alerte muette rendrait « Suivant » mort sur le site des qu'un absent
          est coche. `BottomModal` a sa moitie web (`BottomModal.web.js`). */}
      <BottomModal
        close={() => setAbsentsToConfirm(null)}
        footerComponent={(
          <View style={styles.warningFooter}>
            <Button
              onPress={() => setAbsentsToConfirm(null)}
              style={styles.warningButton}
              title={t('matchCallUp.selection.absentWarning.cancel')}
              variant="Secondary"
            />
            <Button
              onPress={goToComposition}
              style={styles.warningButton}
              title={t('matchCallUp.selection.absentWarning.confirm')}
              variant="Primary"
            />
          </View>
        )}
        isVisible={Boolean(absentsToConfirm)}
        snapPoints={['42%']}
        webPresentation="dialog"
      >
        <View style={styles.warningBody}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('matchCallUp.selection.absentWarning.title', {
              count: (absentsToConfirm || EMPTY_LIST).length,
            })}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {t('matchCallUp.selection.absentWarning.message', {
              count: (absentsToConfirm || EMPTY_LIST).length,
              names: absentNames,
            })}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t('matchCallUp.selection.absentWarning.note')}
          </Text>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  addBadge: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  addRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    minHeight: 44,
    padding: 12,
  },
  countPill: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emptyText: {
    paddingVertical: 24,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCta: {
    width: 150,
  },
  footerTexts: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  headerTexts: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  metaText: {
    marginTop: 2,
  },
  playerName: {
    flexShrink: 1,
  },
  playerNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  playerRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    minHeight: 44,
    padding: 12,
  },
  playerTexts: {
    flex: 1,
    minWidth: 0,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  progressSegment: {
    borderRadius: 2,
    flex: 1,
    height: 4,
  },
  rsvpBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  screen: {
    paddingHorizontal: 0,
  },
  searchInput: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  searchWrapper: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  warningBody: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  warningButton: {
    flex: 1,
  },
  warningFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});

export default MatchCallUpSelection;
