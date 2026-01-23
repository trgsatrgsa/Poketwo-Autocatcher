/*
Name: General Poketwo-Autocatcher (Refactored)
*/

// --- IMPORTS ---
const Discord = require("discord.js-selfbot-v13");
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { faker } = require("@faker-js/faker");
const Tesseract = require('tesseract.js');
const { solveHint, checkRarity } = require("pokehint");
const { ocrSpace } = require("ocr-space-api-wrapper");
const stringSimilarity = require("string-similarity");
const pokemonNames = require("pokemon");

// --- LOAD CONFIGURATION (With Safety Checks) ---
let config = require("./config.js");
try {
    // We use ./config.js now instead of .json
    config = require("./config.js");
} catch (e) {
    console.error("\n[CRITICAL ERROR] Could not find 'config.js'!");
    console.error("Please make sure the file exists and has no coding errors.\n");
    process.exit(1);
}

// --- USER INPUT VALIDATION (Friendly Errors) ---
// This section checks if the user actually filled out the config file.
if (config.userToken === "PASTE_YOUR_TOKEN_HERE" || config.userToken === "") {
    console.log("\n===================================================");
    console.log(" [STOP] YOU FORGOT TO CONFIGURE THE BOT!");
    console.log("===================================================");
    console.log(" Please open 'config.js' and paste your User Token.");
    console.log(" The bot cannot start without it.");
    console.log("===================================================\n");
    process.exit(1);
}

if (config.activateSpamming && config.spamChannelID === "PASTE_CHANNEL_ID_HERE") {
    console.log("\n[WARNING] You turned on Spamming, but didn't provide a Channel ID.");
    console.log("The bot will NOT spam messages until you fix 'spamChannelID'.\n");
    config.activateSpamming = false; // Force disable to prevent crash
}

console.log(`[STATUS] Configuration loaded successfully.`);
console.log(`[STATUS] Logged in user: ${config.ownerID ? "Valid" : "Unknown (ID missing)"}`);


// Preload Pokemon List
const customFixes = require("./namefix.json");
const ALL_POKEMON = pokemonNames.all();
const CLEAN_POKEMON_LIST = ALL_POKEMON.map((p) => ({
    original: p,
    clean: p.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
}));

// Constants
const POKETWO_ID = "716390085896962058";
const HINT_BOT_IDS = ["696161886734909481", "874910942490677270"];

// State
let isSleeping = false;
const activeBadGuesses = new Map(); // Key: ChannelID, Value: RawGuess

// --- CLIENT SETUP ---
const client = new Discord.Client({ checkUpdate: false });
const app = express();
app.listen(config.system.port || 3333, () => console.log(`[SYS] Listening on ${config.system.port}`));

// ---------------------------------------------------------
// SECTION 1: UTILITIES (The Brain)
// ---------------------------------------------------------

function getRandomInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- HELPER: DETERMINE CHANNEL TYPE ---
function getChannelMode(channelID) {
    if (config.privateChannels.includes(channelID)) return "PRIVATE";
    if (config.publicChannels.includes(channelID)) return "PUBLIC";
    return "NONE";
}

// Identification Logic
function identifyPokemon(input) {
    const cleanInput = input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    // 1. Check Custom Fixes
    if (customFixes[cleanInput]) return customFixes[cleanInput];

    // 2. Fuzzy Match
    const justNames = CLEAN_POKEMON_LIST.map((p) => p.clean);
    const matches = stringSimilarity.findBestMatch(cleanInput, justNames);

    if (matches.bestMatch.rating > 0.5) {
        const originalObj = CLEAN_POKEMON_LIST.find((p) => p.clean === matches.bestMatch.target);
        return originalObj ? originalObj.original.toUpperCase() : cleanInput;
    }
    return cleanInput; // Return raw if no good match
}

// Learning Logic
function learnCorrection(badRaw, realName) {
    const cleanBad = badRaw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const cleanReal = realName.toUpperCase();

    if (cleanBad === cleanReal.replace(/[^a-zA-Z0-9]/g, "")) return; // Don't learn identicals

    customFixes[cleanBad] = cleanReal;
    fs.writeFileSync("./namefix.json", JSON.stringify(customFixes, null, 2));
    console.log(`[LEARN] Associated "${cleanBad}" with "${cleanReal}"`);
}

