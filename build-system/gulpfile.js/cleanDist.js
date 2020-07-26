const { src, task, series } = require('gulp');
let clean = require('gulp-clean');
const { sh } = require('sh-thunk');
const os = require('os');
const fs = require('fs');

/**
 * Cleans dist directory if present
 */
function clean_dist_dir(){
    return src('dist', { read: false, allowEmpty: true })
        .pipe(clean());
};

/**
 * Make dist directory.
 */
function make_dist_dir() {
    return new Promise((resolve, reject) => {
        fs.mkdir('./dist', (err) => {
            if (err) {
                reject(err);
            }

            resolve();
        });
    });
}

/**
 * Creates new dist bin directory.
 */
 function make_bin_dir() {
    return new Promise((resolve, reject) => {
        fs.mkdir('./dist/bin', (err) => {
            if (err) {
                reject(err);
            }

            resolve();
        });
    });
 };

 /**
  * Creates new code directory.
  */
 function make_code_dir() {
    return new Promise((resolve, reject) => {
        fs.mkdir('./dist/code', (err) => {
            if (err) {
                reject(err);
            }

            resolve();
        });
    });
 };

const preclean = series(clean_dist_dir, make_dist_dir, make_bin_dir, make_code_dir);

exports.preclean = preclean;