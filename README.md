---
title: Fitandsleek AI Vectorize
emoji: 🔍
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Fitandsleek CLIP vectorize (512D)

Public API for **Fitandsleek** image search (Laravel → Qdrant).

| Route | Method | Body |
|-------|--------|------|
| `/health` | GET | — |
| `/vectorize` | POST | `multipart/form-data`, field **`image`** |

**Render env:**

```env
IMAGE_VECTORIZE_URL=https://norng007-fitandsleek-ai-vectorize.hf.space/vectorize
```

First request after sleep may take 1–3 minutes (CLIP load).
