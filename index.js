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
const { faker } = require("@faker-js/faker"); // Generates legit words

const { solveHint, checkRarity } = require("pokehint");
const { ocrSpace } = require("ocr-space-api-wrapper");

const config = require("./config.json");
const json = require("./namefix.json");
const allowedChannels = config.allowedChannels || [];
let isSleeping = false;

// Standard IDs
const POKETWO_ID = "716390085896962058";
const HINT_BOT_IDS = ["696161886734909481", "874910942490677270"]; // sierra, pokename

//------------------------- KEEP-ALIVE --------------------------------//
const app = express();
app.get("/", (req, res) => res.status(200).send({ success: "true" }));
app.listen(process.env.PORT || 3000);

//------------------------- HELPER FUNCTIONS ----------------------------//

function findOutput(input) {
  return json.hasOwnProperty(input) ? json[input] : input;
}

function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to save unidentified pokemon images
async function logUnidentifiedPokemon(imageUrl, guess) {
  const dir = "./unidentified_pokemon";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  // Clean guess string for filename
  const safeGuess = guess.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const timestamp = Date.now();
  const imagePath = path.join(dir, `${timestamp}_guess_${safeGuess}.png`);

  try {
    const response = await axios({ url: imageUrl, responseType: "stream" });
    response.data.pipe(fs.createWriteStream(imagePath));
    console.log(`[LOGGER] Saved unidentified Pokemon image to ${imagePath}`);
  } catch (err) {
    console.error(
      "[ERROR] Failed to download unidentified Pokemon image.",
      err.message
    );
  }
}

//------------------------- READY HANDLER + HUMAN SPAMMER -----------------------//

client.on("ready", () => {
  console.log(`[STATUS] Account: ${client.user.username} is ONLINE.`);
  console.log("[INFO] Human-like spamming and autocatching initialized.");

  const channel = client.channels.cache.get(config.spamChannelID);

  function spam() {
    if (!isSleeping && channel) {
      // Generates a legitimate-sounding short sentence (e.g., "The quick dog ran.")
      const legitMessage = faker.lorem.words({ min: 1, max: 4 });
      channel.send(legitMessage);
    }
    // Realistic interval for 2026: between 10 to 30 seconds
    const randomInterval = getRandomInterval(10000, 30000);
    setTimeout(spam, randomInterval);
  }
  spam();
});

//------------------------- ANTI-CRASH -------------------------//
process.on("unhandledRejection", (reason, p) => {
  if (!String(reason).includes("Unable to identify that pokemon")) {
    console.log(" [antiCrash] :: Unhandled Rejection/Catch", reason);
  }
});
process.on("uncaughtException", (err, origin) =>
  console.log(" [antiCrash] :: Uncaught Exception", err)
);

//---------------------------- AUTOCATCHER --------------------------------------//

client.on("messageCreate", async (message) => {
  // Owner Controls
  if (message.author.id === config.OwnerID) {
    if (message.content === "$captcha_completed") {
      isSleeping = false;
      return message.channel.send("✅ Autocatcher Resumed!");
    }
    if (message.content === "$help") {
      return message.channel.send(
        "```\n$captcha_completed : Restart bot after captcha\n$say <content> : Repeat text\n$react <msgID> : React with ✅\n$click <msgID> : Click button on message\n```"
      );
    }
    if (message.content.startsWith("$say")) {
      return message.channel.send(message.content.slice(5));
    }
  }

  if (isSleeping) return;

  // CAPTCHA DETECTION
  if (
    message.author.id === POKETWO_ID &&
    message.content.includes("Please tell us")
  ) {
    isSleeping = true;
    console.log("[ALERT] Captcha Detected! Sleeping.");
    return message.channel.send(
      "⚠️ Autocatcher Stopped, Captcha Detected! Solve it, then type `$captcha_completed`."
    );
  }

  // POKETWO HINT RESOLVER
  if (message.author.id === POKETWO_ID) {
    if (message.content.includes("The pokémon is")) {
      const pokemon = await solveHint(message);
      const catchDelay = getRandomInterval(3000, 8000); // 3-8 seconds delay

      console.log(
        `[DETECT] Hint detected: ${pokemon[0]}. Catching in ${
          catchDelay / 1000
        }s...`
      );
      setTimeout(async () => {
        await message.channel.send(`<@${POKETWO_ID}> c ${pokemon[0]}`);

        try {
          const rarity = await checkRarity(`${pokemon[0]}`);
          const logChannel = client.channels.cache.get(config.logChannelID);
          if (logChannel)
            logChannel.send(
              `Caught **${pokemon[0]}** (Rarity: ${rarity}) in #${message.channel.name}`
            );
        } catch (e) {
          /* Ignore rarity check errors */
        }
      }, catchDelay);
    }
    return;
  }

  // OCR / HINT BOT DETECTION (Sierra, Pokename, etc.)
  if (HINT_BOT_IDS.includes(message.author.id)) {
    if (
      allowedChannels.length > 0 &&
      !allowedChannels.includes(message.channel.id)
    )
      return;

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
        const rawName = res1.ParsedResults[0].ParsedText.split("\r")[0];
        const fixedName = findOutput(rawName.replace(/Q/g, "R"));

        // Realistic Catch Delay: 4 to 12 seconds
        const delay = getRandomInterval(4000, 12000);
        console.log(
          `[OCR] Identified: ${fixedName}. Catching in ${delay / 1000} seconds.`
        );

        setTimeout(async () => {
          await message.channel.send(`<@${POKETWO_ID}> c ${fixedName}`);

          // Collect Poketwo's response to check if guess was correct
          const filter = (msg) => msg.author.id === POKETWO_ID;
          const collector = message.channel.createMessageCollector({
            filter,
            max: 1,
            time: 15000,
          });

          collector.on("collect", async (collected) => {
            if (collected.content.includes("Congratulations")) {
              console.log(`[SUCCESS] Caught ${fixedName}!`);
              const logChannel = client.channels.cache.get(config.logChannelID);
              if (logChannel)
                logChannel.send(
                  `Successfully caught **${fixedName}** in #${message.channel.name}`
                );
            } else if (
              collected.content.includes("That is the wrong pokémon")
            ) {
              console.log(
                `[FAILED] Incorrect guess: ${fixedName}. Downloading image for review.`
              );
              // Trigger Image Downloader
              await logUnidentifiedPokemon(preferredURL, fixedName);
            }
          });
        }, delay);
      } catch (error) {
        console.error("[ERROR] OCR Processing failed.", error.message);
      }
    }
  }
});

client.login(config.TOKEN);
