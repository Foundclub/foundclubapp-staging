// @ts-nocheck
/* eslint-disable no-nested-ternary */
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { getAuthRuntimeSnapshot } from '@/store/authRuntime';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';
import PlayerHeadToken from '@/components/tactical/PlayerHeadToken';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import {
  applyCurrentIdentities,
  buildConvocationFieldTokens,
  buildPublishedBoardTarget,
  formatConvocationDay,
  formatConvocationTime,
  getPersonName,
  getViewerConvocationRole,
} from '@/views/playerConvocation/playerConvocationUtils';

import { RouteNames } from '@/navigation/routeNames';

import { getTacticalFieldAspectRatio } from '@/utils/tacticalField';

import CompositionAnswerBar from './CompositionAnswerBar';

// 📐 COMPOMSG — la carte garde la largeur d'une bulle ; le terrain est DEBOUT,
// dans les proportions de son sport. Il etait couche dans une boite de
// 220 x 150 : un terrain de football (1,5 fois plus haut que large) y etait
// ecrase (capture d'Adel du 23/09).
const CARD_WIDTH = 264;
const MINI_FIELD_HEIGHT = 196;
const MINI_TOKEN_SIZE = 24;

/**
 * @typedef {{ id?: string; documentId?: string; firstname?: string; lastname?: string }} CompositionPlayer
 * @typedef {{ playerId?: string; positionX?: number; positionY?: number }} CompositionPlacement
 * @typedef {{
 *   eventAddress?: string;
 *   eventId?: string;
 *   eventDate?: string;
 *   eventDisplayName?: string;
 *   eventName?: string;
 *   eventNote?: string;
 *   manualPlayers?: CompositionPlayer[];
 *   placements?: CompositionPlacement[];
 *   publishedVersion?: number;
 *   reservePlayers?: CompositionPlayer[];
 *   schemaVersion?: number;
 *   snapshotPlayers?: CompositionPlayer[];
 *   sport?: string;
 *   sportContext?: string;
 *   teamId?: string;
 *   teamName?: string;
 *   teamPlayers?: CompositionPlayer[];
 *   teams?: Array<{ id?: string; name?: string; placements?: CompositionPlacement[] }>;
 *   type?: string;
 * }} CompositionPayload
 */

const getPlayerId = (player) => String(player?.documentId || player?.id || '').trim();

/**
 * U06 — le lieu, tel qu'il arrive du serveur.
 *
 * ⛔ Un lieu absent est DIT, jamais invente : la carte ecrit « Lieu non precise »
 * plutot que de laisser un trou que le lecteur comblerait tout seul.
 * ⚠️ Le DEBALLAGE d'une adresse emballee en JSON se fait UNE fois, cote serveur
 * (`extractHumanAddressLabel`, `event-composition.ts`). Ici on ne garde que le
 * garde-fou : tout ce qui n'est pas une chaine non vide vaut « absent », pour
 * qu'aucun objet brut n'arrive a l'ecran.
 * @param {unknown} value
 * @returns {string}
 */
const readableAddress = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Carte « Composition publiee » d'un fil de messagerie.
 *
 * 🎨 COMPOMSG (23/09) — REFAITE AU DESIGN SYSTEME. Adel : « visuellement il faut
 * l'ameliorer, qu'il corresponde mieux au design system. La, c'est pas tres
 * beau. » Elle suit desormais sa voisine du meme fil, `EventShareBubble` (fond
 * `primary800`, liseré cyan, titre sur deux lignes, pied separe), et la maquette
 * du pack composition (ecran 9 : bandeau « COMPOSITION » + sport, terrain avec
 * les tetes des joueurs, pied « N convoques · Ouvrir »).
 *
 * 🚦 QUI VOIT QUOI (regle de la messagerie, COMPOMSG) :
 *   · toucher la CARTE : un joueur convoque va sur « Tu es convoque » ; tout
 *     autre lecteur (entraineur, dirigeant, joueur non retenu) va sur le plein
 *     ecran en lecture seule ;
 *   · toucher le TERRAIN : TOUT LE MONDE va sur le plein ecran en lecture seule.
 * Le plein ecran relit la derniere version publiee au serveur en s'ouvrant
 * (`refreshFromServer`) : une carte ancienne du fil ne montre jamais une compo
 * perimee sans le dire.
 * @param {object} props
 * @param {CompositionPayload | null | undefined} props.composition - The composition data
 * @param {any[]} [props.currentPeople] - FINITIONS13-STATS (2) : les participants
 *   du fil, relus avec lui. Un compte renomme depuis la publication y prend son nom du jour.
 * @param {any} [props.currentEvent] - FINITIONS16 (8) : le match tel que le serveur le joint au
 *   message AUJOURD'HUI. Un match modifie depuis la publication y prend son titre et son heure.
 * @param {boolean} [props.dansLaBulle] - MSG1A (§3.7) : posee dans le cadre commun du fil.
 * @param {boolean} [props.isMe] - Whether sent by current user
 * @param {import('react').ReactNode} [props.meta] - MSG1A : l'heure et les coches, avant le pied.
 * @param {(cible: { label: string }) => void} [props.onOpenAddress] - MSG1A (§3.18) : le lieu
 *   devient un lien (feuille Plans / Google Maps / Waze / Copier).
 * @param {(target?: 'placement') => void} [props.onEdit] - Contrat MSG1A / MSG1C (07/10) : pour
 *   qui peut convoquer. Present : « Modifier » (contour) appelle `onEdit()` (etape Joueurs) et le
 *   terrain appelle `onEdit('placement')` ; absent : un seul « Ouvrir la composition », et le
 *   terrain ouvre le plein ecran comme avant.
 * @param {() => import('react').ReactNode} [props.renderReponses] - Contrat MSG1A / MSG1C : le
 *   bloc « Reponses » (dessine par 1C), rendu sous la carte.
 * @returns {import('react').ReactElement | null}
 */
