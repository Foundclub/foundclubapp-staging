import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * PAR-L5L6 (13/10) — LE CLUB, PUIS L EQUIPE, CHACUN SUR SA LIGNE.
 *
 * 🗣️ Adel, 13/10 vers 01h33, apres la recette de PAR-006 sur iPhone : « on voit bien que les
 * enfants sont dans aucun club ». Ils y etaient : le club n etait ecrit qu en petit au bout de
 * « 11 ans · Senior · FoundClub », sans le mot « club » — et l un des clubs de recette
 * s appelle justement « FoundClub », qu on prend pour la marque.
 * ⇒ Le nom du club a SA ligne, precede du mot « Club » ; l equipe a la sienne.
 * @param {object} props - Les propriétés.
 * @param {string} [props.club] - Le nom du club ; rien = pas de ligne « Club ».
 * @param {string[]} [props.equipes] - Les équipes, sous ce club.
 * @param {string} [props.libelleEquipe] - Remplace « Équipe » (« Équipe demandée »).
 * @param {string} [props.testID] - L étiquette de test.
 * @returns {import('react').ReactElement | null} - Les deux lignes, ou rien.
 */
function ClubEtEquipe({
  club = '', equipes = [], libelleEquipe = '', testID,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const nomDuClub = String(club || '').trim();
  const noms = (Array.isArray(equipes) ? equipes : [])
    .map((nom) => String(nom || '').trim())
    .filter(Boolean);
  if (!nomDuClub && noms.length === 0) return null;

  const etiquette = [Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.4 }];
  const valeur = [Fonts.p2Bold, Fonts.neutral00];

  return (
    <View style={{ gap: 2 }} testID={testID}>
      {nomDuClub ? (
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          <Text style={etiquette}>{t('myChildren.list.clubLabel', 'Club')}</Text>
          {'  '}
          <Text style={valeur}>{nomDuClub}</Text>
        </Text>
      ) : null}
      {noms.length > 0 ? (
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          <Text style={etiquette}>
            {libelleEquipe || t('myChildren.list.teamLabel', { count: noms.length })}
          </Text>
          {'  '}
          <Text style={valeur}>{noms.join(' · ')}</Text>
        </Text>
      ) : null}
    </View>
  );
}

export default ClubEtEquipe;
