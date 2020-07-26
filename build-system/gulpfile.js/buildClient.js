const { dest } = require('gulp');
const typescript = require('gulp-typescript');
const ts = typescript.createProject('tsconfig.json');
const jsmin = require('gulp-minify');


/**
 * Uses Typescript compiler to source and compile .ts files in src and pipe them to dist.
 */
function buildClientDebug(){
    return ts.src()
        .pipe(ts())
        .js
        .pipe(dest("./dist/code"))
};

/**
 * Uses Typescript compiler to source and compile .ts files in src and pipe them to dist.
 * Minifies for production.
 */
function buildClientProduction(){
    return ts.src()
        .pipe(ts())
        .js
        .pipe(jsmin({ ext: { min: '.js'}, noSource: true}))
        .pipe(dest("./dist/code"))
};

exports.buildClientDebug = buildClientDebug;
exports.buildClientProduction = buildClientProduction;