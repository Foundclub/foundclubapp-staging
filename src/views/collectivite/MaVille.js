import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';
import MaCollectivite from '@/views/collectivite/components/MaCollectivite';
import QuestionVilleCarte from '@/views/collectivite/components/QuestionVilleCarte';

import { RouteNames } from '@/navigation/routeNames';

import {
  useClubQuestions,
  useSubmitClubQuestion,
} from '@/services/collectivite/collectiviteQuestionQueries';
import { useMaCollectivite } from '@/services/collectivite/collectiviteRattachementQueries';
import { useClubCollectiviteFacilities } from '@/services/facility/facilityQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const LONGUEUR_MAX = 1000;

/**
 * L'onglet « Écrire à ma Ville » : le texte, puis les questions du club et où elles en sont.
 * Le texte tapé n'est jamais perdu : il ne se vide qu'après l'accord du serveur.
 * @param {object} props - Les propriétés.
 * @param {string} props.clubId - documentId du club.
 * @returns {import('react').ReactElement} L'onglet.
 */
function OngletEcrire({ clubId }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const questions = useClubQuestions(clubId);
  const envoi = useSubmitClubQuestion(clubId);
  const [texte, setTexte] = useState('');
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));
  const [envoye, setEnvoye] = useState(false);
  const liste = Array.isArray(questions.data?.data) ? questions.data.data : [];

  const envoyer = () => {
    setRefus(null);
    setEnvoye(false);
    envoi.mutate(texte.trim(), {
      onError: (/** @type {any} */ erreur) => setRefus(getErrorMessage(erreur, t)),
      onSuccess: () => {
        setTexte('');
        setEnvoye(true);
      },
    });
  };

  let historique;
  if (questions.isLoading) historique = <Loader />;
  else if (questions.isError) {
    historique = (
      <View style={{ gap: 8 }} testID="ma-ville-erreur">
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('maVille.erreurChargement', 'Tes questions n’ont pas pu être chargées.')}
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
    historique = (
      <EmptyState title={t('maVille.aucuneQuestion', 'Aucune question pour l’instant.')} />
    );
  } else {
    historique = liste.map((/** @type {any} */ question) => (
      <QuestionVilleCarte
        key={question.documentId}
        onPress={() => navigation.navigate(RouteNames.CollectiviteQuestion, {
          questionId: question.documentId,
        })}
        question={question}
        sousTitre={question.author?.name || undefined}
      />
    ));
  }

  return (
    <View style={{ gap: 12 }} testID="ma-ville-ecrire">
      <Input
        label={t('maVille.tonMessage', 'Ta question')}
        maxLength={LONGUEUR_MAX}
        multiline
        onChangeText={(/** @type {string} */ valeur) => {
          setTexte(valeur);
          setEnvoye(false);
        }}
        placeholder={t(
          'maVille.placeholder',
          'Une question, une information, un besoin : écris-le ici.',
        )}
        testID="ma-ville-texte"
        value={texte}
      />
      {refus ? <Text style={[Fonts.p3Bold, Fonts.error500]}>{refus}</Text> : null}
      {envoye ? (
        <Text accessibilityLiveRegion="polite" style={[Fonts.p3Bold, Fonts.success500]}>
          {t('maVille.envoye', 'C’est envoyé. Tu seras prévenu de la réponse.')}
        </Text>
      ) : null}
      <Button
        disabled={!texte.trim() || envoi.isPending}
        onPress={envoyer}
        testID="ma-ville-envoyer"
        title={t('maVille.envoyer', 'Envoyer à ma Ville')}
      />
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00, { marginTop: 8 }]}>
        {t('maVille.mesQuestions', 'Les questions du club')}
      </Text>
      {historique}
    </View>
  );
}

/**
 * L'onglet « Signaler un problème » : choisir l'installation, puis le signalement existant
 * (R17-SIGNALER-1), qui reste le seul formulaire.
 * @param {object} props - Les propriétés.
 * @param {string} props.clubId - documentId du club.
 * @param {string | null} props.ville - Le nom de la Ville.
 * @returns {import('react').ReactElement} L'onglet.
 */
