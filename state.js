// --- state.js ---
// This file holds the data shared between the Worker and the Manager.

module.exports = {
    // Is the bot currently paused?
    isSleeping: false,

    // Stats (optional, for fun display)
    stats: {
        totalCaughtSession: 0,
        startTime: Date.now()
    }
};