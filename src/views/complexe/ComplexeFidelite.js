import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { initialesDe, messageDeRefusResa, nomCourt } from '@/domains/complexe/complexeReservation';
import {
  apercuDuJoueur,
  avertissementsDuProgramme,
  corpsDuProgramme,
  ligneValidee,
  PROGRAMME_PAR_DEFAUT,
  RECOMPENSE_MAX,
  SEUIL_MAX,
  SEUIL_MIN,
} from '@/domains/complexe/fideliteDuComplexe';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import DeuxVolets from '@/views/complexe/components/DeuxVolets';

import { RouteNames } from '@/navigation/routeNames';

import {
  useComplexeChoisi,
  useFideliteDuComplexe,
  useReglerFidelite,
  useValiderRecompense,
} from '@/services/complexe/complexeQueries';

import { useIsDesktop } from '@/responsive';

/** @typedef {{ active: boolean, counts: string, reward: string, threshold: number }} Programme */

/**
 * E-G14 — LA FIDÉLITÉ DU COMPLEXE — RESA-L5B-2 (20/10/2026), planche EG14 ; plan :933-969 ;
 * RG-FIDELITE, Q2, RC-G10, RC-G11 ; serveur RESA-L4 (`GET|PUT /complexes/:id/fidelite`,
 * `POST /complexes/:id/fidelite/:joueurId/valider`).
 * Dans l'ordre : « TON PROGRAMME » (« Fidélité active », « Au bout de » x réservations, la
 * récompense — 40 caractères —, « Qui compte ? » : le réserveur seulement, ou le réserveur et les
 * participants présents, et le texte fixe), « CE QUE VOIT LE JOUEUR » (à x − 2), « RÉCOMPENSES À
 * VALIDER » (« Valider » et sa confirmation : le compteur repart à 0), « BIENTÔT » (x − 2 ou plus
 * près ; un client ouvre sa fiche, E-G15), « DERNIÈRES VALIDÉES », puis « Enregistrer ». Changer x
 * ou « qui compte » : « Les compteurs déjà commencés sont gardés. » ; couper : « Les compteurs sont
 * gardés si tu la rallumes. ». Jamais réglé : « Récompense tes habitués. » et « Créer mon
 * programme ». Le compteur est calculé par le serveur ; aucun prix (RC-G11). Sur ordinateur, le
 * réglage à gauche, les listes à droite (plan §9). Jamais d'or (il est à la League).
 * Paramètre de route : `complexeId` (sinon SON complexe). Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeFidelite() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const { complexe, complexeId } = useComplexeChoisi(params?.complexeId);
  const lecture = useFideliteDuComplexe(complexeId);
  const regler = useReglerFidelite();
  const valider = useValiderRecompense();
  const surOrdinateur = useIsDesktop();

  const enregistre = /** @type {Programme | null} */ (lecture.data?.programme || null);
  const [saisie, setSaisie] = useState(/** @type {Programme | null} */ (null));
  const [message, setMessage] = useState(
    /** @type {{ texte: string, ton: 'erreur' | 'ok' } | null} */ (null),
  );
  const [aValider, setAValider] = useState(/** @type {any} */ (null));
  const [erreurFeuille, setErreurFeuille] = useState('');

  // Le réglage de l'écran part du programme enregistré (ou de rien : « Créer mon programme »).
  useEffect(() => {
    if (enregistre && !saisie) {
      setSaisie({
        active: enregistre.active === true,
        counts: enregistre.counts,
        reward: String(enregistre.reward || ''),
        threshold: Number(enregistre.threshold),
      });
    }
  }, [enregistre, saisie]);

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };
  const legende = (/** @type {string} */ texte) => (
    <Text
      accessibilityRole="header"
      style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}
    >
      {texte.toUpperCase()}
    </Text>
  );
  const changer = (/** @type {Partial<Programme>} */ morceau) => {
    setMessage(null);
    setSaisie((avant) => ({ ...(avant || PROGRAMME_PAR_DEFAUT), ...morceau }));
  };
  const repli = t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.');

  // ── Chargement, erreur ─────────────────────────────────────────────────────────────────
  let corps = null;
  if (lecture.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="fidelite-squelette">
        {[180, 96, 120].map((hauteur) => (
          <View
            key={hauteur}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: hauteur },
            ]}
          />
        ))}
      </View>
    );
  } else if (lecture.error && !lecture.data) {
    corps = (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
          gap: 8,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeFidelite.erreur', 'Impossible de charger les clients.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => lecture.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else if (!saisie) {
    // ── Jamais réglé (planche état 2) ────────────────────────────────────────────────────
    corps = (
      <View style={[carte, Spaces.padding[24], Alignments.alignCenter, { gap: 12 }]}>
        <GlyphIcon color={Colors.primary500} name="gift" size={28} />
        <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
          {t('complexeFidelite.vide.titre', 'Récompense tes habitués.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter]}>
          {t(
            'complexeFidelite.vide.dit',
            'Au bout de quelques réservations jouées chez toi, une partie offerte, une boisson : '
            + 'tu choisis.',
          )}
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button
            onPress={() => changer({ ...PROGRAMME_PAR_DEFAUT })}
            title={t('complexeFidelite.vide.creer', 'Créer mon programme')}
          />
        </View>
      </View>
    );
  }

  // ── Le programme (planche état 1, bloc 1) ────────────────────────────────────────────────
  const avertissements = saisie
    ? avertissementsDuProgramme(enregistre, saisie)
    : { compteursGardes: false, coupee: false };
  const radio = (/** @type {string} */ valeur, /** @type {string} */ libelle) => {
    const choisi = saisie?.counts === valeur;
    return (
      <TouchableOpacity
        accessibilityLabel={libelle}
        accessibilityRole="radio"
        accessibilityState={{ checked: choisi }}
        key={valeur}
        onPress={() => changer({ counts: valeur })}
        style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
        testID={`fidelite-compte-${valeur}`}
      >
        <View
          style={[Alignments.alignCenter, Alignments.justifyCenter, {
            borderColor: choisi ? Colors.primary500 : withAlpha(Colors.primary500, 0.5),
            borderRadius: 11,
            borderWidth: 2,
            height: 22,
            width: 22,
          }]}
        >
          {choisi ? (
            <View
              style={{
                backgroundColor: Colors.primary500, borderRadius: 6, height: 12, width: 12,
              }}
            />
          ) : null}
        </View>
        <Text style={[choisi ? Fonts.p2Bold : Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
          {libelle}
        </Text>
      </TouchableOpacity>
    );
  };
  const libelleActive = t('complexeFidelite.programme.active', 'Fidélité active');
  const programme = saisie ? (
    <View style={[carte, Spaces.padding[16], { gap: 16 }]} testID="fidelite-programme">
      {legende(t('complexeFidelite.programme.titre', 'Ton programme'))}
      <TouchableOpacity
        accessibilityLabel={libelleActive}
        accessibilityRole="switch"
        accessibilityState={{ checked: saisie.active }}
        onPress={() => changer({ active: !saisie.active })}
        style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
        testID="fidelite-active"
      >
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{libelleActive}</Text>
        <View
          style={{
            backgroundColor: saisie.active
              ? withAlpha(Colors.primary500, 0.6)
              : withAlpha(Colors.neutral00, 0.16),
            borderRadius: 14,
            height: 28,
            justifyContent: 'center',
            paddingHorizontal: 3,
            width: 48,
          }}
        >
          <View
            style={{
              alignSelf: saisie.active ? 'flex-end' : 'flex-start',
              backgroundColor: Colors.primary100,
              borderRadius: 11,
              height: 22,
              width: 22,
            }}
          />
        </View>
      </TouchableOpacity>
      {avertissements.coupee ? (
        <BandeauComplexe
          testID="fidelite-coupee"
          texte={t(
            'complexeFidelite.programme.coupee',
            'Les compteurs sont gardés si tu la rallumes.',
          )}
          ton="attention"
        />
      ) : null}
      <View style={{ gap: 4 }}>
        <InputStepper
          decrementLabel={t('complexeFidelite.programme.moins', 'Une réservation de moins')}
          incrementLabel={t('complexeFidelite.programme.plus', 'Une réservation de plus')}
          label={t('complexeFidelite.programme.auBoutDe', 'Au bout de')}
          max={SEUIL_MAX}
          min={SEUIL_MIN}
          onDecrement={() => changer({ threshold: Math.max(SEUIL_MIN, saisie.threshold - 1) })}
          onIncrement={() => changer({ threshold: Math.min(SEUIL_MAX, saisie.threshold + 1) })}
          value={saisie.threshold}
        />
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('complexeFidelite.programme.reservations', 'réservations')}
        </Text>
      </View>
      {avertissements.compteursGardes ? (
        <BandeauComplexe
          testID="fidelite-compteurs-gardes"
          texte={t(
            'complexeFidelite.programme.compteursGardes',
            'Les compteurs déjà commencés sont gardés.',
          )}
        />
      ) : null}
      <View style={{ gap: 4 }}>
        <Input
          accessibilityLabel={t('complexeFidelite.programme.recompense', 'Récompense')}
          label={t('complexeFidelite.programme.recompense', 'Récompense')}
          maxLength={RECOMPENSE_MAX}
          onChangeText={(texte) => changer({ reward: String(texte).slice(0, RECOMPENSE_MAX) })}
          placeholder={t('complexeFidelite.programme.exemple', '1 partie offerte')}
          value={saisie.reward}
        />
        <Text style={[Fonts.p3, Fonts.neutral200, { alignSelf: 'flex-end' }]}>
          {t('complexeGerant.reglages.compte', '{{nombre}} / {{max}}', {
            max: RECOMPENSE_MAX,
            nombre: saisie.reward.length,
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: 4 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('complexeFidelite.programme.quiCompte', 'Qui compte ?')}
        </Text>
        {radio('reserveur', t('complexeFidelite.programme.reserveur', 'Le réserveur seulement'))}
        {radio('participants', t(
          'complexeFidelite.programme.participants',
          'Le réserveur et les participants présents',
        ))}
      </View>
      <Text style={[Fonts.p3, Fonts.neutral100]}>
        {t(
          'complexeFidelite.programme.regle',
          'Seules les réservations jouées comptent (pas les annulées ni les non honorées).',
        )}
      </Text>
    </View>
  ) : null;

  // ── Ce que voit le joueur (RC-G10) ───────────────────────────────────────────────────────
  const apercu = saisie ? apercuDuJoueur(t, saisie) : null;
  const vueDuJoueur = apercu ? (
    <View style={{ gap: 8 }}>
      {legende(t('complexeFidelite.apercu.titre', 'Ce que voit le joueur'))}
      <View style={[carte, Spaces.padding[16], { gap: 8 }]} testID="fidelite-apercu">
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {String(complexe?.name || '')}
          </Text>
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>{`${apercu.compte}/${apercu.seuil}`}</Text>
        </View>
        <View
          style={{
            backgroundColor: withAlpha(Colors.neutral00, 0.1),
            borderRadius: 4,
            height: 8,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: Colors.primary500,
              height: '100%',
              width: `${Math.round((apercu.compte / apercu.seuil) * 100)}%`,
            }}
          />
        </View>
        <Text style={[Fonts.p2, Fonts.neutral00]}>{apercu.texte}</Text>
      </View>
    </View>
  ) : null;

  // ── Les listes (blocs 3 à 5) ─────────────────────────────────────────────────────────────
  const aValiderListe = Array.isArray(lecture.data?.aValider) ? lecture.data.aValider : [];
  const bientot = Array.isArray(lecture.data?.bientot) ? lecture.data.bientot : [];
  const validees = Array.isArray(lecture.data?.dernieresValidees)
    ? lecture.data.dernieresValidees
    : [];
  const avatar = (/** @type {any} */ joueur) => (
    <View
      style={[Alignments.alignCenter, Alignments.justifyCenter, {
        backgroundColor: Colors.primary700, borderRadius: 999, height: 40, width: 40,
      }]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{initialesDe(joueur)}</Text>
    </View>
  );
  const ouvrirLeClient = (/** @type {any} */ joueur) => {
    if (!joueur?.documentId) return;
    navigation.navigate(RouteNames.ComplexeClient, { complexeId, joueurId: joueur.documentId });
  };
  const listes = saisie && enregistre ? (
    <View style={{ gap: 20 }}>
      {aValiderListe.length || bientot.length ? null : (
        <View style={[carte, Spaces.padding[16]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'complexeFidelite.listes.aucunProche',
              'Aucun client n’approche encore de sa récompense.',
            )}
          </Text>
        </View>
      )}
      {aValiderListe.length ? (
        <View style={{ gap: 8 }}>
          {legende(t('complexeFidelite.listes.aValider', 'Récompenses à valider'))}
          {aValiderListe.map((/** @type {any} */ ligne) => (
            <View
              key={ligne.joueur?.documentId}
              style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 56 }]}
            >
              {avatar(ligne.joueur)}
              <View style={{ flex: 1, gap: 0 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{nomCourt(ligne.joueur)}</Text>
                <Text style={[Fonts.p3, Fonts.success500]}>
                  {t(
                    'complexeFidelite.listes.disponible',
                    '{{compte}}/{{seuil}} · récompense disponible',
                    { compte: ligne.count, seuil: ligne.threshold, ...SANS_ECHAPPEMENT },
                  )}
                </Text>
              </View>
              <View testID={`fidelite-valider-${ligne.joueur?.documentId}`}>
                <Button
                  onPress={() => {
                    setErreurFeuille('');
                    setAValider(ligne);
                  }}
                  size="sm"
                  title={t('complexeFidelite.listes.valider', 'Valider')}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {bientot.length ? (
        <View style={{ gap: 8 }}>
          {legende(t('complexeFidelite.listes.bientot', 'Bientôt'))}
          {bientot.map((/** @type {any} */ ligne) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={ligne.joueur?.documentId}
              onPress={() => ouvrirLeClient(ligne.joueur)}
              style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 56 }]}
            >
              {avatar(ligne.joueur)}
              <View style={{ flex: 1, gap: 0 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{nomCourt(ligne.joueur)}</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {`${ligne.count}/${ligne.threshold}`}
                </Text>
              </View>
              <GlyphIcon color={Colors.primary200} name="chevronRight" size={12} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {validees.length ? (
        <View style={{ gap: 8 }}>
          {legende(t('complexeFidelite.listes.validees', 'Dernières validées'))}
          {validees.map((/** @type {any} */ ligne) => (
            <Text
              key={`${ligne.joueur?.documentId}-${ligne.validatedAt}`}
              style={[Fonts.p2, Fonts.neutral100]}
            >
              {ligneValidee(t, ligne)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  ) : null;

  // ── Les gestes ─────────────────────────────────────────────────────────────────────────
  const enregistrer = async () => {
    if (!saisie) return;
    setMessage(null);
    try {
      await regler.mutateAsync({ complexeId, programme: corpsDuProgramme(saisie) });
      setMessage({
        texte: t('complexeFidelite.programme.enregistre', 'Programme enregistré.'),
        ton: 'ok',
      });
    } catch (erreur) {
      setMessage({ texte: messageDeRefusResa(t, erreur, repli), ton: 'erreur' });
    }
  };
  const confirmerLaValidation = async () => {
    if (!aValider?.joueur?.documentId) return;
    setErreurFeuille('');
    try {
      await valider.mutateAsync({ complexeId, joueurId: aValider.joueur.documentId });
      setMessage({
        texte: t('complexeFidelite.listes.validee', '{{nom}} : validée.', {
          nom: nomCourt(aValider.joueur), ...SANS_ECHAPPEMENT,
        }),
        ton: 'ok',
      });
      setAValider(null);
    } catch (erreur) {
      setErreurFeuille(messageDeRefusResa(t, erreur, repli));
    }
  };

  const gauche = (
    <View style={{ gap: 20 }}>
      {programme}
      {vueDuJoueur}
      {saisie ? (
        <View testID="fidelite-enregistrer">
          <Button
            disabled={Boolean(regler.isPending)}
            isLoading={Boolean(regler.isPending)}
            onPress={enregistrer}
            title={t('complexeFidelite.programme.enregistrer', 'Enregistrer')}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 20,
          maxWidth: surOrdinateur ? 1120 : 720,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => lecture.refetch?.()}
            refreshing={Boolean(lecture.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <Text
          accessibilityRole="header"
          style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
        >
          {t('complexeFidelite.titre', 'Fidélité').toUpperCase()}
        </Text>
        {message ? (
          <BandeauComplexe
            testID="fidelite-message"
            texte={message.texte}
            ton={message.ton === 'ok' ? 'ok' : 'erreur'}
          />
        ) : null}
        {corps}
        {saisie ? (
          <DeuxVolets actif={surOrdinateur} droite={listes}>
            <View style={{ gap: 20 }}>
              {gauche}
              {surOrdinateur ? null : listes}
            </View>
          </DeuxVolets>
        ) : null}
      </ScrollView>

      <BottomModal
        close={() => setAValider(null)}
        isVisible={Boolean(aValider)}
        webPresentation="dialog"
      >
        <View style={{ gap: 16 }} testID="fidelite-feuille-valider">
          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('complexeFidelite.valider.titre', 'Valider la partie offerte de {{nom}} ?', {
                nom: nomCourt(aValider?.joueur), ...SANS_ECHAPPEMENT,
              })}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('complexeFidelite.valider.dit', 'Son compteur repart à 0.')}
            </Text>
          </View>
          {erreurFeuille ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>
              {erreurFeuille}
            </Text>
          ) : null}
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            <View style={{ flexBasis: 140, flexGrow: 1 }}>
              <Button
                onPress={() => setAValider(null)}
                title={t('complexeReservations.feuille.annuler', 'Annuler')}
                variant="Ghost"
              />
            </View>
            <View style={{ flexBasis: 140, flexGrow: 1 }} testID="fidelite-confirmer">
              <Button
                isLoading={Boolean(valider.isPending)}
                onPress={confirmerLaValidation}
                title={t('complexeFidelite.listes.valider', 'Valider')}
              />
            </View>
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default ComplexeFidelite;
