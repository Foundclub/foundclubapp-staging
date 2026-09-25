#!/usr/bin/env python3
"""Preparation d'une build iOS de livraison -- PARTAGEE par les deux chaines.

Appelants (une seule logique, deux chaines : c'est ce qui les empeche de
diverger en silence, cf. le piege des deux workflows iOS du 2026-09-03) :
  - codemagic.yaml                                  voie normale, gratuite
  - .github/workflows/ios-testflight-release.yml    voie de secours, payante
                                                    une fois le depot prive

Chaque sous-commande lit ses entrees dans l'environnement et se lance depuis
la racine du depot :
  version     verifie IOS_MARKETING_VERSION (X.Y ou X.Y.Z)
  env         ecrit .env.production selon API_ENV
              -> temoin « CIBLE API DU BUILD : ... »
  firebase    pose ios/GoogleService-Info.plist apparie a la cible API
              -> temoin « PROJET FIREBASE DU BUILD : ... »
              puis synchronise le schema d'URL Firebase dans Info.plist
  numeroter   ecrit MARKETING_VERSION et CURRENT_PROJECT_VERSION dans le
              pbxproj ; --signature-manuelle ajoute les reglages de signature
              de la voie GitHub (PROFILE_NAME, APPLE_TEAM_ID)
  archive     relit la version REELLEMENT archivee et la compare a la demande

Bibliotheque standard uniquement (le Mac de GitHub comme celui de Codemagic
ont python3). Controle executable, sur n'importe quel poste :
  python scripts/ci/ios/test_scripts_ios.py
"""
import argparse
import base64
import os
import plistlib
import re
import sys
from pathlib import Path

PBXPROJ = Path("ios/foundclub.xcodeproj/project.pbxproj")
INFO_PLIST = Path("ios/foundclub/Info.plist")
FIREBASE_PLIST = Path("ios/GoogleService-Info.plist")

# APPARIEMENT OBLIGATOIRE client <-> serveur. Le serveur verifie le claim "aud"
# du jeton Firebase contre son FIREBASE_PROJECT_ID ; un decalage rend la
# connexion SMS impossible (400 a chaque tentative), et rien dans l'app ne le
# signale. C'est ce qui a produit la 2.5.6 : l'entree api_env=staging existait,
# mais le plist pose etait toujours celui de la production.
#
# ETAT DES SERVEURS, a re-verifier par
#   docker exec <conteneur> printenv FIREBASE_PROJECT_ID
#   api.foundclubpro.com          -> found-club
#   api-staging.foundclubpro.com  -> found-club  DEPUIS LE 2026-07-30 (voie
#     A-prime, GO Adel) : faute de plist iOS dedie, staging verifie les jetons
#     du projet de PRODUCTION. Ses push sont eteints en echange
#     (ENABLE_PUSH_NOTIFICATIONS=false) et il garde son propre compte de
#     service, pour qu'un envoi accidentel soit refuse par Google au lieu
#     d'atteindre de vrais telephones.
#     Si staging retrouve un jour son projet propre, changer EXPECTED_PROJECT
#     ici ET FIREBASE_PROJECT_ID sur le serveur : les deux ensemble, jamais
#     l'un seul.
EXPECTED_FIREBASE_PROJECT = "found-club"

API_TARGETS = {
    "staging": ("https://api-staging.foundclubpro.com/api", "https://api-staging.foundclubpro.com"),
    "production": ("https://api.foundclubpro.com/api", "https://api.foundclubpro.com"),
}


def fail(message):
    # « ::error:: » est une annotation GitHub ; ailleurs c'est une ligne lisible.
    print("::error::" + message)
    raise SystemExit(1)


def env(name, default=""):
    return os.environ.get(name, default) or default


def api_env():
    # Meme regle que le workflow historique : tout ce qui n'est pas « staging »
    # vise la production.
    return "staging" if env("API_ENV") == "staging" else "production"


def cmd_version(_args):
    # R9d -- le champ n'a pas de defaut, mais un envoi par API peut encore
    # arriver vide ou malforme : MARKETING_VERSION = ; dans le pbxproj.
    version = env("IOS_MARKETING_VERSION")
    if not re.fullmatch(r"[0-9]+(\.[0-9]+){1,2}", version):
        fail("marketing_version doit etre X.Y ou X.Y.Z (recu: '{}').".format(version))
    print("Version marketing iOS demandee : {}".format(version))


