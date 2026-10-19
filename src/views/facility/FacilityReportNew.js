import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  canAttachReportPhoto,
  REPORT_CATEGORIES,
  REPORT_PHOTO_MAX_BYTES,
} from '@/domains/facilityReport/facilityReportDisplay';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useOpenFacilityReports,
  useSubmitFacilityReport,
} from '@/services/facilityReport/facilityReportQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

import MediaPlatform from '@/platform/media';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — SIGNALER UN PROBLEME sur une installation de la Ville, cote
 * membre (planches P10-signaler-tel 2 a 4 et 6, P11-mineur-photo-tel, validees par Adel le 19/10).
 * Un seul ecran : « deja signale » d abord s il y a des signalements ouverts (sans auteur, Q2 A),
 * puis la categorie, le texte, la photo SEULEMENT a partir de 15 ans (Q7 B ; le serveur la refuse
 * de toute facon en dessous), la phrase « La Ville verra ton rôle et ton club, pas ton nom », et
 * « Merci, c'est envoyé ». Le texte tape n est jamais perdu. Les membres sont tutoyes.
 * Parametres : `facilityId`, `facilityName`, `eventId` (depuis une seance), `collectiviteName`.
 * @returns {import('react').ReactElement} L ecran.
 */
function FacilityReportNew() {
  const { t } = useTranslation();
  const { Colors, Fonts, Images } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const params = /** @type {any} */ (useRoute().params) || {};
  const facilityId = params.facilityId || null;
  const { userData } = /** @type {any} */ (useAuth());
  const ouverts = useOpenFacilityReports(facilityId);
  const envoi = useSubmitFacilityReport();
  const [autreChose, setAutreChose] = useState(false);
  const [categorie, setCategorie] = useState(/** @type {string | null} */ (null));
  const [texte, setTexte] = useState('');
  const [photo, setPhoto] = useState(/** @type {any} */ (null));
  const [erreurs, setErreurs] = useState(/** @type {Record<string, string>} */ ({}));
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));
  const [envoye, setEnvoye] = useState(false);
  const photoPermise = canAttachReportPhoto(userData?.birthdate);
  const ville = params.collectiviteName || null;

  const entete = (
    <View style={{ gap: 2 }}>
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>{params.facilityName || ''}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {ville
          ? t('facilityReports.membre.envoyeA', { ville })
          : t('facilityReports.membre.envoyeALaVille', 'Envoyé à la Ville')}
      </Text>
    </View>
  );

  if (ouverts.isLoading) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <Loader testID="signaler-chargement" />
      </ScreenContainer>
    );
  }
  const statutDuRefus = Number(/** @type {any} */ (ouverts.error)?.response?.status);
  if (ouverts.isError && (statutDuRefus === 403 || statutDuRefus === 404)) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <View style={{ gap: 12, paddingTop: 24 }} testID="signaler-refus-membre">
          {entete}
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'facilityReports.membre.erreurs.pasMembre',
              'Seuls les membres des clubs qui utilisent cette installation peuvent la signaler.',
            )}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (envoye) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <View
          style={{
            alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center',
          }}
          testID="signaler-merci"
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: withAlpha(Colors.success500, 0.16),
              borderRadius: 32,
              height: 64,
              justifyContent: 'center',
              width: 64,
            }}
          >
            <Image
              accessibilityIgnoresInvertColors
              source={Images.check}
              style={{ height: 28, width: 28 }}
              tintColor={Colors.success500}
            />
          </View>
          <Text
            accessibilityRole="header"
            style={[Fonts.h4Bold, Fonts.neutral00, { textAlign: 'center' }]}
          >
            {t('facilityReports.membre.merciTitre', 'Merci, c’est envoyé')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, { maxWidth: 320, textAlign: 'center' }]}>
            {t('facilityReports.membre.merciTexte', {
              ville: ville || t('facilityReports.membre.laVille', 'La Ville'),
            })}
          </Text>
          <Button
            onPress={() => navigation.navigate(RouteNames.MyFacilityReports)}
            testID="signaler-voir-mes"
            title={t('facilityReports.membre.voirMes', 'Voir mes signalements')}
            variant="Secondary"
          />
          <Button
            onPress={() => navigation.goBack?.()}
            title={t('facilityReports.membre.retour', 'Revenir')}
            variant="Ghost"
          />
        </View>
      </ScreenContainer>
    );
  }

  const deja = Array.isArray(ouverts.data?.data) ? ouverts.data.data : [];
  if (deja.length && !autreChose) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <ScrollView
          contentContainerStyle={{ gap: 14, paddingBottom: 24, paddingTop: 16 }}
          testID="signaler-deja"
        >
          {entete}
          {deja.map((report, rang) => (
            <View
              key={report.documentId}
              style={{
                backgroundColor: withAlpha(Colors.primary500, 0.08),
                borderColor: withAlpha(Colors.primary500, rang === 0 ? 0.45 : 0.18),
                borderRadius: 14,
                borderWidth: 1,
                gap: 4,
                padding: 12,
              }}
              testID={`signaler-deja-${report.documentId}`}
            >
              {rang === 0 ? (
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('facilityReports.membre.dejaTitre', 'Déjà signalé à la Ville')}
                </Text>
              ) : null}
              <Text style={[Fonts.p3, Fonts.neutral100]}>
                {t('facilityReports.membre.dejaLigne', {
                  category: t(
                    `facilityReports.categoriesCourtes.${report.category}`,
                    report.category,
                  ),
                  status: t(`facilityReports.statutsAuteur.${report.status}`, report.status),
                  title: report.title,
                })}
              </Text>
            </View>
          ))}
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('facilityReports.membre.different', 'Ton problème est différent ?')}
          </Text>
          <Button
            onPress={() => setAutreChose(true)}
            testID="signaler-autre-chose"
            title={t('facilityReports.membre.autreChose', 'Signaler autre chose')}
            variant="Secondary"
          />
        </ScrollView>
      </ScreenContainer>
    );
  }

  const choisirPhoto = async () => {
    setErreurs((avant) => ({ ...avant, photo: '' }));
    const choisi = await MediaPlatform.pickImage();
    if (!choisi || choisi?.didCancel) return;
    const premier = choisi?.assets?.[0] || choisi;
    const taille = Number(premier?.fileSize ?? premier?.size ?? 0);
    if (taille > REPORT_PHOTO_MAX_BYTES) {
      setErreurs((avant) => ({
        ...avant,
        photo: t(
          'facilityReports.membre.erreurs.photoLourde',
          'La photo dépasse 15 Mo. Choisis-en une autre, ou envoie sans photo.',
        ),
      }));
      return;
    }
    setPhoto(choisi);
  };

  const envoyer = async () => {
    /** @type {Record<string, string>} */
    const manque = {};
    if (!categorie) {
      manque.categorie = t(
        'facilityReports.membre.erreurs.categorie',
        'Choisis le type de problème.',
      );
    }
    if (!texte.trim()) {
      manque.texte = t('facilityReports.membre.erreurs.texte', 'Décris le problème.');
    }
    setErreurs(manque);
    setRefus(null);
    if (Object.keys(manque).length) return;
    try {
      await envoi.mutateAsync({
        category: categorie,
        description: texte.trim(),
        event: params.eventId || null,
        facilityId,
        photo: photoPermise ? photo : null,
      });
      setEnvoye(true);
    } catch (erreur) {
      const code = /** @type {any} */ (erreur)?.response?.data?.error?.details?.code;
      setRefus(code ? getErrorMessage(/** @type {any} */ (erreur)) : 'reseau');
    }
  };

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen" keyboardAvoiding>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 24, paddingTop: 16 }}
        testID="signaler-formulaire"
      >
        {entete}
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('facilityReports.membre.quelProbleme', 'Quel problème ?')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {REPORT_CATEGORIES.map((cle) => {
              const actif = categorie === cle;
              return (
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ checked: actif }}
                  key={cle}
                  onPress={() => setCategorie(cle)}
                  style={{
                    backgroundColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.04),
                    borderColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.18),
                    borderRadius: 999,
                    borderWidth: 1,
                    justifyContent: 'center',
                    minHeight: 44,
                    paddingHorizontal: 14,
                  }}
                  testID={`signaler-categorie-${cle}`}
                >
                  <Text style={[Fonts.p3Bold, actif ? Fonts.primary900 : Fonts.neutral00]}>
                    {t(`facilityReports.categories.${cle}`, cle)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {erreurs.categorie ? (
            <Text style={[Fonts.p3Bold, Fonts.error500]}>{erreurs.categorie}</Text>
          ) : null}
        </View>
        <Input
          label={t('facilityReports.membre.disNous', 'Dis-nous en plus')}
          maxLength={1000}
          multiline
          onChangeText={setTexte}
          placeholder={t(
            'facilityReports.membre.disNousPlaceholder',
            'Ce que tu as vu, et où exactement.',
          )}
          testID="signaler-texte"
          value={texte}
        />
        {erreurs.texte ? <Text style={[Fonts.p3Bold, Fonts.error500]}>{erreurs.texte}</Text> : null}

        {photoPermise ? (
          <View style={{ gap: 6 }} testID="signaler-photo-bloc">
            {photo ? (
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  justifyContent: 'space-between',
                }}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('facilityReports.membre.photoChoisie', 'Photo jointe')}
                </Text>
                <Button
                  onPress={() => setPhoto(null)}
                  size="sm"
                  title={t('facilityReports.membre.retirerPhoto', 'Retirer la photo')}
                  variant="Ghost"
                />
              </View>
            ) : (
              <Button
                icon="camera"
                iconPosition="before"
                onPress={choisirPhoto}
                testID="signaler-photo"
                title={t('facilityReports.membre.ajouterPhoto', 'Ajouter une photo (facultatif)')}
                variant="Secondary"
              />
            )}
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {t(
                'facilityReports.membre.consignePhoto',
                'Photographie le problème, jamais une personne. Pas de photo dans les vestiaires.',
              )}
            </Text>
            {erreurs.photo ? (
              <Text style={[Fonts.p3Bold, Fonts.error500]}>{erreurs.photo}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={[Fonts.p3, Fonts.neutral100]} testID="signaler-sans-photo">
            {t(
              'facilityReports.membre.sansPhoto',
              'Décris bien le problème. Ton entraîneur pourra ajouter une photo s’il le faut.',
            )}
          </Text>
        )}

        <Text style={[Fonts.p3, Fonts.neutral200]} testID="signaler-ce-que-voit-la-ville">
          {photoPermise
            ? `${t(
              'facilityReports.membre.ceQueVoitLaVille',
              'La Ville verra ton rôle et ton club, pas ton nom.',
            )} ${t(
              'facilityReports.membre.photoVueVille',
              'La photo n’est vue que par la Ville.',
            )}`
            : t(
              'facilityReports.membre.ceQueVoitLaVille',
              'La Ville verra ton rôle et ton club, pas ton nom.',
            )}
        </Text>

        {refus ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.error500, 0.1),
              borderRadius: 14,
              gap: 4,
              padding: 12,
            }}
            testID="signaler-refus"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {refus === 'reseau'
                ? t('facilityReports.membre.erreurs.envoi', 'Le signalement n’est pas parti.')
                : refus}
            </Text>
            {refus === 'reseau' ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'facilityReports.membre.erreurs.envoiTexte',
                  'Ton texte est gardé. Vérifie la connexion.',
                )}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingBottom: 8, paddingTop: 12 }}>
        <Button
          isLoading={envoi.isPending}
          onPress={envoyer}
          testID="signaler-envoyer"
          title={t('facilityReports.membre.envoyer', 'Envoyer à la Ville')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default FacilityReportNew;
