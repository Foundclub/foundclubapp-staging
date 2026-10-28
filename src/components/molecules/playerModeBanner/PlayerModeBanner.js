import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { useTour } from '@/context/useTour';

/** @typedef {'player' | 'parent' | null} DisplayMode */

/**
 * @typedef {object} PlayerModeBannerProps
 * @property {string} accountRoleKey - Le rôle du COMPTE (president / coach / player / parent…).
 * @property {boolean} canUsePlayerMode - Le mode joueur a un sens pour ce compte.
 * @property {boolean} canUseParentMode - PAR-L12 : le mode parent a un sens (un rôle sportif
 *   qui a des enfants).
 * @property {DisplayMode} displayMode - Le mode ACTIF (rien = le rôle du compte).
 * @property {(mode: DisplayMode) => void} onChange - Le mode choisi (rien = le rôle du compte).
 * @property {() => void} onPratiqueAussi - PAR-L12 : le compte Parent veut pratiquer (la
 *   feuille « Tu pratiques aussi un sport ? »).
 * @property {string[]} prenoms - PAR-L12 : les prénoms de ses enfants (« Anissa et Martin »).
 */

/**
 * @typedef {{
 *   actif: boolean,
 *   testID: string,
 *   titre?: string,
 *   lignes: string[],
 *   actions: ActionDuBandeau[],
 * }} EtatDuBandeau
 */

/**
 * @typedef {{
 *   cle: string,
 *   libelle: string,
 *   mode?: DisplayMode,
 *   plein?: boolean,
 *   testID: string,
 *   pratiqueAussi?: boolean,
 * }} ActionDuBandeau
 */

/**
 * Qui attend dans le mode parent : « Anissa », « Anissa et Martin », sinon « Tes enfants ».
 * RESA-BASCULE (20/10/2026) : exportée, la bascule « Ton mode » dit la même phrase.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @param {string[]} prenoms - Les prénoms lus.
 * @returns {string} - La phrase.
 */