function OngletSignaler({ clubId, ville }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const installations = useClubCollectiviteFacilities(clubId);
  const liste = Array.isArray(installations.data) ? installations.data : [];

  let corps;
  if (installations.isLoading) corps = <Loader />;
  else if (installations.isError) {
    corps = (
      <View style={{ gap: 8 }} testID="ma-ville-erreur">
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('maVille.erreurInstallations', 'Les installations n’ont pas pu être chargées.')}
        </Text>
        <Button
          onPress={() => installations.refetch?.()}
          size="sm"
          title={t('maVille.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (liste.length === 0) {
    corps = (
      <EmptyState
        title={t('maVille.aucuneInstallation', 'Ta Ville n’a pas encore d’installation ici.')}
      />
    );
  } else {
    corps = liste.map((/** @type {any} */ installation) => (
      <TouchableOpacity
        accessibilityRole="button"
        key={installation.documentId}
        onPress={() => navigation.navigate(RouteNames.FacilityReportNew, {
          collectiviteName: installation.collectivite?.name || ville,
          facilityId: installation.documentId,
          facilityName: installation.name,
        })}
        style={{
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.1),
          borderRadius: 16,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 44,
          padding: 14,
        }}
        testID={`ma-ville-installation-${installation.documentId}`}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{installation.name}</Text>
      </TouchableOpacity>
    ));
  }

  return (
    <View style={{ gap: 12 }} testID="ma-ville-signaler">
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t('maVille.choisirInstallation', 'Sur quelle installation ?')}
      </Text>
      {corps}
      <Button
        onPress={() => navigation.navigate(RouteNames.MyFacilityReports)}
        size="sm"
        title={t('facilityReports.membre.mesTitre', 'Mes signalements')}
        variant="Secondary"
      />
    </View>
  );
}

/**
 * T3-TICKETS-VILLE (03/11/2026, fiche 20 option B) — « MA COLLECTIVITÉ », depuis l'accueil du
 * dirigeant. Deux onglets (mot d'Adel) : écrire à sa Ville, signaler un problème sur une
 * installation. Un club sans Ville y retrouve le rattachement existant (`MaCollectivite`).
 * Le dirigeant est tutoyé.
 * Paramètres : `clubId` (par défaut le club du compte), `onglet` (`ecrire` ou `signaler`).
 * @returns {import('react').ReactElement} L'écran.
 */
function MaVille() {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const params = /** @type {any} */ (useRoute().params) || {};
  const { userData } = /** @type {any} */ (useAuth());
  const clubId = params.clubId || userData?.club?.documentId || null;
  const collectivite = useMaCollectivite(clubId);
  const [onglet, setOnglet] = useState(params.onglet === 'signaler' ? 'signaler' : 'ecrire');
  const ville = collectivite.data?.attached?.name || null;

  const ONGLETS = [
    { cle: 'ecrire', titre: t('maVille.ongletEcrire', 'Écrire à ma Ville') },
    { cle: 'signaler', titre: t('maVille.ongletSignaler', 'Signaler un problème') },
  ];

  let corps;
  if (collectivite.isLoading) corps = <Loader />;
  else if (collectivite.isError) {
    corps = (
      <View style={{ gap: 8 }} testID="ma-ville-erreur">
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('maVille.erreurVille', 'Ta collectivité n’a pas pu être chargée.')}
        </Text>
        <Button
          onPress={() => collectivite.refetch?.()}
          size="sm"
          title={t('maVille.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (!ville) {
    corps = <MaCollectivite clubId={String(clubId)} />;
  } else {
    corps = (
      <>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
          {ONGLETS.map(({ cle, titre }) => {
            const actif = onglet === cle;
            return (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: actif }}
                key={cle}
                onPress={() => setOnglet(cle)}
                style={{
                  alignItems: 'center',
                  backgroundColor: actif
                    ? withAlpha(Colors.primary500, 0.16)
                    : withAlpha(Colors.neutral00, 0.04),
                  borderColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.1),
                  borderRadius: 12,
                  borderWidth: 1,
                  flex: 1,
                  justifyContent: 'center',
                  minHeight: 44,
                  padding: 8,
                }}
                testID={`ma-ville-onglet-${cle}`}
              >
                <Text
                  style={[
                    Fonts.p3Bold,
                    actif ? Fonts.primary200 : Fonts.neutral200,
                    { textAlign: 'center' },
                  ]}
                >
                  {titre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {onglet === 'ecrire'
          ? <OngletEcrire clubId={clubId} />
          : <OngletSignaler clubId={clubId} ville={ville} />}
      </>
    );
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 16 }}
        testID="ma-ville"
      >
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('collectivite.home.header', 'Ma collectivité')}
          </Text>
          {ville ? <Text style={[Fonts.p2, Fonts.neutral200]}>{ville}</Text> : null}
        </View>
        {corps}
      </ScrollView>
    </ScreenContainer>
  );
}

export default MaVille;
