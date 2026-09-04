# HUNTER MD

Telegram-controlled multi-user WhatsApp bot with Premium gating and pairing-code connection.

## Telegram flow
`/start` → Telegram channel membership check → Premium check → Connect WhatsApp → pairing code.

The Instagram and WhatsApp buttons are promotional links. Telegram's API cannot verify Instagram follows or WhatsApp-channel follows.

## Premium
Owner: `@hunterdev0`

Owner command:
- `/addpremium USER_ID 7`
- `/addpremium USER_ID 30`
- `/addpremium USER_ID lifetime`

User commands:
- `/premium`
- `/myplan`
- `/id`
- `/menu`

## WhatsApp commands
General:
`.menu .ping .status .owner .public .private .ai .joke .meme .character .translate .emojimix`

Group:
`.groupinfo .tagall .hidetag .kick .antilink on/off .anticall on/off .autoread on/off .autoreacts on/off .antistatus on/off .antidelete on/off .accept .kickoffline`

Utility/media command names are included (`.song`, `.video`, `.facebook`, `.insta`, `.tiktok`, `.apk`, `.dp`, `.vv`, `.gdrive`, `.mf`). External downloaders are intentionally disabled in this stable deployment so it does not depend on unofficial APIs.

## ModVC deployment
1. Upload this ZIP.
2. Install command: `npm install`
3. Start command: `npm start`
4. Add environment variables from `.env.example`.
5. Set `BOT_TOKEN` to your BotFather token.
6. For force-join verification, set `REQUIRED_CHANNEL_ID` and make the bot an admin in that Telegram channel.
7. Keep the service running on port `3000` (or let ModVC provide `PORT`).

Never upload your real `.env` or `auth_info` to GitHub.
