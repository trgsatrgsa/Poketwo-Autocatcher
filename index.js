/*
Name: General Poketwo-Autocatcher
Version: 2026 Edition
Description: A generalized, human-like bot to assist with catching Pokemons.
*/

const Discord = require("discord.js-selfbot-v13");
const client = new Discord.Client({ checkUpdate: false });
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { faker } = require("@faker-js/faker");
const Tesseract = require('tesseract.js');

// Import external solvers
const { solveHint, checkRarity } = require("pokehint");
const { ocrSpace } = require("ocr-space-api-wrapper");

// Import Smart Matching Libraries
const stringSimilarity = require("string-similarity");
const pokemonNames = require("pokemon");
const customFixes = require("./namefix.json");

// Map to store bad guesses per channel
// Key: Channel ID, Value: The Raw OCR Text
const activeBadGuesses = new Map();

// --- CONFIGURATION ---
APP_CONFIG_FILE = process.env.CFG || "./config.json";
console.log(`[STATUS] Config Path: ${APP_CONFIG_FILE}`);
const config = require(APP_CONFIG_FILE);
console.log(`[STATUS] Config: ${JSON.stringify(config)}`);
const allowedChannels = config.allowedChannels || [];
let isSleeping = false;

// Standard IDs
const POKETWO_ID = "716390085896962058";
const HINT_BOT_IDS = ["696161886734909481", "874910942490677270"];

// 1. PRELOAD POKEMON LIST (The Brain)
// We get all names, then clean them (remove special chars) for better matching
const ALL_POKEMON = pokemonNames.all();
const CLEAN_POKEMON_LIST = ALL_POKEMON.map((p) => ({
  original: p,
  clean: p.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
}));

//------------------------- KEEP-ALIVE --------------------------------//
const app = express();
app.get("/", (req, res) => res.status(200).send({ success: "true" }));
DEFAULT_APP_PORT = process.env.PORT || config.DEFAULT_APP_PORT || 3333;
console.log(`[STATUS] Port: ${DEFAULT_APP_PORT}`);
app.listen(DEFAULT_APP_PORT);

//------------------------- HELPER FUNCTIONS ----------------------------//

