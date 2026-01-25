// --- state.js ---
// This file holds the data shared between the Worker and the Manager.

module.exports = {
    // Is the bot currently paused?
    isSleeping: false,

    // Temporary list of extra channels added via command
    tempPrivateChannels: [],

    // Stats (optional, for fun display)
    stats: {
        totalCaughtSession: 0,
        startTime: Date.now()
    }
};