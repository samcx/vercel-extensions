---
'@vercel/vercel-extensions': patch
---

Fix extension remove and named upgrade so they target any installed extension shown in `vc extension list`, even when the install is no longer runnable.
