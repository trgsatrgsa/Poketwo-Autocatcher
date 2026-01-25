Credit to https://github.com/AkshatOP/Poketwo-Autocatcher

### README

What this repo does is adding something to tailor personal use case

### Feature

- Offline OCR tesseract to detect Poke-Name's pokemon name, no api key needed
- Auto self correction mechanism if OCR go wrong
- Generate random legit word when spaming
- Stop incense when hit captcha
- Configure to auto sendhint, control with CD time

### Usage

1. Invite Poké-Name to your own server https://top.gg/bot/874910942490677270/invite
2. Modify `config.js`, replace `XXXXXXXXX` to your according value
   1. change the `userToken` to your token
   2. change the `ownerID` with your user ID
   3. copy your channel id that want to caught and update in `privateChannels`
3. `npm clean-install`, install with fix library version avoid version mismatch
4. run with `node index.js` to start the server

### Create Bot token

1. Go to Discord Developer Portal
   - https://discord.com/developers/applications
2. Create Application
   - Click "New Application"
   - Name it, accept ToS, click "Create"
3. Configure Bot
   1. Navigate to Bot section on left
   2. Get Token
      - Under "Token" section, click "Reset Token"
      - Copy it (only shown once) — this goes in your config.js
   3. Under "Authorization Flow", Public Bot - Checked
   4. Under "Privileged Gateway Intents"
      - "Message Content Intent" - Enable
      - "Server Members Intent" - Enable
4. Invite Bot to Server
   1. Left sidebar → "OAuth2" → "OAuth2 URL Generator"
   2. Under `Scopes`: select `bot`
   3. BotPermission
      1. General Permissions: View Channels
      2. Text Permissions: Send Messages, Manage Messages, Read Message History
   4.  Copy generated URL, open in browser, select server
5. Use Token
   - Paste token in your config where botToken is expected

### Dependency

1. Node - v22.13.0
2. NPM - 10.9.2

### Limitation

- It is not 100% catcher, it is a progressive learning catcher. When system fail to catch, it self auto learn and note down itself in namefix.json to make next time correct.