def cmd_env(args):
    # R9a -- sans la cle RevenueCat, le SDK demarre a vide et la caisse est
    # MORTE dans une build par ailleurs verte. Mieux vaut une build rouge
    # qu'une version sur l'App Store qui ne sait rien vendre.
    for name in ("TOMTOM_API_KEY_PRODUCTION", "REVENUECAT_APPLE_API_KEY"):
        if not env(name):
            fail("Secret absent : {} (voir CONSTRUIRE_LES_VERSIONS.md).".format(name))

    api_url, socket_url = API_TARGETS[api_env()]
    lines = [
        "APP_ENV=production",
        "API_URL=" + api_url,
        "SOCKET_URL=" + socket_url,
        "WEB_APP_URL=https://foundclub.app",
        "SENTRY_DSN=" + env("SENTRY_DSN"),
        "FC_ENABLE_PUSH_NOTIFICATIONS=1",
        "FC_ENABLE_SMART_NOTIFICATIONS=1",
        "FC_ENABLE_NOTIFICATION_TEST_TRIGGER=0",
        "FC_SEARCH_MAP_PROVIDER=tomtom",
        "TOMTOM_API_KEY=" + env("TOMTOM_API_KEY_PRODUCTION"),
        "REVENUECAT_APPLE_API_KEY=" + env("REVENUECAT_APPLE_API_KEY"),
        "FC_FORCE_REVENUECAT_RAIL=" + env("FC_FORCE_REVENUECAT_RAIL"),
        "DELETE_ACCOUNT_URL=https://api.foundclubpro.com/suppression.html",
        "CONTACT_URL=https://foundclubpro.com",
    ]
    Path(args.fichier).write_bytes(("\n".join(lines) + "\n").encode("utf-8"))

    # Sans ces lignes, aucun journal de build ne dit quel serveur a ete
    # embarque. Constate le 2026-07-29 sur la 2.5.6, impossible a relire apres
    # coup. Ce sont des adresses publiques, jamais un secret.
    print("CIBLE API DU BUILD : {}".format(api_url))
    print("API_URL=" + api_url)
    print("SOCKET_URL=" + socket_url)


def cmd_firebase(_args):
    staging_b64 = env("GOOGLE_SERVICE_INFO_PLIST_STAGING_BASE64")
    # Un plist staging dedie, s'il existe un jour (voie B), prend le dessus.
    if api_env() == "staging" and staging_b64:
        plist_b64, secret_name = staging_b64, "GOOGLE_SERVICE_INFO_PLIST_STAGING_BASE64"
    else:
        plist_b64 = env("GOOGLE_SERVICE_INFO_PLIST_PRODUCTION_BASE64")
        secret_name = "GOOGLE_SERVICE_INFO_PLIST_PRODUCTION_BASE64"

    if not plist_b64:
        fail("api_env={} exige le secret {}, qui est absent ou vide. Une build produite "
             "sans lui ne peut PAS se connecter au serveur vise : arret avant de "
             "fabriquer une build fantome.".format(api_env(), secret_name))

    # b64decode sans validation : tolere les retours a la ligne d'un collage.
    data = base64.b64decode(plist_b64)
    FIREBASE_PLIST.write_bytes(data)

    firebase = plistlib.loads(data)
    actual = str(firebase.get("PROJECT_ID", "")).strip()
    print("PROJET FIREBASE DU BUILD : {}".format(actual))
    if actual != EXPECTED_FIREBASE_PROJECT:
        fail("Le plist Firebase porte le projet '{}' alors que le serveur vise attend '{}'. "
             "La connexion SMS echouerait avec 'incorrect aud claim' : arret."
             .format(actual, EXPECTED_FIREBASE_PROJECT))

    # Schema d'URL : Firebase Auth rappelle l'app par « app-<GOOGLE_APP_ID> ».
    info = plistlib.loads(INFO_PLIST.read_bytes())

    google_app_id = str(firebase.get("GOOGLE_APP_ID", "")).strip()
    if not google_app_id:
        fail("GOOGLE_APP_ID missing from ios/GoogleService-Info.plist")

    encoded_app_id = "app-" + google_app_id.replace(":", "-")
    url_types = info.get("CFBundleURLTypes", [])
    if not url_types:
        fail("CFBundleURLTypes missing from ios/foundclub/Info.plist")

    schemes = url_types[0].get("CFBundleURLSchemes", [])
    if not schemes:
        fail("CFBundleURLSchemes missing from ios/foundclub/Info.plist")

    schemes[0] = encoded_app_id
    url_types[0]["CFBundleURLSchemes"] = schemes
    info["CFBundleURLTypes"] = url_types

    INFO_PLIST.write_bytes(plistlib.dumps(info))
    print("Synced Firebase URL scheme: {}".format(encoded_app_id))


