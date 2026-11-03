import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';
import QuestionVilleCarte from '@/views/collectivite/components/QuestionVilleCarte';

import { RouteNames } from '@/navigation/routeNames';

import { useCollectiviteQuestions } from '@/services/collectivite/collectiviteQuestionQueries';

/**
 * T3-TICKETS-VILLE (03/11/2026, fiche 20 option B) — « QUESTIONS DES CLUBS », la boîte de la
 * Ville : les plus récentes d'abord, chacune avec son club et son statut. La Ville est vouvoyée.
 * Paramètre : `collectiviteId`.
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteQuestions() {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const { collectiviteId } = /** @type {any} */ (useRoute().params) || {};
  const questions = useCollectiviteQuestions(collectiviteId);
  const liste = Array.isArray(questions.data?.data) ? questions.data.data : [];

  let corps;
  if (questions.isLoading) corps = <Loader />;
  else if (questions.isError) {
    corps = (
      <View style={{ gap: 8 }} testID="questions-ville-erreur">
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('collectiviteQuestions.erreurChargement', 'Les tickets n’ont pas pu être chargés.')}
        </Text>
        <Button
          onPress={() => questions.refetch?.()}
          size="sm"
          title={t('maVille.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (liste.length === 0) {
    corps = (
      <EmptyState title={t('collectiviteQuestions.vide', 'Aucun club ne vous a encore écrit.')} />
    );
  } else {
    corps = liste.map((/** @type {any} */ question) => (
      <QuestionVilleCarte
        key={question.documentId}
        onPress={() => navigation.navigate(RouteNames.CollectiviteQuestion, {
          questionId: question.documentId,
        })}
        question={question}
        sousTitre={question.club?.name || undefined}
      />
    ));
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 16 }}
        testID="questions-ville"
      >
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('collectiviteQuestions.titre', 'Tickets des clubs')}
        </Text>
        {corps}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteQuestions;
