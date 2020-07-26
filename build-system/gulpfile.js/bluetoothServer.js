const { src, task, series } = require('gulp');
const install = require('gulp-install');
let clean = require('gulp-clean');
const { sh } = require('sh-thunk');
const os = require('os');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { exec } = require('child_process');

// path to bluetooth-serial-server source files
const source_path = path.resolve(path.join('.', 'src', 'code', 'server', 'bluetooth-serial-server', 'server', 'server.py'));

/**
 * Installs bluetooth server dependencies outlined in requirements.txt
 */
function pyRequirementsInstall(){
    console.log('Installing python server requirements');

    return src([`./src/code/server/bluetooth-serial-server/requirements.txt`])
            .pipe(install());
};

/**
 * Cleans output directory for server
 */
function cleanOutputDir(){
        return src(`./dist/bluetooth/${os.platform()}/${os.arch()}`, {allowEmpty: true})
                .pipe(clean())
}

/**
 * Checks for bluetooth serial server source code
 */
function checkSource() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(source_path)) {
      resolve();
    } else {
      reject(
        Error(`${chalk.red(`Source code not found.\n`)}
Bluetooth serial server source code not found at:
        ${chalk.cyan(source_path)} 
Please download / clone the repository:
        ${chalk.greenBright(`https://github.umn.edu/TaskFlow/bluetooth-serial-server.git`)} 
and save into:
        ${chalk.cyan(source_path)}
Otherwise, you can modify the source_path variable in 
        ${chalk.cyan(__filename)}\n`)
      );
    }
  });
}

/**
 * Uses pyinstaller to create server.exe and places it into dist
 */
function pyinstaller_server() {
    return new Promise((resolve, reject) => {
        exec(`pyinstaller ${source_path} --distpath ./dist/bluetooth/${os.platform()}/${os.arch()} --workpath ./dist/bluetooth/${os.platform()}/${os.arch()}/build --specpath ./dist/bluetooth/${os.platform()}/${os.arch()}/spec`, (err) => {
            if (err) {
                reject(err);
            }

            resolve();
        })
    });
}

/**
 * Checks os platform and arch. Errors out if target platform and arch do not match the platform and arch of user's machine.
 * This is because pyinstaller can only build for the platform it's running on.
 * @param {string} target_platform - the target platform for the build
 * @param {string} target_arch - the target arch for the build
 */
function checkPlatform(target_platform, target_arch){
        return new Promise((resolve, reject) => {

                let platform = os.platform();
                let arch = os.arch();
        
                console.log(platform);
                console.log(arch);
        
                if (platform !== target_platform || arch !== target_arch){
                        reject(Error(`${chalk.red(`Incompatible platform:`)}
                        You are running ${chalk.cyan(`build_bluetooth_server_${target_platform}_${target_arch}`)} on a ${chalk.greenBright(`${platform} ${arch}`)} system.
                        Pyinstaller can only build distributables for the same platform it is running on.
                        If you'd like to build the bluetooth server.exe on and for ${platform} ${arch}, you can run ${chalk.cyan(`build_bluetooth_server_${platform}_${arch}`)}.
                        Otherwise, if you want to build for ${target_platform} ${target_arch}, try building on a ${target_platform} ${target_arch} virtual machine.\n\n`
                        ));
                } else {
                        resolve();
                }
        })
}

const build_bluetooth_server_linux_x64 = series(
        () => checkPlatform('linux', 'x64'),
        checkSource,
        cleanOutputDir,
        pyRequirementsInstall,
        pyinstaller_server);

const build_bluetooth_server_darwin_x64 = series(
        () => checkPlatform('darwin', 'x64'),
        checkSource,
        cleanOutputDir,
        pyRequirementsInstall,
        pyinstaller_server);
        
const build_bluetooth_server_win32_x64 = series(
        () => checkPlatform('win32', 'x64'),
        checkSource,
        cleanOutputDir,
        pyRequirementsInstall,
        pyinstaller_server);

exports.build_bluetooth_server_linux_x64 = build_bluetooth_server_linux_x64;
exports.build_bluetooth_server_darwin_x64 = build_bluetooth_server_darwin_x64;
exports.build_bluetooth_server_win32_x64 = build_bluetooth_server_win32_x64;