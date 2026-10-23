# Townspeople portraits

Four original character illustrations for the first Bread Crisis scenario, generated on 2026-10-23 with the built-in `image_gen` tool. The existing `public/advisor-lin-lan.png` was visually inspected for the warm painted art direction. No external game characters, downloaded artwork, or third-party game assets were used.

The generated PNGs were copied into this repository without post-processing. Each is 1086 × 1448 pixels with a genuine transparent alpha channel. PNG inspection confirmed transparent background pixels for all four assets; visual inspection confirmed a single distinct person with their hands and story prop visible.

| Character | Asset | Bytes |
| --- | --- | ---: |
| 陈禾 — farmer | `public/townspeople/farmer.png` | 1,985,486 |
| 阿诚 — mill worker | `public/townspeople/worker.png` | 1,884,168 |
| 阿芸 — market seller | `public/townspeople/seller.png` | 1,821,884 |
| 周婶 — resident | `public/townspeople/resident.png` | 1,993,052 |

## Generation prompts

Each prompt was sent as a separate built-in image generation call with `transparent_background: true`.

### farmer

```text
Use case: stylized-concept. Asset type: original town strategy game dialogue character portrait, standalone transparent PNG. Warm hand-painted semi-realistic storybook illustration with delicate visible brushwork, earthy muted colors, natural facial anatomy and expressive readable face, softly directional warm light. Similar visual polish to a 19th century town council adviser portrait: richly painted cloth, friendly believable face, modest period workwear, no modern objects. Composition: a single person centered, three-quarter body from head to below hips, both hands and prop completely visible, facing slightly toward viewer. One person ONLY, no background, no scenery, no text, no logo, no watermark, no border. Genuine transparent alpha background, clean isolated silhouette. Keep all hat/head, arms, hands and prop fully within canvas. Portrait aspect ratio approximately 3:4. Subject: Chen He, a mature East Asian male farmer in his late forties with a kindly weathered face, subtle smile and slight concern, wearing a worn straw hat, simple ochre linen shirt with sleeves rolled up and muted moss-green waistcoat/work trousers. He holds a modest small sheaf of wheat in one hand at waist level and opens his free palm as if explaining this season's harvest. Calm grounded posture. No written name in image.
```

### worker

```text
Use case: stylized-concept. Asset type: original town strategy game dialogue character portrait, standalone transparent PNG. Warm hand-painted semi-realistic storybook illustration with delicate visible brushwork, earthy muted colors, natural facial anatomy and expressive readable face, softly directional warm light. Similar visual polish to a 19th century town council adviser portrait: richly painted cloth, friendly believable face, modest period workwear, no modern objects. Composition: a single person centered, three-quarter body from head to below hips, both hands and prop completely visible, facing slightly toward viewer. One person ONLY, no background, no scenery, no text, no logo, no watermark, no border. Genuine transparent alpha background, clean isolated silhouette. Keep all hat/head, arms, hands and prop fully within canvas. Portrait aspect ratio approximately 3:4. Subject: A Cheng, a young adult East Asian male mill and bakery worker, short slightly tousled dark hair, friendly earnest face, wearing a plain cream work shirt with rolled sleeves and a flour-dusted dark gray-green apron. He holds a simple wooden tray with two small bread loaves at waist level, hands visibly supporting tray, as though showing today's output. Relaxed clear silhouette. No written name in image.
```

### seller

```text
Use case: stylized-concept. Asset type: original town strategy game dialogue character portrait, standalone transparent PNG. Warm hand-painted semi-realistic storybook illustration with delicate visible brushwork, earthy muted colors, natural facial anatomy and expressive readable face, softly directional warm light. Similar visual polish to a 19th century town council adviser portrait: richly painted cloth, friendly believable face, modest period workwear, no modern objects. Composition: a single person centered, three-quarter body from head to below hips, both hands and prop completely visible, facing slightly toward viewer. One person ONLY, no background, no scenery, no text, no logo, no watermark, no border. Genuine transparent alpha background, clean isolated silhouette. Keep all hat/head, arms, hands and prop fully within canvas. Portrait aspect ratio approximately 3:4. Subject: A Yun, an adult East Asian female market seller in her thirties with warm lively eyes and dark hair neatly tied back, wearing a simple cream blouse and warm rust-red shop apron with modest period long skirt. She carries a woven basket holding three rustic bread loaves at waist level and gently gestures toward the basket with her free hand as though speaking to a customer. Friendly practical expression, no written name in image.
```

### resident

```text
Use case: stylized-concept. Asset type: original town strategy game dialogue character portrait, standalone transparent PNG. Warm hand-painted semi-realistic storybook illustration with delicate visible brushwork, earthy muted colors, natural facial anatomy and expressive readable face, softly directional warm light. Similar visual polish to a 19th century town council adviser portrait: richly painted cloth, friendly believable face, modest period workwear, no modern objects. Composition: a single person centered, three-quarter body from head to below hips, both hands and prop completely visible, facing slightly toward viewer. One person ONLY, no background, no scenery, no text, no logo, no watermark, no border. Genuine transparent alpha background, clean isolated silhouette. Keep all hat/head, arms, hands and prop fully within canvas. Portrait aspect ratio approximately 3:4. Subject: Aunt Zhou, a middle-aged East Asian female resident in her fifties, warm softly lined face, dark hair with a few gray strands tied in a bun, wearing a muted blue wool shawl over a simple beige blouse and modest brown period skirt. She holds a small modest woven shopping basket with one bread loaf at waist level, free hand gently resting on the basket rim, looking toward viewer with a thoughtful approachable expression. No written name in image.
```

