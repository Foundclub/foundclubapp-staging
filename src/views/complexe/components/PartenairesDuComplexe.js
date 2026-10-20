import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { messageDeRefus } from '@/domains/complexe/complexeGerant';
import { corpsDesPartenaires, PARTENAIRES_MAX } from '@/domains/complexe/pageDuComplexe';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

import {
  useEnregistrerPartenaires,
  usePartenairesDuComplexe,
} from '@/services/complexe/complexeQueries';
import { televerserPhoto } from '@/services/complexe/complexeService';

import MediaPlatform from '@/platform/media';

/**
 * « NOS PARTENAIRES » DU COMPLEXE — RESA-L5B-2 (20/10/2026), planche RA5 (A-G25 : comme les
 * clubs ; gratuits pour les complexes en V1, « partenaires A ») ; serveur RESA-L4
 * (`GET|PUT /complexes/:id/partenaires`, la liste ENTIÈRE, 12 au plus).
 * Les écrans des clubs repris mot pour mot (leurs clés de traduction : `addSponsor.*`,
 * `clubDetails.alerts.deleteSponsor.*`, `clubDetails.titles.sponsors`) : la liste (logo rond, nom)
 * et son « + », « Ajouter un partenaire » (logo, nom obligatoire, lien facultatif ; « Ajouter le
 * partenaire » grisé sans logo), la suppression et sa confirmation. Seule la phrase d'aide change
 * (« Il apparaîtra sur ta page et sur ta carte dans la recherche. »). À la différence des clubs, un
 * partenaire se retire par son IDENTIFIANT (deux partenaires sans lien ne partent pas ensemble).
 * Chaque geste enregistre aussitôt la liste entière (comme chez les clubs).
 * @param {object} props - Les propriétés.
 * @param {string | null} props.complexeId - documentId du complexe.
 * @returns {import('react').ReactElement} Le bloc.
 */
