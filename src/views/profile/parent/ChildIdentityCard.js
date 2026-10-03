import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * ST-RETOURS2 (planche 22) — LA LIGNE SOUS LE NOM D UN ENFANT : « 14 ans · U15 · AS Montrivage ».
 * L age, l equipe, le club ; ce qui manque est saute, sans trou. UNE regle pour les trois
 * endroits ou le parent lit son enfant : « Mes enfants », sa fiche, la page d un moins de 13 ans.
 * @param {(cle: string, repli?: any, options?: any) => string} t - La traduction.
 * @param {object} enfant - Ce qu on sait de l enfant.
 * @param {number | null} [enfant.age] - Son age (calcule par le serveur).
 * @param {string | null} [enfant.clubName] - Son club.
 * @param {string | null} [enfant.teamName] - Son equipe.
 * @returns {string} - La ligne, vide si on ne sait rien.
 */
export const ligneDIdentite = (t, { age, clubName, teamName }) => [
  typeof age === 'number' ? t('myChildren.screen.years', '{{count}} ans', { count: age }) : '',
  teamName,
  clubName,
].filter(Boolean).join(' · ');

/**
 * ST-RETOURS2 (03/10, planche 22 du design valide, etats 2 et 6) — LA CARTE D IDENTITE D UN
 * ENFANT, VUE PAR SON PARENT. Centree, comme la planche : l avatar, le nom, la ligne
 * « 14 ans · U15 · AS Montrivage », et « Mon enfant ».
 *
 * La MEME pour les deux enfants du parent : le compte relie de 13 a 17 ans (sa fiche de
 * profil, `UserDetails`) et la fiche declaree de moins de 13 ans (« Mes enfants »).
 * @param {object} props - Les proprietes.
 * @param {string | null} [props.avatarUrl] - La photo, ou rien (les initiales).
 * @param {import('react').ReactNode} [props.children] - Un badge de plus, sous « Mon enfant ».
 * @param {boolean} [props.enablePreview] - La photo s agrandit d un appui.
 * @param {string} [props.line] - « 14 ans · U15 · AS Montrivage », ou rien.
 * @param {string} props.name - Prenom et nom.
 * @param {string} [props.testID] - L etiquette de test.
 * @returns {import('react').ReactElement} - La carte.
 */
function ChildIdentityCard({
  avatarUrl = null, children = null, enablePreview = false, line = '', name, testID,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();

  return (
    <View
      style={[
        Alignments.alignCenter,
        {
          backgroundColor: withAlpha(Colors.primary700, 0.55),
          borderRadius: 24,
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 20,
        },
      ]}
      testID={testID}
    >
      <ProfileAvatar
        enablePreview={enablePreview}
        imageUrl={avatarUrl}
        name={name}
        size={56}
      />
      <Text numberOfLines={2} style={[Fonts.h4Bold, Fonts.neutral00, { textAlign: 'center' }]}>
        {name}
      </Text>
      {line ? (
        <Text style={[Fonts.p2, Fonts.neutral200, { textAlign: 'center' }]}>{line}</Text>
      ) : null}
      <View
        style={{
          borderColor: Colors.primary500,
          borderRadius: 8,
          borderWidth: 1,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text style={[Fonts.p3, Fonts.primary500]}>{t('stRetours.parent.myChild')}</Text>
      </View>
      {children}
    </View>
  );
}

export default ChildIdentityCard;
