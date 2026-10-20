#!/usr/bin/env bash
# Installs (or removes) the LFS_TrashArcade Jules factory as a *user-level* systemd timer. No root, no system services.
#
#   tools/install_factory.sh             install / update, then enable the 15-minute timer
#   tools/install_factory.sh --uninstall stop and remove the timer, units and mirror clone (state/logs kept)
#
# Layout:
#   ~/.local/share/lfs-trasharcade-factory/repo   dedicated mirror clone, hard-reset to origin/main before every tick
#                                                 (so controller fixes deploy themselves; your working copy is never touched)
#   ~/.local/state/lfs-trasharcade-factory/       state.json + events.jsonl (append-only audit log)
#   ~/.secrets/jules_api_key                      API key, mode 600 (never committed, never logged)
#
# Ticks at :07, :22, :37, :52 (offset from other factories so they never hit the Jules API in the same second).
# Note: user timers only run while you are logged in unless lingering is enabled (loginctl enable-linger).
set -euo pipefail

REPO_SLUG="SyrisBruhh42/LFS_TrashArcade"
NAME="lfs-trasharcade-factory"
MIRROR="$HOME/.local/share/$NAME/repo"
UNIT_DIR="$HOME/.config/systemd/user"

if [[ "${1:-}" == "--uninstall" ]]; then
  systemctl --user disable --now "$NAME.timer" 2>/dev/null || true
  rm -f "$UNIT_DIR/$NAME.service" "$UNIT_DIR/$NAME.timer"
  systemctl --user daemon-reload
  rm -rf "$HOME/.local/share/$NAME"
  echo "Uninstalled. State and logs remain in ~/.local/state/$NAME (delete manually if wanted)."
  exit 0
fi

[[ -s "$HOME/.secrets/jules_api_key" ]] || { echo "Missing ~/.secrets/jules_api_key"; exit 1; }
chmod 600 "$HOME/.secrets/jules_api_key"
GH_BIN="$(command -v gh)"; [[ -n "$GH_BIN" ]] || { echo "gh CLI not found"; exit 1; }

if [[ ! -d "$MIRROR/.git" ]]; then
  mkdir -p "$(dirname "$MIRROR")"
  git -c credential.helper= -c "credential.helper=!$GH_BIN auth git-credential" clone -q "https://github.com/$REPO_SLUG.git" "$MIRROR"
fi
# Repo-local helpers only: an empty entry resets inherited helpers, then gh supplies the token from your keyring.
git -C "$MIRROR" config --unset-all credential.helper 2>/dev/null || true
git -C "$MIRROR" config --add credential.helper ""
git -C "$MIRROR" config --add credential.helper "!$GH_BIN auth git-credential"
git -C "$MIRROR" fetch -q origin main && git -C "$MIRROR" reset -q --hard origin/main

mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/$NAME.service" <<EOF
[Unit]
Description=LFS_TrashArcade Jules factory tick (reconcile + dispatch at most one session)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$MIRROR
Environment=PATH=$(dirname "$GH_BIN"):/usr/local/bin:/usr/bin:/bin
Environment=JULES_API_KEY_FILE=%h/.secrets/jules_api_key
ExecStartPre=-/usr/bin/git -C $MIRROR fetch -q origin main
ExecStartPre=-/usr/bin/git -C $MIRROR reset -q --hard origin/main
ExecStart=/usr/bin/python3 $MIRROR/tools/factory_dispatch.py
TimeoutStartSec=600
Nice=10
EOF

cat > "$UNIT_DIR/$NAME.timer" <<EOF
[Unit]
Description=Launch one LFS_TrashArcade Jules session every 15 minutes

[Timer]
OnCalendar=*-*-* *:07/15:00
AccuracySec=1s
Persistent=false
Unit=$NAME.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$NAME.timer"
systemctl --user list-timers "$NAME.timer" --no-pager
echo "Installed. Logs: journalctl --user -u $NAME.service -f   |   Status: python3 $MIRROR/tools/factory_dispatch.py --status"
