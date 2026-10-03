import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { feedbackCardStyle } from '@/views/profile/coachFeedback/CoachFeedbackList';
import ChildIdentityCard, { ligneDIdentite } from '@/views/profile/parent/ChildIdentityCard';

import { parentalPowerForAge } from '@/constants/parentalDeclaration';

/**
 * ST-RETOURS2 (03/10, planche 22 du design valide, etat 6) — LA PAGE D UN ENFANT DE MOINS DE
 * 13 ANS, vue par son parent.
 *
 * Lea n a pas de compte : une fiche que son parent a declaree. Donc ni questionnaire, ni stats,
 * ni retours de match — et la page le DIT simplement, avec quand ils arriveront. Elle garde le
 * seul geste que le parent fait encore pour elle a cet age : lui chercher un club (E17).
 *
 * 🔒 Rien de plus que la fiche deja lue par « Mes enfants » : prenom, nom, age (calcule par le
 * serveur, jamais la date), equipe, club.
 * @param {object} props - Les proprietes.
 * @param {any} props.enfant - La fiche (`GET` des enfants declares).
 * @param {(enfant: any) => void} props.onSearchClub - « Chercher un club pour Lea ».
 * @returns {import('react').ReactElement} - La page.
 */
function DeclaredChildPage({ enfant, onSearchClub }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts,
  } = useTheme();

  const prenom = enfant?.firstname || '';
  const nomComplet = `${prenom} ${enfant?.lastname || ''}`.trim();
  const ligne = ligneDIdentite(t, {
    age: enfant?.age,
    clubName: enfant?.club?.name,
    teamName: enfant?.team?.name || t('myChildren.screen.noTeam', 'Pas encore d’équipe'),
  });
  const moinsDe13Ans = parentalPowerForAge(enfant?.age) === 'full';

  return (
    <View style={{ gap: 16 }}>
      <View style={[Alignments.alignCenter, { gap: 8 }]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00, { letterSpacing: 1 }]}>
          {prenom.toUpperCase()}
        </Text>
        <View style={{ backgroundColor: Colors.neutral00, height: 2, width: 80 }} />
      </View>

      <ChildIdentityCard
        avatarUrl={enfant?.photo?.url}
        line={ligne}
        name={nomComplet}
        testID="declared-child-identity"
      />

      {moinsDe13Ans ? (
        <>
          <View style={feedbackCardStyle(Colors, false)}>
            <Text
              style={[
                Fonts.p3Bold,
                Fonts.primary200,
                { letterSpacing: 0.4, textTransform: 'uppercase' },
              ]}
            >
              {t('stRetours.parent.under13Title')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('stRetours.parent.under13Hint', { firstname: prenom, ...SANS_ECHAPPEMENT })}
            </Text>
          </View>
          <Button
            onPress={() => onSearchClub(enfant)}
            title={t(
              'myChildren.actions.searchClub',
              'Chercher un club pour {{firstname}}',
              { firstname: prenom, ...SANS_ECHAPPEMENT },
            )}
          />
        </>
      ) : null}
    </View>
  );
}

export default DeclaredChildPage;
