import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { libelleSport } from '@/domains/complexe/complexeTerrain';
import { jourEtHeure } from '@/domains/complexe/partieDuJoueur';
import {
  contenuDEchec,
  prixDuCreneau,
  texteCreneau,
  texteJourLong,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useInvitation,
  useRepondreParLeLien,
} from '@/services/complexe/complexeJoueurQueries';

import { useIsDesktop } from '@/responsive';

const COLONNE = 560;

/** Les états où le lien prend encore une réponse (`publicStateOf` du serveur). */
const ON_REPOND = Object.freeze(['collecte', 'complete', 'ouverte']);

/**
 * E-P08 — « LA PAGE D'INVITATION PAR LIEN », DANS L'APP — RESA-L6B-2 (20/10/2026), planche EP08,
 * plan E-P08 (A-P05, A-P06, A-P07, Q4, RG-LIEN, RC-T04, AT-05 A, AT-09 B). Un compte connecté lit
 * la page du lien `foundclub.app/r/<code>` (la liste fermée du serveur : jamais un numéro ni un nom
 * complet) et y répond avec son compte, dans l'ordre de la fiche :
 *   1. « Julien t'invite à jouer » (le prénom seul) — « Julien cherche des joueurs » pour une
 *      collecte ;
 *   2. la carte : sport, jour, heures ; complexe et ville ; prix indicatif (D4) ;
 *   3. « 7 présents sur 10 » et leurs prénoms + initiales (AT-09 B) ; une collecte : combien il en
 *      faut, et jusqu'à quand ;
 *   4. « Je viens » / « Je ne viens pas » ; complète : seulement « Je ne viens pas » ; annulée,
 *      passée, non aboutie : la phrase du serveur, plus de réponse ;
 *   5. l'engagement sur l'honneur (RG-HONNEUR) ; « Voir le complexe » (E-P02).
 * Répondu : « Tu es noté présent. » ou « C'est noté. » (personne n'est prévenu d'un absent), «
 * Changer », « Voir la partie dans l'app » (E-P07). Refus nommés : âge minimum, banni (sans la
 * raison, AT-05 A), complète. Lien désactivé ou inconnu : « Ce lien n'est plus valable… ».
 * Paramètre : `code`. Ouvert par le lien `foundclub://r/<code>` (appNavigator.js) ; la page du
 * SITE, sans compte, est le lot RESA-L7-2. Caché par `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverInvitation() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const code = String(/** @type {any} */ (route?.params)?.code || '').trim();
  const surOrdinateur = useIsDesktop();
  const lecture = useInvitation(code || null);
  const repondre = useRepondreParLeLien();
  const [reponse, setReponse] = useState(/** @type {any} */ (null));
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));
  const page = lecture?.data || null;

  const carte = {
    backgroundColor: withAlpha(Colors.primary800, 0.6),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  };
  const enveloppe = (/** @type {import('react').ReactNode} */ contenu) => (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24,
          paddingTop: 24,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );

  if (lecture?.isLoading && !page) {
    return enveloppe(
      <View style={{ gap: 12 }} testID="invitation-squelette">
        {[60, 160, 120].map((hauteur) => (
          <View
            accessibilityState={{ busy: true }}
            key={hauteur}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.06),
              borderRadius: 20,
              height: hauteur,
            }}
          />
        ))}
      </View>,
    );
  }
  if (!page) {
    const variante = lecture?.error ? varianteDEchec(lecture.error) : 'lienInvalide';
    const lienEteint = !code || variante === 'lienInvalide' || variante === 'introuvable';
    return enveloppe(
      <View accessibilityRole="alert" style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {lienEteint
            ? contenuDEchec(t, 'lienInvalide').titre
            : t('reserverTerrain.invitation.erreur', 'Impossible de charger cette invitation.')}
        </Text>
        {!lienEteint ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              onPress={() => lecture?.refetch?.()}
              title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          </View>
        ) : null}
      </View>,
    );
  }

  const organisateur = String(page.organisateur || '').trim();
  const collecte = page.collecte || null;
  let titre = t('reserverTerrain.invitation.onTInvite', 'On t’invite à jouer');
  if (organisateur && collecte) {
    titre = t('reserverTerrain.invitation.chercheDesJoueurs', '{{prenom}} cherche des joueurs', {
      prenom: organisateur,
      ...SANS_ECHAPPEMENT,
    });
  } else if (organisateur) {
    titre = t('reserverTerrain.invitation.tInvite', '{{prenom}} t’invite à jouer', {
      prenom: organisateur,
      ...SANS_ECHAPPEMENT,
    });
  }
  const prix = prixDuCreneau(t, page.price, null);
  const lieu = [page?.complexe?.name, page?.complexe?.city].filter(Boolean).join(', ');
  const quand = [
    // La page du lien nomme le sport en toutes lettres (liste fermée du serveur).
    libelleSport({ name: page?.terrain?.sport }),
    texteJourLong(t, page.date),
    texteCreneau(page.from, page.to),
  ].filter(Boolean).join(' · ');
  const onRepond = ON_REPOND.includes(String(page.etat));
  const complete = page.etat === 'complete';
  const presents = Number(page.presents) || 0;
  const places = Number(page.places) || 0;
  const noms = Array.isArray(page.participants) ? page.participants.join(', ') : '';

  const envoyer = async (/** @type {'absent' | 'present'} */ choix) => {
    setRefus(null);
    try {
      const groupe = await repondre.mutateAsync({ code, reponse: choix });
      setReponse({ choix, reservation: groupe?.reservation || null });
    } catch (erreur) {
      setRefus(contenuDEchec(t, varianteDEchec(erreur), { erreur, rejoindre: true }).titre);
    }
  };
  const boutonDeReponse = (
    /** @type {'absent' | 'present'} */ cle,
    /** @type {string} */ mot,
    /** @type {boolean} */ principal,
  ) => (
    <TouchableOpacity
      accessibilityLabel={mot}
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(repondre?.isPending) }}
      disabled={Boolean(repondre?.isPending)}
      onPress={() => envoyer(cle)}
      style={{
        alignItems: 'center',
        backgroundColor: principal ? Colors.primary500 : 'transparent',
        borderColor: Colors.primary500,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 48,
      }}
      testID={`invitation-${cle}`}
    >
      <Text style={[Fonts.p2Bold, principal ? Fonts.primary900 : Fonts.primary200]}>{mot}</Text>
    </TouchableOpacity>
  );

  let reponses = null;
  if (reponse) {
    reponses = (
      <View style={{ ...carte, borderColor: Colors.success500 }}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {reponse.choix === 'present'
            ? t('reserverTerrain.invitation.notePresent', 'Tu es noté présent.')
            : t('reserverTerrain.invitation.note', 'C’est noté.')}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setReponse(null)}
          style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('reserverTerrain.invitation.changer', 'Changer')}
          </Text>
        </TouchableOpacity>
        {reponse.reservation ? (
          <Button
            onPress={() => navigation.navigate(RouteNames.ReserverMaReservation, {
              reservationId: reponse.reservation,
            })}
            title={t('reserverTerrain.invitation.voirLaPartie', 'Voir la partie dans l’app')}
            variant="Secondary"
          />
        ) : null}
      </View>
    );
  } else if (onRepond) {
    reponses = (
      <View style={{ gap: 10 }}>
        {!complete
          ? boutonDeReponse('present', t('reserverTerrain.invitation.jeViens', 'Je viens'), true)
          : null}
        {boutonDeReponse(
          'absent',
          t('reserverTerrain.invitation.jeNeViensPas', 'Je ne viens pas'),
          false,
        )}
        {refus ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
          {t(
            'reserverTerrain.maReservation.honneurPresent',
            'Tu t’engages sur l’honneur à venir si tu réponds présent.',
          )}
        </Text>
      </View>
    );
  }

  return enveloppe(
    <>
      <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>{titre}</Text>
      <View style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{quand}</Text>
        {lieu ? <Text style={[Fonts.p2, Fonts.neutral100]}>{lieu}</Text> : null}
        {prix?.principal ? (
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
              prix: prix.principal,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
      </View>
      <View style={carte} testID="invitation-jauge">
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {/* CORR-RESA (83 A) : « 1 présent », « 3 présents ». */}
          {t('reserverTerrain.invitation.presentsSurNombre', {
            count: Number(presents) || 0,
            defaultValue_one: '{{count}} présent sur {{places}}',
            defaultValue_other: '{{count}} présents sur {{places}}',
            places,
          })}
        </Text>
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary500, 0.18),
            borderRadius: 4,
            height: 8,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: Colors.primary500,
              height: 8,
              width: `${places ? Math.min(100, Math.round((presents / places) * 100)) : 0}%`,
            }}
          />
        </View>
        {collecte ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'reserverTerrain.invitation.ilEnFaut',
              'Il en faut {{quorum}} pour réserver. Date limite : {{echeance}}.',
              {
                echeance: jourEtHeure(t, collecte.collectDeadline),
                quorum: Number(collecte.quorum) || places,
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
        ) : null}
        {noms ? <Text style={[Fonts.p3, Fonts.neutral100]}>{noms}</Text> : null}
      </View>
      {page.message ? (
        <View accessibilityRole="alert" style={carte}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{String(page.message)}</Text>
        </View>
      ) : null}
      {reponses}
      {page?.complexe?.slug ? (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => navigation.navigate(RouteNames.ReserverComplexe, {
            slug: page.complexe.slug,
          })}
          style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('reserverTerrain.invitation.voirLeComplexe', 'Voir le complexe')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </>,
  );
}

export default ReserverInvitation;
