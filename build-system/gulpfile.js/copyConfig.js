const { src, dest } = require('gulp');
const json_editor = require("gulp-json-editor");

/**
 * Copies config.json file to dist and sets debug params to false
 */
function copyConfigProduction(){
    return src(['src/code/config.json'])
        .pipe(json_editor((config)=>{
            config.debug_mode = false;
            config.zoom.debug = false;
            return config;
        }))
        .pipe(dest('./dist/code'))
};

/**
 * Copies config.json file to dist and sets debug params to true
 */
function copyConfigDebug(){
    return src(['src/code/config.json'])
        .pipe(json_editor((config)=>{
            config.debug_mode = true;
            config.zoom.debug = true;
            return config;
        }))
        .pipe(dest('./dist/code'))
};

exports.copyConfigDebug = copyConfigDebug;
exports.copyConfigProduction = copyConfigProduction;