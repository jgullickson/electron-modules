const gulp = require('gulp');

const { preclean } = require('./cleanDist');
const { copyModulesDebug, copyModulesProduction } = require('./copyModules');
const { copyConfigDebug, copyConfigProduction } = require('./copyConfig');
const { build_bluetooth_server_darwin_x64, build_bluetooth_server_linux_x64, build_bluetooth_server_win32_x64 } = require('./bluetoothServer');
const { buildClientDebug, buildClientProduction } = require('./buildClient');
const { makeDistributable, reorganizeMakeOutput } = require('./maker.js');

/**
 * Full desktop client build with debug flags set to true (dev tools open, background modules visible, no minification)
 */
exports.build_debug = gulp.series(
  preclean,
  copyModulesDebug,
  copyConfigDebug,
  buildClientDebug,
  makeDistributable,
  reorganizeMakeOutput
);

/**
 * Full desktop client build with debug flags set to false (no dev tools, background modules hidden, source files minified)
 */
exports.build_production = gulp.series(
  preclean,
  copyModulesProduction,
  copyConfigProduction,
  buildClientProduction,
  makeDistributable,
  reorganizeMakeOutput
);

/**
 * Individual tasks for building platform-specific bluetooth-serial-server executables.
 */
exports.build_bluetooth_server_darwin_x64 = build_bluetooth_server_darwin_x64;
exports.build_bluetooth_server_linux_x64 = build_bluetooth_server_linux_x64;
exports.build_bluetooth_server_win32_x64 = build_bluetooth_server_win32_x64;