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

If `botToken` is set, mention the bot to control:

| Command | Description |
|---------|-------------|
| `@bot help` | Show all commands |
| `@bot status` | Catcher status |
| `@bot pause/resume` | Pause/resume catcher |
| `@bot c` | Manage channels |
| `@bot cfg` | Toggle settings |
| `@bot delay` | Adjust timing |
| `@bot log` | Set log channel |

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

### 7. Hosting on Replit

Create a Replit account at https://replit.com/login, then fork this repo.

#### 7.1. Configuration

Open **Secrets (Environment Variables)** in your Replit project (top right search icon, in the search find `Secrets`).

Add the following secrets:

| Key | Value |
|-----|-------|
| `USER_TOKEN` | Your Discord user token |
| `BOT_TOKEN` | Admin bot token (from [Create Bot Token](#create-bot-token)) |
| `OWNER_ID` | Your Discord user ID |

Click the green **Run** button. The bot should be online.

#### 7.2. Keeping the bot online 24/7

Replit will shutdown if you close the window. Use [UptimeRobot](https://uptimerobot.com/signUp) to keep it alive.

1. Sign up and go to Dashboard
2. Click **Create New Monitor**
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Anything
   - **URL**: Your Replit project URL (ends with `.repl.co`)
   - **Monitoring Interval**: 5 minutes
3. Click **Create Monitor**

### 8. Dependency

1. Node - v22.13.0
2. NPM - 10.9.2

### 9. Limitation

- It is not 100% catcher, it is a progressive learning catcher. When system fail to catch, it self auto learn and note down itself in namefix.json to make next time correct.