def cmd_numeroter(args):
    # Octets, pas texte : le pbxproj est reecrit a l'identique sur macOS comme
    # sous Windows (le controle local tourne sur le PC).
    text = PBXPROJ.read_bytes().decode("utf-8")

    if args.signature_manuelle:
        # Voie GitHub : certificat et profil installes a la main, il faut les
        # nommer dans le projet. Codemagic, lui, le fait avec
        # « xcode-project use-profiles » et n'a pas besoin de ce bloc.
        replacements = {
            'PROVISIONING_PROFILE_SPECIFIER = "";':
                'PROVISIONING_PROFILE_SPECIFIER = "{}";'.format(os.environ["PROFILE_NAME"]),
            '"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";':
                '"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";',
        }

        # Conditionnel depuis que 8a4546b7 a ecrit l'equipe en dur (2026-04-10).
        if 'DEVELOPMENT_TEAM = "";' in text:
            text = text.replace('DEVELOPMENT_TEAM = "";',
                                'DEVELOPMENT_TEAM = "{}";'.format(os.environ["APPLE_TEAM_ID"]))

        for old, new in replacements.items():
            if old not in text:
                fail("Expected setting not found in project.pbxproj: {}".format(old))
            text = text.replace(old, new)

    text, current_project_version_count = re.subn(
        r"CURRENT_PROJECT_VERSION = [^;]+;",
        "CURRENT_PROJECT_VERSION = {};".format(os.environ["IOS_BUILD_NUMBER"]),
        text,
    )
    if current_project_version_count == 0:
        fail("Expected at least one CURRENT_PROJECT_VERSION setting in project.pbxproj")

    text, marketing_version_count = re.subn(
        r"MARKETING_VERSION = [^;]+;",
        "MARKETING_VERSION = {};".format(os.environ["IOS_MARKETING_VERSION"]),
        text,
    )
    if marketing_version_count == 0:
        fail("Expected at least one MARKETING_VERSION setting in project.pbxproj")

    PBXPROJ.write_bytes(text.encode("utf-8"))
    print("Using iOS marketing version: {}".format(os.environ["IOS_MARKETING_VERSION"]))
    print("Using iOS build number: {}".format(os.environ["IOS_BUILD_NUMBER"]))


def cmd_archive(args):
    apps = sorted(Path(args.xcarchive).glob("Products/Applications/*.app/Info.plist"))
    if not apps:
        fail("Archived app Info.plist not found under {}".format(args.xcarchive))
    info = plistlib.loads(apps[0].read_bytes())
    short_version = str(info.get("CFBundleShortVersionString", ""))
    build_number = str(info.get("CFBundleVersion", ""))
    print("Archived CFBundleShortVersionString: {}".format(short_version))
    print("Archived CFBundleVersion: {}".format(build_number))

    wanted = (env("IOS_MARKETING_VERSION"), env("IOS_BUILD_NUMBER"))
    if (short_version, build_number) != wanted:
        fail("L'archive porte {} ({}) alors que la build demandee est {} ({}) : "
             "le numero envoye a Apple ne serait pas celui annonce."
             .format(short_version, build_number, *wanted))


def main(argv=None):
    parser = argparse.ArgumentParser(description="Preparation d'une build iOS (partagee GitHub/Codemagic)")
    sub = parser.add_subparsers(dest="commande", required=True)
    sub.add_parser("version").set_defaults(func=cmd_version)
    p_env = sub.add_parser("env")
    p_env.add_argument("--fichier", default=".env.production")
    p_env.set_defaults(func=cmd_env)
    sub.add_parser("firebase").set_defaults(func=cmd_firebase)
    p_num = sub.add_parser("numeroter")
    p_num.add_argument("--signature-manuelle", action="store_true")
    p_num.set_defaults(func=cmd_numeroter)
    p_arch = sub.add_parser("archive")
    p_arch.add_argument("xcarchive")
    p_arch.set_defaults(func=cmd_archive)
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
