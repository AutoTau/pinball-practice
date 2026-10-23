const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle migrations are .sql files imported from drizzle/migrations.js.
config.resolver.sourceExts.push('sql');

module.exports = config;
