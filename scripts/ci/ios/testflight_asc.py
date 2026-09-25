#!/usr/bin/env python3
"""App Store Connect apres (et avant) l'envoi -- PARTAGE par les deux chaines.

Appelants : codemagic.yaml (voie normale) et
.github/workflows/ios-testflight-release.yml (voie de secours).

Sous-commandes :
  prochain-numero  numero de build = plus grand numero de la serie FoundClub
                   connu d'Apple + 1 (serie = numeros < SERIE_MAX ; voir
                   plus bas pourquoi).
                   Imprime les dernieres builds et leur etat : c'est le seul
                   endroit ou l'on VOIT l'etat d'une build precedente.
                   Echoue (code 1) si Apple ne repond pas : sans numero, pas
                   de build.
  attendre         attend qu'Apple ait fini de traiter CETTE build
                   (version + numero). Ne fait jamais echouer la chaine.
  distribuer       rattache la build au groupe de testeurs. Ne fait jamais
                   echouer la chaine.
  temoin           imprime « ETAT TESTFLIGHT : ... », toujours.
  suivre           attendre + distribuer + temoin, dans le MEME processus
                   (Codemagic : aucun etat n'a a traverser d'une etape a
                   l'autre). Ne fait jamais echouer la chaine.

POURQUOI « attendre » ET « distribuer » EXISTENT (D52, 2026-08-09). La 2.6.13
(941) est partie, le workflow a rendu `success` (UPLOAD SUCCEEDED + Delivery
UUID), et PERSONNE ne l'a vue dans TestFlight : il manquait le rattachement a
un groupe de testeurs. RIEN dans le journal ne permettait de s'en apercevoir.
Depuis le 2026-08-11 on sait qu'Apple REFUSE ce rattachement par l'API pour un
groupe INTERNE (HTTP 422 « Cannot add internal group to a build », sur les deux
adresses possibles) : les testeurs internes recoivent d'eux-memes toute build
traitee. Le refus est donc attendu et sans consequence ; l'etat, lui, reste le
temoin utile.

Identifiants, lus dans l'environnement sous l'un ou l'autre nom :
  cle     APPSTORE_KEY_ID      ou APP_STORE_CONNECT_KEY_IDENTIFIER (Codemagic)
  emetteur APPSTORE_ISSUER_ID  ou APP_STORE_CONNECT_ISSUER_ID      (Codemagic)
  fichier APPSTORE_KEY_PATH (.p8 deja pose), sinon le CONTENU de
          APP_STORE_CONNECT_PRIVATE_KEY, recopie dans un fichier temporaire
          lisible du seul proprietaire et efface a la sortie.
Le jeton JWT est signe par `openssl` et n'est JAMAIS imprime, pas plus que la
clef. Les resultats sont ajoutes au fichier d'environnement de la chaine
($GITHUB_ENV ou $CM_ENV) pour les etapes suivantes.

Bibliotheque standard + openssl uniquement. Controle executable (faux serveur
Apple local, fausse clef jetable) :
  python scripts/ci/ios/test_scripts_ios.py
"""
import argparse
import atexit
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from urllib.parse import urlencode

API_ROOT = os.environ.get("ASC_API_ROOT") or "https://api.appstoreconnect.apple.com"

# Les builds FoundClub sont numerotees run_number+run_attempt (GitHub) puis
# « dernier + 1 » (Codemagic) : quelques milliers. L'historique d'Apple contient
# aussi des numeros-HORODATAGES hors serie (1 761 054 327, vu le 2026-09-25,
# heritage de l'ancienne agence) : les prendre pour maximum ferait sauter la
# numerotation a 1,7 milliard pour toujours. Ils sont ignores, et imprimes.
SERIE_MAX = 10_000_000

ETIQUETTES = {
    "VALID": "traitee",
    "PROCESSING": "encore en traitement chez Apple",
    "ABSENTE": "pas encore visible chez Apple",
    "FAILED": "traitement en echec chez Apple",
    "INVALID": "refusee par Apple",
}


# ── Identifiants ───────────────────────────────────────────────────────────


def _premier(*noms):
    for nom in noms:
        valeur = (os.environ.get(nom) or "").strip()
        if valeur:
            return valeur
    return ""


