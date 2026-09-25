#!/usr/bin/env python3
"""Codemagic depuis le poste : lancer une TestFlight et lire les builds.

    python scripts/ci/ios/codemagic.py dernieres
    python scripts/ci/ios/codemagic.py etat <identifiant de build>
    python scripts/ci/ios/codemagic.py lancer 2.6.68 [--api-env staging] [--attendre-apple] [--branche staging]

LE JETON NE S'AFFICHE JAMAIS. Il est lu dans un fichier que seul Adel remplit
(decision d'Adel du 2026-09-25, « jeton oui ») :
    C:/Users/adelf/.foundclub-secrets/codemagic/api_token.txt
(autre chemin possible par la variable CODEMAGIC_TOKEN_FILE). Il ne part que
dans l'en-tete `x-auth-token` ; aucune ligne de ce script ne l'imprime, et un
message d'erreur de Codemagic ne le contient pas.

⚠️ `lancer` DEPENSE des minutes : 500 par mois, ~20-25 par TestFlight.
Regle d'Adel du 2026-09-25 : UNE TestFlight par jour au plus, en regroupant
les lots. `lancer` est donc un geste de chef d'orchestre, avec la recolte.

Les entrees de la build (version, cible API, attente d'Apple) partent deux
fois : en `inputs` (entrees du workflow) ET en variables d'environnement, car
la documentation de l'API ne dit pas lesquelles elle honore. Si aucune ne
passait, l'etape « Version demandee » s'arrete en moins d'une minute.

Bibliotheque standard uniquement. Controle : python scripts/ci/ios/test_scripts_ios.py
"""
import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ.get("CODEMAGIC_API_ROOT") or "https://api.codemagic.io"
DEPOT = "foundclubapp-staging"
WORKFLOW = "ios-testflight"
FICHIER_JETON = Path(os.environ.get("CODEMAGIC_TOKEN_FILE")
                     or Path.home() / ".foundclub-secrets" / "codemagic" / "api_token.txt")


def jeton():
    try:
        valeur = FICHIER_JETON.read_text(encoding="utf-8-sig").strip()
    except OSError:
        valeur = ""
    if not valeur:
        raise SystemExit("Jeton Codemagic introuvable ou vide : {} (voir CONSTRUIRE_LES_VERSIONS.md §1.7)."
                         .format(FICHIER_JETON))
    return valeur


def appel(methode, chemin, corps=None):
    donnees = json.dumps(corps).encode("utf-8") if corps is not None else None
    requete = urllib.request.Request(API + chemin, data=donnees, method=methode)
    requete.add_header("x-auth-token", jeton())
    requete.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(requete, timeout=60) as reponse:
            brut = reponse.read()
            return reponse.status, (json.loads(brut) if brut else {})
    except urllib.error.HTTPError as exc:
        brut = exc.read()[:500].decode("utf-8", "replace")
        raise SystemExit("Codemagic refuse {} {} : HTTP {} {}".format(methode, chemin, exc.code, brut))
    except urllib.error.URLError as exc:
        raise SystemExit("Codemagic injoignable ({} {}) : {}".format(methode, chemin, exc.reason))


def application():
    _, reponse = appel("GET", "/apps")
    for app in reponse.get("applications", []):
        if DEPOT in json.dumps(app):
            return app
    raise SystemExit("Aucune application Codemagic ne porte le depot {} : Adel l'a-t-il ajoutee "
                     "(CONSTRUIRE_LES_VERSIONS.md §6, etape C) ?".format(DEPOT))


def ligne(build):
    return "{} | {} | {} | branche {} | {} -> {}".format(
        build.get("_id", "?"), build.get("status", "?"), " ".join(build.get("labels") or []) or "-",
        build.get("branch", "?"), str(build.get("startedAt") or "-")[:16], str(build.get("finishedAt") or "-")[:16])


def cmd_dernieres(_args):
    app = application()
    _, reponse = appel("GET", "/builds?appId={}".format(app["_id"]))
    builds = reponse.get("builds", [])
    print("DERNIERES BUILDS CODEMAGIC ({} lues) :".format(len(builds)))
    for build in builds[:5]:
        print("  - " + ligne(build))

    # Minutes du mois : chaque build arrondie a la minute superieure, comme le
    # decompte des 500 minutes gratuites (remises a zero le 1er). Estimation :
    # la page Billing de Codemagic fait foi.
    mois = datetime.now(timezone.utc).strftime("%Y-%m")
    minutes = 0
    for build in builds:
        debut, fin = build.get("startedAt"), build.get("finishedAt")
        if debut and fin and str(debut).startswith(mois):
            duree = (datetime.fromisoformat(str(fin).replace("Z", "+00:00"))
                     - datetime.fromisoformat(str(debut).replace("Z", "+00:00"))).total_seconds()
            minutes += math.ceil(max(duree, 0) / 60)
    print("MINUTES CODEMAGIC CE MOIS ({}) : ~{} sur 500 (builds lues seulement)".format(mois, minutes))
    return 0


def cmd_etat(args):
    _, reponse = appel("GET", "/builds/{}".format(args.build))
    build = reponse.get("build", reponse)
    print("BUILD CODEMAGIC : " + ligne(build))
    # Code 1 seulement pour un echec avere ; en cours ou fini = 0.
    return 1 if build.get("status") in ("failed", "canceled", "timeout") else 0


def cmd_lancer(args):
    app = application()
    attendre = "true" if args.attendre_apple else "false"
    corps = {
        "appId": app["_id"],
        "workflowId": WORKFLOW,
        "branch": args.branche,
        "labels": ["{} {}".format(args.version, args.api_env)],
        "inputs": {
            "marketing_version": args.version,
            "api_env": args.api_env,
            "force_revenuecat_rail": args.force_revenuecat_rail,
            "attendre_apple": args.attendre_apple,
        },
        "environment": {"variables": {
            "IOS_MARKETING_VERSION": args.version,
            "API_ENV": args.api_env,
            "FC_FORCE_REVENUECAT_RAIL": args.force_revenuecat_rail,
            "ATTENDRE_APPLE": attendre,
        }},
    }
    _, reponse = appel("POST", "/builds", corps)
    build_id = reponse.get("buildId", "?")
    print("BUILD CODEMAGIC LANCEE : {} — version {} — cible {} — attendre Apple {}".format(
        build_id, args.version, args.api_env, attendre))
    print("A suivre : python scripts/ci/ios/codemagic.py etat {}".format(build_id))
    print("Page : https://codemagic.io/app/{}/build/{}".format(app["_id"], build_id))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Codemagic : lancer et lire les TestFlight")
    sub = parser.add_subparsers(dest="commande", required=True)
    sub.add_parser("dernieres").set_defaults(func=cmd_dernieres)
    p_etat = sub.add_parser("etat")
    p_etat.add_argument("build")
    p_etat.set_defaults(func=cmd_etat)
    p_lancer = sub.add_parser("lancer")
    p_lancer.add_argument("version")
    p_lancer.add_argument("--api-env", choices=["production", "staging"], default="production")
    p_lancer.add_argument("--attendre-apple", action="store_true")
    p_lancer.add_argument("--force-revenuecat-rail", default="")
    p_lancer.add_argument("--branche", default="staging")
    p_lancer.set_defaults(func=cmd_lancer)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
