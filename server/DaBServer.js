const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const query = require('querystring');
const crypto = require("crypto");
const fallDuration = 700;
const LOWEST_LATENCY = 400;
const ID_LENGTH = 32;
const MAX_BALLS_PR_SESSION = 2;
const SESSION_EXP_TIME = 10000; // 10_000
const EXTENSION_MAP = { // "Borrowed" from Stackoverflow
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword'
};

let clicks = [];
let sessions = new Map();
let waitingClients = [];

let server = http.createServer((request, response) => {
    console.log("Received request: ");
    console.log("URL: " + request.url);

    if (tryHandleFileRequest(request, response)) {
        // successfully handled file request.
    } else {
        receiveNonFileRequest(request, response);
    }
}).listen(8080);

function tryHandleFileRequest(request, response) {
    if (request.url == "/") {
        console.log("Index request");
        fs.readFile("../site/index.html", (error, content) => {
            if (error) {
                sendEmptyResponse(response);
            } else {
                response.writeHead(200, {"Content-Type": "text/html"});
                response.end(content, "utf-8");
            }
        });
    } else if (/(.+)(\.)(.+)/g.test(request.url)) {
        console.log("Generic file requet");
        let location = "../site" + request.url; // FIXME THIS IS NAIVE, AND VERY INSECURE!
        let extension = path.extname(location);
        fs.readFile(location, (error, content) => {
            if (error) {
                console.log(error);
                sendEmptyResponse(response);
            } else {
                response.writeHead(200, {"Content-Type": EXTENSION_MAP[extension]});
                response.end(content, "utf-8");
            }
        });
    } else {
        return false;
    }
    return true;
}

function receiveNonFileRequest(request, response) {
    console.log("Non file request:");
    if (request.url.startsWith("/BallPoll")) {
        HandleBallPoll();
    } else if (request.url == "/OnClick") {
        HandleOnClick();
    } else if (request.url == "/NewSession") {
        handleNewSession();
    } else if (request.url.startsWith("/Sync")) {
        handleSync();
    } else {
        sendEmptyResponse(response);
    }

    /* ===================================================================================
                                   REQUEST HANDLERS
       ===================================================================================
    */

    function HandleBallPoll() {
        let parameters = url.parse(request.url, true).query;
        if (parameters.id) {
            reIssueSession(parameters.id);
        }
        if (parameters.size < clicks.length) {
            sendClick(response, parameters.size);
        } else if (parameters.size == clicks.length) {
            waitingClients.push(response);
            clearExpiredBalls();
            response.setTimeout(5000, () => {
                response.writeHead(204);
                response.end();
                let index = waitingClients.findIndex(e => e == response);
                if (index !== -1) {
                    waitingClients.splice(index, 1);
                }
            });
        } else { // Clicks are missing, some may have been removed.
            console.log("Array length mismatch.");
            sendEmptyResponse(response, 205);
        }
    }

    function HandleOnClick() {
        let body = "";
        request.on("data", chunk => {
            body += chunk;
        });
        request.on("end", () => {
            console.log(body);
            let data = query.parse(body);
            let session = data.id;
            if (session === undefined || !isValidSession(session)) {
                console.log(isValidSession(session));
                sendEmptyResponse(response, 403);
                return;
            }

            let point = JSON.parse(data.location);
            let latency = data.latency;
            let index;
            if (countClicksOfSession(session) < MAX_BALLS_PR_SESSION) {
                index = clicks.length;
                clicks.push(new Click(point, session, latency));
            } else {
                clickToUpdate = findOldestClickFromSession(session);
                console.log("Updating: ", clickToUpdate);
                index = clicks.findIndex(e => e == clickToUpdate);
                clicks[index] = new Click(point, session, latency);
            }
            clickUpdated(index);
            console.log("Click received");
            response.writeHead(200, {"Content-Type": "text/txt"});
            response.end("ok");
        });
    }

    function handleNewSession() {
        response.writeHead(200, {"Content-Type": "text/json", "Cache-Control": "no-store"});
        let sessionID = generateSessionID();
        console.log("Sent session id: " + sessionID);
        response.end(JSON.stringify(sessionID));
    }

    function handleSync() {
        let parameters = url.parse(request.url, true).query;
        if (parameters.ball == undefined || parameters.ball == "undefined") {
            sendEmptyResponse(response, 400);
        }
        else if (parameters.ball >= clicks.length) {
            sendEmptyResponse(response, 404);
        } else {
            response.writeHead(200, {"Content-Type": "text/json", "Cache-Control": "no-store"});
            var data = {};
            data.topTime = calculateNextTopTime(clicks[parameters.ball]);
            response.end(JSON.stringify(data));
        }
    }
}

