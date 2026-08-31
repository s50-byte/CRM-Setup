---
name: frontend-deploy
description: Frontend-Änderungen sind erst nach Build + rsync nach /var/www/iv-crm sichtbar.
paths: ["frontend/**"]
---

# Frontend-Deployment

Eine Änderung unter `frontend/` ist im Browser erst sichtbar, nachdem gebaut
**und** ausgeliefert wurde. nginx serviert aus `/var/www/iv-crm`, nicht aus dem
Repo.

Aus `/home/simon/iv-crm`:

    npm --prefix frontend run build
    rsync -a --delete frontend/build/ /var/www/iv-crm/

- Ein PM2-Restart allein reicht NICHT und hat schon zu vermeintlich
  wirkungslosen Fixes geführt. PM2 betrifft nur das Backend.
- `--delete` ist nötig, damit alte `main.<hash>.js` verschwinden.
- `frontend/build/` ist eingecheckt: die neuen Bundles gehören mit in den Commit.
- Erst nach dem rsync melden, dass etwas deployed ist.
