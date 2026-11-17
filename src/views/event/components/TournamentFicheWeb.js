import i18next from 'i18next';
import { useTranslation } from 'react-i18next';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { useGetTournamentTeam } from '@/services/tournamentTeam/tournamentTeamQueries';

import { getTournamentEntryFeeLabel, getTournamentMinAge } from '../tournamentUtils';
import TournamentTeamProgress from './TournamentTeamProgress';
import { isPaidTournament } from './tournamentTerms';
// « @/platform » est hors des groupes de perfectionist (il le veut en dernier) ; import/order le
// voudrait avant les chemins relatifs : on suit perfectionist.
// eslint-disable-next-line import/order
import LinksPlatform from '@/platform/links';

// T-PAGES-3 (17/11/2026, maquette DESIGN-TOURNOI-PAGES validée, écrans (a) et (b), ordinateur) —
// LES BLOCS DE LA FICHE DU TOURNOI SUR LE SITE, vus par qui n'organise pas le tournoi :
// « Comment ça marche », « Avant de t'inscrire », la carte « Ton inscription » et la carte
// « Mon équipe » (R4 : capitaine, membre ou invité). Propres au site : la fiche du téléphone
// (EventDetails.js) a les siens (T-PAGES-4). Les couleurs et les boutons sont ceux de la fiche
// (`ui`, passé par EventDetails.web.js). Un seul bouton principal par carte.
// Témoin : __tests__/EventDetailsWeb.T-PAGES-3.fiche.test.js.

/**
 * @typedef {{ accentColor: string, borderColor: string, mutedTextColor: string,
 *   outlineButtonStyle: Record<string, any>, primaryButtonStyle: Record<string, any>,
 *   sectionBackground: string, sectionTitleStyle: Record<string, any>, softSurfaceColor: string,
 *   textColor: string }} FicheUi
 */

/** @type {import('react').CSSProperties} */
const BOUTON_LARGE = {
  boxSizing: 'border-box',
  minHeight: 44,
  padding: '12px 16px',
  textAlign: 'center',
  whiteSpace: 'normal',
  width: '100%',
};

/**
 * Le style d'une carte de la fiche.
 * @param {FicheUi} ui - Les couleurs de la fiche.
 * @param {boolean} [accent] - La carte d'action (bord bleu).
 * @returns {import('react').CSSProperties} Le style.
 */
const styleDeCarte = (ui, accent = false) => ({
  background: ui.sectionBackground,
  border: `1px solid ${accent ? ui.accentColor : ui.borderColor}`,
  borderRadius: 24,
  boxSizing: 'border-box',
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 22,
});

/**
 * Le seuil de validation d'une équipe payante (5 par défaut, comme le serveur).
 * @param {any} event - Le tournoi.
 * @returns {number} Le nombre de places payées qui valide l'équipe.
 */
const seuilDeValidation = (event) => {
  const seuil = Math.round(Number(event?.tournamentConfig?.paidMembersToValidate));
  return Number.isFinite(seuil) && seuil > 0 ? seuil : 5;
};

/**
 * « Comment ça marche », en 3 étapes (2 pour un tournoi gratuit).
 * @param {object} props - Les propriétés.
 * @param {any} props.event - Le tournoi.
 * @param {FicheUi} props.ui - Les couleurs de la fiche.
 * @returns {import('react').ReactElement} Le bloc.
 */
