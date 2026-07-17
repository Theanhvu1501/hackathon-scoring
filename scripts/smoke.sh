#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
echo "== waiting for app =="
for i in $(seq 1 60); do curl -sf "$BASE/api/results" >/dev/null && break || sleep 2; done

echo "== board reachable =="
curl -sf "$BASE/board" >/dev/null && echo "OK board"

echo "== admin login (grab code from container logs or seed) =="
# ADMIN_CODE must be exported by caller (from seed output). Fallback: derive via a helper endpoint is not exposed; caller provides it.
: "${ADMIN_CODE:?export ADMIN_CODE from seed output}"
JAR=$(mktemp)
curl -sf -c "$JAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"code\":\"$ADMIN_CODE\"}" >/dev/null && echo "OK login"

echo "== bad code rejected =="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"code":"WRONG-CODE"}')
[ "$code" = "401" ] && echo "OK reject ($code)"

echo "== provisional leader =="
curl -sf -b "$JAR" -X POST "$BASE/api/reveal" -H 'Content-Type: application/json' -d '{"state":"provisional"}' >/dev/null
PROV=$(curl -sf "$BASE/api/results" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).rows[0].team.code))')
echo "provisional leader = $PROV"

echo "== final leader =="
curl -sf -b "$JAR" -X POST "$BASE/api/reveal" -H 'Content-Type: application/json' -d '{"state":"final"}' >/dev/null
FIN=$(curl -sf "$BASE/api/results" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).rows[0].team.code))')
echo "final leader = $FIN"

[ "$PROV" = "CV" ] && [ "$FIN" = "EV" ] && echo "OK reveal reshuffle (CV -> EV)" || { echo "FAIL reveal expected CV then EV, got $PROV then $FIN"; exit 1; }

echo "== reset to drafting =="
curl -sf -b "$JAR" -X POST "$BASE/api/reveal" -H 'Content-Type: application/json' -d '{"state":"drafting"}' >/dev/null
echo "ALL SMOKE PASSED"
