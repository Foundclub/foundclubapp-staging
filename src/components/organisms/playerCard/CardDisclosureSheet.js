// @ts-nocheck
/**
 * CardDisclosureSheet — CARTECODE (registre des mineurs ligne 41, « 6- C pour TOUT LE MONDE ») :
 * avant chaque partage de sa carte, chacun voit ce qui part, et ce qui ne part jamais.
 * La liste vient de `buildCardDisclosure` (pure, testée) : elle ne nomme que ce qui est sur
 * la carte.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * La feuille « ce qui part », ouverte avant chaque partage.
 * @param {{
 *   disclosure: { parts: Array<{ key: string, value?: unknown }>, never: string[] },
 *   isBusy?: boolean, isVisible: boolean,
 *   onClose: () => void, onConfirm: () => void, onEdit: () => void,
 * }} props
 * @returns {import('react').ReactElement}
 */
function CardDisclosureSheet({
  disclosure, isBusy = false, isVisible, onClose, onConfirm, onEdit,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  const libelle = ({ key, value }) => ({
    age: t('playerCard.disclosure.age', {
      age: value,
      defaultValue: 'Ton âge ({{age}} ans), jamais ta date',
    }),
    available: t('playerCard.disclosure.available', 'Ton statut : disponible'),
    body: t('playerCard.disclosure.body', 'Ta taille et ton poids'),
    city: t('playerCard.disclosure.city', { city: value, defaultValue: 'Ta ville : {{city}}' }),
    message: t('playerCard.disclosure.message', 'Le message « Voici ma carte FoundClub. »'),
    messageLooking: t(
      'playerCard.disclosure.messageLooking',
      'Le message « Voici ma carte FoundClub. Je cherche un club ! »',
    ),
    name: t('playerCard.disclosure.name', 'Ton prénom et ton nom'),
    photoAndName: t('playerCard.disclosure.photoAndName', 'Ta photo, ton prénom et ton nom'),
    qrNeutral: t(
      'playerCard.disclosure.qrNeutral',
      'Un code QR vers foundclub.app, pas vers ton profil',
    ),
    qrProfile: t('playerCard.disclosure.qrProfile', 'Un code QR vers ton profil'),
    unavailable: t('playerCard.disclosure.unavailable', 'Ton statut : indisponible'),
  }[key]);

  const ligne = (texte, ok, cle) => (
    <View key={cle} style={[Alignments.row, Spaces.gap[8]]}>
      <Icone
        color={ok ? Colors.success500 : Colors.error500}
        height={20}
        name={ok ? 'check' : 'close'}
        width={20}
      />
      <Text style={[Fonts.p2, Fonts.neutral100, styles.etire]}>{texte}</Text>
    </View>
  );

  return (
    <BottomModal close={onClose} isVisible={isVisible}>
      <View style={[Spaces.gap[12], Spaces.paddingTop[8]]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('playerCard.disclosure.title', 'Ce qui part avec ta carte')}
        </Text>
        {disclosure.parts.map((part) => ligne(libelle(part), true, part.key))}
        <Text style={[Fonts.p3Bold, Fonts.neutral200, styles.intertitre]}>
          {t('playerCard.disclosure.neverTitle', 'Ne part jamais')}
        </Text>
        {ligne(
          t('playerCard.disclosure.never', 'Téléphone, e-mail, adresse, date de naissance'),
          false,
          'never',
        )}
        <Button
          disabled={isBusy}
          icon="share"
          iconPosition="after"
          isLoading={isBusy}
          onPress={onConfirm}
          title={t('playerCard.shareShortCta', 'Partager')}
        />
        <Button
          onPress={onEdit}
          title={t('playerCard.disclosure.edit', 'Modifier ma carte')}
          variant="Ghost"
        />
      </View>
    </BottomModal>
  );
}

const styles = StyleSheet.create({
  etire: { flex: 1 },
  intertitre: { letterSpacing: 1.2, textTransform: 'uppercase' },
});

export default CardDisclosureSheet;
