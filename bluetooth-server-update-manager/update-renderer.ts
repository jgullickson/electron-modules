import { ipcRenderer, remote } from 'electron';
const { getGlobal, BrowserWindow } = remote;
import * as AdmZip from "adm-zip";
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { Transform } from 'stream';
import { build_modal } from '../../../code/ui';
import { Channels } from '../../../code/enums/messaging/channels';

const auth_token = require('../../config.json').github.auth_token;
const releases_url = "https://github.umn.edu/api/v3/repos/TaskFlow/bluetooth-serial-server/releases";
const local_server_dir = path.resolve(__dirname, path.join("..", "..", "server", "bluetooth-serial-server"));
const local_release_path = path.resolve(__dirname, path.join("..", "..", "server", "bluetooth-serial-server", "local_release.json"));
const arch = os.arch();
const platform = os.platform();
const system_tag = `${platform}_${arch}`;
const system_regex = new RegExp(`^${system_tag}`);

let modal: any;

/*
  SUMMARY:

  Documentation for the github api calls in this code:
    https://developer.github.com/v3/repos/releases/#list-releases-for-a-repository
    https://developer.github.com/v3/repos/releases/#get-a-single-release-asset
  
  This code:
    -checks os platform and architecture to determine which version of the bluetooth server is needed.
    -queries github api to determine the latest available release of the bluetooth server for os.
    -checks local files for copy of bluetooth server and version info file.
    -compares latest release version info to local version info file, and downloads latest available version if it is newer than local version. 

  Basic structure:
    release_manager(){
        check_local_release();
        get_latest_release();
        get_asset_url();
        request_server_download(){
          handle_response()
        };
    }
*/

/**
 * Sends a request to the Github API to download the bluetooth server.
 * @param {String} url
 * @param {Function} error_callback 
 * @param {Function} success_callback 
 * @returns {null} null
 */
const request_server_download = (url: string, error_callback: any, success_callback: any) => {
  /**
   * Set headers for server request.
   */
  let options = {
    hostname: url,
    headers: {
      "User-Agent": "taskflow.desktop.client",
      Accept: "application/octet-stream",
      Authorization: `token ${auth_token}`
    }
  };
  /**
   * Request for server.
   */
  https.get(options, (response: any)  => {
    handle_response(response, error_callback, success_callback);
  });
};

/**
 * Handles the response to the request_server_download. Either follows redirects (one 302 is expected per Github API documentation) or, when a 200 is received, downloads the server file.
 * @param {Object} response - HTTP Response Object from server
 * @param {Function} error_callback
 * @param {Function} success_callback
 * @returns {null} null
 */
let handle_response = (response: any, error_callback: any, success_callback: any) => {
  if (response.statusCode === 200) {
    console.log(response.statusCode);
    console.log('Located download endpoint...'); //download asset

    let downloadStream = new Transform();

    response.on("data", (chunk: any) => {
      downloadStream.push(chunk);
    });

    response.on("end", () => {
      console.log('Downloading bluetooth server binaries to ' + local_server_dir + '/server'); // write stream to file

      let downloadPath = path.join(local_server_dir, "/server.zip");
      fs.writeFileSync(downloadPath, downloadStream.read()); // unzip file

      let downloadZipped = new AdmZip(downloadPath);
      downloadZipped.extractAllTo(path.join(local_server_dir), true); // change permissions to allow for execution

      fs.chmodSync(path.join(local_server_dir, "/server/server"), 0o777); // signal success

      success_callback();
    });
    
  } else if (response.statusCode === 302) {
    //follow redirects
    console.log(response.statusCode);
    let redirect_url = response.headers.location;
    console.log(`Redirected to ${redirect_url}`);
    request_server_download(redirect_url, error_callback, success_callback);
  }
};

/**
 * Checks for the locally stored release info json file 
 * @param {string} path - path to the json file
 * @returns {JSON} local_release - a json file describing the release id and publish date of the local copy of the server 
 */
const check_local_release = (path: any) => {
  return new Promise((resolve, reject) => {
    let local_release;

    if (fs.existsSync(path)) {
      local_release = require(path);
      resolve(local_release);
    } else {

      let default_release_info: {id: any, published_at: any} = {
        id: null,
        published_at: null
      };

      fs.writeFileSync(path, JSON.stringify(default_release_info));

      local_release = require(path);
      resolve(local_release);
    }
  });
};

