import { useTranslation } from 'react-i18next';
import {
  Platform, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';

import { LARGEUR_DES_MENUS_DU_SITE } from '@/domains/complexe/tonMode';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';

import { useTour } from '@/context/useTour';

// BANDEAU-PARENT (10/11/2026) — la largeur des deux positions « Parent | Joueur » (maquette A).
const LARGEUR_DES_POSITIONS = 196;

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
 *
 * BANDEAU-PARENT (10/11/2026, D20, maquette validée par Adel, piste A) — le bandeau DU PARENT
 * devient une ligne de 68 px (108 et 146 avant) : « Ton mode » à gauche, « Parent | Joueur » à
 * droite (le contrôle de « Ton mode », positions de 44 px), un seul toucher, au même endroit
 * dans les deux sens ; en mode joueur la carte se colore. Les prénoms ne s'écrivent plus : le
 * lecteur d'écran les lit sur « Parent ». Le compte Parent lit « Tu pratiques aussi un sport ? »
 * et « Je pratique » sur la même ligne. Sur le site, à partir de 1 024 px, la phrase du mode
 * s'écrit sous « Ton mode ». Le dirigeant et l'entraîneur gardent leur bandeau.
 * 🧪 `__tests__/PlayerModeBanner.BANDEAUPARENT.test.js` ; la hauteur mesurée : `web`,
 * `tests/components/resa-bascule.spec.ts`.
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
  const { width } = useWindowDimensions();

  // BANDEAU-PARENT — les trois états du parent : l'offre du compte Parent, et le compte Joueur né
  // Parent (l'accueil ne lui ouvre la bascule que s'il l'est : `offersParentSwitch`).
  /** @type {'offre' | 'parent' | 'joueur' | null} */
  let etatDuParent = null;
  if (accountRoleKey === 'parent') etatDuParent = 'offre';
  else if (accountRoleKey === 'player' && displayMode === 'parent') etatDuParent = 'parent';
  else if (accountRoleKey === 'player' && canUseParentMode) etatDuParent = 'joueur';

  if (etatDuParent) {
    // Pendant le guide, seul le retour (le mode joueur) reste.
    if (guideEnCours && etatDuParent !== 'joueur') return null;
    const enJoueur = etatDuParent === 'joueur';
    const surLeSite = Platform.OS === 'web';
    const cadre = [
      Alignments.row,
      Alignments.alignCenter,
      {
        borderRadius: 20,
        borderWidth: 1,
        gap: 12,
        // 11 + 44 + 11 + le liseré = 68 px. Sur le site, la rangée des positions a 2 px de marge
        // en haut et en bas (`SegmentedControl`) : le cadre les rend.
        minHeight: 68,
        paddingLeft: 16,
        paddingRight: 12,
        paddingVertical: surLeSite ? 9 : 11,
      },
      enJoueur
        ? { backgroundColor: withAlpha(Colors.primary500, 0.15), borderColor: Colors.primary500 }
        : { backgroundColor: 'transparent', borderColor: withAlpha(Colors.primary500, 0.33) },
    ];

    if (etatDuParent === 'offre') {
      const jePratique = t('playerMode.parentAccount.enter', 'Je pratique');
      return (
        <View style={cadre} testID="parent-mode-home">
          <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
            {t('playerMode.parentAccount.offer', 'Tu pratiques aussi un sport ?')}
          </Text>
          <TouchableOpacity
            accessibilityLabel={jePratique}
            accessibilityRole="button"
            onPress={onPratiqueAussi}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.primary700,
              // FINITIONS3 : un texte gras de deux mots dans une boîte à sa largeur mesurée perd
              // son dernier mot sous Android 16 ; la largeur minimale lui laisse de la marge.
              { minHeight: 44, minWidth: 120, paddingHorizontal: 14 },
            ]}
            testID="player-mode-enter"
          >
            <Text style={[Alignments.selfStretch, Fonts.p2Bold, Fonts.textCenter, Fonts.neutral00]}>
              {jePratique}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const libelleParent = t('tonMode.positions.parent', 'Parent');
    const libelleJoueur = t('tonMode.positions.joueur', 'Joueur');
    const rang = (/** @type {number} */ n) => t('tonMode.position', { rang: n, total: 2 });
    const attente = enJoueur ? `. ${quiTAttend(t, prenoms)}` : '';
    const options = [
      {
        // En mode joueur, qui attend dans le mode parent : lu, plus écrit.
        accessibilityLabel: `${libelleParent}, ${rang(1)}${attente}`,
        label: libelleParent,
        value: 'parent',
      },
      { accessibilityLabel: `${libelleJoueur}, ${rang(2)}`, label: libelleJoueur, value: 'joueur' },
    ];
    const choisir = (/** @type {string} */ valeur) => {
      if (valeur === (enJoueur ? 'joueur' : 'parent')) return;
      onChange(valeur === 'parent' ? 'parent' : null);
    };
    return (
      <View style={cadre} testID={enJoueur ? 'player-mode-active' : 'parent-mode-home'}>
        <View style={[Spaces.gap[4], { flex: 1 }]}>
          <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.6 }]}>
            {t('tonMode.titre', 'Ton mode').toUpperCase()}
          </Text>
          {surLeSite && width >= LARGEUR_DES_MENUS_DU_SITE ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {enJoueur
                ? t('playerMode.player.description', 'Tu vois l’app comme un joueur.')
                : t('tonMode.phrase.parent', 'Tu vois l’app comme un parent.')}
            </Text>
          ) : null}
        </View>
        <View
          accessibilityLabel={t('tonMode.titre', 'Ton mode')}
          accessibilityRole="radiogroup"
          style={{ width: LARGEUR_DES_POSITIONS }}
        >
          <SegmentedControl
            centerContent
            fitLabels
            grand
            onChange={choisir}
            options={options}
            radio
            value={enJoueur ? 'joueur' : 'parent'}
          />
        </View>
      </View>
    );
  }

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
          onPress={() => onChange(action.mode === undefined ? null : action.mode)}
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
