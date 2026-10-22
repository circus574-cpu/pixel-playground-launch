"""Pakuje animowanych potworów (/opt/renders/enemy-<id>) do paczek dostawy i nadaje każdemu osobny klucz
actorBindings '<świat>.enemy.<slug>' (packer sam daje tylko '<świat>.enemy', który zderzałby 10 wrogów jednego świata)."""
import json, subprocess, sys, os
roster = json.load(open(sys.argv[1]))
items = roster["monsters"]
only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
ok = []; bindings = {}
for e in items:
    i, w = e["id"], e["world"]
    if only and i not in only: continue
    src = "/opt/renders/enemy-" + i
    if not os.path.isdir(src + "/idle/down"): print("BRAK", i); continue
    out = "/opt/packs/enemy-%s-1.0.0" % i
    import shutil; shutil.rmtree(out, ignore_errors=True)
    r = subprocess.run(["/opt/ki-legends-gpu/bin/ki-assets-current", "run", "assets:pack", "--", src, out, "--id=enemy-" + i,
                        "--world=" + w, "--profile=enemy", "--version=1.0.0"], cwd="/opt/ki-legends-project-current", capture_output=True, text=True)
    if r.returncode: print("BLAD", i, r.stderr[-300:]); continue
    mp = out + "/manifest.json"; m = json.load(open(mp))
    slug = i[len(w) + 1:]
    bindings[i] = {"intendedKey": "%s.enemy.%s" % (w, slug), "actor": "enemy-" + i, "pack": "enemy-%s-1.0.0" % i}
    m["actorBindings"] = {}  # importer dopuszcza tylko role default|guide|hunter|merchant|smith; klucze per potwór: bindings.json
    json.dump(m, open(mp, "w"), indent=2, ensure_ascii=False)
    ok.append(i); print("PACK", i, m["actorBindings"])
json.dump(bindings, open("/opt/packs/bindings-%s.json" % (sys.argv[2][:20].replace(",", "_") if len(sys.argv) > 2 else "all"), "w"), indent=2)
print("PACK_DONE", len(ok))
