// --- admin.js ---
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./config.js");
const state = require("./state.js");

const CONFIG_PATH = path.join(__dirname, "config.js");

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
    channels: { aliases: ["c", "ch", "list"], ownerOnly: true },
    config: { aliases: ["cfg", "settings"], ownerOnly: true },
};

const pendingAdds = new Map();

function saveConfigArray(key) {
    const content = fs.readFileSync(CONFIG_PATH, "utf8");
    const arr = config[key];
    const arrStr = arr.map(id => `        "${id}"`).join(",\n");
    const regex = new RegExp(`${key}:\\s*\\[[\\s\\S]*?\\]`);
    const updated = content.replace(regex, `${key}: [\n${arrStr}\n    ]`);
    fs.writeFileSync(CONFIG_PATH, updated, "utf8");
    console.log(`[ADMIN] Config saved - ${key}: ${arr.length} items`);
}

function saveConfigValue(key, value) {
    const content = fs.readFileSync(CONFIG_PATH, "utf8");
    const regex = new RegExp(`(${key}:\\s*)([^,\\n]+)`);
    const valStr = typeof value === "string" ? `"${value}"` : value;
    const updated = content.replace(regex, `$1${valStr}`);
    fs.writeFileSync(CONFIG_PATH, updated, "utf8");
    console.log(`[ADMIN] Config saved - ${key}: ${value}`);
}

function saveConfig() { saveConfigArray("privateChannels"); }