def _chemin_clef():
    chemin = _premier("APPSTORE_KEY_PATH")
    if chemin:
        return chemin
    contenu = os.environ.get("APP_STORE_CONNECT_PRIVATE_KEY") or ""
    if not contenu.strip():
        return ""
    descripteur, chemin = tempfile.mkstemp(suffix=".p8")
    with os.fdopen(descripteur, "w", encoding="utf-8") as handle:
        texte = contenu.replace("\r\n", "\n").replace("\\n", "\n").strip() + "\n"
        handle.write(texte)
    os.chmod(chemin, 0o600)
    atexit.register(lambda: os.path.exists(chemin) and os.remove(chemin))
    os.environ["APPSTORE_KEY_PATH"] = chemin
    return chemin


def identifiants_presents():
    return bool(_premier("APPSTORE_KEY_ID", "APP_STORE_CONNECT_KEY_IDENTIFIER")
                and _premier("APPSTORE_ISSUER_ID", "APP_STORE_CONNECT_ISSUER_ID")
                and _chemin_clef())


# ── Client minimal de l'API App Store Connect ──────────────────────────────


def _b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _der_to_jose(der):
    """DER (SEQUENCE{INTEGER r, INTEGER s}) -> r||s sur 2x32 octets.

    `openssl dgst -sign` rend une signature ECDSA au format DER ; JWS/ES256
    exige les deux entiers bruts concatenes. Pas de PyJWT sur les machines de
    build, donc la conversion est faite a la main -- 15 lignes d'ASN.1 simple.
    """
    if not der or der[0] != 0x30:
        raise ValueError("signature ECDSA inattendue (SEQUENCE absente)")
    index = 2
    if der[1] & 0x80:
        index = 2 + (der[1] & 0x7F)
    parts = []
    for _ in range(2):
        if der[index] != 0x02:
            raise ValueError("signature ECDSA inattendue (INTEGER absent)")
        length = der[index + 1]
        value = der[index + 2:index + 2 + length]
        index += 2 + length
        parts.append(value.lstrip(b"\x00").rjust(32, b"\x00"))
    return b"".join(parts)


