const { src, dest, task, series } = require('gulp');
const { sh } = require('sh-thunk');
const clean = require('gulp-clean');
const { exec } = require("child_process");

/**
 * Make distributable using electron-forge (configuration in package.json)
 */
function make_distributable() {
    console.log("Making desktop application distributable .zip");

    return new Promise((resolve, reject) => {
        exec('npm run make', (err) => {
            reject(err);
        });

        resolve();
    });
}

/**
 * Reorganizes the default output structure of electron-forge make.
 */
function moveMakeOutput(){
    return src('./out/**/*')
        .pipe(dest('./dist/bin'));
};

/**
 * Cleans the original output directory from electron-forge make.
 */
function cleanOrigMakeOutput(){
    return src('out', {read: false, allowEmpty: true})
        .pipe(clean());
};

/**
 * Series
 */
const reorganizeMakeOutput = series(moveMakeOutput, cleanOrigMakeOutput);

exports.makeDistributable = make_distributable;
exports.reorganizeMakeOutput = reorganizeMakeOutput;