/* ===================================================================================
                                   UTILITY FUNCTIONS
   ===================================================================================
*/

function sendEmptyResponse(response, status = 404) {
    response.writeHead(status, {"Content-Type": "text/plain", "Cache-Control": "no-store"});
    response.end();
}


function clickUpdated(index) { // No way of removing clicks.
    waitingClients.forEach(res => sendClick(res, index));
    waitingClients = [];
}

function sendClick(response, clickIndex) {
    response.writeHead(200, {"Content-Type": "text/json", "Cache-Control": "no-store"});
    var data = {};
    data.location = clicks[clickIndex].location;
    data.index = clickIndex;
    data.color = hashSessionToColorCode(clicks[clickIndex].session);
    data.topTime = calculateNextTopTime(clicks[clickIndex]);
    data.dropTime = fallDuration;
    let responseContent = JSON.stringify(data);
    console.log("Sent click: " + responseContent);
    response.end(responseContent);
}

function calculateNextTopTime(click) {// Only relative times are sent, because of potential desyncs.
    let lastTop = (Date.now() - (click.clickTime)) % (fallDuration * 2);
    let nextTop = fallDuration * 2 - lastTop;
    if (nextTop < LOWEST_LATENCY) {
        nextTop += fallDuration * 2;
    }
    return nextTop;
}

/* ===================================================================================
                                   SESSION FUNCTIONS
   ===================================================================================
*/

function generateSessionID() {
    let found = false;
    let id = "";
    while (!found) {
        id = generateRandomIDString();
        found = !(sessions.has(id))
    }
    sessions.set(id, Date.now() + SESSION_EXP_TIME);
    return id;
}

function generateRandomIDString() {
    return crypto.randomBytes(ID_LENGTH).toString("hex");
}

function isValidSession(session) {
    clearExpiredSessions();
    return sessions.has(session);
}

function clearExpiredSessions() {
    let toDelete = [];
    sessions.forEach((value, key) => {
        if (value < Date.now()) {
            toDelete.push(key)
        }
    });
    if (toDelete.length > 0) console.log("Removed expired sessions: ", toDelete);
    toDelete.forEach(it => sessions.delete(it));
}

function reIssueSession(session) {
    sessions.set(session, Date.now() + SESSION_EXP_TIME);
}

function countClicksOfSession(session) {
    return clicks.filter(it => it.session === session).length
}

function findOldestClickFromSession(session) {
    let oldest = undefined;
    clicks.filter(it => it.session === session).forEach(it => {
        if (!oldest || it.clickTime < oldest.clickTime) {
            oldest = it;
        }
    });
    return oldest;
}

function hashSessionToColorCode(session) {
    // "Borrowed" from StackOverflow.
    let hash = session.split("").reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a
        }
        , 0);

    let colorInt = hash & 0x00000FFF;
    let colorString = colorInt.toString(16);
    return "#" + ("000".substring(0, 3 - colorString.length) + colorString);
}

function clearExpiredBalls() {
    for (let i = 0; i < clicks.length; i++) {
        const click = clicks[i];
        if (!isValidSession(click.session)) {
            console.log("Cleared expired ball");
            clicks.splice(i, 1);
            i--;
        }
    }
}

/* ===================================================================================
                                   CLASS DEFINITIONS
   ===================================================================================
*/

class Click {
    constructor(location, session, latency = 0) {
        this.location = location;
        this.session = session;
        this.clickTime = Date.now() - latency;
    }
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

console.log("Server started.");
clicks.push(new Click(new Point(100, 100), generateSessionID()));