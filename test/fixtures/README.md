# Test fixtures

Provenance of each file, so nobody later mistakes a reconstruction for a capture.

| File | Provenance |
|---|---|
| `ravShiurim.rav674.json` | **Captured.** Item 1 is a byte-faithful `Search/WebSite_GetRavShiurim/` row for rav 674 (הרב אלימלך בידרמן), trimmed from a 24-item page down to one. Item 2 is item 1 duplicated and varied by hand to exercise the null/locked/short-duration branches and an unknown extra key (`NewFieldTheApiAddedLater`). |
| `ravShiurimCount.rav674.json` | **Captured.** The complete `Ravs/WebSite_GetRavShiurimCount/674/-1` body. |
| `cloudflare403.html` | **Captured.** The real HTTP 403 interstitial the API returned while this library was being written, head kept verbatim, the multi-KB challenge script body replaced with a short placeholder. |
| `ravFolders.rav674.json` | **Reconstructed**, not captured: every live attempt at `Ravs/GetRavMainFolders/674/-1` was answered with the Cloudflare 403 above. The key names and types come from a confirmed field list; the values are plausible fillers. Replace it with a real capture when the API is reachable again. |

Hebrew text is stored UTF-8 without a BOM. The suite asserts on it directly, which is also
what catches an encoding regression on Windows.
