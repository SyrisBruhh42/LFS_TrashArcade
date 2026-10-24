"""Resolve a maintenance assignment from the exact trusted base, never PR prose."""
import json
import re
import subprocess

REPOSITORY = "SyrisBruhh42/LFS_TrashArcade"
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{2,79}\Z")
SHA = re.compile(r"[0-9a-f]{40}\Z")
HASH = re.compile(r"[0-9a-f]{64}\Z")


def resolve(git, base, folder, incident_id, spec_hash):
    """Only select a reviewed record; all constraints come from trusted Git data."""
    if not ID.fullmatch(incident_id or "") or not HASH.fullmatch(spec_hash or ""):
        raise ValueError("Maintenance requires an exact reviewed incident ID and specification hash")
    try:
        catalog = json.loads(git("show", f"{base}:factory/maintenance_catalog.json"))
        if catalog.get("schema_version") != 1 or not isinstance(catalog.get("incidents"), dict):
            raise ValueError("Invalid trusted maintenance catalog")
        entry = catalog["incidents"][incident_id]
        observed = entry["observed_sha"]
        if (entry.get("status") != "approved" or entry.get("spec_hash") != spec_hash
                or entry.get("repository") != REPOSITORY or entry.get("assigned_folder") != "games/" + folder
                or entry.get("game_id") != folder[:3] or not SHA.fullmatch(observed)
                or not HASH.fullmatch(entry.get("expected_behavior_hash", ""))
                or not ID.fullmatch(entry.get("scenario_id", ""))):
            raise ValueError("Maintenance assignment does not match trusted approved scope")
        if git("merge-base", observed, base).strip() != observed:
            raise ValueError("Incident observation is not in the tested base history")
        if git("rev-parse", f"{observed}:games/{folder}") != git("rev-parse", f"{base}:games/{folder}"):
            raise ValueError("Incident game changed since diagnosis; refresh the reviewed assignment")
        manifest = json.loads(git("show", f"{base}:games/{folder}/game.json"))
        if manifest.get("phase") != entry.get("protected_phase"):
            raise ValueError("Incident protected phase does not match current base")
        return {**entry, "incident_id": incident_id}
    except (KeyError, TypeError, AttributeError, subprocess.CalledProcessError) as exc:
        raise ValueError("Trusted maintenance assignment is missing or malformed") from exc