function CompositionMessageBubble({
  composition,
  currentEvent = null,
  currentPeople = [],
  dansLaBulle = false,
  isMe = false,
  meta = null,
  onEdit = undefined,
  onOpenAddress = undefined,
  renderReponses = undefined,
}) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const navigation = useNavigation();

  if (!composition) return null;

  const {
    eventAddress,
    eventDate,
    eventDisplayName,
    eventId,
    eventName,
    eventNote,
    manualPlayers = [],
    placements = [],
    publishedVersion,
    reservePlayers: reservePlayersPublies = [],
    schemaVersion = 2,
    snapshotPlayers: snapshotPlayersPublies = [],
    sport = 'football',
    sportContext,
    teamId,
    teamName,
    teamPlayers: teamPlayersPublies = [],
    teams = [],
    type,
  } = composition;
  // 🪪 FINITIONS13-STATS (2) — la carte est une PHOTO de la publication : elle figeait
  // le nom de chaque joueur (Hugo, renomme le 29/09, restait « Paul Veuillet »). Les
  // participants du fil, DEJA relus avec lui, donnent le nom du jour — aucune requete
  // de plus (la regle « bulle A » du 29/09 tient). Meme regle que la feuille de match
  // et que la vue Convocation : seule l identite bouge, jamais qui est convoque.
  const reservePlayers = applyCurrentIdentities(reservePlayersPublies, currentPeople);
  const snapshotPlayers = applyCurrentIdentities(snapshotPlayersPublies, currentPeople);
  const teamPlayers = applyCurrentIdentities(teamPlayersPublies, currentPeople);
  // 🐛 COMPOMSG (point 3) — `teams` vaut `[]` par defaut : `Array.isArray(teams)`
  // etait donc TOUJOURS vrai, et les cartes « a plat » d'avant la v3 (7 en
  // production, du 13/05 au 15/06) ne lisaient jamais leurs `placements` — ni
  // jeton, ni nom, ni compte. Une liste d'equipes VIDE ne dit rien de la forme.
  const isMultiTeamComposition = Number(schemaVersion) === 3 || teams.length > 0;
  const previewPlacements = isMultiTeamComposition
    ? (Array.isArray(teams?.[0]?.placements) ? teams[0].placements : [])
    : placements;

  const allPlayers = [...teamPlayers, ...manualPlayers, ...reservePlayers, ...snapshotPlayers];

  // 🧾 R6 (vague R) — LES NOMS, ENFIN ECRITS.
  //
  // 🧨 Constat de recette du 24/08 : « la liste des convoques doit se voir dans
  // le groupe de messages de l equipe ». Les personnes voyageaient DEJA dans la
  // charge (`snapshotPlayers`, `reservePlayers`) : ZERO changement serveur.
  //
  // ♻️ `buildConvocationFieldTokens` est le MEME assembleur que l ecran du
  // joueur convoque et que l onglet « Convocation » : il apparie un placement a
  // sa personne et JETTE les placements orphelins — jamais de ligne vide a la
  // place d un nom qu on n a pas. Il nourrit aussi les jetons du terrain : les
  // tetes et les noms viennent de la meme liste.
  const starters = buildConvocationFieldTokens({
    placements: previewPlacements,
    snapshotPlayers: allPlayers,
  });
  const benchPlayers = reservePlayers.filter((player) => getPersonName(player));

  // ⛔ LE MINI-TERRAIN N A JAMAIS DESSINE QUE LA PREMIERE EQUIPE — c est un
  // apercu, et il le reste. Mais une liste qui s arreterait la SANS RIEN DIRE
  // ferait croire au lecteur qu il a vu tout le monde : la carte compte ce
  // qu elle ne montre pas.
  const otherTeamsCount = isMultiTeamComposition && Array.isArray(teams)
    ? Math.max(0, teams.length - 1)
    : 0;
  const otherTeamsLine = otherTeamsCount > 0
    ? t(
      'compositionMessageBubble.otherTeams',
      {
        count: otherTeamsCount,
        defaultValue_one: '+ {{count}} autre équipe dans cette composition',
        defaultValue_other: '+ {{count}} autres équipes dans cette composition',
      },
    )
    : '';

  // 🔢 COMPOMSG — CE QUE LA CARTE COMPTE : les CONVOQUES (terrain + banc, toutes
  // equipes confondues). Elle affichait « 1 equipe(s) » — accent manquant,
  // « (s) » de formulaire, et une information que personne ne cherchait.
  const allPlacements = isMultiTeamComposition && Array.isArray(teams)
    ? teams.flatMap((entry) => (Array.isArray(entry?.placements) ? entry.placements : []))
    : placements;
  const calledUpIds = new Set([
    ...buildConvocationFieldTokens({ placements: allPlacements, snapshotPlayers: allPlayers })
      .map((token) => getPlayerId(token.player)),
    ...benchPlayers.map((player) => getPlayerId(player)),
  ].filter(Boolean));
  const calledUpLine = calledUpIds.size > 0
    ? t('compositionMessageBubble.calledUp', {
      count: calledUpIds.size,
      defaultValue_one: '{{count}} convoqué',
      defaultValue_other: '{{count}} convoqués',
    })
    : '';
  // 🏷️ COMPOMSG — « v1 » ne disait rien a un joueur. Une compo MODIFIEE le dit
  // en mots (« Version 2 », meme mot que l'ecran « Compo modifiee » du pack) ;
  // la premiere publication n'affiche rien de technique.
  const versionNumber = Number(publishedVersion) || 0;
  const versionLine = versionNumber > 1
    ? t('compositionMessageBubble.version', {
      defaultValue: 'Version {{version}}',
      version: versionNumber,
    })
    : '';

  // U06 — l'heure etait DEJA dans `eventDate` (champ `datetime` cote serveur) et
  // partait a la poubelle : la carte n'en gardait que le jour.
  // ♻️ COMPOMSG — le jour et l'heure s'ecrivent avec les MEMES fonctions que
  // « Tu es convoque » : un joueur qui passe de l'un a l'autre lit la meme date.
  // 🗓️ FINITIONS16 · POINT 8 (T15) — LE MATCH D'AUJOURD'HUI, PAS LA PHOTO. Le match du 3 oct. avait
  // ete modifie apres la publication (adversaire renomme, coup d'envoi avance) : la carte disait
  // « RECETTE 28-09 · 17:00 », « Ouvrir » montrait « Équipe visiteuse · 15:00 ». Le message porte
  // le match du jour (`message.event`) : la carte le lit, sans requete de plus. Seulement le MEME
  // match ; sans date lisible, la photo.
  const matchDuJour = currentEvent?.documentId
    && String(currentEvent.documentId) === String(eventId || '')
    ? currentEvent
    : null;
  const dateDuMatch = Number.isFinite(Date.parse(String(matchDuJour?.date || '')))
    ? matchDuJour?.date
    : eventDate;
  const whenLine = [formatConvocationDay(dateDuMatch), formatConvocationTime(dateDuMatch)]
    .filter(Boolean).join(' · ');
  const addressLine = readableAddress(eventAddress) || t(
    'compositionMessageBubble.locationNotSpecified',
    'Lieu non précisé',
  );
  // Une carte de composition SANS evenement rattache (partage libre) n'a ni
  // quand ni ou a annoncer : on ne lui colle pas un « Lieu non precise » qui ne
  // repond a aucune question.
  // 🏷️ COMPOMSG (suite) — LE TITRE ET LE RDV, SEPARES. Mesure en production :
  // le match d'Adel a un `name` VIDE et le RDV dans sa `description` ; la charge
  // n'avait que `eventName` = `name || description`, la carte titrait donc le
  // RDV. Le serveur envoie desormais `eventDisplayName` (« Match vs US Pelican »,
  // la meme regle que « Tu es convoque ») et `eventNote` (le texte libre).
  // ⛔ Une carte DEJA postee n'a ni l'un ni l'autre : elle garde son titre d'hier.
  const title = String(matchDuJour?.name || '').trim()
    || String(eventDisplayName || '').trim()
    || eventName;
  const noteText = String(eventNote || '').trim();
  const note = noteText && noteText.toLowerCase() !== String(title || '').trim().toLowerCase()
    ? noteText
    : '';
  const hasEventContext = Boolean(title || whenLine);

  const kicker = type === 'lineup_share'
    ? t('compositionMessageBubble.published', 'Composition publiée')
    : t('compositionMessageBubble.matchLineUp', 'Composition du match');

  // 🎒 COMPOMODIF (M1) — LE PACK QUE LA CARTE EMPORTE, ASSEMBLE UNE SEULE FOIS.
  //
  // Un coach qui appuie sur « Modifier » doit retrouver ses convoques. Sans lui,
  // l'ecran de selection repartirait de zero — c'est exactement le defaut M4.
  const packDeLaCarte = isMultiTeamComposition
    ? {
      manualPlayers,
      reservePlayerIds: reservePlayers.map((player) => getPlayerId(player)).filter(Boolean),
      reserveSnapshotPlayers: reservePlayers,
      schemaVersion: 3,
      snapshotPlayers,
      sportContext,
      teams,
    }
    : {
      manualPlayers,
      placements,
      sportContext,
    };

  // COMPOLECT-2 (D1) + COMPOMSG — LA CARTE MENE AU MEME TERRAIN QUE PARTOUT
  // AILLEURS, et par la MEME recette (`buildPublishedBoardTarget`) que le
  // terrain de « Tu es convoque ».
  //
  // DEUX CAS GARDENT L'ANCIEN PLATEAU, et ce sont exactement ceux
  // d'`EventDetails` (D6) : sans titulaire dessinable, un terrain vide ferait
  // croire a une compo perdue ; avec plusieurs equipes, le plateau ne dessine
  // QU'UN terrain et en cacherait une sans rien dire.
  const openFullScreen = () => {
    const { auth } = getAuthRuntimeSnapshot();

    // 🚪 COMPOMODIF (M1) — ⚠️ VOLONTAIREMENT ETROIT : un president de club qui
    // n'entraine pas cette equipe n'aura pas le bouton « Modifier » ICI — la
    // carte ne porte pas le club, et inventer un droit qu'on ne peut pas
    // verifier vaut moins qu'un bouton manquant.
    const peutModifier = Boolean(teamId) && (auth?.user?.trainedTeams || []).some(
      (equipe) => String(equipe?.documentId || '') === String(teamId),
    );

    const target = eventId
      ? buildPublishedBoardTarget(
        {
          ...packDeLaCarte,
          reservePlayerIds: reservePlayers.map((player) => getPlayerId(player)).filter(Boolean),
          reserveSnapshotPlayers: reservePlayers,
          snapshotPlayers: allPlayers,
          teams: isMultiTeamComposition ? teams : [{ placements }],
          version: publishedVersion,
        },
        { sport: sportContext || sport, teamName },
      )
      : null;

    if (target) {
      navigation.navigate(RouteNames.EventStack, {
        params: {
          ...target,
          // 🌐 COMPO-CARTE-SITE — le droit ABSENT n'est pas ecrit `false` : sur
          // le site, ces parametres voyagent dans l'adresse (`buildWebPath`),
          // ou `false` devient la chaine « false » — non vide, donc VRAIE pour
          // le plateau, qui montrait « Modifier » a un simple lecteur. Absent,
          // le plateau prend sa valeur par defaut : `canEdit = false`.
          ...(peutModifier ? { canEdit: true } : {}),
          eventId,
          eventLabel: title,
          // Sans ces deux-la, « Modifier » ouvrirait un ecran incapable de
          // retrouver les convoques, puis de publier faute d'equipe.
          existingComposition: packDeLaCarte,
          // 🔄 COMPOMSG — la carte est une PHOTO prise a la publication. Le
          // plateau relit la derniere version et dit si celle-ci a ete depassee.
          messageVersion: versionNumber || null,
          readOnly: true,
          refreshFromServer: true,
          teamId,
        },
        screen: RouteNames.MatchCompositionBoard,
      });
      return;
    }

    navigation.navigate(RouteNames.EventStack, {
      params: {
        canEdit: false,
        editorMode: 'event',
        editorSource: type === 'lineup_share' ? 'published' : null,
        editorSourceLabel: type === 'lineup_share' ? t(
          'compositionMessageBubble.teamLineUpPublished',
          "Composition d'équipes publiée",
        ) : null,
        eventId,
        eventName,
        existingComposition: packDeLaCarte,
        multiTeamComposition: isMultiTeamComposition,
        players: allPlayers,
        readOnly: true,
        sport,
        teamName,
      },
      screen: RouteNames.TacticalBoardV2,
    });
  };

  // ♻️ BULLE — le pack tel que la CARTE le porte sert deux fois : a
  // l'aiguillage du toucher (AC08), et a la garde des boutons de reponse.
  const packPublieDeLaCarte = {
    reservePlayerIds: reservePlayers.map((player) => getPlayerId(player)).filter(Boolean),
    teams: isMultiTeamComposition ? teams : [{ placements }],
  };

  // 🥇 AC08 — LA BULLE MENE AU BON ECRAN. Un convoque va sur SON ecran ; les
  // autres gardent la vue d'ensemble en lecture seule.
  //
  // ♻️ L'identite se lit dans l'instantane d'authentification — le MEME que
  // `client.native.js` interroge avant chaque requete. `useAuth` tirerait tout le
  // client HTTP dans une carte de tchat qui n'appelle rien.
  const handlePress = () => {
    const { auth } = getAuthRuntimeSnapshot();
    const viewerConvocationRole = getViewerConvocationRole(
      { published: packPublieDeLaCarte },
      auth?.user?.documentId || auth?.user?.id,
    );

    if (eventId && viewerConvocationRole) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId },
        screen: RouteNames.PlayerConvocation,
      });
      return;
    }

    openFullScreen();
  };

  // 🙋 BULLE (decision d'Adel du 29/09, « bulle A ») — PRESENT / ABSENT DANS
  // LA CARTE. Deux gardes lues sur la carte elle-meme, AVANT toute requete :
  //   · le lecteur figure sur CETTE carte — sinon (entraineur, joueur ecarte,
  //     parent) rien n'est demande au serveur et la carte reste telle quelle ;
  //   · le match n'a pas commence — le serveur refuserait la reponse
  //     (`validateDateIsInFuture`, `event-rsvp.ts`) : un bouton voue au refus
  //     n'a rien a faire sur une carte. Seul un match de LIGUE est accepte apres
  //     coup par le serveur ; sa fiche reste la pour ca.
  // Le reste — demande de reponse, version en cours, reponse deja donnee — se
  // lit au serveur, dans `CompositionAnswerBar`, jamais sur la carte.
  const { auth: lecteur } = getAuthRuntimeSnapshot();
  const viewerId = String(lecteur?.user?.documentId || lecteur?.user?.id || '').trim();
  const matchAVenir = Date.parse(String(dateDuMatch || '')) > Date.now();
  const proposeLaReponse = type === 'lineup_share'
    && Boolean(eventId)
    && matchAVenir
    && Boolean(getViewerConvocationRole({ published: packPublieDeLaCarte }, viewerId));

  // 🎨 MSG1A (§3.7) — dans le fil, la carte se pose DANS la bulle commune (`BulleDuFil`) :
  // pas de fond ni de liseré propres, 276 de large (SPECS.md §3). Ailleurs (le site), elle
  // garde son cadre.
  const cadre = dansLaBulle
    ? [styles.contenuDansLaBulle]
    : [
      styles.container,
      {
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        backgroundColor: withAlpha(Colors.primary800, 0.92),
        borderColor: withAlpha(Colors.primary500, 0.35),
      },
    ];
  const retrait = dansLaBulle ? styles.sansRetrait : null;

  const accessibilityLabel = [
    kicker,
    versionLine,
    title,
    whenLine,
    teamName,
    hasEventContext ? addressLine : '',
    note,
    calledUpLine,
  ].filter(Boolean).join('. ');

  const starterNames = starters.map((token) => getPersonName(token.player)).filter(Boolean);
  const benchNames = benchPlayers.map((player) => getPersonName(player));
  const pitchTitle = t('compositionMessageBubble.onThePitch', 'Sur le terrain');
  const benchTitle = t('compositionMessageBubble.onTheBench', 'Sur le banc');

  // 🗂️ MSG1A (§3.7) — QUI PEUT MODIFIER, c'est l'appelant qui le dit (contrat avec MSG1C) :
  // avec `onEdit`, deux boutons ; sans, un seul « Ouvrir la composition ».
  const peutModifierIci = typeof onEdit === 'function';
  const toucherLeTerrain = peutModifierIci ? () => onEdit('placement') : openFullScreen;
  const reponses = typeof renderReponses === 'function' ? renderReponses() : null;
  // 📍 MSG1A (§3.18) — le lieu en lien. ⛔ Jamais un bouton DANS le bouton de la carte : le
  // lien et l'encadre « Infos » sortent alors du corps, a la suite, dans le meme ordre.
  const adresseCliquable = hasEventContext && Boolean(readableAddress(eventAddress))
    && typeof onOpenAddress === 'function';
  const encadreInfos = note ? (
    <View style={[styles.note, { backgroundColor: withAlpha(Colors.neutral900, 0.22) }]}>
      <Text style={[styles.noteTexte, styles.noteLabel, { color: Colors.primary500 }]}>
        {t('compositionMessageBubble.note', 'Infos')}
      </Text>
      <Text
        numberOfLines={3}
        style={[styles.noteTexte, styles.noteCorps, { color: Colors.neutral00 }]}
      >
        {note}
      </Text>
    </View>
  ) : null;

  // ♿ COMPO-CARTE-SITE — TROIS BOUTONS COTE A COTE, AUCUN DANS UN AUTRE (carte, terrain,
  // pied). Un lecteur d'ecran entend la carte (sa phrase dit tout), puis le terrain, puis
  // les boutons du pied.
  return (
    <View style={cadre}>
      <TouchableOpacity
        accessibilityHint={t('compositionMessageBubble.openHint', 'Ouvre la composition')}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={handlePress}
        style={[styles.body, retrait]}
      >
        {/* MSG1A — l'en-tete du pack : glyphe « Users » + « Composition publiee » en cyan,
            « Version N » a droite. */}
        <View style={styles.kickerRow}>
          <GlyphIcon color={Colors.primary500} name="users" size={15} />
          <Text
            numberOfLines={1}
            style={[styles.kicker, { color: Colors.primary500 }]}
          >
            {kicker}
          </Text>
          {versionLine ? (
            <Text
              numberOfLines={1}
              style={[styles.version, { color: withAlpha(Colors.neutral00, 0.7) }]}
            >
              {versionLine}
            </Text>
          ) : null}
        </View>

        {/* U06 + COMPOLECT-2 — le nom du match a droit a DEUX lignes. Puis quand · qui, et ou. */}
        {title ? (
          <Text numberOfLines={2} style={[styles.titre, { color: Colors.neutral00 }]}>
            {title}
          </Text>
        ) : null}
        {hasEventContext || teamName ? (
          <View style={styles.contextLines}>
            {whenLine || teamName ? (
              <Text
                numberOfLines={1}
                style={[styles.contexte, { color: withAlpha(Colors.neutral00, 0.7) }]}
              >
                {[whenLine, teamName].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {hasEventContext && !adresseCliquable ? (
              <Text
                numberOfLines={2}
                style={[styles.contexte, { color: withAlpha(Colors.neutral00, 0.7) }]}
              >
                {addressLine}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* COMPOMSG — le texte de l'entraineur (souvent le RDV), sous le mot « Infos ». */}
        {adresseCliquable ? null : encadreInfos}
      </TouchableOpacity>

      {adresseCliquable ? (
        <View style={[styles.suiteDuCorps, retrait]}>
          <TouchableOpacity
            accessibilityHint={t(
              'conversation.address.hint',
              'Ouvre le choix de l’application de cartes',
            )}
            accessibilityRole="link"
            onPress={() => onOpenAddress({ label: addressLine })}
            style={styles.lienAdresse}
            testID="composition-adresse"
          >
            <GlyphIcon color={Colors.primary500} name="locationPin" size={14} />
            <Text
              numberOfLines={2}
              style={[styles.contexte, styles.lienAdresseTexte, { color: Colors.primary500 }]}
            >
              {addressLine}
            </Text>
          </TouchableOpacity>
          {encadreInfos}
        </View>
      ) : null}

      {/* 🔎 COMPOMSG — LE TERRAIN EST SON PROPRE BOUTON : il mene TOUJOURS au plein ecran.
          ⚖️ MSG1A — le pack le dessine COUCHE (276 x 132) ; il reste DEBOUT, dans les
          proportions de son sport (decision COMPOMSG du 23/09, capture d'Adel). */}
      <TouchableOpacity
        accessibilityLabel={t(
          'compositionMessageBubble.openFullScreen',
          'Voir la composition en plein écran',
        )}
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={toucherLeTerrain}
        style={styles.fieldTouch}
      >
        <RenderedTacticalField
          sport={sport}
          style={[
            styles.miniField,
            { aspectRatio: 1 / getTacticalFieldAspectRatio(sportContext || sport) },
          ]}
        >
          {starters.map(({ placement, player }) => (
            <View
              key={`${placement?.playerId}-${placement?.positionX}-${placement?.positionY}`}
              style={[
                styles.tokenSlot,
                {
                  left: `${placement?.positionX || 0}%`,
                  top: `${placement?.positionY || 0}%`,
                },
              ]}
            >
              <PlayerHeadToken player={player} size={MINI_TOKEN_SIZE} />
            </View>
          ))}
        </RenderedTacticalField>
        <View
          style={[styles.expandPill, { backgroundColor: withAlpha(Colors.neutral900, 0.6) }]}
        >
          {peutModifierIci ? (
            <GlyphIcon color={Colors.neutral00} name="penSquare" size={13} />
          ) : null}
          <Text style={[styles.pilule, { color: Colors.neutral00 }]}>
            {peutModifierIci
              ? t('compositionMessageBubble.editPlacement', 'Modifier le placement')
              : t('compositionMessageBubble.expand', 'Agrandir')}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 🧾 R6 — QUI EST CONVOQUE (memes mots que l'onglet « Convocation »), deux lignes au
          plus par groupe (le pack). Masque aux lecteurs d'ecran : la carte le dit deja. */}
      {starterNames.length > 0 || benchNames.length > 0 || !dansLaBulle ? (
        <TouchableOpacity
          accessible={false}
          activeOpacity={0.85}
          aria-hidden
          focusable={false}
          onPress={handlePress}
          style={[styles.roster, retrait]}
        >
          {starterNames.length > 0 ? (
            <View style={styles.rosterGroup}>
              <Text style={[styles.rosterTitle, { color: Colors.neutral00 }]}>
                {`${pitchTitle} · ${starterNames.length}`}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.rosterNoms, { color: withAlpha(Colors.neutral00, 0.7) }]}
              >
                {starterNames.join(' · ')}
              </Text>
            </View>
          ) : null}
          {benchNames.length > 0 ? (
            <View style={styles.rosterGroup}>
              <Text style={[styles.rosterTitle, { color: Colors.neutral00 }]}>
                {`${benchTitle} · ${benchNames.length}`}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.rosterNoms, { color: withAlpha(Colors.neutral00, 0.7) }]}
              >
                {benchNames.join(' · ')}
              </Text>
            </View>
          ) : null}
          {otherTeamsLine ? (
            <Text
              style={[styles.rosterNoms, { color: withAlpha(Colors.neutral00, 0.7) }]}
            >
              {otherTeamsLine}
            </Text>
          ) : null}
          {/* 🌐 HORS DE LA BULLE (le site, tant que MESSAGERIE-1W n'a pas adopte le pack) :
              l'ancien bas de carte « N convoques · Ouvrir », meme toucher que la carte et
              masque aux lecteurs d'ecran (temoins COMPO-CARTE-SITE du site et de l'app). */}
          {!dansLaBulle ? (
            <View
              style={[styles.footerHorsBulle, { borderTopColor: withAlpha(Colors.neutral00, 0.1) }]}
            >
              <Text
                numberOfLines={1}
                style={[styles.footerText, { color: withAlpha(Colors.neutral00, 0.7) }]}
              >
                {calledUpLine}
              </Text>
              <Text style={[styles.boutonPiedTexte, { color: Colors.primary500 }]}>
                {t('compositionMessageBubble.open', 'Ouvrir')}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : null}

      {/* 🗳️ MSG1A (§3.7) — le bloc « Reponses » (dessine par MSG1C), sous la carte. */}
      {reponses ? <View style={retrait}>{reponses}</View> : null}

      {/* ♿ BULLE — les boutons de reponse, a la suite et non imbriques. */}
      {proposeLaReponse ? (
        <CompositionAnswerBar
          eventId={eventId}
          publishedVersion={publishedVersion}
          teamId={teamId}
          viewerId={viewerId}
        />
      ) : null}

      {meta ? <View style={styles.meta}>{meta}</View> : null}

      {/* MSG1A (§3.7) — le pied du pack, DANS la bulle du fil : DEUX vrais boutons pour qui
          gere la composition (« Modifier » en contour, « Ouvrir » plein), un seul « Ouvrir la
          composition » pour les autres. Le nombre de convoques reste dit, au-dessus. */}
      {dansLaBulle ? (
        <View
          style={[
            styles.footer,
            styles.footerDansLaBulle,
            { borderTopColor: withAlpha(Colors.neutral00, 0.14) },
          ]}
        >
          {calledUpLine ? (
            <Text
              numberOfLines={1}
              style={[styles.footerText, { color: withAlpha(Colors.neutral00, 0.7) }]}
            >
              {calledUpLine}
            </Text>
          ) : null}
          <View style={styles.footerBoutons}>
            {peutModifierIci ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => onEdit()}
                style={[styles.boutonPied, { borderColor: Colors.primary500, borderWidth: 1.5 }]}
                testID="composition-modifier"
              >
                <GlyphIcon color={Colors.primary500} name="penSquare" size={16} />
                <Text style={[styles.boutonPiedTexte, { color: Colors.primary500 }]}>
                  {t('compositionMessageBubble.edit', 'Modifier')}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={handlePress}
              style={[styles.boutonPied, { backgroundColor: Colors.primary500 }]}
              testID="composition-ouvrir"
            >
              <Text style={[styles.boutonPiedTexte, { color: Colors.primary900 }]}>
                {peutModifierIci
                  ? t('compositionMessageBubble.open', 'Ouvrir')
                  : t('compositionMessageBubble.openComposition', 'Ouvrir la composition')}
              </Text>
              <GlyphIcon color={Colors.primary900} name="chevronRight" size={16} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  boutonPied: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    justifyContent: 'center',
  },
  boutonPiedTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 14,
    lineHeight: 18,
  },
  container: {
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
    width: CARD_WIDTH,
  },
  contenuDansLaBulle: {
    width: 276,
  },
  contexte: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    lineHeight: 18,
  },
  contextLines: {
    gap: 2,
  },
  expandPill: {
    alignItems: 'center',
    borderRadius: 999,
    bottom: 8,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    right: 8,
  },
  // COMPO-CARTE-SITE — le terrain est sorti de `body` : il reprend a la main l'ecart du pack.
  fieldTouch: {
    alignSelf: 'center',
    marginBottom: 4,
    marginTop: 10,
  },
  footer: {
    borderTopWidth: 1,
    gap: 8,
    marginTop: 8,
    padding: 10,
  },
  footerBoutons: {
    flexDirection: 'row',
    gap: 8,
  },
  // Dans la bulle : le pied touche les bords (marges 10 de la bulle compensees).
  footerDansLaBulle: {
    marginBottom: -7,
    marginHorizontal: -10,
  },
  footerHorsBulle: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    minHeight: 44,
  },
  footerText: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12.5,
    lineHeight: 17,
  },
  kicker: {
    flex: 1,
    fontFamily: GRAS_FAMILLE,
    fontSize: 12.5,
    lineHeight: 17,
  },
  kickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  // 📍 MSG1A (§3.18) — le lieu en lien (pack : epingle 14, texte 13 souligne, cyan).
  lienAdresse: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  lienAdresseTexte: {
    flexShrink: 1,
    textDecorationLine: 'underline',
  },
  meta: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  miniField: {
    borderRadius: 12,
    height: MINI_FIELD_HEIGHT,
    overflow: 'hidden',
  },
  note: {
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteCorps: {
    flex: 1,
  },
  noteLabel: {
    fontFamily: GRAS_FAMILLE,
  },
  noteTexte: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    lineHeight: 18,
  },
  pilule: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 11.5,
    lineHeight: 15,
  },
  roster: {
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 14,
  },
  rosterGroup: {
    gap: 3,
  },
  rosterNoms: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    lineHeight: 18,
  },
  rosterTitle: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 12,
    letterSpacing: 0.6,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  sansRetrait: {
    paddingHorizontal: 0,
  },
  suiteDuCorps: {
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 14,
  },
  titre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 21,
    marginTop: 2,
  },
  // Le jeton est CENTRE sur sa position, pas accroche par son coin.
  tokenSlot: {
    marginLeft: -(MINI_TOKEN_SIZE / 2),
    marginTop: -(MINI_TOKEN_SIZE / 2),
    position: 'absolute',
  },
  version: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12,
    lineHeight: 16,
  },
});

export default CompositionMessageBubble;
