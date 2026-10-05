import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * ST-RETOURS2 (planche 22) — LA LIGNE SOUS LE NOM D UN ENFANT : « 14 ans · U15 · AS Montrivage ».
 * L age, l equipe, le club ; ce qui manque est saute, sans trou. UNE regle pour les trois
 * endroits ou le parent lit son enfant : « Mes enfants », sa fiche, la page d un moins de 13 ans.
 * @param {any} t - La traduction (TFunction d i18next).
 * @param {object} enfant - Ce qu on sait de l enfant.
 * @param {number | null} [enfant.age] - Son age (calcule par le serveur).
 * @param {string | null} [enfant.clubName] - Son club.
 * @param {string | null} [enfant.teamName] - Son equipe.
 * @param {Array<string | null | undefined>} [enfant.teamNames] - FINITIONS13-STATS (3) : TOUTES
 *   ses equipes, dans l ordre de son profil (« U13 · U15 ») ; a defaut, `teamName`.
 * @param {Array<any>} [enfant.teams] - FINITIONS15 (9d) : ses equipes AVEC leur club
 *   (`myTeams`, `club` peuple) ; chacune se range sous SON club. Prime sur `teamNames`.
 * @returns {string} - La ligne, vide si on ne sait rien.
 */
export const ligneDIdentite = (t, {
  age, clubName, teamName, teamNames, teams,
}) => {
  const lAge = typeof age === 'number'
    ? t('myChildren.screen.years', '{{count}} ans', { count: age })
    : '';
  // 🎨 FINITIONS15 point 9d (T14, S03d) — « 14 ans · U13 · Seniors A · U15 · AS Montrivage » :
  // Seniors A est une equipe d un AUTRE club, la ligne la rangeait sous celui du profil. Chaque
  // equipe va sous SON club (« equipe · club », la grammaire de la planche 22) ; le club de
  // l enfant d abord ; une equipe sans club lu reste sous le sien.
  if (Array.isArray(teams) && teams.length > 0) {
    const principal = String(clubName || '').trim();
    /** @type {Map<string, string[]>} */
    const parClub = new Map(principal ? [[principal, []]] : []);
    teams.forEach((equipe) => {
      const nom = String(equipe?.name || '').trim();
      if (!nom) return;
      const club = String(equipe?.club?.name || '').trim() || principal;
      const liste = parClub.get(club) || [];
      if (!liste.includes(nom)) liste.push(nom);
      parClub.set(club, liste);
    });
    const groupes = [...parClub].filter(([, noms]) => noms.length > 0);
    if (groupes.length > 0) {
      return [lAge, ...groupes.flatMap(([club, noms]) => [...noms, club])]
        .filter(Boolean).join(' · ');
    }
  }
  // FINITIONS13-STATS (3, T13, tranche par le chef « A ») — Hugo joue en U13 ET en U15 : la
  // ligne prenait sa PREMIERE equipe et disait « 14 ans · U13 ». Elle les dit toutes, une fois.
  const equipes = [...new Set((Array.isArray(teamNames) ? teamNames : [])
    .map((nom) => String(nom || '').trim())
    .filter(Boolean))];
  return [
    lAge,
    ...(equipes.length > 0 ? equipes : [teamName]),
    clubName,
  ].filter(Boolean).join(' · ');
};

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
        imageUrl={avatarUrl || undefined}
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
