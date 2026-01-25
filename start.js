// --- start.js ---
console.log("Starting System...");

// 1. Load the Admin Bot
require("./admin.js");

// 2. Load the Worker (Autocatcher)
require("./index.js");

// Note: Because they both require('./state.js'), they share the same data.