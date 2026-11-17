import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Tag from '@/components/atoms/tag/Tag';
import TrainingProgressBar from '@/components/organisms/training/TrainingProgressBar';

import { createTournamentDesignSystem } from '../tournamentDesignSystem';
import { isTournamentActiveMemberStatus, normalizeTournamentText } from '../tournamentUtils';

// T-PAGES-1 (17/11/2026, maquette DESIGN-TOURNOI-PAGES validée, cartes (b) et (c)) — OÙ EN
// EST L'ÉQUIPE : « 1 / 5 places payées », la barre, la règle de validation, et la liste
// « à faire » calculée depuis `team.payment` et les membres. Brique commune : la fiche du
// tournoi (T-PAGES-3 et 4) et la page « Voir mon équipe » (T-PAGES-2). Aucune requête : tout
// arrive par les propriétés. Témoin : components/__tests__/TournamentTeamProgress.test.js.

/**
 * @typedef {{ kind: 'players', missing: number, count: number, max: number | null }
 *   | { kind: 'payments', count: number, names: string[] }
 *   | { kind: 'consents', count: number, names: string[] }
 *   | { kind: 'jerseys', chosen: number, total: number, names: string[] }
 *   | { kind: 'selfDue' }
 *   | { kind: 'selfPaid', size: string | null }} TodoItem
 */

/**
 * Le nom affiché d'un membre.
 * @param {any} member - Le membre (vue d'équipe du serveur).
 * @returns {string} Prénom et nom, ou une chaîne vide.
 */
const memberName = (member) => [member?.user?.firstname, member?.user?.lastname]
  .filter(Boolean).join(' ');

/**
 * Le calcul de la carte, sans affichage (testé seul).
 * @param {object} [params] - L'équipe telle que la page la reçoit.
 * @param {any[]} [params.members] - Les membres de l'équipe (`team.members`).
 * @param {any} [params.payment] - Le bloc `team.payment` (absent pour un tournoi gratuit).
 * @param {string} [params.teamStatus] - `team.status` (`accepted` = validée).
 * @param {any} [params.tournamentConfig] - `team.event.tournamentConfig`.
 * @returns {{ isValidated: boolean, isPaid: boolean, done: number, needed: number,
 *   ratio: number, playersCount: number, missingPlayers: number, missingPayments: number,
 *   todo: TodoItem[] }} L'état de l'équipe.
 */
export const getTournamentTeamProgress = ({
  members = [], payment = null, teamStatus = '', tournamentConfig = {},
} = {}) => {
  const actifs = (Array.isArray(members) ? members : [])
    .filter((member) => isTournamentActiveMemberStatus(member?.responseStatus));
  const parMembre = new Map(actifs.map((member) => [member?.documentId, member]));
  const nomDeLaPlace = (/** @type {any} */ place) => memberName(
    parMembre.get(place?.memberDocumentId),
  );
  const isValidated = normalizeTournamentText(teamStatus) === 'accepted';
  const isPaid = Boolean(payment);
  const minRoster = Number(tournamentConfig?.minRosterSize);
  const maxRoster = Number(tournamentConfig?.maxRosterSize);
  const neededPaid = Number(payment?.paidMembersToValidate) > 0
    ? Number(payment.paidMembersToValidate) : 5;
  // Le compteur du serveur fait foi (il ne compte pas l'ado sans autorisation).
  const paid = Math.max(0, Number(payment?.paidCount) || 0);
  let minPlayers = 0;
  if (minRoster > 0) minPlayers = minRoster;
  else if (isPaid) minPlayers = neededPaid;
  const missingPlayers = Math.max(0, minPlayers - actifs.length);
  const missingPayments = isPaid ? Math.max(0, neededPaid - paid) : 0;
  const needed = isPaid ? neededPaid : minPlayers;
  const done = isPaid ? paid : actifs.length;
  /** @type {any[]} */
  const places = Array.isArray(payment?.members) ? payment.members : [];

  /** @type {TodoItem[]} */
  const todo = [];
  if (!isValidated) {
    if (missingPlayers > 0) {
      todo.push({
        count: actifs.length,
        kind: 'players',
        max: maxRoster > 0 ? maxRoster : (minPlayers || null),
        missing: missingPlayers,
      });
    }
    const aPayer = places.filter((place) => place?.status !== 'paid' && !place?.isSelf);
    if (aPayer.length > 0) {
      todo.push({
        count: aPayer.length, kind: 'payments', names: aPayer.map(nomDeLaPlace).filter(Boolean),
      });
    }
    const attentes = actifs.filter((member) => member?.parentalConsentPending === true);
    if (attentes.length > 0) {
      todo.push({
        count: attentes.length, kind: 'consents', names: attentes.map(memberName).filter(Boolean),
      });
    }
    // T-PAGES-5 : la clé `jerseySize` n'arrive que pour qui a le droit de la lire ; sans elle,
    // on ne compte rien (jamais « 0 choisie » par manque de droit).
    const tailles = places.filter((place) => (
      place && Object.prototype.hasOwnProperty.call(place, 'jerseySize')
    ));
    const sansTaille = tailles.filter((place) => !place.jerseySize);
    if (tournamentConfig?.jerseySizeRequired === true && sansTaille.length > 0) {
      todo.push({
        chosen: tailles.length - sansTaille.length,
        kind: 'jerseys',
        names: sansTaille.map(nomDeLaPlace).filter(Boolean),
        total: tailles.length,
      });
    }
  }
  const moi = places.find((place) => place?.isSelf);
  if (moi && moi.status === 'paid') todo.push({ kind: 'selfPaid', size: moi.jerseySize || null });
  if (moi && moi.status !== 'paid' && !isValidated) todo.unshift({ kind: 'selfDue' });

  let ratio = isValidated ? 1 : 0;
  if (needed > 0) ratio = Math.min(1, done / needed);
  return {
    done,
    isPaid,
    isValidated,
    missingPayments,
    missingPlayers,
    needed,
    playersCount: actifs.length,
    ratio,
    todo,
  };
};