export function TournamentHowItWorks({ event, ui }) {
  const { t } = useTranslation();
  const config = event?.tournamentConfig || {};
  const minimum = Math.round(Number(config.minRosterSize));
  const prix = getTournamentEntryFeeLabel(event);
  const etapes = [
    [t('tournamentFicheWeb.how.step1Title'), t('tournamentFicheWeb.how.step1')],
    [
      minimum > 1
        ? t('tournamentFicheWeb.how.step2Title', { count: minimum - 1 })
        : t('tournamentFicheWeb.how.step2TitleFree'),
      t('tournamentFicheWeb.how.step2'),
    ],
    ...(prix ? [[
      t('tournamentFicheWeb.how.step3Title', { price: prix, ...SANS_ECHAPPEMENT }),
      config.jerseySizeRequired === true
        ? t('tournamentFicheWeb.how.step3Jersey', { count: seuilDeValidation(event) })
        : t('tournamentFicheWeb.how.step3', { count: seuilDeValidation(event) }),
    ]] : []),
  ];
  return (
    <section data-testid="tournament-how-it-works" style={styleDeCarte(ui)}>
      <h2 style={ui.sectionTitleStyle}>{t('tournamentFicheWeb.how.title')}</h2>
      <ol style={{
        display: 'grid', gap: 12, margin: 0, paddingLeft: 22,
      }}
      >
        {etapes.map(([titre, detail]) => (
          <li key={titre} style={{ color: ui.textColor, lineHeight: 1.5 }}>
            <span style={{ display: 'block', fontFamily: 'Montserrat-Bold, sans-serif' }}>
              {titre}
            </span>
            <span style={{ color: ui.mutedTextColor }}>{detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * « Avant de t'inscrire » : l'âge, le maillot, la rétractation, le lien des conditions. Rien à
 * dire : rien n'est dessiné.
 * @param {object} props - Les propriétés.
 * @param {any} props.event - Le tournoi.
 * @param {() => void} props.onOpenTerms - Ouvre les conditions d'inscription.
 * @param {FicheUi} props.ui - Les couleurs de la fiche.
 * @param {string} [props.title] - Le titre (« Avant le match » quand on a une équipe).
 * @returns {import('react').ReactElement | null} Le bloc, ou rien.
 */
export function TournamentBeforeSignUp({
  event, onOpenTerms, title, ui,
}) {
  const { t } = useTranslation();
  const minAge = getTournamentMinAge(event);
  const payant = isPaidTournament(event);
  /** @type {string[][]} */
  const lignes = [];
  if (minAge) {
    lignes.push([
      t('tournamentFicheWeb.before.age', { minAge }),
      minAge < 18 ? t('tournamentFicheWeb.before.ageConsent') : '',
    ]);
  }
  if (event?.tournamentConfig?.jerseySizeRequired === true) {
    lignes.push([
      t('tournamentFicheWeb.before.jersey'),
      t('tournamentFicheWeb.before.jerseyDetail'),
    ]);
  }
  if (payant) lignes.push(['', t('tournamentFicheWeb.before.withdrawal')]);
  if (lignes.length === 0 && !payant) return null;
  return (
    <section data-testid="tournament-before-sign-up" style={styleDeCarte(ui)}>
      <h2 style={ui.sectionTitleStyle}>{title || t('tournamentFicheWeb.before.title')}</h2>
      {lignes.map(([gras, reste]) => (
        <p key={`${gras}${reste}`} style={{ color: ui.mutedTextColor, lineHeight: 1.6, margin: 0 }}>
          {gras ? (
            <span style={{ color: ui.textColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>
              {gras}
            </span>
          ) : null}
          {gras && reste ? ' ' : null}
          {reste}
        </p>
      ))}
      {payant ? (
        <button
          data-testid="event-tournament-terms-link"
          onClick={onOpenTerms}
          style={{ ...ui.outlineButtonStyle, justifySelf: 'start', minHeight: 44 }}
          type="button"
        >
          {t('tournamentFicheWeb.before.termsLink')}
        </button>
      ) : null}
    </section>
  );
}

/**
 * La carte « Ton inscription » (écran (a)) : le prix, la règle de validation, « Créer mon équipe »
 * en seul bouton principal ; ou, pour un compte trop jeune, le message sans aucun bouton.
 * @param {object} props - Les propriétés.
 * @param {any} props.event - Le tournoi.
 * @param {FicheUi} props.ui - Les couleurs de la fiche.
 * @param {boolean} [props.tooYoung] - Compte plus jeune que l'âge minimum.
 * @param {boolean} [props.isVisitor] - Lecteur sans compte (R7).
 * @param {boolean} [props.canCreate] - « Créer mon équipe » est permis.
 * @param {boolean} [props.isPending] - Une inscription part.
 * @param {() => void} [props.onCreate] - « Créer mon équipe ».
 * @param {() => void} [props.onLogin] - « J'ai déjà un compte » (visiteur).
 * @param {boolean} [props.canRegisterClubTeam] - « Inscrire une équipe du club » est permis.
 * @param {() => void} [props.onRegisterClubTeam] - « Inscrire une équipe du club ».
 * @param {import('react').ReactNode} [props.children] - Le panneau « Rejoindre une équipe ».
 * @returns {import('react').ReactElement} La carte.
 */
export function TournamentSignUpCard({
  canCreate = false, canRegisterClubTeam = false, children = null, event, isPending = false,
  isVisitor = false, onCreate, onLogin, onRegisterClubTeam, tooYoung = false, ui,
}) {
  const { t } = useTranslation();
  const prix = getTournamentEntryFeeLabel(event);
  if (tooYoung) {
    return (
      <section data-testid="tournament-sign-up-card" role="status" style={styleDeCarte(ui, true)}>
        <span style={{
          color: ui.accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
        }}
        >
          {t('tournamentFicheWeb.signUp.kicker')}
        </span>
        <h2 style={ui.sectionTitleStyle}>
          {t('tournamentFicheWeb.signUp.tooYoungTitle', { minAge: getTournamentMinAge(event) })}
        </h2>
        <p style={{ color: ui.mutedTextColor, lineHeight: 1.5, margin: 0 }}>
          {t('tournamentFicheWeb.signUp.tooYoungText')}
        </p>
      </section>
    );
  }
  const creer = canCreate;
  return (
    <section data-testid="tournament-sign-up-card" style={styleDeCarte(ui, true)}>
      <span style={{
        color: ui.accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}
      >
        {t('tournamentFicheWeb.signUp.kicker')}
      </span>
      <h2 style={ui.sectionTitleStyle}>{t('tournamentFicheWeb.signUp.title')}</h2>
      {prix ? (
        <div style={{
          color: ui.textColor, fontFamily: 'Montserrat-Black, sans-serif', fontSize: 26,
        }}
        >
          {prix}
        </div>
      ) : null}
      {isPaidTournament(event) ? (
        <p style={{ color: ui.mutedTextColor, lineHeight: 1.5, margin: 0 }}>
          {t('tournamentFicheWeb.signUp.rule', { count: seuilDeValidation(event) })}
        </p>
      ) : null}
      {creer ? (
        <button
          data-testid="tournament-create-my-team"
          disabled={isPending}
          onClick={onCreate}
          style={{
            ...ui.primaryButtonStyle,
            ...BOUTON_LARGE,
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.7 : 1,
          }}
          type="button"
        >
          {t('tournamentFicheWeb.signUp.create')}
        </button>
      ) : null}
      {isVisitor ? (
        <button
          onClick={onLogin}
          style={{ ...ui.outlineButtonStyle, ...BOUTON_LARGE }}
          type="button"
        >
          {t('tournamentFicheWeb.signUp.haveAccount')}
        </button>
      ) : null}
      {canRegisterClubTeam ? (
        <button
          disabled={isPending}
          onClick={onRegisterClubTeam}
          style={{
            ...(creer ? ui.outlineButtonStyle : ui.primaryButtonStyle),
            ...BOUTON_LARGE,
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.7 : 1,
          }}
          type="button"
        >
          {t('eventDetails.registerAClubTeam', 'Inscrire une équipe du club')}
        </button>
      ) : null}
      {children}
    </section>
  );
}

/**
 * La place du lecteur dans l'équipe lue (`team.payment.members`, `isSelf`), ou `null`.
 * @param {any} team - L'équipe lue par `useGetTournamentTeam`.
 * @returns {any} La place.
 */
const maPlace = (team) => (Array.isArray(team?.payment?.members) ? team.payment.members : [])
  .find((/** @type {any} */ place) => place?.isSelf) || null;

/**
 * La carte « Mon équipe » (écran (b), R4) : où en est l'équipe (TournamentTeamProgress) et le seul
 * geste du lecteur : payer sa place si elle est due, répondre à son invitation, suivre sa demande,
 * sinon « Voir mon équipe ». L'équipe se lit ici (une requête de plus sur la fiche) ; tant
 * qu'elle charge, ou si la lecture échoue, la carte garde le nom et « Voir mon équipe ».
 * @param {object} props - Les propriétés.
 * @param {any} props.team - L'équipe telle que la fiche la connaît (`tournamentTeams`).
 * @param {'captain' | 'member' | 'invited' | 'requested'} props.role - Le lecteur dans l'équipe.
 * @param {(teamId: string) => void} props.onOpenTeam - Ouvre la page de l'équipe.
 * @param {any} [props.tournamentConfig] - Le réglage du tournoi (si l'équipe lue ne le porte pas).
 * @param {FicheUi} props.ui - Les couleurs de la fiche.
 * @returns {import('react').ReactElement} La carte.
 */
export function TournamentMyTeamCard({
  onOpenTeam, role, team, tournamentConfig = {}, ui,
}) {
  const { t } = useTranslation();
  const { data } = useGetTournamentTeam(team?.documentId || '');
  const lue = data?.data || data || null;
  const equipe = lue?.documentId ? lue : null;
  const place = maPlace(equipe);
  const payer = Boolean(place && place.status !== 'paid' && place.paymentUrl);
  const ouvrir = () => onOpenTeam(team?.documentId);
  let principal = { libelle: t('eventDetails.seeMyTeam', 'Voir mon équipe'), onClick: ouvrir };
  if (role === 'invited') {
    principal = {
      libelle: t('eventDetails.answerMyInvitation', 'Répondre à mon invitation'),
      onClick: ouvrir,
    };
  } else if (role === 'requested') {
    principal = {
      libelle: t('eventDetails.followMyRequest', 'Suivre ma demande'),
      onClick: ouvrir,
    };
  } else if (payer) {
    principal = {
      libelle: t('tournamentTeamDetails.places.payMine', 'Payer ma place'),
      onClick: () => LinksPlatform.openUrl(place.paymentUrl),
    };
  }
  const montreVoir = principal.onClick !== ouvrir;
  return (
    <section data-testid="tournament-my-team-card" style={styleDeCarte(ui, true)}>
      <span style={{
        color: ui.accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}
      >
        {t(`tournamentFicheWeb.myTeam.kicker.${role}`)}
      </span>
      <h2 style={{ ...ui.sectionTitleStyle, overflowWrap: 'anywhere' }}>
        {equipe?.name || team?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi')}
      </h2>
      {equipe ? (
        <TournamentTeamProgress
          members={equipe.members || []}
          payment={equipe.payment || null}
          showTodo
          teamStatus={equipe.status || ''}
          tournamentConfig={equipe.event?.tournamentConfig || tournamentConfig}
        />
      ) : null}
      <button
        data-testid="tournament-my-team-primary"
        onClick={principal.onClick}
        style={{ ...ui.primaryButtonStyle, ...BOUTON_LARGE }}
        type="button"
      >
        {principal.libelle}
      </button>
      {montreVoir ? (
        <button
          onClick={ouvrir}
          style={{ ...ui.outlineButtonStyle, ...BOUTON_LARGE }}
          type="button"
        >
          {t('eventDetails.seeMyTeam', 'Voir mon équipe')}
        </button>
      ) : null}
    </section>
  );
}

/**
 * T-PAGES-3 point 3 — la case « Format » de l'essentiel dit « 24 équipes au plus » ; pour qui
 * n'organise pas le tournoi, ce nombre suit la règle des 30 % (`getTournamentVisitorTeamsLine`,
 * tournamentJoinRules) : le morceau est remplacé par la ligne de la règle, ou retiré.
 * ponytail: reconnaît le morceau à son texte (la brique TournamentEssentials, de T-PAGES-A, n'a
 * pas de propriété pour le changer) ; sortie : une propriété `teamsLine` sur la brique.
 * @param {import('./TournamentEssentials').EssentialItem[]} items - Les cases de la brique.
 * @param {any} event - Le tournoi.
 * @param {string | null} line - La ligne des 30 %, ou `null`.
 * @returns {import('./TournamentEssentials').EssentialItem[]} Les cases.
 */
export const withTournamentTeamsLine = (items, event, line) => {
  const equipes = Math.round(Number(event?.tournamentConfig?.maxTeams));
  if (!(equipes > 0)) return items;
  const auPlus = i18next.t('tournamentEssentials.maxTeams', { count: equipes });
  const remplace = (/** @type {string | null} */ texte) => {
    if (!texte) return texte;
    const morceaux = texte.split(' · ').map((morceau) => (morceau === auPlus ? line : morceau));
    return morceaux.filter(Boolean).join(' · ') || null;
  };
  return items.map((item) => (item.key === 'format'
    ? { ...item, note: remplace(item.note), value: remplace(item.value) || item.value }
    : item));
};