// --- NEW: LOCAL HINT SOLVER (Fallback Logic) ---
function solveHintLocally(content) {
    // Content format: "The pokémon is T_rt_ig."
    // 1. Extract the pattern
    const patternMatch = content.match(/The pokémon is (.*)\./);
    if (!patternMatch) return [];

    let pattern = patternMatch[1];

    // 2. Convert Poketwo's hint format to Regex
    // "\_" (escaped underscore) -> "." (wildcard)
    // " " (space) -> ".*" or just space? Poketwo usually escapes spaces too or leaves them.
    // Let's assume standard Poketwo hint: "T _ r t _ i g" or "T_rt_ig" logic

    // Remove backslashes used for escaping
    pattern = pattern.replace(/\\/g, "");

    // Replace underscore with regex dot (.)
    const regexString = "^" + pattern.replace(/_/g, ".") + "$";
    const regex = new RegExp(regexString, "i"); // Case insensitive

    // 3. Filter our local list
    const matches = ALL_POKEMON.filter((p) => regex.test(p));
    return matches;
}

// Monitoring miscatch
async function logUnidentifiedPokemon(imageUrl, guess) {
    const dir = "./unidentified_pokemon";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const safeGuess = guess.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const timestamp = Date.now();
    const imagePath = path.join(dir, `${timestamp}_guess_${safeGuess}.png`);
    try {
        const response = await axios({ url: imageUrl, responseType: "stream" });
        response.data.pipe(fs.createWriteStream(imagePath));
        console.log(`[LOGGER] Saved unidentified Pokemon image to ${imagePath}`);
    } catch (err) {
        console.error("[ERROR] Failed to download image.");
    }
}

// ---------------------------------------------------------
// SECTION 2: ACTIONS (The Hands)
// ---------------------------------------------------------

async function performCatch(channel, pokemonName, rawOcrText = null, imageUrl = null) {
    let catchDelay = getRandomInterval(config.catchDelayMin, config.catchDelayMax);

    console.log(`[ACTION] Catching ${pokemonName} in ${catchDelay}ms...`);
    await sleep(catchDelay);

    // --- STEALTH LOGIC FOR PUBLIC CHANNELS ---
    // 1. Check if we should care about this channel
    const mode = getChannelMode(message.channel.id);
    if (mode === "NONE") return; // Ignore channels not in our lists

    if (mode === "PUBLIC") {
        // A. "Not the one always catching" (Random Skip)
        const skipRoll = Math.floor(Math.random() * 100);
        if (skipRoll < config.publicSkipChance) {
            console.log(`[STEALTH] Skipped ${pokemonToCatch} in Public Channel to look human.`);
            return; // STOP! Don't catch.
        }

        // B. "Try to catch when not much person" / Slower reaction
        // We add extra delay to simulate a human reading the screen
        const extraMs = (config.publicExtraDelay || 2) * 1000;
        catchDelay += extraMs;
        console.log(`[STEALTH] Target: ${pokemonToCatch}. Mode: PUBLIC. Added ${extraMs}ms delay.`);
    } else {
        console.log(`[FARMING] Target: ${pokemonToCatch}. Mode: PRIVATE. Catching fast.`);
    }

    // Excute catch
    await channel.send(`<@${POKETWO_ID}> catch ${pokemonName}`);

    // Create a temporary listener for the result
    const filter = (m) => m.author.id === POKETWO_ID;
    const collector = channel.createMessageCollector({ filter, max: 1, time: 10000 });

    collector.on('collect', async (msg) => {
        if (msg.content.includes("Congratulations")) {
            console.log(`[SUCCESS] Caught ${pokemonName}`);
            activeBadGuesses.delete(channel.id);

            // Log to Discord if enabled
            if (config.logChannelID && config.logChannelID !== "") {
                const logChan = client.channels.cache.get(config.logChannelID);
                if (logChan) logChan.send(`Caught **${pokemonName}** in <#${channel.id}>`);
            }
        }
        else if (msg.content.includes("wrong pokémon")) {
            console.log(`[FAIL] Wrong guess: ${pokemonName}`);
            // Store bad guess for learning later
            if (rawOcrText) activeBadGuesses.set(channel.id, rawOcrText);

            // Save image for debug
            if (config.saveErrorImages && imageUrl) {
                // Download image for backup
                await logUnidentifiedPokemon(imageUrl, pokemonName);
            }
        }
    });
}

