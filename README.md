Credit to https://github.com/AkshatOP/Poketwo-Autocatcher

### 1. README

What this repo does is adding something to tailor personal use case

### 2. Feature

- Offline OCR tesseract to detect Poke-Name's pokemon name, no api key needed
- Auto self correction mechanism if OCR go wrong
- Generate random legit word when spaming
- Stop incense when hit captcha
- Configure to auto sendhint, control with CD time

### 3. Usage

1. Invite Poké-Name to your own server https://top.gg/bot/874910942490677270/invite
2. Configure `config.js`
   - `userToken` - your Discord user token
   - `ownerID` - your Discord user ID
   - `botToken` - (optional) admin bot token, see [Create Bot Token](#create-bot-token)
   - `ocrSpaceApiKey` - (optional) OCR Space API key, falls back to local Tesseract if empty. Get from https://ocr.space/ocrapi
   - `ocrSpacePro` - set `true` if using OCR Space Pro account
   - `privateChannels` - channel IDs to monitor
3. `npm clean-install`
4. `node index.js`

### 4. Environment Variables

Override `config.js` values when empty (or override for `PORT`):

| Env Variable | Config Key | Description |
|-------------|------------|-------------|
| `USER_TOKEN` | `userToken` | Discord user token |
| `BOT_TOKEN` | `botToken` | Admin bot token |
| `OWNER_ID` | `ownerID` | Your Discord user ID |
| `PORT` | `system.port` | Web server port (default: 3333) |

### 5. Admin Bot Commands

If `botToken` is set, mention your bot by name to control (e.g. `@YourBotName help`):

| Command | Description |
|---------|-------------|
| `@YourBotName help` | Show all commands |
| `@YourBotName status` | Catcher status |
| `@YourBotName pause/resume` | Pause/resume catcher |
| `@YourBotName c` | Manage channels |
| `@YourBotName cfg` | Toggle settings |
| `@YourBotName delay` | Adjust timing |
| `@YourBotName log` | Set log channel |

#### Owner Commands (type in monitored channel)

| Command | Description |
|---------|-------------|
| `$ping` | Verify channel is being monitored (replies in Discord, auto-deletes after 5s) |
| `$resume` | Resume bot after captcha pause |

### 6. Create Bot Token

#### 6.1. Creating the application

Head to https://discord.com/developers/applications, log in, and click **New Application**. Enter a name and click **Create**. You can also add an avatar, click **Save Changes** afterwards.

#### 6.2. Creating the bot account

Go to the **Bot** section on the left, then click **Add Bot**, then **Yes, Do it**.

You can change:
- **Username**: Your bot's display name
- **Icon**: Your bot's avatar
- **Public Bot**: Check this so the bot can be added to servers

#### 6.3. Enabling intents

Scroll down to **Privileged Gateway Intents** and enable:
- **Server Members Intent**
- **Message Content Intent**

Click **Save Changes**.

#### 6.4. Adding to your server

Go to **OAuth2 >> URL Generator**, under **Scopes** check **Bot**.

Under **Bot Permissions** select:
- View Channels
- Send Messages
- Manage Messages
- Read Message History

Copy the generated link, open it in browser, select your server and click **Authorize**.

#### 6.5. Getting the token

Go back to the **Bot** page, click **Reset Token** and copy it (only shown once).

Set it as `botToken` in `config.js` or as `BOT_TOKEN` environment variable.

### 7. Dependency

1. Node - v22.13.0
2. NPM - 10.9.2

### 8. Limitation

- It is not 100% catcher, it is a progressive learning catcher. When system fail to catch, it self auto learn and note down itself in namefix.json to make next time correct.
