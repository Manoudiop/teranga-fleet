#!/bin/sh
# Sauvegarde de la base PostgreSQL de Teranga Fleet.
#
#   DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/teranga-fleet ./ops/backup-db.sh
#
# Produit un fichier .dump (format custom de pg_dump, déjà compressé), vérifie
# qu'il est lisible, puis supprime les sauvegardes de plus de
# BACKUP_RETENTION_DAYS jours (14 par défaut). Si BACKUP_S3_URI est défini
# (ex. s3://mon-bucket/sauvegardes), le fichier est aussi copié hors du serveur
# avec la CLI aws (S3_ENDPOINT pour un stockage compatible S3).
#
# À planifier chaque nuit, par exemple avec cron :
#   30 2 * * * DATABASE_URL=... BACKUP_DIR=... /opt/teranga-fleet/ops/backup-db.sh >> /var/log/teranga-backup.log 2>&1
set -eu

: "${DATABASE_URL:?DATABASE_URL manquante}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# pg_dump refuse les paramètres propres à Prisma (?schema=public) : on les retire.
DB_URL="${DATABASE_URL%%\?*}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="$BACKUP_DIR/teranga-fleet-$STAMP.dump"
PARTIAL="$FILE.partial"
# Une sauvegarde interrompue ne doit jamais ressembler à une sauvegarde valide.
trap 'rm -f "$PARTIAL"' EXIT

pg_dump --format=custom --no-owner --no-privileges --dbname="$DB_URL" --file="$PARTIAL"
pg_restore --list "$PARTIAL" > /dev/null
mv "$PARTIAL" "$FILE"
echo "Sauvegarde créée : $FILE ($(du -h "$FILE" | cut -f1))"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  if [ -n "${S3_ENDPOINT:-}" ]; then
    aws s3 cp "$FILE" "$BACKUP_S3_URI/" --endpoint-url "$S3_ENDPOINT"
  else
    aws s3 cp "$FILE" "$BACKUP_S3_URI/"
  fi
  echo "Copie hors serveur : $BACKUP_S3_URI/$(basename "$FILE")"
fi

find "$BACKUP_DIR" -name 'teranga-fleet-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete |
  sed 's/^/Ancienne sauvegarde supprimée : /'