// OCR Processor
async function processImage(url) {
    try {
        let rawText = "";

        if (!(config.ocrSpaceApiKey && config.ocrSpaceApiKey !== "")) {
            // Use internal ocr if is empty
            const { data: { text } } = await Tesseract.recognize(url, 'eng');
            rawText = text;
        } else {
            // Fallback to OCR Space
            const res = await ocrSpace(url, { apiKey: config.ocrSpaceApiKey });
            if (res.ParsedResults && res.ParsedResults[0]) {
                rawText = res.ParsedResults[0].ParsedText;
            }
        }

        const firstLine = rawText.split(/[\r\n]+/)[0].trim(); // Get first line only
        return { raw: firstLine, clean: identifyPokemon(firstLine) };

    } catch (err) {
        console.error("[OCR ERR]", err.message);
        return null;
    }
}

// ---------------------------------------------------------
// SECTION 3: EVENT HANDLING (The Flow)
// ---------------------------------------------------------

client.on("ready", () => {
    console.log(`[STATUS] Logged in as ${client.user.tag}`);

    // Start Spam Loop
    if (config.spamChannelID && config.spamChannelID !== "") {
        const spamChan = client.channels.cache.get(config.spamChannelID);
        if (!spamChan) return console.log("[WARN] Spam channel not found");

        const spamLoop = () => {
            if (!isSleeping) {
                spamChan.send(faker.lorem.sentence(3));
            }
            setTimeout(spamLoop, getRandomInterval(config.spamDelayMin, config.spamDelayMax));
        };
        spamLoop();
    }
});

client.on("messageCreate", async (message) => {
    // 1. Global Guards
    if (isSleeping && message.author.id !== config.ownerID) return;
    // Check if we should care about this channel
    const mode = getChannelMode(message.channel.id);
    if (mode === "NONE") return; // Ignore channels not in our lists

    // 2. Owner Commands
    if (message.author.id === config.ownerID) {
        if (message.content === "$resume") {
            isSleeping = false;
            return message.reply("Resumed.");
        }
    }

    // 3. Captcha Detection
    if (message.author.id === POKETWO_ID && message.content.includes("Please tell us")) {
        isSleeping = true;
        message.channel.send(`<@${POKETWO_ID}> incense pause`); // Safety
        console.log("[ALERT] Captcha detected! Bot paused.");

        // Attempt to open browser (optional)
        const match = message.content.match(/(https?:\/\/[^\s]+)/);
        if (match) import("open").then(o => o.default(match[0]));
        return;
    }

    // 4. Learning from Mistakes ("Wild X fled")
    if (message.author.id === POKETWO_ID && message.embeds[0]?.title?.includes("fled")) {
        const match = message.embeds[0].title.match(/Wild (.+) fled/);
        if (match && activeBadGuesses.has(message.channel.id)) {
            const realName = match[1];
            const badRaw = activeBadGuesses.get(message.channel.id);
            learnCorrection(badRaw, realName);
            activeBadGuesses.delete(message.channel.id);
        }
        return;
    }

    // 5. Spawn Detection (OCR)
    const hasEmbedImage = message.embeds[0]?.image;
    if (config.activateImageReader && hasEmbedImage) {
        // Check if it's a Poketwo spawn
        // Usually hints/spawns come from the Bot IDs or Poketwo itself
        if (message.author.id === POKETWO_ID || HINT_BOT_IDS.includes(message.author.id)) {

            const imageUrl = message.embeds[0].image.url;

            // Only process specific image types if needed
            if (imageUrl.includes("prediction.png") || imageUrl.includes("embed.png")) {
                const result = await processImage(imageUrl);
                if (result) {
                    await performCatch(message.channel, result.clean, result.raw, imageUrl);
                }
            }
        }
    } else {
        if (config.activateImageReader && !hasEmbedImage) console.log("[OCR] OCR enable but image is not exist!");
    }

    // 6. Hint Detection
    if (config.activateHintSolver && message.content.includes("The pokémon is")) {
        // ... Insert hint solver logic here ...
        // const name = solveHint(message.content);
        // if(name) performCatch(message.channel, name);
        let pokemon = [];
        // 1. Try External Library
        try {
            pokemon = await solveHint(message);
        } catch (err) {
            console.log("[HINT] External lib error, trying local...");
        }
        // 2. Fallback: If external lib failed, use LOCAL SOLVER
        if (!pokemon || pokemon.length === 0) {
            console.log("[HINT] External lib returned nothing. Using Local Logic.");
            pokemon = solveHintLocally(message.content);
        }
        // Catch pokemon
        if (pokemon.length > 0) {
            const name = pokemon[0]; // Take the first best guess
            if (name) performCatch(message.channel, name);
        }
    }
});

client.login(config.userToken);