def _token():
    """Jeton JWT ES256, regenere a chaque appel (Apple plafonne sa duree a
    20 min, or l'attente peut durer plus longtemps). Jamais imprime."""
    header = {"alg": "ES256", "kid": _premier("APPSTORE_KEY_ID", "APP_STORE_CONNECT_KEY_IDENTIFIER"),
              "typ": "JWT"}
    now = int(time.time())
    payload = {
        "iss": _premier("APPSTORE_ISSUER_ID", "APP_STORE_CONNECT_ISSUER_ID"),
        "iat": now,
        "exp": now + 19 * 60,
        "aud": "appstoreconnect-v1",
    }
    signing_input = "{}.{}".format(
        _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8")),
        _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
    )
    signed = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", _chemin_clef()],
        input=signing_input.encode("ascii"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return "{}.{}".format(signing_input, _b64url(_der_to_jose(signed.stdout)))


def request(method, path, body=None):
    """Rend (code HTTP, corps JSON). Ne leve jamais sur une erreur reseau."""
    url = path if path.startswith("http") else API_ROOT + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    try:
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", "Bearer " + _token())
        if data is not None:
            req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return response.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            return exc.code, (json.loads(raw) if raw else {})
        except ValueError:
            return exc.code, {"raw": raw[:500].decode("utf-8", "replace")}
    except Exception as exc:  # reseau, DNS, clef illisible, openssl absent...
        return 0, {"raw": "{}: {}".format(type(exc).__name__, exc)}


def detail(payload):
    """Message d'erreur d'Apple, lisible et sans secret.

    Le `code` est repris EN PLUS du titre : c'est lui qui distingue une adresse
    ou un identifiant faux (NOT_FOUND) d'un droit manquant sur la clef
    (FORBIDDEN_ERROR). Aucun secret ici : Apple ne renvoie ni jeton ni clef.
    """
    errors = payload.get("errors") if isinstance(payload, dict) else None
    if errors:
        return " | ".join(
            "[{}] {}: {}".format(e.get("code", "?"), e.get("title", "?"), e.get("detail", "")).strip()
            for e in errors
        )
    return str(payload.get("raw", "")) if isinstance(payload, dict) else ""


# ── Utilitaires de chaine ──────────────────────────────────────────────────


def publier(cle, valeur):
    """Transmet une valeur aux etapes suivantes ($GITHUB_ENV ou $CM_ENV)."""
    os.environ[cle] = str(valeur)
    cible = os.environ.get("GITHUB_ENV") or os.environ.get("CM_ENV")
    if cible:
        with open(cible, "a", encoding="utf-8") as handle:
            handle.write("{}={}\n".format(cle, valeur))


def heure_utc(valeur):
    """Apple date ses builds a l'heure de Californie (2026-09-25T06:50:12-07:00) :
    affichee telle quelle, une build de 13 h 50 UTC passait pour une build du
    matin. On convertit en UTC."""
    try:
        moment = datetime.fromisoformat(str(valeur).replace("Z", "+00:00"))
        return moment.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    except ValueError:
        return str(valeur or "?")[:16]


def app_id_de(bundle_id):
    status, payload = request("GET", "/v1/apps?" + urlencode({"filter[bundleId]": bundle_id, "limit": "1"}))
    if status != 200 or not payload.get("data"):
        return "", status, payload
    return payload["data"][0]["id"], status, payload


# ── Sous-commandes ─────────────────────────────────────────────────────────


def cmd_prochain_numero(_args):
    bundle_id = os.environ.get("IOS_BUNDLE_ID") or "com.foundclub"
    if not identifiants_presents():
        print("::error::Cle App Store Connect absente (identifiant, emetteur ou .p8) : "
              "impossible de choisir un numero de build.")
        return 1

    app_id, status, payload = app_id_de(bundle_id)
    if not app_id:
        print("::error::App Store Connect ne rend pas l'app {} (HTTP {}). {}"
              .format(bundle_id, status, detail(payload)))
        return 1
    publier("TESTFLIGHT_APP_ID", app_id)

    status, payload = request("GET", "/v1/builds?" + urlencode({
        "filter[app]": app_id,
        "sort": "-uploadedDate",
        "limit": "200",
        "include": "preReleaseVersion",
        "fields[builds]": "version,processingState,uploadedDate,preReleaseVersion",
        "fields[preReleaseVersions]": "version",
    }))
    if status != 200:
        print("::error::Liste des builds illisible (HTTP {}). {}".format(status, detail(payload)))
        return 1

    versions = {
        item.get("id"): item.get("attributes", {}).get("version", "?")
        for item in payload.get("included", [])
        if item.get("type") == "preReleaseVersions"
    }
    numeros = []
    lignes = []
    hors_serie = []
    for build in payload.get("data", []):
        attributs = build.get("attributes", {})
        numero = str(attributs.get("version", ""))
        lien = (build.get("relationships", {}).get("preReleaseVersion", {}) or {}).get("data") or {}
        ligne = "  - {} ({}) | {} | envoyee le {}".format(
            versions.get(lien.get("id"), "?"), numero,
            ETIQUETTES.get(attributs.get("processingState"), attributs.get("processingState")),
            heure_utc(attributs.get("uploadedDate")))
        lignes.append(ligne)
        if numero.isdigit() and int(numero) < SERIE_MAX:
            numeros.append(int(numero))
        elif numero:
            hors_serie.append(ligne)

    print("DERNIERES BUILDS CHEZ APPLE ({} lues) :".format(len(lignes)))
    for ligne in lignes[:5]:
        print(ligne)
    if hors_serie:
        print("NUMEROS HORS SERIE IGNORES ({}) :".format(len(hors_serie)))
        for ligne in hors_serie[:5]:
            print(ligne)

    if not numeros:
        print("::error::Aucune build de la serie FoundClub chez Apple : numero impossible a choisir.")
        return 1
    prochain = max(numeros) + 1
    publier("IOS_BUILD_NUMBER", prochain)
    print("NUMERO DE BUILD CHOISI : {} (plus grand numero de la serie + 1)".format(prochain))
    return 0


def cmd_attendre(_args):
    version = os.environ["IOS_MARKETING_VERSION"]
    build_number = os.environ["IOS_BUILD_NUMBER"]
    bundle_id = os.environ.get("IOS_BUNDLE_ID") or "com.foundclub"
    max_wait = int(os.environ.get("TESTFLIGHT_MAX_WAIT_MINUTES") or 40)
    poll = int(os.environ.get("TESTFLIGHT_POLL_SECONDS") or 60)

    etiquette_version = "{} ({})".format(version, build_number)
    publier("TESTFLIGHT_VERSION_LABEL", etiquette_version)
    publier("TESTFLIGHT_STATE", "INCONNU")
    publier("TESTFLIGHT_STATE_LABEL", "etat inconnu")

    if not identifiants_presents():
        print("::warning::Cle App Store Connect absente : etat non relu. L'ENVOI, lui, a reussi.")
        return 0

    # 1. Retrouver l'app par son bundle id.
    app_id, status, payload = app_id_de(bundle_id)
    if not app_id:
        print("::warning::App Store Connect ne rend pas l'app {} (HTTP {}). {} "
              "L'ENVOI DU BINAIRE, LUI, A REUSSI : rien n'est perdu, il reste a "
              "rattacher la build a un groupe de testeurs a la main."
              .format(bundle_id, status, detail(payload)))
        return 0

    publier("TESTFLIGHT_APP_ID", app_id)
    print("App Store Connect : {} -> app id {}".format(bundle_id, app_id))
    print("Build recherchee : version {} / numero de build {} "
          "(JAMAIS « la plus recente » : deux chaines peuvent se croiser)"
          .format(version, build_number))
    print("Plafond d'attente : {} min, sondage toutes les {} s".format(max_wait, poll))

    # 2. Sonder CETTE build (version + numero), jamais la derniere arrivee.
    requete = "/v1/builds?" + urlencode({
        "filter[app]": app_id,
        "filter[preReleaseVersion.version]": version,
        "filter[version]": build_number,
        "limit": "1",
    })

    depart = time.monotonic()
    echeance = depart + max_wait * 60
    etat, build_id = "ABSENTE", ""

    while True:
        status, payload = request("GET", requete)
        minutes = int((time.monotonic() - depart) / 60)
        if status != 200:
            etat = "HTTP_{}".format(status)
            print("[TestFlight] t+{:>2} min | {} | appel API en echec ({}) {}"
                  .format(minutes, etiquette_version, etat, detail(payload)))
        elif not payload.get("data"):
            etat = "ABSENTE"
            print("[TestFlight] t+{:>2} min | {} | pas encore enregistree chez Apple"
                  .format(minutes, etiquette_version))
        else:
            entree = payload["data"][0]
            build_id = str(entree.get("id", ""))
            etat = str(entree.get("attributes", {}).get("processingState") or "INCONNU")
            print("[TestFlight] t+{:>2} min | {} | {}".format(minutes, etiquette_version, etat))
            if etat != "PROCESSING":
                break

        if time.monotonic() + poll >= echeance:
            break
        time.sleep(poll)

    publier("TESTFLIGHT_STATE", etat)
    publier("TESTFLIGHT_BUILD_ID", build_id)
    publier("TESTFLIGHT_STATE_LABEL", ETIQUETTES.get(etat, "etat inconnu ({})".format(etat)))

    if etat == "VALID":
        print("Apple a fini : {} est traitee (build id {}).".format(etiquette_version, build_id))
    elif etat in ("PROCESSING", "ABSENTE"):
        print("::warning::Apple n'avait pas fini de traiter {} au bout de {} min "
              "(etat : {}). L'ENVOI A REUSSI et le binaire est bien chez Apple ; "
              "il ne manque que le rattachement au groupe de testeurs. Relever "
              "TESTFLIGHT_MAX_WAIT_MINUTES, ou rattacher a la main dans "
              "App Store Connect.".format(etiquette_version, max_wait, etat))
    else:
        print("::warning::Apple rend l'etat '{}' pour {}. L'envoi a reussi, mais la "
              "build n'est pas distribuable en l'etat : regarder TestFlight."
              .format(etat, etiquette_version))
    return 0


def cmd_distribuer(_args):
    etat = os.environ.get("TESTFLIGHT_STATE", "INCONNU")
    build_id = os.environ.get("TESTFLIGHT_BUILD_ID", "")
    app_id = os.environ.get("TESTFLIGHT_APP_ID", "")
    voulu = (os.environ.get("TESTFLIGHT_GROUP") or "").strip()

    # Defaut pessimiste : le temoin de fin de chaine ne dira « distribuee » que
    # si un POST a reellement reussi.
    publier("TESTFLIGHT_DISTRIBUTION", "non distribuee")

    if etat != "VALID" or not build_id or not app_id:
        print("::warning::Distribution non tentee : la build n'est pas au statut "
              "VALID (etat lu : {}). L'envoi du binaire reste un succes.".format(etat))
        publier("TESTFLIGHT_DISTRIBUTION", "non distribuee (build non traitee : {})".format(etat))
        return 0

    # 1. LIRE les groupes existants avant toute chose : le nom ne se devine pas.
    status, payload = request("GET", "/v1/betaGroups?" + urlencode({"filter[app]": app_id, "limit": "200"}))
    if status != 200:
        print("::warning::Impossible de lire la liste des groupes de test (HTTP {}). {}"
              .format(status, detail(payload)))
        publier("TESTFLIGHT_DISTRIBUTION",
                "non distribuee (liste des groupes illisible, HTTP {})".format(status))
        return 0

    groupes = [
        {
            "id": g.get("id", ""),
            "nom": str(g.get("attributes", {}).get("name") or ""),
            "interne": bool(g.get("attributes", {}).get("isInternalGroup")),
        }
        for g in payload.get("data", [])
    ]

    print("GROUPES DE TEST DECLARES SUR CETTE APP : {}".format(len(groupes)))
    for g in groupes:
        print("  - « {} »  ({})".format(g["nom"], "interne" if g["interne"] else "externe"))

    # 2. Choisir. Un seul groupe -> on le prend. Plusieurs -> ON NE DEVINE PAS.
    if not groupes:
        print("::warning::Aucun groupe de test n'existe sur cette app. Creer un groupe "
              "dans App Store Connect (TestFlight > Groupes), puis renseigner "
              "TESTFLIGHT_GROUP si vous en gardez plusieurs.")
        publier("TESTFLIGHT_DISTRIBUTION", "non distribuee (aucun groupe n'existe)")
        return 0

    if voulu:
        choisis = [g for g in groupes if g["nom"] == voulu] or \
                  [g for g in groupes if g["nom"].casefold() == voulu.casefold()]
        if not choisis:
            print("::warning::Le groupe « {} » (TESTFLIGHT_GROUP) n'existe pas sur cette "
                  "app. Les noms reels sont listes juste au-dessus : rien n'a ete "
                  "distribue, par prudence.".format(voulu))
            publier("TESTFLIGHT_DISTRIBUTION", "non distribuee (groupe « {} » introuvable)".format(voulu))
            return 0
        cible = choisis[0]
        print("Groupe choisi par reglage (TESTFLIGHT_GROUP) : « {} »".format(cible["nom"]))
    elif len(groupes) == 1:
        cible = groupes[0]
        print("Un seul groupe existe : « {} ». C'est lui, sans ambiguite.".format(cible["nom"]))
    else:
        print("::warning::{} groupes de test existent et aucun n'est designe. Distribuer "
              "au mauvais groupe enverrait une version de recette a des gens qui ne "
              "l'attendent pas : RIEN N'A ETE DISTRIBUE. Choisir un nom dans la liste "
              "ci-dessus et le poser dans TESTFLIGHT_GROUP.".format(len(groupes)))
        publier("TESTFLIGHT_DISTRIBUTION",
                "non distribuee ({} groupes possibles, aucun designe)".format(len(groupes)))
        return 0

    # 3. Rattacher. 204 = c'est fait.
    #
    # L'API expose DEUX chemins pour le MEME lien (D74) :
    #   (a) POST /v1/builds/{build}/relationships/betaGroups   <- on prend celui-la
    #   (b) POST /v1/betaGroups/{groupe}/relationships/builds  <- repli
    # (a) est celui qu'emploie fastlane/spaceship (`add_beta_groups_to_build`).
    # ⚠️ LE CORPS CHANGE AVEC LE SENS : ce qu'on met dans `data` est TOUJOURS
    # l'autre bout du lien. Recopier le chemin sans le corps donnerait un 409.
    #
    # On imprime les identifiants et l'adresse AVANT l'appel : ce ne sont pas des
    # secrets (references lisibles dans App Store Connect), et sans eux un echec
    # ne dit pas QUI est introuvable.
    print("Identifiants utilises — app : {} | build : {} | groupe « {} » : {}"
          .format(app_id, build_id, cible["nom"], cible["id"]))

    def tenter(chemin, corps):
        print("POST {}{}".format(API_ROOT, chemin))
        code, reponse = request("POST", chemin, corps)
        if code in (200, 201, 204):
            print("  -> HTTP {} : accepte.".format(code))
        else:
            print("  -> HTTP {} : REFUSE par Apple. {}".format(code, detail(reponse)))
        return code, reponse

    status, payload = tenter(
        "/v1/builds/{}/relationships/betaGroups".format(build_id),
        {"data": [{"type": "betaGroups", "id": cible["id"]}]},
    )
    if status not in (200, 201, 204):
        print("Le sens « depuis la build » n'a pas abouti : seconde tentative par "
              "l'autre sens de la meme relation, pour ne rien laisser au hasard.")
        status, payload = tenter(
            "/v1/betaGroups/{}/relationships/builds".format(cible["id"]),
            {"data": [{"type": "builds", "id": build_id}]},
        )

    if status in (200, 201, 204):
        print("Build {} rattachee au groupe « {} » (HTTP {}).".format(build_id, cible["nom"], status))
        publier("TESTFLIGHT_DISTRIBUTION", "distribuee au groupe « {} »".format(cible["nom"]))
        if not cible["interne"]:
            print("::warning::« {} » est un groupe EXTERNE : Apple exige une Beta App "
                  "Review avant que ces testeurs recoivent la build. Les groupes "
                  "INTERNES, eux, la recoivent tout de suite.".format(cible["nom"]))
    elif cible["interne"]:
        # 2026-08-11 : Apple refuse ce rattachement pour TOUT groupe interne, sur
        # les deux adresses (HTTP 422 « Cannot add internal group to a build »).
        # Ce n'est ni un chemin ni un droit : les testeurs internes recoivent
        # d'eux-memes chaque build traitee. Le refus est attendu.
        # ⚠️ « d'eux-memes » suppose la case « distribution automatique » cochee
        # sur le groupe dans App Store Connect : le temoin le dit, il ne l'affirme pas.
        print("Refus attendu : Apple ne rattache pas un groupe INTERNE par l'API (HTTP {}). "
              "Les testeurs internes recoivent la build d'eux-memes une fois traitee, "
              "si la distribution automatique est activee sur le groupe.".format(status))
        publier("TESTFLIGHT_DISTRIBUTION",
                "groupe interne « {} » : rattachement API refuse (attendu), distribution "
                "automatique par Apple si activee sur le groupe".format(cible["nom"]))
    else:
        print("::warning::Le rattachement au groupe « {} » a ete refuse (HTTP {}). {} "
              "L'envoi du binaire reste un succes ; le rattachement peut se faire a la "
              "main dans App Store Connect.".format(cible["nom"], status, detail(payload)))
        publier("TESTFLIGHT_DISTRIBUTION", "non distribuee (rattachement refuse, HTTP {})".format(status))
    return 0


def cmd_temoin(_args):
    # Ce temoin s'imprime TOUJOURS : c'est lui qu'on relit, au meme titre que
    # « CIBLE API DU BUILD », « PROJET FIREBASE DU BUILD » et l'envoi.
    etiquette = os.environ.get("TESTFLIGHT_VERSION_LABEL") or "{} ({})".format(
        os.environ.get("IOS_MARKETING_VERSION", "?"), os.environ.get("IOS_BUILD_NUMBER", "?"))
    etat = os.environ.get("TESTFLIGHT_STATE_LABEL") or "etat inconnu"
    diffusion = os.environ.get("TESTFLIGHT_DISTRIBUTION") or \
        "non distribuee (etapes de distribution non executees)"
    ligne = "ETAT TESTFLIGHT : {} — {} — {}".format(etiquette, etat, diffusion)
    print(ligne)
    resume = os.environ.get("GITHUB_STEP_SUMMARY")
    if resume:
        with open(resume, "a", encoding="utf-8") as handle:
            handle.write(ligne + "\n")
    return 0


def cmd_suivre(args):
    cmd_attendre(args)
    cmd_distribuer(args)
    return cmd_temoin(args)


def main(argv=None):
    parser = argparse.ArgumentParser(description="App Store Connect, partage GitHub/Codemagic")
    sub = parser.add_subparsers(dest="commande", required=True)
    for nom, fonction in (("prochain-numero", cmd_prochain_numero), ("attendre", cmd_attendre),
                          ("distribuer", cmd_distribuer), ("temoin", cmd_temoin),
                          ("suivre", cmd_suivre)):
        sub.add_parser(nom).set_defaults(func=fonction)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
