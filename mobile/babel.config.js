module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Bundles Drizzle's .sql migration files into the app as strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
