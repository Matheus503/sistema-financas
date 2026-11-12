const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const monorepoRoot = path.resolve(__dirname, "../..");
config.watchFolders = [monorepoRoot];

// The Next.js dev server replaces files under .next while Metro watches the
// monorepo root. Exclude those transient build artifacts from Metro's file map.
const nextBuildArtifacts = /(^|[\\/])\.next([\\/]|$)/;
config.resolver.blockList = new RegExp(
  `(?:${config.resolver.blockList.source})|(?:${nextBuildArtifacts.source})`,
);

module.exports = config;
