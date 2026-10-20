import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';

import { ecrireModeComplexe } from '@/domains/complexe/modeComplexe';
import {
  dansLeMenuDuSite,
  LARGEUR_DES_MENUS_DU_SITE,
  positionActive,
  positionsDuCompte,
} from '@/domains/complexe/tonMode';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import PlayerModeBanner from '@/components/molecules/playerModeBanner/PlayerModeBanner';
import TonMode from '@/views/complexe/components/TonMode';
import FeuillePratiqueAussi from '@/views/home/FeuillePratiqueAussi';

import { RouteNames } from '@/navigation/routeNames';

import { useMesComplexes } from '@/services/complexe/complexeQueries';

/** Les rôles de compte qui encadrent : leur accueil n'est pas celui d'un joueur. */
const ROLES_QUI_ENCADRENT = Object.freeze(['coach', 'president']);

/**
 * LA BASCULE « MODE COMPLEXE / MODE JOUEUR » EN TÊTE DE L'ACCUEIL — RESA-L5A1 (13/10/2026),
 * planche RB, AT-01 (« bascule ok ») : le bandeau qui existe déjà pour le dirigeant ou le coach
 * qui joue (`PlayerModeBanner`), au même endroit. La bascule change ce qu'on voit, jamais ce qu'on
 * a le droit de faire.
 *   · Sans complexe (ou pendant la lecture) : le bandeau du mode joueur, inchangé.
 *   · En mode joueur ou parent : son retour, inchangé (« Revenir en mode entraîneur »).
 *   · Un dirigeant ou un coach : « Tu joues aussi, et tu gères … » (état 3), ou « Tu gères … ».
 *   · Les autres comptes (un joueur) : « Mode joueur » et « Revenir en mode complexe » (état 2).
 * Monté seulement quand `COMPLEXES_GERANT` est allumé (`HomeHub.js`).
 * RESA-RAT-APP (19/10/2026) : PAR-L12 a donné trois positions au bandeau (rôle du compte, joueur,
 * parent) ; la bascule reçoit et transmet ses propriétés telles quelles.
 *
 * RESA-BASCULE (20/10/2026, planche RB-3 validée par Adel, « parent-gérant A ») — UNE seule
 * bascule, aucun mode perdu : un compte qui gère un complexe et a au moins deux modes lit « Ton
 * mode » (`TonMode`) à la place du duo bascule + bandeau. Joueur, Parent, Dirigeant, Coach changent
 * l'accueil sur place (la page remonte) ; Complexe ouvre son espace. Un compte Parent y trouve
 * l'offre « Tu pratiques aussi un sport ? » et SA feuille (la ligne du complexe en plus ; « Oui »
 * mène à l'accueil joueur, T1 A). Sur le site, à partir de 1 024 px, la bascule d'un dirigeant ou
 * d'un coach est en bas du menu du club : l'accueil ne la répète pas ; un joueur ou un parent la
 * garde en tête, sur une ligne (O2). Sans complexe, et pour un compte à un seul mode (né « pour un
 * complexe », super admin) : rien ne change (le bandeau, ou les états de la planche RB).
 * @param {object} props - Les propriétés du bandeau du mode joueur, et le compte.
 * @param {string} props.accountRoleKey - Le rôle du COMPTE (`getUserRoleKey`).
 * @param {boolean} props.canUseParentMode - PAR-L12 : le mode parent a un sens (des enfants).
 * @param {boolean} props.canUsePlayerMode - Le mode joueur a un sens pour ce compte.
 * @param {string | null} props.compteId - Le documentId du compte (le mode se garde par compte).
 * @param {'player' | 'parent' | null} props.displayMode - Le mode ACTIF (rien = le rôle du compte).
 * @param {(mode: 'player' | 'parent' | null) => void} props.onChange - Le mode choisi.
 * @param {() => void} [props.onMonter] - RESA-BASCULE : la page remonte en haut (planche 5c).
 * @param {() => void} [props.onPasseEnJoueur] - RESA-BASCULE : le compte Parent est passé en
 *   Joueur par la feuille (« Ton compte est passé en Joueur. »).
 * @param {() => void} props.onPratiqueAussi - PAR-L12 : ouvrir la feuille « pratiquer aussi ».
 * @param {string[]} props.prenoms - PAR-L12 : les prénoms de ses enfants.
 * @returns {import('react').ReactElement} Le bandeau.
 */