function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- NEW: SMART POKEMON IDENTIFIER (For OCR) ---
function identifyPokemon(ocrInput) {
  // 1. Clean the input
  const cleanInput = ocrInput.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  console.log(`[INDENTIFY] Clean input from ${ocrInput} -> ${cleanInput}`);

  // 2. Check Manual JSON Fixes first
  if (customFixes.hasOwnProperty(cleanInput)) {
    console.log(`[INDENTIFY] Use custom fix!`);
    return customFixes[cleanInput];
  }

  // 3. Fuzzy Match against the list
  // We match against the 'clean' versions of pokemon names
  const justNames = CLEAN_POKEMON_LIST.map((p) => p.clean);
  const matches = stringSimilarity.findBestMatch(cleanInput, justNames);
  const bestMatch = matches.bestMatch;

  // Confidence check (>50%)
  if (bestMatch.rating > 0.5) {
    // Find the original name based on the matched clean name
    const originalObj = CLEAN_POKEMON_LIST.find(
      (p) => p.clean === bestMatch.target
    );
    console.log(`[INDENTIFY] Use fuzzy match!`);
    return originalObj ? originalObj.original.toUpperCase() : cleanInput;
  }

  return cleanInput;
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

function learnCorrection(badNameRaw, realName) {
  // 1. Clean the bad name exactly like identifyPokemon does
  const cleanBadKey = badNameRaw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const cleanRealValue = realName.toUpperCase().trim();

  // 2. Prevent loops (don't map "PIKACHU" to "PIKACHU")
  if (cleanBadKey === cleanRealValue.replace(/[^a-zA-Z0-9]/g, "")) return;

  // 3. Update Memory (Immediate effect)
  customFixes[cleanBadKey] = cleanRealValue;
  console.log(`[AUTO-LEARN] Learned new fix: "${cleanBadKey}" -> "${cleanRealValue}"`);

  // 4. Save to File (Permanent effect)
  try {
    fs.writeFileSync(
      "./namefix.json",
      JSON.stringify(customFixes, null, 2), // Pretty print
      "utf8"
    );
  } catch (err) {
    console.error("[ERROR] Could not save namefix.json:", err);
  }
}


//------------------------- MAIN BOT LOGIC -----------------------//

client.on("ready", () => {
  console.log(`[STATUS] Account: ${client.user.username} is ONLINE.`);
  const channel = client.channels.cache.get(config.spamChannelID);

  function spam() {
    if (!isSleeping && channel) {
      const legitMessage = faker.lorem.words({ min: 1, max: 4 });
      channel.send(legitMessage);
    }
    setTimeout(spam, getRandomInterval(30000, 60000));
  }

  if (config.switchSpam) {
    // start spam service
    spam();
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reportCaught(name) {
  try {
    const rarity = await checkRarity(name);
    const logChannel = client.channels.cache.get(config.logChannelID);
    const datenow = new Date();
    const formattedDateTimeShort = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "short",
      timeStyle: "long",
    }).format(datenow);
    if (logChannel)
      logChannel.send(
        `Caught **${name}** (Rarity: ${rarity}) [${formattedDateTimeShort}]`
      );
  } catch (e) {
    console.log(`[ERR] Fail to get rarity, ${e}`);
  }
}

client.on("messageCreate", async (message) => {
  const catchDelay = getRandomInterval(config.DELAY_MIN, config.DELAY_MAX);

  // [Owner Commands omitted for brevity - keep your existing ones]
  if (
    message.author.id === config.OwnerID &&
    message.content === "$captcha_completed"
  ) {
    isSleeping = false;
    return message.channel.send("✅ Autocatcher Resumed!");
  }
  if (isSleeping) return;

  // CAPTCHA
  if (
    message.author.id === POKETWO_ID &&
    message.content.includes("Please tell us")
  ) {
    isSleeping = true;
    await sleep(1000);
    await message.channel.send(`<@${POKETWO_ID}> incense pause`);

    // Open with url
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = message.content.match(urlRegex);
    const captchaUrl = match[0];

    // Dynamic import works in CommonJS for ESM-only packages
    import("open").then((openModule) => {
      const open = openModule.default;
      open(captchaUrl);
    });
    return;
  }

  // Guard on only allowed channel
  if (
    allowedChannels.length > 0 &&
    !allowedChannels.includes(message.channel.id)
  )
    return;

  // --- NEW: LISTEN FOR "FLED" MESSAGE (The Learning Moment) ---
  if (
    message.author.id === POKETWO_ID &&
    message.embeds.length > 0 &&
    message.embeds[0].title &&
    message.embeds[0].title.includes("Wild") &&
    message.embeds[0].title.includes("fled")
  ) {
    const title = message.embeds[0].title;
    const match = title.match(/Wild (.+) fled/);

    // Check if THIS channel has a pending bad guess
    if (match && activeBadGuesses.has(message.channel.id)) {
      const realPokemonName = match[1];
      const badGuessRaw = activeBadGuesses.get(message.channel.id); // Retrieve guess

      console.log(`[MISSED] Channel ${message.channel.name}: The pokemon was actually: ${realPokemonName}`);

      // TRIGGER THE LEARNING PROCESS
      learnCorrection(badGuessRaw, realPokemonName);

      // Remove from memory so we don't learn it twice
      activeBadGuesses.delete(message.channel.id);
    }
  }

  // --- Send hint if wild pokemon appear ---
  const embedTitle = message.embeds[0]?.title;

  // // Checking if it contains data before proceeding
  // if (config.switchSendHint && embedTitle) {
  //   // Example: checking if it is a Pokétwo spawn
  //   if (embedTitle.includes("has appeared")) {
  //     console.log(embedTitle);
  //     await sleep(1000); // Wait for 1 second before hint(1000 milliseconds)
  //     // Your logic here
  //     await message.channel.send(`<@${POKETWO_ID}> hint`);
  //     return;
  //   }
  // }

  // // --- IMPROVED HINT SOLVER ---
  // if (
  //   message.author.id === POKETWO_ID &&
  //   message.content.includes("The pokémon is")
  // ) {
  //   let pokemon = [];
  //   // 1. Try External Library
  //   try {
  //     pokemon = await solveHint(message);
  //   } catch (err) {
  //     console.log("[HINT] External lib error, trying local...");
  //   }

  //   // 2. Fallback: If external lib failed, use LOCAL SOLVER
  //   if (!pokemon || pokemon.length === 0) {
  //     console.log("[HINT] External lib returned nothing. Using Local Logic.");
  //     pokemon = solveHintLocally(message.content);
  //   }

  //   // 3. Catch if we found something
  //   if (pokemon.length > 0) {
  //     const name = pokemon[0]; // Take the first best guess
  //     console.log(
  //       `[HINT SOLVED] Result: ${name}. Catching in ${catchDelay / 1000}s.`
  //     );

  //     setTimeout(async () => {
  //       await message.channel.send(`<@${POKETWO_ID}> catch ${name}`);
  //       // Optional: Check Rarity
  //       try {
  //         const rarity = await checkRarity(name);
  //         const logChannel = client.channels.cache.get(config.logChannelID);
  //         const datenow = new Date();
  //         const formattedDateTimeShort = new Intl.DateTimeFormat("en-GB", {
  //           dateStyle: "short",
  //           timeStyle: "long",
  //         }).format(datenow);
  //         if (logChannel)
  //           logChannel.send(
  //             `Caught **${name}** (Rarity: ${rarity}) [${formattedDateTimeShort}]`
  //           );
  //       } catch (e) {
  //         console.log(`[ERR] Fail to get rarity, ${e}`);
  //       }
  //     }, catchDelay);
  //   } else {
  //     console.log("[HINT FAILED] Could not solve hint locally or externally.");
  //   }
  //   return;
  // }

  // Tesseract: OCR
  if (true) {
    let preferredURL = null;
    message.embeds.forEach((e) => {
      if (
        e.image &&
        (e.image.url.includes("prediction.png") ||
          e.image.url.includes("embed.png"))
      ) {
        preferredURL = e.image.url;
      }
    });
    if (preferredURL) {


      const { data: { text } } = await Tesseract.recognize(preferredURL, 'eng');
      const rawName = text.split('\n')[0].trim();

      // USE NEW IDENTIFY LOGIC
      const fixedName = identifyPokemon(rawName);

      // catch delay
      console.log(
        `[TSR OCR] Identified: ${fixedName} (Raw: ${rawName}). Waiting ${catchDelay / 1000
        }s.`
      );

      setTimeout(async () => {
        await message.channel.send(`<@${POKETWO_ID}> catch ${fixedName}`);

        const filter = (msg) => msg.author.id === POKETWO_ID;
        const collector = message.channel.createMessageCollector({
          filter,
          max: 1,
          time: 15000,
        });

        collector.on("collect", async (collected) => {
          if (collected.content.includes("Congratulations")) {
            console.log(`[SUCCESS] Caught ${fixedName}!`);

            // If we caught it, remove any bad guess data for this channel (cleanup)
            activeBadGuesses.delete(message.channel.id);

            // report to log channel
            await reportCaught(fixedName);

          } else if (collected.content.includes("That is the wrong")) {
            console.log(`[FAILED] Incorrect guess: ${fixedName} in #${message.channel.name}`);

            // --- STORE GUESS WITH CHANNEL ID ---
            // Key: Channel ID, Value: Raw Name from OCR
            activeBadGuesses.set(message.channel.id, rawName);

            // Download image for backup
            await logUnidentifiedPokemon(preferredURL, fixedName);
          }
        });

      }, catchDelay);
    }
  }

  // --- IMPROVED OCR (PREVIOUSLY DISCUSSED) ---
  if (config.switchOcr && HINT_BOT_IDS.includes(message.author.id)) {
    let preferredURL = null;
    message.embeds.forEach((e) => {
      if (
        e.image &&
        (e.image.url.includes("prediction.png") ||
          e.image.url.includes("embed.png"))
      ) {
        preferredURL = e.image.url;
      }
    });

    if (preferredURL) {
      try {
        const res1 = await ocrSpace(preferredURL, {
          apiKey: config.ocrSpaceApiKey,
        });

        // CHECK IF OCR FOUND TEXT
        if (
          !res1.ParsedResults ||
          res1.ParsedResults.length === 0 ||
          !res1.ParsedResults[0].ParsedText
        ) {
          console.log("[OCR FAILED] Empty result. Saving image.");
          await logUnidentifiedPokemon(preferredURL, "NO_TEXT");
          return;
        }

        const rawName = res1.ParsedResults[0].ParsedText.split("\r")[0];

        // USE NEW IDENTIFY LOGIC
        const fixedName = identifyPokemon(rawName);

        // catch delay
        console.log(
          `[OCR] Identified: ${fixedName} (Raw: ${rawName}). Waiting ${catchDelay / 1000
          }s.`
        );

        setTimeout(async () => {
          await message.channel.send(`<@${POKETWO_ID}> catch ${fixedName}`);

          const filter = (msg) => msg.author.id === POKETWO_ID;
          const collector = message.channel.createMessageCollector({
            filter,
            max: 1,
            time: 15000,
          });

          collector.on("collect", async (collected) => {
            if (collected.content.includes("Congratulations")) {
              console.log(`[SUCCESS] Caught ${fixedName}!`);
              // ... Log success
            } else if (
              collected.content.includes("That is the wrong pokémon")
            ) {
              console.log(`[FAILED] Incorrect guess. Downloading.`);
              await logUnidentifiedPokemon(preferredURL, fixedName);
            }
          });
        }, catchDelay);
      } catch (error) {
        console.error("[ERROR] OCR Processing failed.", error.message);
        await logUnidentifiedPokemon(preferredURL, "OCR_ERROR");
      }
    }
  }
});

client.login(config.TOKEN);