export const quiTAttend = (t, prenoms) => {
  const noms = (Array.isArray(prenoms) ? prenoms : []).filter(Boolean);
  if (noms.length < 1 || noms.length > 2) {
    return t('playerMode.parent.waitingAll', 'Tes enfants t’attendent dans le mode parent.');
  }
  return t('playerMode.parent.waiting', {
    count: noms.length,
    prenoms: noms.join(` ${t('playerMode.parent.and', 'et')} `),
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * LOT RÔLES (demande d'Adel du 2026-09-28) — le bandeau du MODE JOUEUR, en
 * tête de l'accueil. Deux états, et jamais les deux à la fois :
 *   · l'OFFRE, pour un dirigeant ou un entraîneur qui joue dans une équipe ;
 *   · le RETOUR, quand le mode est actif — « l'option de revenir en arrière »,
 *     visible et en un seul geste.
 * Le mode est un affichage : ce bandeau ne touche aucun droit.
 *
 * PAR-L12 (13/10, design parent §2 bis / E25, décision D6 A d'Adel du 12/10) — TROIS
 * positions : le rôle du compte, le mode joueur, le MODE PARENT. Il s'affiche pour TOUT parent :
 *   · compte Parent : « Tu pratiques aussi un sport ? » → la feuille (son compte passe en Joueur) ;
 *   · joueur qui a des enfants : « Mode joueur… Anissa et Martin t'attendent » ↔ « Tu joues aussi
 *     dans une équipe. » (mode parent), la bascule en un geste ;
 *   · dirigeant ou entraîneur qui a des enfants : « Mode joueur » (s'il joue) et « Mode parent »,
 *     puis « Revenir en mode dirigeant » depuis l'un ou l'autre.
 * Un compte sans enfant n'a aucune bascule « parent ».
 * @param {PlayerModeBannerProps} props - Les propriétés.
 * @returns {import('react').ReactElement | null} Le bandeau, ou rien.
 */
function PlayerModeBanner(props) {
  const {
    accountRoleKey, canUseParentMode, canUsePlayerMode, displayMode, onChange, onPratiqueAussi,
    prenoms,
  } = props;
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const tour = useTour();
  // GUIDE-BONUS (L5) : pendant le guide, aucune bascule proposée (un double toucher
  // y faisait passer en mode joueur, audit 50-51) ; le retour reste.
  const guideEnCours = Boolean(tour.isGuide && tour.isTourActive && tour.tourStatus === 'active');

  const estStaff = accountRoleKey === 'president' || accountRoleKey === 'coach';
  const staffLabel = accountRoleKey === 'coach'
    ? t('playerMode.staff.coach', 'entraîneur')
    : t('playerMode.staff.president', 'dirigeant');
  // RESA-FIN-APP (20/10) — « Tes droits d’entraîneur », « de dirigeant » (tournée 2 : « de
  // entraîneur »). L'anglais garde `{{staff}}`.
  const staffDe = accountRoleKey === 'coach'
    ? t('playerMode.staffDe.coach', 'd’entraîneur')
    : t('playerMode.staffDe.president', 'de dirigeant');
  const revenirAuStaff = t('playerMode.active.exit', 'Revenir en mode {{staff}}', {
    staff: staffLabel,
    ...SANS_ECHAPPEMENT,
  });
  const basculerEnJoueur = t('playerMode.player.enter', 'Basculer en mode joueur');

  /** @type {EtatDuBandeau | null} */
  let etat = null;
  if (estStaff && displayMode === 'player') {
    etat = {
      actif: true,
      actions: [{
        cle: 'sortir', libelle: revenirAuStaff, mode: null, plein: true, testID: 'player-mode-exit',
      }],
      lignes: [t(
        'playerMode.active.description',
        'Tu vois l\'app comme un joueur de ton équipe. Tes droits {{staffDe}} sont intacts.',
        { staff: staffLabel, staffDe, ...SANS_ECHAPPEMENT },
      )],
      testID: 'player-mode-active',
      titre: t('playerMode.active.title', 'Mode joueur'),
    };
  } else if (estStaff && displayMode === 'parent') {
    etat = {
      actif: true,
      actions: [{
        cle: 'sortir', libelle: revenirAuStaff, mode: null, plein: true, testID: 'parent-mode-exit',
      }],
      lignes: [t('playerMode.parent.description', {
        staff: staffLabel, staffDe, ...SANS_ECHAPPEMENT,
      })],
      testID: 'parent-mode-active',
      titre: t('playerMode.parent.title', 'Mode parent'),
    };
  } else if (accountRoleKey === 'parent') {
    etat = {
      actif: false,
      actions: [{
        cle: 'pratiquer',
        libelle: basculerEnJoueur,
        pratiqueAussi: true,
        testID: 'player-mode-enter',
      }],
      lignes: [t('playerMode.parentAccount.offer', 'Tu pratiques aussi un sport ?')],
      testID: 'parent-mode-home',
    };
  } else if (accountRoleKey === 'player' && displayMode === 'parent') {
    etat = {
      actif: false,
      actions: [{
        cle: 'joueur', libelle: basculerEnJoueur, mode: null, testID: 'player-mode-enter',
      }],
      lignes: [t('playerMode.offer.description', 'Tu joues aussi dans une équipe.')],
      testID: 'parent-mode-home',
    };
  } else if (accountRoleKey === 'player' && canUseParentMode) {
    etat = {
      actif: true,
      actions: [{
        cle: 'parent',
        libelle: t('playerMode.parent.back', 'Revenir en mode parent'),
        mode: 'parent',
        plein: true,
        testID: 'parent-mode-enter',
      }],
      lignes: [`${t('playerMode.player.description', 'Tu vois l’app comme un joueur.')} ${
        quiTAttend(t, prenoms)}`],
      testID: 'player-mode-active',
      titre: t('playerMode.active.title', 'Mode joueur'),
    };
  } else if (estStaff && canUsePlayerMode && canUseParentMode) {
    etat = {
      actif: false,
      actions: [
        {
          cle: 'joueur',
          libelle: t('playerMode.choice.player', 'Mode joueur'),
          mode: 'player',
          testID: 'player-mode-enter',
        },
        {
          cle: 'parent',
          libelle: t('playerMode.choice.parent', 'Mode parent'),
          mode: 'parent',
          testID: 'parent-mode-enter',
        },
      ],
      lignes: [
        t('playerMode.offer.description', 'Tu joues aussi dans une équipe.'),
        quiTAttend(t, prenoms),
      ],
      testID: 'player-mode-offer',
    };
  } else if (estStaff && canUsePlayerMode) {
    etat = {
      actif: false,
      actions: [{
        cle: 'joueur',
        libelle: t('playerMode.offer.enter', 'Voir l\'app en joueur'),
        mode: 'player',
        testID: 'player-mode-enter',
      }],
      lignes: [t('playerMode.offer.description', 'Tu joues aussi dans une équipe.')],
      testID: 'player-mode-offer',
    };
  } else if (estStaff && canUseParentMode) {
    etat = {
      actif: false,
      actions: [{
        cle: 'parent',
        libelle: t('playerMode.parent.enter', 'Basculer en mode parent'),
        mode: 'parent',
        testID: 'parent-mode-enter',
      }],
      lignes: [quiTAttend(t, prenoms)],
      testID: 'parent-mode-offer',
    };
  }

  if (!etat || (guideEnCours && !etat.actif)) return null;

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.borderWidth1,
        Spaces.gap[12],
        Spaces.padding[16],
        {
          backgroundColor: etat.actif ? `${Colors.primary500}26` : 'transparent',
          borderColor: etat.actif ? Colors.primary500 : `${Colors.primary500}55`,
        },
      ]}
      testID={etat.testID}
    >
      {etat.titre ? (
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{etat.titre}</Text>
          {etat.lignes.map((ligne) => (
            <Text key={ligne} style={[Fonts.p3, Fonts.neutral200]}>{ligne}</Text>
          ))}
        </View>
      ) : etat.lignes.map((ligne) => (
        <Text key={ligne} style={[Fonts.p2, Fonts.neutral00]}>{ligne}</Text>
      ))}
      {etat.actions.map((action) => (
        <TouchableOpacity
          accessibilityLabel={action.libelle}
          accessibilityRole="button"
          key={action.cle}
          onPress={() => (action.pratiqueAussi
            ? onPratiqueAussi()
            : onChange(action.mode === undefined ? null : action.mode))}
          style={[
            Alignments.alignCenter,
            ApplicationStyle.borderRadius12,
            Spaces.paddingVertical[12],
            action.plein
              ? ApplicationStyle.backgroundColor.primary500
              : ApplicationStyle.backgroundColor.primary700,
          ]}
          testID={action.testID}
        >
          {/* FINITIONS3 (29/09) : « Voir l'app en » — sous Android 16, un texte gras de
              plusieurs mots dans une boite a sa largeur MESUREE perd son dernier mot. La
              boite s etire sur tout le bouton, le texte y est centre (parade du bouton
              partage, FINITIONS du 28/09). */}
          <Text
            style={[
              Alignments.selfStretch,
              Fonts.p2Bold,
              Fonts.textCenter,
              action.plein ? Fonts.primary900 : Fonts.neutral00,
            ]}
          >
            {action.libelle}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default PlayerModeBanner;
