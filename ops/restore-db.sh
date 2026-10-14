#!/bin/sh
# Restauration d'une sauvegarde créée par backup-db.sh.
#
#   DATABASE_URL=postgresql://... ./ops/restore-db.sh /var/backups/teranga-fleet/teranga-fleet-20261014T023000Z.dump
#
# Remplace le contenu de la base indiquée : arrêter l'API avant, puis la
# redémarrer après. Tout se fait dans une seule transaction : en cas d'erreur,
# la base reste dans son état d'origine. Une confirmation est demandée, sauf
# avec RESTORE_CONFIRM=OUI (scripts).
set -eu

FILE="${1:?Usage : restore-db.sh <fichier.dump>}"
: "${DATABASE_URL:?DATABASE_URL manquante}"
[ -f "$FILE" ] || { echo "Fichier introuvable : $FILE" >&2; exit 1; }

DB_URL="${DATABASE_URL%%\?*}"
# Cible affichée sans l'utilisateur ni le mot de passe.
TARGET="${DB_URL#*@}"

pg_restore --list "$FILE" > /dev/null

if [ "${RESTORE_CONFIRM:-}" != "OUI" ]; then
  printf 'Restaurer %s dans %s ?\nLes données actuelles de cette base seront remplacées. Tapez OUI pour continuer : ' "$FILE" "$TARGET"
  read -r ANSWER
  [ "$ANSWER" = "OUI" ] || { echo "Restauration annulée."; exit 1; }
fi

pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction \
  --dbname="$DB_URL" "$FILE"
echo "Base restaurée depuis $FILE"
