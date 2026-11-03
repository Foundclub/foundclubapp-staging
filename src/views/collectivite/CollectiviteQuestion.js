import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { reportDayLabel } from '@/domains/facilityReport/facilityReportDisplay';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useCollectiviteQuestion,
  useSetQuestionStatus,
} from '@/services/collectivite/collectiviteQuestionQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const LONGUEUR_MAX_DU_MOT = 500;

/**
 * T3-TICKETS-VILLE (03/11/2026, fiche 20 option B) — UNE QUESTION. Le serveur dit qui peut la
 * traiter (`meta.canManage`) : la Ville y change le statut et peut laisser un mot, le club lit où
 * elle en est. Une fiche refusée se lit comme une fiche introuvable. Paramètre : `questionId`.
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteQuestion() {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const { questionId } = /** @type {any} */ (useRoute().params) || {};
  const fiche = useCollectiviteQuestion(questionId);
  const statut = useSetQuestionStatus(questionId);
  const [mot, setMot] = useState('');
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));
  const question = fiche.data?.data;
  const peutTraiter = fiche.data?.meta?.canManage === true && question?.status !== 'traitee';

  const poser = (/** @type {string} */ status) => {
    setRefus(null);
    statut.mutate({ note: mot.trim(), status }, {
      onError: (/** @type {any} */ erreur) => setRefus(getErrorMessage(erreur)),
      onSuccess: () => setMot(''),
    });
  };

  let corps;
  if (fiche.isLoading) corps = <Loader />;
  else if (!question) {
    corps = (
      <EmptyState
        title={t('APIerrors.COLLECTIVITE_QUESTION_NOT_FOUND', 'Ce ticket est introuvable.')}
      />
    );
  } else {
    corps = (
      <>
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
          {String(t(
            /** @type {string} */ (`collectiviteQuestions.statuts.${question.status}`),
            question.status,
          ))}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {[question.club?.name, question.author?.name, reportDayLabel(question.createdAt)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral00]} testID="question-texte">{question.text}</Text>
        {question.cityNote ? (
          <Text style={[Fonts.p2, Fonts.neutral100]} testID="question-mot">
            {t('collectiviteQuestions.motDeLaVille', {
              ...SANS_ECHAPPEMENT,
              note: question.cityNote,
              ville: question.collectivite?.name || t('facilityReports.membre.laVille', 'La Ville'),
            })}
          </Text>
        ) : null}
        {peutTraiter ? (
          <View style={{ gap: 12 }} testID="question-traiter">
            <Input
              label={t('collectiviteQuestions.votreMot', 'Votre réponse au club (facultatif)')}
              maxLength={LONGUEUR_MAX_DU_MOT}
              multiline
              onChangeText={setMot}
              testID="question-votre-mot"
              value={mot}
            />
            {refus ? <Text style={[Fonts.p3Bold, Fonts.error500]}>{refus}</Text> : null}
            {question.status === 'recue' ? (
              <Button
                disabled={statut.isPending}
                onPress={() => poser('en_cours')}
                title={t('collectiviteQuestions.prendre', 'Passer en cours')}
                variant="Secondary"
              />
            ) : null}
            <Button
              disabled={statut.isPending}
              onPress={() => poser('traitee')}
              title={t('collectiviteQuestions.traiter', 'Marquer comme traité')}
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 16 }}
        testID="question-fiche"
      >
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('collectiviteQuestions.titreFiche', 'Ticket à la Ville')}
        </Text>
        {corps}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteQuestion;
