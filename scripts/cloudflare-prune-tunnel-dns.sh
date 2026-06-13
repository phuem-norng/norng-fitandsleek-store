#!/usr/bin/env sh
# Remove A/AAAA on TUNNEL_APP_HOSTNAME so Cloudflare Tunnel CNAME is used.
# Needs: jq, curl. Token: scripts/cloudflare-tunnel-app-hostname.env

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/cloudflare-tunnel-app-hostname.env"

if ! command -v jq >/dev/null 2>&1; then
  printf "Please install jq (e.g. brew install jq)\n" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  printf "Missing %s\nCopy scripts/cloudflare-tunnel-app-hostname.env.example → %s and set CLOUDFLARE_API_TOKEN.\n" "$ENV_FILE" "$ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  printf "CLOUDFLARE_API_TOKEN is empty in %s\n" "$ENV_FILE" >&2
  exit 1
fi

: "${CLOUDFLARE_ZONE_NAME:=phuemnorng-kalapakteam.space}"
: "${TUNNEL_APP_HOSTNAME:=app.fitandsleek.phuemnorng-kalapakteam.space}"

CF_API="https://api.cloudflare.com/client/v4"

zone_resp=$(curl -sS -X GET "$CF_API/zones?name=$CLOUDFLARE_ZONE_NAME" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json")

zone_id=$(printf "%s" "$zone_resp" | jq -r '.result[0].id // empty')
if [ -z "$zone_id" ] || [ "$zone_id" = "null" ]; then
  printf "Could not resolve zone id for %s\n%s\n" "$CLOUDFLARE_ZONE_NAME" "$zone_resp" >&2
  exit 1
fi

delete_by_type_name() {
  typ="$1"
  name="$2"
  url="$CF_API/zones/$zone_id/dns_records?type=$typ&name=$name&per_page=100"
  rec_resp=$(curl -sS -X GET "$url" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")
  printf "%s" "$rec_resp" | jq -r '.result[]?.id // empty' | while read -r rid; do
    [ -z "$rid" ] && continue
    printf "Deleting %s id=%s (%s)\n" "$typ" "$rid" "$name"
    curl -sS -X DELETE "$CF_API/zones/$zone_id/dns_records/$rid" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" | jq -c '{success,errors}'
  done
}

printf "Pruning A/AAAA for %s …\n" "$TUNNEL_APP_HOSTNAME"
delete_by_type_name A "$TUNNEL_APP_HOSTNAME"
delete_by_type_name AAAA "$TUNNEL_APP_HOSTNAME"

# Remove mistaken hostname from earlier mis-routed DNS (if any)
BAD="app.fitandsleek.kalapak-team.space.${CLOUDFLARE_ZONE_NAME}"
delete_by_type_name A "$BAD"
delete_by_type_name AAAA "$BAD"

printf "Re-applying tunnel DNS route …\n"
if command -v cloudflared >/dev/null 2>&1; then
  cloudflared tunnel route dns fitandsleek-dev "$TUNNEL_APP_HOSTNAME" || true
else
  printf "cloudflared not in PATH; add CNAME in dashboard.\n" >&2
fi

printf "Done. Wait 1–2 minutes, then: https://%s\n" "$TUNNEL_APP_HOSTNAME"