function PartenairesDuComplexe({ complexeId }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const lecture = usePartenairesDuComplexe(complexeId);
  const enregistrer = useEnregistrerPartenaires();
  const partenaires = Array.isArray(lecture.data) ? lecture.data : [];
  const [ajout, setAjout] = useState(false);
  const [logo, setLogo] = useState(/** @type {{ id: number, url?: string } | null} */ (null));
  const [nom, setNom] = useState('');
  const [lien, setLien] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [aRetirer, setARetirer] = useState(/** @type {any} */ (null));
  const [erreur, setErreur] = useState('');

  const repli = t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.');
  const sauver = async (/** @type {any[]} */ liste) => {
    setErreur('');
    try {
      await enregistrer.mutateAsync({ complexeId, partenaires: corpsDesPartenaires(liste) });
      return true;
    } catch (refus) {
      setErreur(messageDeRefus(t, refus, repli));
      return false;
    }
  };
  const ouvrirLAjout = () => {
    setLogo(null);
    setNom('');
    setLien('');
    setErreur('');
    setAjout(true);
  };
  const choisirLeLogo = async () => {
    const choisie = await MediaPlatform.pickImage();
    if (!choisie || choisie?.didCancel) return;
    setEnvoi(true);
    try {
      const envoyee = await televerserPhoto(choisie);
      if (envoyee?.id) setLogo({ id: envoyee.id, url: envoyee.url });
    } catch {
      setErreur(t('complexeMaPage.photoEchec', 'La photo n’est pas partie. Réessaie.'));
    } finally {
      setEnvoi(false);
    }
  };
  const ajouter = async () => {
    if (!logo || !nom.trim()) return;
    const ok = await sauver([...partenaires, { link: lien, logo, title: nom }]);
    if (ok) setAjout(false);
  };
  const retirer = async () => {
    if (!aRetirer) return;
    const ok = await sauver(partenaires.filter((p) => p.documentId !== aRetirer.documentId));
    if (ok) setARetirer(null);
  };

  const rond = (/** @type {any} */ partenaire) => (partenaire?.logo?.url ? (
    <Image
      source={{ uri: partenaire.logo.url }}
      style={{ borderRadius: 19, height: 38, width: 38 }}
    />
  ) : (
    <View
      style={[Alignments.alignCenter, Alignments.justifyCenter, {
        backgroundColor: Colors.primary700, borderRadius: 19, height: 38, width: 38,
      }]}
    >
      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
        {String(partenaire?.title || '').split(/\s+/).map((mot) => mot.charAt(0)).join('')
          .slice(0, 2)
          .toUpperCase()}
      </Text>
    </View>
  ));
  const libelleAjouter = t('addSponsor.title', 'Ajouter un partenaire');
  const libelleLien = t(
    'complexeMaPage.partenaires.lien',
    'Lien vers le site du partenaire (facultatif)',
  );

  return (
    <View style={{ gap: 8 }} testID="page-partenaires">
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
        <Text
          accessibilityRole="header"
          style={[Fonts.p3Bold, Fonts.primary200, { flex: 1, letterSpacing: 0.5 }]}
        >
          {t('clubDetails.titles.sponsors', 'Nos partenaires').toUpperCase()}
        </Text>
        {partenaires.length < PARTENAIRES_MAX ? (
          <TouchableOpacity
            accessibilityLabel={libelleAjouter}
            accessibilityRole="button"
            onPress={ouvrirLAjout}
            style={[Alignments.alignCenter, Alignments.justifyCenter, {
              borderColor: Colors.primary500,
              borderRadius: 22,
              borderWidth: 1,
              height: 44,
              width: 44,
            }]}
          >
            <Text style={[Fonts.h4Bold, Fonts.primary500]}>+</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {partenaires.map((partenaire) => (
        <View
          key={partenaire.documentId}
          style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 48 }]}
        >
          {rond(partenaire)}
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{partenaire.title}</Text>
          <TouchableOpacity
            accessibilityLabel={t('complexeMaPage.partenaires.supprimer', 'Supprimer {{nom}}', {
              nom: partenaire.title, ...SANS_ECHAPPEMENT,
            })}
            accessibilityRole="button"
            onPress={() => {
              setErreur('');
              setARetirer(partenaire);
            }}
            style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
            testID={`partenaire-retirer-${partenaire.documentId}`}
          >
            <GlyphIcon color={Colors.error500} name="trashAlt" size={16} />
          </TouchableOpacity>
        </View>
      ))}
      {erreur && !ajout && !aRetirer ? (
        <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{erreur}</Text>
      ) : null}

      <BottomModal close={() => setAjout(false)} isVisible={ajout} webPresentation="dialog">
        <View style={{ gap: 16 }} testID="partenaire-feuille-ajout">
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {libelleAjouter}
          </Text>
          <TouchableOpacity
            accessibilityLabel={t('addSponsor.fields.logo', 'Logo du partenaire')}
            accessibilityRole="button"
            onPress={choisirLeLogo}
            style={[Alignments.alignCenter, Alignments.justifyCenter, {
              alignSelf: 'center',
              borderColor: withAlpha(Colors.primary500, 0.6),
              borderRadius: 16,
              borderStyle: logo ? 'solid' : 'dashed',
              borderWidth: 1,
              height: 104,
              width: 104,
            }]}
          >
            {logo?.url ? (
              <Image
                source={{ uri: logo.url }}
                style={{ borderRadius: 16, height: 102, width: 102 }}
              />
            ) : (
              <Text style={[Fonts.p3, Fonts.primary200, Fonts.textCenter, Spaces.padding[8]]}>
                {envoi
                  ? t('complexeMaPage.envoi', 'Envoi…')
                  : t('addSponsor.fields.logo', 'Logo du partenaire')}
              </Text>
            )}
          </TouchableOpacity>
          <Input
            accessibilityLabel={t('addSponsor.fields.title.label', 'Nom du partenaire')}
            label={t('addSponsor.fields.title.label', 'Nom du partenaire')}
            maxLength={80}
            onChangeText={(valeur) => setNom(String(valeur))}
            value={nom}
          />
          <Input
            accessibilityLabel={libelleLien}
            autoCapitalize="none"
            keyboardType="url"
            label={libelleLien}
            onChangeText={(valeur) => setLien(String(valeur))}
            placeholder={t('addSponsor.fields.link.placeholder', 'https://www.nike.com')}
            value={lien}
          />
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'complexeMaPage.partenaires.aide',
              'Il apparaîtra sur ta page et sur ta carte dans la recherche.',
            )}
          </Text>
          {erreur ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{erreur}</Text>
          ) : null}
          <View testID="partenaire-ajouter">
            <Button
              disabled={!logo || !nom.trim() || Boolean(enregistrer.isPending)}
              isLoading={Boolean(enregistrer.isPending)}
              onPress={ajouter}
              title={t('addSponsor.actions.save', 'Ajouter le partenaire')}
            />
          </View>
          <Button
            onPress={() => setAjout(false)}
            title={t('clubDetails.alerts.deleteSponsor.actions.cancel', 'Annuler')}
            variant="Ghost"
          />
        </View>
      </BottomModal>

      <BottomModal
        close={() => setARetirer(null)}
        isVisible={Boolean(aRetirer)}
        webPresentation="dialog"
      >
        <View style={{ gap: 16 }} testID="partenaire-feuille-suppression">
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t(
              'clubDetails.alerts.deleteSponsor.title',
              'Tu es sur le point de supprimer le partenaire {{sponsorName}}.',
              { sponsorName: String(aRetirer?.title || ''), ...SANS_ECHAPPEMENT },
            )}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'clubDetails.alerts.deleteSponsor.description',
              'Es-tu sûr·e de vouloir continuer ?',
            )}
          </Text>
          {erreur ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{erreur}</Text>
          ) : null}
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            <View style={{ flexBasis: 140, flexGrow: 1 }}>
              <Button
                onPress={() => setARetirer(null)}
                title={t('clubDetails.alerts.deleteSponsor.actions.cancel', 'Annuler')}
                variant="Ghost"
              />
            </View>
            <View style={{ flexBasis: 140, flexGrow: 1 }} testID="partenaire-supprimer">
              <Button
                isLoading={Boolean(enregistrer.isPending)}
                onPress={retirer}
                title={t('clubDetails.alerts.deleteSponsor.actions.confirm', 'Supprimer')}
                variant="DangerFilled"
              />
            </View>
          </View>
        </View>
      </BottomModal>
    </View>
  );
}

export default PartenairesDuComplexe;
