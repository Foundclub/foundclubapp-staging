#!/usr/bin/env python3
"""Minutes GitHub Actions consommees, par depot et par workflow (lecture seule).

    python scripts/ci/minutes_github.py            # 30 derniers jours, 3 depots
    python scripts/ci/minutes_github.py 7          # 7 derniers jours

Pourquoi ce script : la page de facturation de GitHub n'est lisible que par
Adel (le jeton `gh` du poste n'a pas le droit « user » qu'elle exige). Ici on
reconstitue la consommation depuis la duree de chaque TACHE, arrondie a la
minute superieure -- c'est ainsi que GitHub facture. Une minute de Mac compte
a part : 0,062 $ hors quota, soit ~10 minutes Linux du quota gratuit.

Rappel (verifie le 2026-09-25) : depot PUBLIC = gratuit ; depot PRIVE = pris
sur 2 000 minutes par mois pour TOUT le compte Foundclub (app + admin + web).
Sans moyen de paiement enregistre, GitHub BLOQUE au-dela ; avec, il FACTURE.

Utilise `gh api` (GET uniquement). Mesure du 2026-09-25 (26/08 -> 25/09) :
  app   : Linux 11 065 (App CI 8 076 dont 7 200 de tests bloques 6 h,
          Android Staging 2 618, Play 369) ; Mac 1 509 (TestFlight 1 424)
  admin : Linux 1 211 (93 envois sur staging)     web : Linux 20
"""
import json
import math
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

DEPOTS = ("Foundclub/foundclubapp-staging", "Foundclub/foundclubadmin-staging", "Foundclub/foundclubweb-staging")


def gh(chemin):
    sortie = subprocess.run(["gh", "api", chemin], capture_output=True, text=True, encoding="utf-8")
    if sortie.returncode != 0:
        raise RuntimeError(sortie.stderr.strip())
    return json.loads(sortie.stdout)


def date(texte):
    return datetime.fromisoformat(texte.replace("Z", "+00:00")) if texte else None


def mesurer(depot, depuis):
    stats = defaultdict(lambda: {"runs": 0, "linux": 0, "mac": 0, "declencheurs": defaultdict(int)})
    page = 1
    while True:
        lot = gh("repos/{}/actions/runs?per_page=100&page={}&created=>={}".format(
            depot, page, depuis.date().isoformat())).get("workflow_runs", [])
        if not lot:
            break
        for run in lot:
            s = stats[run["name"]]
            s["runs"] += 1
            s["declencheurs"][run["event"]] += 1
            # Chaque tentative (relance) est facturee.
            for tentative in range(1, run.get("run_attempt", 1) + 1):
                for tache in gh("repos/{}/actions/runs/{}/attempts/{}/jobs?per_page=100".format(
                        depot, run["id"], tentative)).get("jobs", []):
                    debut, fin = date(tache.get("started_at")), date(tache.get("completed_at"))
                    if not debut or not fin or fin < debut:
                        continue
                    minutes = math.ceil((fin - debut).total_seconds() / 60)
                    mac = "macos" in " ".join(tache.get("labels") or [])
                    s["mac" if mac else "linux"] += minutes
        page += 1
    return stats


def main():
    jours = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    depuis = datetime.now(timezone.utc) - timedelta(days=jours)
    total_linux = total_mac = 0
    for depot in DEPOTS:
        stats = mesurer(depot, depuis)
        print("== {} ({} jours depuis {})".format(depot, jours, depuis.date()))
        for nom, s in sorted(stats.items(), key=lambda kv: -(kv[1]["linux"] + kv[1]["mac"])):
            print("  {:45s} lancements={:4d} linux={:6d} mac={:5d} {}".format(
                nom, s["runs"], s["linux"], s["mac"], dict(s["declencheurs"])))
            total_linux += s["linux"]
            total_mac += s["mac"]
    # Seuls les depots PRIVES comptent dans le quota : a lire depot par depot.
    print("TOTAL DES 3 DEPOTS : linux={} min, mac={} min".format(total_linux, total_mac))


if __name__ == "__main__":
    main()
