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
const { ocrSpace } = require("ocr-space-api-wrapper");
const stringSimilarity = require("string-similarity");
const pokemonNames = require("pokemon");

// --- LOAD CONFIG & DATA ---
const config = require(process.env.CFG || "./config.json");
const customFixes = require("./namefix.json");

// Preload Pokemon List
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

// ---------------------------------------------------------
// SECTION 2: ACTIONS (The Hands)
// ---------------------------------------------------------

async function performCatch(channel, pokemonName, rawOcrText = null, imageUrl = null) {
    const catchDelay = getRandomInterval(config.behavior.catchDelay.min, config.behavior.catchDelay.max);

    console.log(`[ACTION] Catching ${pokemonName} in ${catchDelay}ms...`);
    await sleep(catchDelay);

    await channel.send(`<@${POKETWO_ID}> catch ${pokemonName}`);

    // Create a temporary listener for the result
    const filter = (m) => m.author.id === POKETWO_ID;
    const collector = channel.createMessageCollector({ filter, max: 1, time: 10000 });

    collector.on('collect', async (msg) => {
        if (msg.content.includes("Congratulations")) {
            console.log(`[SUCCESS] Caught ${pokemonName}`);
            activeBadGuesses.delete(channel.id);

            // Log to Discord if enabled
            if (config.logging.reportCaught && config.channels.logChannelId) {
                const logChan = client.channels.cache.get(config.channels.logChannelId);
                if (logChan) logChan.send(`Caught **${pokemonName}** in <#${channel.id}>`);
            }
        }
        else if (msg.content.includes("wrong pokémon")) {
            console.log(`[FAIL] Wrong guess: ${pokemonName}`);
            // Store bad guess for learning later
            if (rawOcrText) activeBadGuesses.set(channel.id, rawOcrText);

            // Save image for debug
            if (config.logging.saveUnidentifiedImages && imageUrl) {
                // ... (Insert your save image logic here) ...
            }
        }
    });
}

// OCR Processor
async function processImage(url) {
    try {
        let rawText = "";

        if (config.behavior.ocrProvider === "tesseract") {
            const { data: { text } } = await Tesseract.recognize(url, 'eng');
            rawText = text;
        } else {
            // Fallback to OCR Space
            const res = await ocrSpace(url, { apiKey: config.credentials.ocrSpaceApiKey });
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
    if (config.behavior.autoSpam.enabled) {
        const spamChan = client.channels.cache.get(config.channels.spamChannelId);
        if (!spamChan) return console.log("[WARN] Spam channel not found");

        const spamLoop = () => {
            if (!isSleeping) {
                spamChan.send(faker.lorem.sentence(3));
            }
            setTimeout(spamLoop, getRandomInterval(config.behavior.autoSpam.intervalMin, config.behavior.autoSpam.intervalMax));
        };
        spamLoop();
    }
});

client.on("messageCreate", async (message) => {
    // 1. Global Guards
    if (isSleeping && message.author.id !== config.credentials.ownerId) return;
    if (config.channels.whitelist.length > 0 && !config.channels.whitelist.includes(message.channel.id)) return;

    // 2. Owner Commands
    if (message.author.id === config.credentials.ownerId) {
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
    if (config.behavior.useOcr && hasEmbedImage) {
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
    }

    // 6. Hint Detection
    if (config.behavior.replyToHints && message.content.includes("The pokémon is")) {
        // ... Insert hint solver logic here ...
        // const name = solveHint(message.content);
        // if(name) performCatch(message.channel, name);
    }
});

client.login(config.credentials.token);