function buildChannelUI(page = 0) {
    const perPage = 5;
    const channels = config.privateChannels;
    const totalPages = Math.ceil(channels.length / perPage) || 1;
    page = Math.max(0, Math.min(page, totalPages - 1));
    const start = page * perPage;
    const slice = channels.slice(start, start + perPage);

    const list = slice.length
        ? slice.map((id, i) => `\`${start + i + 1}.\` <#${id}>`).join("\n")
        : "*No channels - click ➕ to add*";

    const embed = new EmbedBuilder()
        .setTitle("📺 Private Channels")
        .setColor(0x5865f2)
        .setDescription(list)
        .setFooter({ text: `Page ${page + 1}/${totalPages} • Total: ${channels.length}` });

    // Delete buttons for each channel on current page
    const deleteRow = new ActionRowBuilder();
    slice.forEach((id, i) => {
        deleteRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`ch_del_${id}`)
                .setLabel(`${start + i + 1}`)
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
        );
    });

    // Nav row: prev, add, next
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ch_page_${page - 1}`)
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId("ch_add")
            .setEmoji("➕")
            .setLabel("Add")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`ch_page_${page + 1}`)
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
    );

    const components = [];
    if (slice.length) components.push(deleteRow);
    components.push(navRow);

    return { embed, components };
}

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

const helpPages = [
    {
        title: "📖 Help - General",
        fields: [
            { name: "p, ping", value: "Check bot latency" },
            { name: "h, help", value: "Show this help" },
            { name: "s, status", value: "Catcher status *(owner)*" },
            { name: "pause, stop", value: "Pause catcher *(owner)*" },
            { name: "r, resume", value: "Resume catcher *(owner)*" },
        ]
    },
    {
        title: "📺 Help - Channels",
        fields: [
            { name: "c", value: "Channel manager UI" },
            { name: "c add <id>", value: "Add channel" },
            { name: "c del <id>", value: "Remove channel" },
        ]
    },
    {
        title: "⚙️ Help - Config",
        fields: [
            { name: "cfg", value: "Toggle settings panel" },
            { name: "cfg hint", value: "Toggle auto hint" },
            { name: "cfg solver", value: "Toggle hint solver" },
            { name: "cfg ocr", value: "Toggle image reader" },
            { name: "cfg save", value: "Toggle save error images" },
        ]
    }
];

function buildHelpUI(page = 0, suggestion = null) {
    page = Math.max(0, Math.min(page, helpPages.length - 1));
    const p = helpPages[page];

    const embed = new EmbedBuilder()
        .setTitle(p.title)
        .setColor(0x5865f2)
        .setDescription(suggestion ? `Did you mean **${suggestion}**?` : "Mention me with a command:")
        .addFields(p.fields)
        .setFooter({ text: `Page ${page + 1}/${helpPages.length} • @bot <command>` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`help_page_${page - 1}`)
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`help_page_${page + 1}`)
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= helpPages.length - 1)
    );

    return { embed, components: [row] };
}

const toggles = [
    { key: "activateAutoHint", label: "Auto Hint", emoji: "💡" },
    { key: "activateHintSolver", label: "Hint Solver", emoji: "🧩" },
    { key: "activateImageReader", label: "OCR Reader", emoji: "👁️" },
    { key: "saveErrorImages", label: "Save Errors", emoji: "💾" },
];

function buildConfigUI() {
    const lines = toggles.map(t => {
        const val = config[t.key];
        return `${t.emoji} **${t.label}**: ${val ? "✅ ON" : "❌ OFF"}`;
    });

    const embed = new EmbedBuilder()
        .setTitle("⚙️ Settings")
        .setColor(0x5865f2)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Click to toggle" });

    const row = new ActionRowBuilder();
    toggles.forEach(t => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`cfg_${t.key}`)
                .setEmoji(config[t.key] ? "✅" : "❌")
                .setLabel(t.label)
                .setStyle(config[t.key] ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
    });

    return { embed, components: [row] };
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

    // Handle pending add replies (no @mention needed)
    const pending = pendingAdds.get(message.author.id);
    if (pending && pending.channelId === message.channelId && Date.now() < pending.expires) {
        const channelId = message.content.replace(/[<#>]/g, "").trim();
        pendingAdds.delete(message.author.id);
        if (!/^\d{17,20}$/.test(channelId)) {
            return message.reply("❌ Invalid channel ID.");
        }
        if (config.privateChannels.includes(channelId)) {
            return message.reply(`⚠️ <#${channelId}> already in list.`);
        }
        config.privateChannels.push(channelId);
        saveConfig();
        const ui = buildChannelUI(0);
        return message.reply({ content: `✅ Added <#${channelId}>`, embeds: [ui.embed], components: ui.components });
    }

    if (!message.mentions.has(adminClient.user)) return;

    const raw = message.content.replace(/<@!?\d+>/g, "").trim();
    const parts = raw.toLowerCase().split(/\s+/);
    const cmdInput = parts[0] || "";
    const subCmd = parts[1] || "";
    const arg = parts[2] || "";
    const cmd = resolveCommand(cmdInput);
    const isOwner = message.author.id === config.ownerID;

    // Debug logging
    console.log(`[ADMIN] ─────────────────────────────`);
    console.log(`[ADMIN] Message from: ${message.author.tag}`);
    console.log(`[ADMIN]   Author ID:  "${message.author.id}"`);
    console.log(`[ADMIN]   Config ID:  "${config.ownerID}"`);
    console.log(`[ADMIN]   ID Match:   ${isOwner ? "✓ YES (owner)" : "✗ NO (not owner)"}`);
    console.log(`[ADMIN]   Command:    "${cmdInput}" → "${cmd || "none"}" sub: "${subCmd}"`);
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
        case "help": {
            const ui = buildHelpUI(0);
            return message.reply({ embeds: [ui.embed], components: ui.components });
        }

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

        case "channels": {
            // c add <id>
            if (subCmd === "add" || subCmd === "+") {
                const channelId = arg.replace(/[<#>]/g, "");
                if (!channelId || !/^\d{17,20}$/.test(channelId)) {
                    return message.reply("❌ Usage: `@bot c add <channel_id>`");
                }
                if (config.privateChannels.includes(channelId)) {
                    return message.reply(`⚠️ <#${channelId}> already in list.`);
                }
                config.privateChannels.push(channelId);
                saveConfig();
                const ui = buildChannelUI(0);
                return message.reply({ content: `✅ Added <#${channelId}>`, embeds: [ui.embed], components: ui.components });
            }
            // c del <id>
            if (subCmd === "del" || subCmd === "-" || subCmd === "rm") {
                const channelId = arg.replace(/[<#>]/g, "");
                if (!channelId || !/^\d{17,20}$/.test(channelId)) {
                    return message.reply("❌ Usage: `@bot c del <channel_id>`");
                }
                const idx = config.privateChannels.indexOf(channelId);
                if (idx === -1) {
                    return message.reply(`⚠️ <#${channelId}> not in list.`);
                }
                config.privateChannels.splice(idx, 1);
                saveConfig();
                const ui = buildChannelUI(0);
                return message.reply({ content: `🗑️ Removed <#${channelId}>`, embeds: [ui.embed], components: ui.components });
            }
            // c (show UI)
            const ui = buildChannelUI(0);
            return message.reply({ embeds: [ui.embed], components: ui.components });
        }

        case "config": {
            // cfg <toggle> - quick toggle via command
            const toggleMap = { hint: "activateAutoHint", solver: "activateHintSolver", ocr: "activateImageReader", save: "saveErrorImages" };
            if (subCmd && toggleMap[subCmd]) {
                const key = toggleMap[subCmd];
                config[key] = !config[key];
                saveConfigValue(key, config[key]);
            }
            const ui = buildConfigUI();
            return message.reply({ embeds: [ui.embed], components: ui.components });
        }

        default: {
            const suggestion = cmdInput ? resolveCommand(cmdInput) : null;
            if (!suggestion) return;
            const ui = buildHelpUI(0, suggestion);
            return message.reply({ embeds: [ui.embed], components: ui.components });
        }
    }
});

// Button interaction handler
adminClient.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.user.id !== config.ownerID) {
        return interaction.reply({ content: "🔒 Owner only.", flags: MessageFlags.Ephemeral });
    }

    const id = interaction.customId;

    // Pagination
    if (id.startsWith("ch_page_")) {
        const page = parseInt(id.split("_")[2], 10);
        const ui = buildChannelUI(page);
        return interaction.update({ embeds: [ui.embed], components: ui.components });
    }

    // Delete channel
    if (id.startsWith("ch_del_")) {
        const channelId = id.replace("ch_del_", "");
        const idx = config.privateChannels.indexOf(channelId);
        if (idx !== -1) {
            config.privateChannels.splice(idx, 1);
            saveConfig();
        }
        const ui = buildChannelUI(0);
        return interaction.update({ embeds: [ui.embed], components: ui.components });
    }

    // Add channel - prompt user
    if (id === "ch_add") {
        await interaction.reply({ content: "📝 Reply with channel ID or #mention to add:", flags: MessageFlags.Ephemeral });
        pendingAdds.set(interaction.user.id, { channelId: interaction.channelId, expires: Date.now() + 60000 });
        return;
    }

    // Help pagination
    if (id.startsWith("help_page_")) {
        const page = parseInt(id.split("_")[2], 10);
        const ui = buildHelpUI(page);
        return interaction.update({ embeds: [ui.embed], components: ui.components });
    }

    // Config toggle
    if (id.startsWith("cfg_")) {
        const key = id.replace("cfg_", "");
        if (config.hasOwnProperty(key)) {
            config[key] = !config[key];
            saveConfigValue(key, config[key]);
        }
        const ui = buildConfigUI();
        return interaction.update({ embeds: [ui.embed], components: ui.components });
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