/**
 * Sends a request to Github API to get info on bluetooth server releases.
 * Filters available releases down to the latest release available for the os the script is running on
 * @param {string} url - url to repository's releases endpoint
 * @returns {Object} latest_release_for_platform - an object with info on the latest release (such as date published) and a url to all of its assets
 */
const get_latest_release = (url: string) => {
  return new Promise((resolve, reject) => {

    //set request header options
    let options = {
      headers: {
        "User-Agent": "taskflow.desktop.client",
        Accept: "application/json",
        Authorization: `token ${auth_token}`
      }
    };

    let latest_release_for_platform: any;

    https.get(releases_url, options, (res: any) => {

      let release_data = "";

      res.on("data", (d: any) => {
        release_data += d;
      });

      res.on("end", () => {
        let release_array = JSON.parse(release_data);

        latest_release_for_platform = release_array
          .filter((r: any) => system_regex.test(r.tag_name))
          .sort((a: any, b: any) => a.published_at > b.published_at ? 1 : -1)
          .pop();

        resolve(latest_release_for_platform);
      });

      res.on("error", (err: any) => {
        reject(Error(err));
      });

    });
  });
};

/**
 * Gets specific url to download the desired server.zip asset
 * @param {string} url - assets url for respository (lists all assets)
 * @returns {string} asset_url - the url passed to request_server_download() to download the server.zip asset
 */
const get_asset_url = (url: string) => {
  return new Promise((resolve, reject) => {
    let asset_url = ''; //set request header options

    let options = {
      headers: {
        "User-Agent": "taskflow.desktop.client",
        Accept: "application/json",
        Authorization: `token ${auth_token}`
      }
    };

    https.get(url, options, (res: any) => {

      let assets_data = "";

      res.on("data", (d: any) => {
        assets_data += d;
      });

      res.on("end", () => {
        let asset_array = JSON.parse(assets_data);

        let server_bin = asset_array
          .filter((a: any) => a.name === "server.zip")
          .pop();
        
        asset_url = server_bin.url;
        
        resolve(asset_url);
      });

      res.on("error", (err: any) => {
        reject(Error(err));
      });
    });
  });
};

/**
 * Create directory structure for server if needed
 */
const create_dirs = () => {
    if (!fs.existsSync(local_server_dir)){
      console.log('creating dirs: ' + local_server_dir)
      fs.mkdirSync(local_server_dir, { recursive: true})
    } else {
      console.log('dirs exist')
    }
  };


/**
 * Main function which organizes all helper functions in this module.
 * @returns {null} null
 */
const release_manager = () => {
    return new Promise(async (resolve, reject) => {

        modal = build_modal(path.resolve(__dirname, './modal.html'));

        create_dirs();
        
        // get local release info
        let local_release: any = await check_local_release(local_release_path); 
        
        // get latest release info
        let latest_release_for_platform: any = await get_latest_release(releases_url);
        
        if (!fs.existsSync(path.join(local_server_dir, "server/server")) || 
            local_release.published_at === null || 
              latest_release_for_platform.published_at > local_release.published_at) {

                // get asset url
                let asset_url: any = await get_asset_url(latest_release_for_platform.assets_url);

                // download asset
                request_server_download(asset_url, (err: any) => reject(err), () => {
                    let updated_release_info = {
                        id: latest_release_for_platform.id,
                        published_at: latest_release_for_platform.published_at
                    };
                    
                    fs.writeFileSync(path.join(local_server_dir, "local_release.json"), JSON.stringify(updated_release_info));

                    resolve();
                });
            } else if (latest_release_for_platform.published_at == local_release.published_at) {
                console.log("Bluetooth server is already up to date!");

                resolve();
            } else {
                console.warn("Something unexpected happened. Please check the version of the bluetooth server in " + local_server_dir + " . Version information can be found in local_release.json");
                
                reject();
            }
        })
    };

release_manager().then(
        function(){
          modal.destroy();
          console.log('bluetooth server update ended successfully!');

          return ipcRenderer.send(Channels.BLUETOOTH_SERVER_UPDATE_SUCESS);
        },
        function(){
          modal.destroy();
          console.error('an error occurred during bluetooth server update');

          return ipcRenderer.send(Channels.BLUETOOTH_SERVER_UPDATE_ERROR);
        }
    );