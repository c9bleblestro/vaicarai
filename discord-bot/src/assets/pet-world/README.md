# Pet World — illustrated animation packs

The base bot renders the currently equipped pet using its actual catalog image or Discord emoji. The original animated GIF is decoded with its frame durations. If the image is static, the base render moves that sprite; it does not invent a different animal.

Optional hand-illustrated finished GIFs override the base art only when the path matches the actual pet catalog ID, theme, and action:
- <petId>/portrait-idle.gif
- <petId>/room-neon-idle.gif
- <petId>/room-rose-brincar.gif
- <petId>/room-moon-dormir.gif

Supported actions: idle, brincar, alimentar, acariciar, banho, dormir, aventura, coletar, away.
Themes: neon, rose, moon.
Each GIF should have at least two frames, stay below 8 MiB, contain no Discord controls and depict that exact pet. The bot retains actual stats and native controls outside the illustration. If a matching file is absent or invalid, the dynamic renderer is used.
The original generated cat and husky reference clips were not transferred to this repository; they depict distinct example animals and should not be installed as universal sprites.
