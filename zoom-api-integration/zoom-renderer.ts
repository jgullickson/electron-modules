const { remote, ipcRenderer, webContents } = require('electron');
const { BrowserWindow, dialog, nativeImage } = remote;
import * as https from 'https';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Channels } from '../../enums/messaging/channels';

const store = require('../../config.json').zoom;

enum ZOOM_EVENTS {
    AUTH_COMPLETE = "zoom.events.auth_complete",
    ACCESS_TOKEN_RECEIVED = "zoom.events.access_token_received",
    ACCESS_TOKEN_REFRESHED = "zoom.events.access_token_refreshed",
    MEETING_CREATED = "zoom.events.meeting_created",
    REGISTRANT_ADDED = "zoom.events.registrant_added"
};

/**
 * Listeners for calls from main process
 */

/**
 * @listens zoom:oauth
 */
ipcRenderer.on(Channels.ZOOM_OAUTH, () => {
    oauth_popup();
})

/**
 * @listens zoom:meeting
 */
ipcRenderer.on(Channels.ZOOM_MEETING, () => {
    show_info_box(
            'Hi ' + store.user_data.first_name + ',\n\nThanks for reaching out.', 
            `Someone from our team will be with you shortly. Please allow up to 10 minutes for us to answer your call.\n\nThanks for waiting...`)
            .then(
                function() {
                    return create_meeting()
                },
                function(){
                    return show_cancel_box()
                }
            );
});

/**
 * @listens zoom:refresh-token
 */
ipcRenderer.on(Channels.ZOOM_REFRESH_TOKEN, () => {
    refresh_access_token();
});

/**
 * Internal listeners
 */
class InternalEmitter extends EventEmitter {};
const internal_emitter = new InternalEmitter();

/**
 * @listens auth-complete
 */
internal_emitter.on(ZOOM_EVENTS.AUTH_COMPLETE, () => {
    console.log('auth complete!');
    request_access_token();
});

/**
 * @listens access-token-received
 */
internal_emitter.on(ZOOM_EVENTS.ACCESS_TOKEN_RECEIVED, () => {
    token_timer();
    get_user_data();
});

/**
 * @listens access-token-refreshed
 */
internal_emitter.on(ZOOM_EVENTS.ACCESS_TOKEN_REFRESHED, () => {
    token_timer();
    get_user_data();
});

/**
 * @listens meeting-created
 */
internal_emitter.on(ZOOM_EVENTS.MEETING_CREATED, (meeting_object: any) => {
    start_meeting(meeting_object.join_url);
    add_registrant(meeting_object.id);
});

/**
 * @listens registrant-added
 */
internal_emitter.on(ZOOM_EVENTS.REGISTRANT_ADDED, (registration_object: any) => {
    console.log('registrant added!')
    console.log(registration_object);
});

/**
 * Refresh zoom access token automatically if a token exists in the store
 */
if (store.access_token.length > 0) {
    refresh_access_token();
};

/**
 * Creates window that delivers the Zoom OAuth flow to the user.
 * Upon reaching final page in flow (our redirect url), it sends the authorization code to the store.
 * @emits InternalEmitter#auth-complete
 * @returns {undefined}
 */

function oauth_popup(){

    let oauth_popup = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    if (store.debug === true) oauth_popup.webContents.openDevTools();

    let id = store.client_id;
    let redirect = store.redirect_url;
    let auth_url = encodeURI(`https://zoom.us/oauth/authorize?response_type=code&client_id=${id}&redirect_uri=${redirect}`);
    
    oauth_popup.loadURL(auth_url);

    /**
     * Checks page url every time it page navigates. 
     * If url matches our oath success page, it grabs the auth code and sends it back to the main process.
     */

    oauth_popup.webContents.on('did-navigate', (event: any, url: any, httpCode: any, httpText: any) => {
        
        let target_url = store.redirect_url;
        let target_url_rgx = new RegExp(`${target_url}`);

        if (target_url_rgx.test(url)){

            let url_code = url.match(/\?code=(\w+)/);

            // update store
            store.auth_code = url_code[1];
            
            /**
             * @event InternalEmitter#auth-complete
             */
            internal_emitter.emit(ZOOM_EVENTS.AUTH_COMPLETE);
        };
    });
};


