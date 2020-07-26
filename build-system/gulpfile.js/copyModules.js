const { src, dest, parallel } = require('gulp');
const htmlmin = require('gulp-htmlmin');

/**
 * Copy html files for modules from src to dist
 */
function copyModulesDebug(){
    return src("./src/code/modules/**/*.html")
    .pipe(dest("./dist/code/modules/"));
}
/**
 * Copy html files for modules from src to dist.
 * Minify for production.
 */
function copyModulesProduction(){
    return src("./src/code/modules/**/*.html")
        .pipe(htmlmin({ collapseWhitespace: true, minifyCSS: true }))
        .pipe(dest("./dist/code/modules/"));
}

/**
 * Copy icons for messages boxes / modals
 */
function copyIcons(){
    return(src("./src/code/modules/**/*.png"))
        .pipe(dest("./dist/code/modules"))
}

exports.copyModulesDebug = parallel(copyModulesDebug, copyIcons);
exports.copyModulesProduction = parallel(copyModulesProduction, copyIcons);