/**
 * Le titre d'une ligne « à faire ».
 * @param {TodoItem} item - La ligne.
 * @returns {string} Le titre.
 */
export const getTodoTitle = (item) => {
  switch (item.kind) {
    case 'consents':
      return i18next.t('tournamentTeamProgress.todo.consents', { count: item.count });
    case 'jerseys':
      return i18next.t('tournamentTeamProgress.todo.jerseys', {
        chosen: item.chosen, count: item.chosen, total: item.total,
      });
    case 'payments':
      return i18next.t('tournamentTeamProgress.todo.payments', { count: item.count });
    case 'players':
      return i18next.t('tournamentTeamProgress.todo.players', { count: item.missing });
    case 'selfDue':
      return i18next.t('tournamentTeamProgress.todo.selfDue');
    default:
      return i18next.t('tournamentTeamProgress.todo.selfPaid');
  }
};

/**
 * Le détail d'une ligne « à faire » (sous le titre), ou `null`.
 * @param {TodoItem} item - La ligne.
 * @returns {string | null} Le détail.
 */
export const getTodoDetail = (item) => {
  const noms = (/** @type {string[]} */ names) => ({
    names: names.join(', '), ...SANS_ECHAPPEMENT,
  });
  if (item.kind === 'players') {
    return item.max
      ? i18next.t('tournamentTeamProgress.todo.playersDetail', { count: item.count, max: item.max })
      : null;
  }
  if (item.kind === 'payments' && item.names.length) {
    return i18next.t('tournamentTeamProgress.todo.paymentsDetail', noms(item.names));
  }
  if (item.kind === 'consents' && item.names.length) {
    return i18next.t('tournamentTeamProgress.todo.consentsDetail', noms(item.names));
  }
  if (item.kind === 'jerseys' && item.names.length) {
    return i18next.t('tournamentTeamProgress.todo.jerseysDetail', noms(item.names));
  }
  if (item.kind === 'selfPaid' && item.size) {
    return i18next.t('tournamentTeamProgress.sizeChosen', { size: item.size, ...SANS_ECHAPPEMENT });
  }
  return null;
};

/**
 * La phrase « Il manque 2 joueurs et 4 paiements. », ou `null` s'il ne manque rien.
 * @param {{ missingPlayers: number, missingPayments: number }} progress - L'état.
 * @returns {string | null} La phrase.
 */