/**
 * Sends request for access token to Zoom authorization server, updates the store with the access token and refresh token
 * @emits InternalEmitter#access-token-received
 * @returns {undefined}
 */
function request_access_token(){

    const { auth_code, client_id, client_secret, redirect_url } = store;

    console.log('requesting access token with ' + auth_code);

    // request url (per zoom api)
    let url = encodeURI(`https://zoom.us/oauth/token?grant_type=authorization_code&code=${auth_code}&redirect_uri=${redirect_url}`);
    
    // create base64 encoded string of client_id:client_secret (per zoom api)
    let id_secret = client_id + ':' + client_secret;
    let buff: Buffer = Buffer.from(id_secret);
    let base64_id_secret = buff.toString('base64');

    // set request options
    const options = {
        method: "POST",
        headers: {
            "Authorization": `Basic ${base64_id_secret}`
        },
        hostname: url
    };

    const req = https.request(options, (res: any) => {   
        if (res.statusCode === 200) {

            // stream response
            let data = "";

            res.on("data", (d: any) => {
                data += d;
            });

            res.on("end", () => {

                //parse data
                let response_object = JSON.parse(data);

                //update store
                store.access_token = response_object.access_token;
                store.refresh_token = response_object.refresh_token;

                /**
                 * @event InternalEmitter#access-token-received
                 */
                internal_emitter.emit(ZOOM_EVENTS.ACCESS_TOKEN_RECEIVED);
            });
        } else {
            console.log(`statusCode: ${res.statusCode}`)
        }
     });
    
    req.on('error', (e: any) => console.error(e));
    req.end();
};

/**
 * Sends request to refresh Zoom access token and updates the store with the new access token and refresh token
 * @emits InternalEmitter#access-token-refreshed
 * @returns {undefined}
 */
function refresh_access_token(){

    const { refresh_token, client_secret, client_id } = store;

    // create base64 encoded string of client_id:client_secret (per zoom api)
    let id_secret = client_id + ':' + client_secret;
    let buff: Buffer = Buffer.from(id_secret);
    let base64_id_secret = buff.toString('base64');

    const url = `https://zoom.us/oauth/token?grant_type=refresh_token&refresh_token=${refresh_token}`;

    // set request options
    const options = {
        method: "POST",
        headers: {
            "Authorization": `Basic ${base64_id_secret}`
        },
        hostname: url
    };

    const req = https.request(options, (res: any) => {

        if (res.statusCode === 200) {

            let data = "";
            res.on('data', (d: any) => data += d);

            res.on('end', () => {
                let response_object = JSON.parse(data);

                // udpate store
                store.access_token = response_object.access_token;
                store.refresh_token = response_object.refresh_token;

                /**
                 * @event InternalEmitter#access-token-refreshed
                 */
                internal_emitter.emit(ZOOM_EVENTS.ACCESS_TOKEN_REFRESHED);
            })
        } else {
            console.log(`statusCode: ${res.statusCode}`);
        }
    });

    req.on('error', (e: any) => console.error(e));
    req.end();
};

/**
 * Sets a timeout to automatically refresh the access token (calls refresh_access_token) every 59min (access tokens expire after an hour);
 * @returns {undefined}
 */
function token_timer() {

    const timeout =  3.54e6;
    const timeout_function = setTimeout(refresh_access_token, timeout);

    console.log('Access token updated.');
    console.log(`Token will be refreshed in ${timeout / 6e4} minutes.`);

};

/**
 * Gets user data for authenticated Zoom user and saves to the store
 * @returns {Promise} - resolves with object containing user data
 */
function get_user_data(){
    return new Promise((resolve, reject) => {

    let token = store.access_token;

    let url = 'https://api.zoom.us/v2/users/me';

    let options = {
        headers: {
            "Authorization": `Bearer ${token}`
        },
        hostname: url
    };

    let req = https.get(options, (res: any) => {
        console.log(res.statusCode)
        if (res.statusCode === 200) {

            let data = "";
            res.on('data', (d: any) => {
                data += d;
            });

            res.on('end', () => {
                let response_object = JSON.parse(data);
                // update store
                store.user_data = response_object;
                resolve(response_object);
            })
        }
    })
    req.on('error', (e: any) => reject(Error(e)));
    req.end();

    })
};

