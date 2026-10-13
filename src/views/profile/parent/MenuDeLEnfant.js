import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { parentalPowerForAge } from '@/constants/parentalDeclaration';

/**
 * Une rangée du menu : une icône, un libellé, 52 px de haut (zone de toucher ≥ 44).
 * @param {object} props - Les propriétés.
 * @param {boolean} [props.danger] - En rouge (« Supprimer la fiche »).
 * @param {string} props.icone - Le nom de l icône (`SvgIcon`).
 * @param {string} props.libelle - Ce que fait la rangée.
 * @param {() => void} props.onPress - Le geste.
 * @param {string} props.testID - L étiquette de test.
 * @returns {import('react').ReactElement} - La rangée.
 */
function Rangee({
  danger = false, icone, libelle, onPress, testID,
}) {
  const { Colors, Fonts } = useTheme();
  const encre = danger ? Colors.error300 : Colors.neutral00;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        borderTopColor: withAlpha(Colors.primary500, 0.18),
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 12,
        minHeight: 52,
      }}
      testID={testID}
    >
      <Icone
        color={danger ? Colors.error300 : Colors.primary200}
        height={20}
        name={icone}
        width={20}
      />
      <Text style={[Fonts.p1, { color: encre, flexGrow: 1, flexShrink: 1 }]}>{libelle}</Text>
    </TouchableOpacity>
  );
}

/**
 * PAR-L5L6 (13/10, design parent E05, planche 2) — LE MENU « … » D UN ENFANT DÉCLARÉ.
 *
 * Une feuille, pas une alerte système : sur le site, `Alert` devient `window.confirm`, qui ne
 * porte que deux choix — le menu en a trois. « Voir sa fiche » (moins de 13 ans : la seule
 * tranche qui a une page), « Modifier sa fiche », « Supprimer la fiche » (en rouge, elle ouvre
 * la confirmation qui existait déjà).
 *
 * La feuille se FERME avant le geste : la confirmation de suppression ne s ouvre pas par-dessus.
 * @param {object} props - Les propriétés.
 * @param {any | null} props.enfant - La fiche dont on ouvre le menu ; rien = fermé.
 * @param {() => void} props.onClose - Ferme la feuille.
 * @param {(enfant: any) => void} props.onDelete - « Supprimer la fiche ».
 * @param {(enfant: any) => void} props.onEdit - « Modifier sa fiche ».
 * @param {(enfant: any) => void} props.onOpen - « Voir sa fiche ».
 * @returns {import('react').ReactElement} - La feuille.
 */
function MenuDeLEnfant({
  enfant, onClose, onDelete, onEdit, onOpen,
}) {
  const { t } = useTranslation();
  const { Alignments, Fonts } = useTheme();
  const prenom = enfant?.firstname || '';
  const nomComplet = `${prenom} ${enfant?.lastname || ''}`.trim();
  const age = typeof enfant?.age === 'number'
    ? t('myChildren.screen.years', '{{count}} ans', { count: enfant.age })
    : '';
  const aSaPage = parentalPowerForAge(enfant?.age) === 'full';

  /**
   * Ferme la feuille, PUIS fait le geste sur l enfant qu elle montrait.
   * @param {(enfant: any) => void} geste - Le geste.
   * @returns {() => void} - Le gestionnaire d appui.
   */
  const choisir = (geste) => () => {
    const vise = enfant;
    onClose();
    geste(vise);
  };

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <Button onPress={onClose} title={t('common.close', 'Fermer')} variant="Ghost" />
      )}
      isVisible={Boolean(enfant)}
    >
      <View style={{ gap: 4 }} testID="child-menu">
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12, paddingBottom: 12 }]}>
          <ProfileAvatar
            enablePreview={false}
            imageUrl={enfant?.photo?.url}
            name={nomComplet}
            size={40}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={2} style={[Fonts.h4Bold, Fonts.neutral00]}>{nomComplet}</Text>
            {age ? <Text style={[Fonts.p3, Fonts.neutral200]}>{age}</Text> : null}
          </View>
        </View>
        {aSaPage ? (
          <Rangee
            icone="arrow-right"
            libelle={t('myChildren.declared.open', 'Voir sa fiche')}
            onPress={choisir(onOpen)}
            testID="child-menu-open"
          />
        ) : null}
        <Rangee
          icone="edit"
          libelle={t('myChildren.menu.edit')}
          onPress={choisir(onEdit)}
          testID="child-menu-edit"
        />
        <Rangee
          danger
          icone="trash"
          libelle={t('myChildren.menu.delete')}
          onPress={choisir(onDelete)}
          testID="child-menu-delete"
        />
      </View>
    </BottomModal>
  );
}

export default MenuDeLEnfant;
