// =========================================================================
//  POKETWO AUTOCATCHER - CONFIGURATION FILE
// =========================================================================
//  HOW TO EDIT:
//  1. Only change the text inside the "quotes" or change false to true.
//  2. Do not remove commas (,) at the end of lines.
//  3. Anything starting with // is a comment to help you.
// =========================================================================

module.exports = {
    // ============================
    // SECTION 1: ACCOUNT CREDENTIALS
    // ============================

    // Your Discord User Token. (NOT a Bot Token).
    // Example: "NzkyNzE1NDU0MTk2MDg4ODQy.X-hvzA.Ov4..."
    // Watch a YouTube video on "How to get Discord User Token" if you don't know this.
    userToken: "",

    // (Optional) Bot Token for Admin Bot.
    // Example: "MTQ2NDk4MTY1NzI4NjA4MjU5MA.G996i-.abc123..."
    // Leave empty "" if you do not want admin bot features.
    botToken: "",

    // Your User ID. Used so the bot knows who the "Master" is.
    // Example: "123456789012345678" (must be a string with quotes!)
    // Enable 'Developer Mode' in Discord Settings -> Advanced, then Right Click your Name -> Copy ID.
    ownerID: "",

    // (Optional) OCR Space API Key. Falls back to local Tesseract if empty.
    // Example: "K87771060788957"
    // Get one at: https://ocr.space/ocrapi
    ocrSpaceApiKey: "",

    // Set to true if you have an OCR Space Pro account.
    // Uses the faster pro endpoint: https://apipro1.ocr.space/parse/image
    ocrSpacePro: false,

    // ============================
    // SECTION 2: CHANNEL SETTINGS
    // ============================

    // LIST 1: PRIVATE FARMING CHANNELS
    // In these channels, the bot will spam (if enabled) and catch AS FAST AS POSSIBLE.
    // Example: ["09876543210987654321", "12345678901234567890"] (must be strings with quotes!)
    // Best for your private server.
    privateChannels: [],

    // (Not yet implemented) Public / Community Channels.
    // In stealth mode: catches less frequently and waits longer.
    // Leave empty [] for now.
    publicChannels: [],


    // ============================
    // SECTION 3: REPORTING & LOGGING
    // ============================

    // Channel ID to send catch logs (e.g., "Caught Pikachu").
    // Example: "123456789012345678"
    // Leave empty "" if you do not want logs.
    logChannelID: "",

    // Channel ID to spam random messages.
    // Example: "123456789012345678"
    // Leave empty "" if you do not want to spam.
    spamChannelID: "",

    // (Advanced) Technical settings. Do not modify unless you know what you are doing.
    system: { port: 3333 },

    // ============================
    // SECTION 4: BEHAVIOR SETTING
    // ============================

    // Should the bot automatically ask for a hint when a pokemon spawns?
    // This is very useful if OCR fails. The bot will see the hint and solve it.
    activateAutoHint: false,

    // How long to wait (in milliseconds) before asking for a hint?
    // 1000ms = 1 second.
    autoHintDelay: 2000,

    // SAFETY COOLDOWN: Minimum time (ms) between two hint commands.
    // If pokemon spawn too fast, the bot will WAIT until this time passes.
    // Recommended: 60000 (60 seconds) to avoid "You are typing too fast" or ignored commands.
    hintCooldown: 60000,

    // Should the bot try to solve hints (e.g. "The pokemon is P_k_c_u")?
    activateHintSolver: true,

    // Should the bot read images (OCR) to catch wild pokemon?
    activateImageReader: true,

    // Should the bot save an image to your computer if it fails to identify a pokemon?
    // Useful for fixing bugs. Files are saved in "unidentified_pokemon" folder.
    saveErrorImages: true,

    // ============================
    // SECTION 4a: DELAYS & TIMING (For Private Channels)
    // ============================

    // Time is in Milliseconds (1000ms = 1 second).
    // Minimum time to wait before catching.
    catchDelayMin: 3000,
    // Maximum time to wait before catching.
    catchDelayMax: 5000,

    // Minimum time to wait between spam messages. (default: 30000ms = 30s)
    spamDelayMin: 30000,
    // Maximum time to wait between spam messages. (default: 60000ms = 60s)
    spamDelayMax: 60000,


};