function BasculeComplexe({
  accountRoleKey, canUseParentMode, canUsePlayerMode, compteId, displayMode, onChange, onMonter,
  onPasseEnJoueur, onPratiqueAussi, prenoms,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const { width } = useWindowDimensions();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const mes = useMesComplexes({ enabled: Boolean(compteId) });
  const complexe = Array.isArray(mes.data) && mes.data.length ? mes.data[0] : null;
  const positions = positionsDuCompte({
    aDesEnfants: canUseParentMode === true,
    aUnComplexe: Boolean(complexe),
    peutJouer: canUsePlayerMode === true,
    roleDuCompte: accountRoleKey,
  });

  if (complexe && positions.length >= 2) {
    const ordinateur = Platform.OS === 'web' && width >= LARGEUR_DES_MENUS_DU_SITE;
    if (dansLeMenuDuSite({
      dansLeComplexe: false, largeur: width, plateforme: Platform.OS, roleDuCompte: accountRoleKey,
    })) {
      return null;
    }
    const estParent = accountRoleKey === 'parent';
    return (
      <>
        <TonMode
          actif={positionActive({
            dansLeComplexe: false, modeAffiche: displayMode, roleDuCompte: accountRoleKey,
          })}
          disposition={ordinateur ? 'ligne' : 'auto'}
          nomDuComplexe={String(complexe.name || '')}
          offre={estParent ? { onPress: () => setFeuilleOuverte(true) } : null}
          onChoisir={(position) => {
            if (position.cle === 'complexe') {
              ecrireModeComplexe(compteId, true);
              navigation.navigate(RouteNames.ComplexeEspace, { complexeId: complexe.documentId });
              return;
            }
            onChange(position.mode);
            onMonter?.();
          }}
          positions={positions}
          prenoms={prenoms}
        />
        {estParent ? (
          <FeuillePratiqueAussi
            gereUnComplexe
            isVisible={feuilleOuverte}
            onClose={() => setFeuilleOuverte(false)}
            onDone={() => {
              setFeuilleOuverte(false);
              onPasseEnJoueur?.();
            }}
            prenoms={prenoms}
          />
        ) : null}
      </>
    );
  }
  const fondActif = {
    backgroundColor: withAlpha(Colors.primary500, 0.15),
    borderColor: Colors.primary500,
  };
  const fondOffre = {
    backgroundColor: 'transparent',
    borderColor: withAlpha(Colors.primary500, 0.33),
  };
  const cadre = [
    ApplicationStyle.borderRadius24,
    ApplicationStyle.borderWidth1,
    Spaces.gap[12],
    Spaces.padding[16],
  ];
  const boutonPlein = ApplicationStyle.backgroundColor.primary500;
  const boutonSombre = ApplicationStyle.backgroundColor.primary700;

  if (!complexe || displayMode) {
    return (
      <PlayerModeBanner
        accountRoleKey={accountRoleKey}
        canUseParentMode={canUseParentMode}
        canUsePlayerMode={canUsePlayerMode}
        displayMode={displayMode}
        onChange={onChange}
        onPratiqueAussi={onPratiqueAussi}
        prenoms={prenoms}
      />
    );
  }

  const nom = String(complexe.name || '');
  const passerEnModeComplexe = () => {
    ecrireModeComplexe(compteId, true);
    navigation.navigate(RouteNames.ComplexeEspace, { complexeId: complexe.documentId });
  };
  const encadre = ROLES_QUI_ENCADRENT.includes(accountRoleKey);

  const bouton = (
    /** @type {string} */ libelle,
    /** @type {() => void} */ onPress,
    /** @type {boolean} */ plein,
    /** @type {string} */ testID,
  ) => (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="button"
      key={testID}
      onPress={onPress}
      style={[
        Alignments.alignCenter,
        ApplicationStyle.borderRadius12,
        Spaces.paddingVertical[12],
        { flexGrow: 1, minHeight: 44 },
        plein ? boutonPlein : boutonSombre,
      ]}
      testID={testID}
    >
      {/* FINITIONS3 (29/09) : la boîte s'étire, sinon Android 16 perd le dernier mot gras. */}
      <Text
        style={[
          Alignments.selfStretch,
          Fonts.p2Bold,
          Fonts.textCenter,
          plein ? Fonts.primary900 : Fonts.neutral00,
        ]}
      >
        {libelle}
      </Text>
    </TouchableOpacity>
  );

  const libelleModeComplexe = t('complexeGerant.bascule.modeComplexe', 'Mode complexe');

  if (!encadre) {
    // État 2 de la planche : l'accueil joueur, et en tête le retour vers le complexe.
    return (
      <View
        style={[cadre, fondActif]}
        testID="complexe-bascule-joueur"
      >
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('complexeGerant.bascule.modeJoueur', 'Mode joueur')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'complexeGerant.bascule.joueurDescription',
              // eslint-disable-next-line max-len
              'Tu vois l\'app comme un joueur. Ton complexe et tes droits de gestionnaire sont intacts.',
            )}
          </Text>
        </View>
        {bouton(
          t('complexeGerant.bascule.revenir', 'Revenir en mode complexe'),
          passerEnModeComplexe,
          true,
          'complexe-bascule-revenir',
        )}
      </View>
    );
  }

  // État 3 de la planche : un dirigeant ou un coach qui gère aussi un complexe.
  return (
    <View
      style={[cadre, fondOffre]}
      testID="complexe-bascule-offre"
    >
      <Text style={[Fonts.p2, Fonts.neutral00]}>
        {canUsePlayerMode
          ? t('complexeGerant.bascule.joueEtGere', 'Tu joues aussi, et tu gères {{nom}}.', {
            nom,
            ...SANS_ECHAPPEMENT,
          })
          : t('complexeGerant.bascule.gere', 'Tu gères {{nom}}.', { nom, ...SANS_ECHAPPEMENT })}
      </Text>
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        {canUsePlayerMode
          ? bouton(
            t('complexeGerant.bascule.modeJoueur', 'Mode joueur'),
            () => onChange('player'),
            false,
            'complexe-bascule-mode-joueur',
          )
          : null}
        {bouton(libelleModeComplexe, passerEnModeComplexe, false, 'complexe-bascule-mode-complexe')}
      </View>
    </View>
  );
}

export default BasculeComplexe;