/**
 * Creates a Zoom meeting requiring authentication to join
 * @emits InternalEmitter#meeting-created
 * @returns {Promise} - resolves with object containing information on the newly created meeting (id, join_url)
 */
function create_meeting() {
    return new Promise((resolve, reject) => {

        let token: string = store.access_token;

        console.log(`creating meeting with ${token}`);

        let url: string = 'https://api.zoom.us/v2/users/me/meetings';

        let meeting_settings: object = {
            topic: `TaskFlow Help Request from ${store.user_data.first_name} ${store.user_data.last_name}.`,
            type: 2,
            settings: {
                join_before_host: true,
                registrants_confirmation_email: true,
                registrants_email_notification: true,
                approval_type: 0,
                meeting_authentication: true
            }
        };

        let meeting_json = JSON.stringify(meeting_settings);
        console.log(meeting_json);

        let options: object = {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            hostname: url
        };

        let req = https.request(options, (res: any) => {
            console.log(`meeting creation response: ${res.statusCode}`);
            console.log(res.statusMessage);
            console.log(res);
            
            if (res.statusCode === 200 || res.statusCode === 201) {

                let data = "";
                res.on('data', (d: any) => {
                    data += d;
                });

                res.on('end', () => {
                    let meeting_object = JSON.parse(data);

                    /**
                     * @event InternalEmitter#meeting-created
                     */
                    internal_emitter.emit(ZOOM_EVENTS.MEETING_CREATED, meeting_object);

                    resolve(meeting_object);
                });
            }
        });
        req.on('error', (e: any) => reject(Error(e)));

        req.write(meeting_json);

        req.end();
    })
};

/**
 * Creates a new secured browser window and loads a meeting join_url inside it
 * @param {string} url - the join_url for a Zoom meeting
 */
function start_meeting(url: string){

    let meeting_window = new BrowserWindow({
        height: 400,
        width: 400,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    meeting_window.loadURL(url);
};

/**
 * Adds a registrant to a Zoom meeting. Per configuration in {@link create_meeting} above, registrant will receive a notification email with a link to join
 * @param {string} meeting_id - the id of the meeting to which to add the registrant
 */
function add_registrant(meeting_id: string){
    return new Promise((resolve, reject) => {
    
    let token = store.access_token;

    let url = encodeURI(`https://api.zoom.us/v2/meetings/${meeting_id}/registrants`)
    
    console.log(url);
    
    let body = JSON.stringify({
        email: store.support.email,
        first_name: store.support.first_name,
        last_name: store.support.last_name
    });

    let options = {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        hostname: url
    };

    let req = https.request(options, (res: any) => {
        console.log(`add reg statusCode: ${res.statusCode}`);

        if (res.statusCode === 200 || res.statusCode === 201) {

            let data = "";
            res.on('data', (d: any) => data += d);
    
            res.on('end', () => {
    
                let registration_object = JSON.parse(data);

                /**
                 * @event InternalEmitter#registrant-added
                 */
                internal_emitter.emit(ZOOM_EVENTS.REGISTRANT_ADDED, registration_object);

                resolve(registration_object);
            })
        }
    });

    req.on('error', (e: any) => reject(Error(e)) );
    req.write(body);
    req.end();
    })
};

/**
 * Creates an info box
 * @param {string} message - main message to be displayed
 * @param subtitle - smaller text to display under main message
 */
function show_info_box (message: string, subtitle: string) {
    return new Promise((resolve, reject) => {
        const iconPath = path.resolve(__dirname, './tf_info.png');
        const icon = nativeImage.createFromPath(iconPath);
    
        dialog.showMessageBox({
            type: 'info',
            icon: icon,
            message: message,
            detail: subtitle,
            buttons: ['Cancel', 'Start meeting!'],
            defaultId: 1,
            cancelId: 0
        }).then((d: any) => {
            if (d.response === 0){
                reject()
            } else {
                resolve()
            }
        });
    });
};

/**
 * 
 */
function show_cancel_box(){
        const iconPath = path.resolve(__dirname, './tf_cancel.png');
        const icon = nativeImage.createFromPath(iconPath);
    
        dialog.showMessageBox({
            type: 'info',
            icon: icon,
            message: 'Meeting canceled',
            detail: `We're here if you need us! Feel free to reach out again anytime.`,
            buttons: ['Continue']
        })
};