export const getMissingLine = ({ missingPayments, missingPlayers }) => {
  const morceaux = [
    missingPlayers > 0
      ? i18next.t('tournamentTeamProgress.missingPlayers', { count: missingPlayers }) : null,
    missingPayments > 0
      ? i18next.t('tournamentTeamProgress.missingPayments', { count: missingPayments }) : null,
  ].filter(Boolean);
  if (!morceaux.length) return null;
  const quoi = morceaux.length === 2
    ? i18next.t('tournamentTeamProgress.and', {
      a: morceaux[0], b: morceaux[1], ...SANS_ECHAPPEMENT,
    })
    : morceaux[0];
  return i18next.t('tournamentTeamProgress.missing', { what: quoi, ...SANS_ECHAPPEMENT });
};

/**
 * La carte « Où en est l'équipe ».
 * @param {object} props - Les propriétés.
 * @param {any[]} [props.members] - `team.members`.
 * @param {any} [props.payment] - `team.payment`.
 * @param {string} [props.teamStatus] - `team.status`.
 * @param {any} [props.tournamentConfig] - `team.event.tournamentConfig`.
 * @param {boolean} [props.showTodo] - Affiche « Il te reste à faire » (carte de la fiche, (b)).
 * @param {boolean} [props.viewerIsMember] - Le lecteur est dans l'équipe (ou la gère) : faux pour
 *   un visiteur ou un parent, la carte ne lui dit ni « Ton équipe » ni ce qu'il manque.
 * @param {import('react').ReactNode} [props.footer] - Un pied (le bouton « Voir mon équipe »).
 * @returns {import('react').ReactElement} La carte.
 */
function TournamentTeamProgress({
  footer = null, members = [], payment = null, showTodo = false, teamStatus = '',
  tournamentConfig = {}, viewerIsMember = true,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const ds = createTournamentDesignSystem({
    ApplicationStyle, Colors, Fonts, Spaces,
  });
  const progress = getTournamentTeamProgress({
    members, payment, teamStatus, tournamentConfig,
  });
  const tone = progress.isValidated ? Colors.success500 : Colors.warning500;
  const missing = progress.isValidated || !viewerIsMember ? null : getMissingLine(progress);
  let regle = null;
  if (progress.isPaid) {
    let cle = progress.isValidated
      ? 'tournamentTeamProgress.ruleValidated' : 'tournamentTeamProgress.rule';
    if (!viewerIsMember) cle = 'tournamentTeamProgress.ruleNeutral';
    regle = t(cle, {
      count: progress.done, needed: progress.needed, ...SANS_ECHAPPEMENT,
    });
  }

  return (
    <View style={[...ds.styles.panelCard, Spaces.gap[12]]} testID="tournament-team-progress">
      <View
        style={[
          Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8],
          { flexWrap: 'wrap' },
        ]}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('tournamentTeamProgress.title')}</Text>
        <Tag
          style={ds.getToneTagStyle(tone)}
          text={progress.isValidated
            ? t('tournamentTeamProgress.validated')
            : t('tournamentTeamProgress.notValidated')}
          textColor="neutral00"
          textStyle={{ color: tone }}
        />
      </View>
      {/* Rien à atteindre (tournoi gratuit sans effectif minimum) : ni « 2 / 0 », ni barre. */}
      {progress.needed > 0 ? (
        <>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            <Text style={[Fonts.h2, Fonts.neutral00]} testID="tournament-team-progress-count">
              {`${progress.done} / ${progress.needed}`}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {progress.isPaid
                ? t('tournamentTeamProgress.paidPlaces', { count: progress.done })
                : t('tournamentTeamProgress.players', { count: progress.done })}
            </Text>
          </View>
          <TrainingProgressBar
            color={progress.isValidated ? Colors.success500 : Colors.primary500}
            ratio={progress.ratio}
          />
        </>
      ) : null}
      {regle ? <Text style={[Fonts.p3, Fonts.neutral100]}>{regle}</Text> : null}
      {missing ? <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{missing}</Text> : null}
      {showTodo && progress.todo.length > 0 ? (
        <View style={Spaces.gap[8]} testID="tournament-team-progress-todo">
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>
            {t('tournamentTeamProgress.todoTitle')}
          </Text>
          {progress.todo.map((item) => {
            const detail = getTodoDetail(item);
            return (
              <View key={item.kind}>
                <Text
                  style={[
                    Fonts.p3Bold,
                    { color: item.kind === 'selfPaid' ? Colors.success500 : Colors.neutral00 },
                  ]}
                >
                  {getTodoTitle(item)}
                </Text>
                {detail ? <Text style={[Fonts.p4, Fonts.neutral200]}>{detail}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {footer}
    </View>
  );
}

export default TournamentTeamProgress;
