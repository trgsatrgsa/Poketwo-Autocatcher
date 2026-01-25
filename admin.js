// --- admin.js ---
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const config = require("./config.js");
const state = require("./state.js");

const adminClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const commands = {
    ping: { aliases: ["p", "pong"], ownerOnly: false },
    help: { aliases: ["h", "?"], ownerOnly: false },
    status: { aliases: ["s", "stat"], ownerOnly: true },
    pause: { aliases: ["stop", "off"], ownerOnly: true },
    resume: { aliases: ["start", "on", "r"], ownerOnly: true },
};

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function resolveCommand(input) {
    if (!input) return "help";
    for (const [cmd, { aliases }] of Object.entries(commands)) {
        if (cmd === input || aliases.includes(input)) return cmd;
    }
    // Fuzzy match - find closest command (threshold: 2 edits)
    let best = null, bestDist = 3;
    for (const cmd of Object.keys(commands)) {
        const dist = levenshtein(input, cmd);
        if (dist < bestDist) { best = cmd; bestDist = dist; }
    }
    return best;
}

function showHelp(suggestion = null) {
    const embed = new EmbedBuilder()
        .setTitle("📖 Admin Bot Help")
        .setColor(0x5865f2)
        .setDescription(suggestion ? `Did you mean **${suggestion}**? Here's the command list:` : "Mention me with a command:")
        .addFields(
            { name: "p, ping", value: "Check bot latency" },
            { name: "h, help", value: "Show this message" },
            { name: "s, status", value: "Show catcher status *(owner)*" },
            { name: "pause, stop", value: "Pause autocatcher *(owner)*" },
            { name: "r, resume", value: "Resume autocatcher *(owner)*" }
        )
        .setFooter({ text: "Usage: @bot <command>" });
    return embed;
}

adminClient.on("clientReady", () => {
    console.log(`[ADMIN] ✓ Bot Online: ${adminClient.user.tag} (ID: ${adminClient.user.id})`);
    console.log(`[ADMIN] ✓ Config ownerID: "${config.ownerID}"`);
    console.log(`[ADMIN] ✓ Listening for @mentions...`);
});

adminClient.on("error", (err) => {
    console.error(`[ADMIN] ✗ Client Error:`, err.message);
});

adminClient.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const mentioned = message.mentions.has(adminClient.user);
    if (!mentioned) return;

    const input = message.content.replace(/<@!?\d+>/g, "").trim().toLowerCase();
    const cmd = resolveCommand(input);
    const isOwner = message.author.id === config.ownerID;

    // Debug logging
    console.log(`[ADMIN] ─────────────────────────────`);
    console.log(`[ADMIN] Message from: ${message.author.tag}`);
    console.log(`[ADMIN]   Author ID:  "${message.author.id}"`);
    console.log(`[ADMIN]   Config ID:  "${config.ownerID}"`);
    console.log(`[ADMIN]   ID Match:   ${isOwner ? "✓ YES (owner)" : "✗ NO (not owner)"}`);
    console.log(`[ADMIN]   Raw input:  "${input}"`);
    console.log(`[ADMIN]   Resolved:   "${cmd || "none"}"`);
    console.log(`[ADMIN] ─────────────────────────────`);

    // Check owner-only
    if (cmd && commands[cmd]?.ownerOnly && !isOwner) {
        return message.reply("🔒 Owner only command.");
    }

    switch (cmd) {
        case "ping": {
            const latency = Date.now() - message.createdTimestamp;
            return message.reply(`🏓 Pong! Latency: ${latency}ms | API: ${Math.round(adminClient.ws.ping)}ms`);
        }
        case "help":
            return message.reply({ embeds: [showHelp()] });

        case "status": {
            const statusIcon = state.isSleeping ? "🔴 Paused" : "🟢 Running";
            const embed = new EmbedBuilder()
                .setTitle("🎮 Autocatcher Control Panel")
                .setColor(state.isSleeping ? 0xff0000 : 0x00ff00)
                .addFields(
                    { name: "Status", value: statusIcon, inline: true },
                    { name: "Session Catches", value: `${state.stats.totalCaughtSession}`, inline: true },
                    { name: "Uptime", value: `<t:${Math.floor(state.stats.startTime / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: "Use @bot pause or @bot resume" });
            return message.reply({ embeds: [embed] });
        }
        case "pause":
            state.isSleeping = true;
            return message.reply("⏸️ **System Paused.** The worker will stop catching.");

        case "resume":
            state.isSleeping = false;
            return message.reply("▶️ **System Resumed.** Happy hunting!");

        default:
            // Unknown command - show help with suggestion if close match found
            const suggestion = input ? resolveCommand(input) : null;
            return message.reply({ embeds: [showHelp(suggestion)] });
    }
});

if (!config.botToken || config.botToken.trim() === "") {
    console.log(`[ADMIN] No botToken configured - admin bot disabled`);
} else {
    console.log(`[ADMIN] Starting bot...`);
    adminClient.login(config.botToken).catch((err) => {
        console.error(`[ADMIN] ✗ Login FAILED:`, err.message);
        if (err.message.includes("invalid token")) {
            console.error(`[ADMIN] ✗ Check your botToken in config.js`);
        }
    });
}