const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const query = require('querystring');
const fallDuration = 500;
const LOWEST_LATENCY = 100;
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
let waitingClients = [];

let server = http.createServer( (request, response) => {
    console.log("Received request: ");
    console.log("URL: "+ request.url);

    if (recieveFileRequest(request, response)) {
        // successfully handled file request.
    }else{
        receiveNonFileRequest(request, response);
    }
} ).listen(8080);

function recieveFileRequest(request, response){
    if (request.url == "/") {
        console.log("Index request");
        fs.readFile("../site/index.html", (error, content)=>{
            if (error) {
                sendEmptyResponse(response);
            }else{
                response.writeHead(200,{"Content-Type":"text/html"});
                response.end(content, "utf-8");
            }
        });
    }else if (/(.+)(\.)(.+)/g.test(request.url)) {
        console.log("Generic file requet");
        let location = "../site" + request.url; // FIXME THIS IS A NAIVE, AND VERY UNSECURE!
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
    }else{
        return false;
    }
    return true;
}

function receiveNonFileRequest(request, response) {
    console.log("Non file request:");
    if (request.url.startsWith("/BallPoll")) {
        console.log("Ball poll recieved");
        let parameters = url.parse(request.url, true).query;
        if (parameters.size< clicks.length){
            sendClick(response, parameters.size);
        } else {
            waitingClients.push(response);
            response.setTimeout(5000, ()=>{
                response.writeHead(204);
                response.end();
                let index = waitingClients.findIndex(e => e==response);
                if (index !== -1) {waitingClients.splice(index, 1);}
            });
        }
    }else if (request.url == "/OnClick") {
        let body = "";
        request.on("data", chunk =>{
            body += chunk;
        });
        request.on("end", ()=>{
            console.log(body);
            let data = query.parse(body);
            let point = JSON.parse(data.location);
            let index = clicks.length;
            clicks.push(new Click(point));
            clickUpdated(index);
            console.log("Click received");
            response.writeHead(200, {"Content-Type":"text/txt"});
            response.end("ok");
        });
    }else{
        sendEmptyResponse(response);
    }
}

function clickUpdated(index){
    waitingClients.forEach(res => sendClick(res, index));
    waitingClients = [];
}

function sendClick(response, clickIndex){
    response.writeHead(200, {"Content-Type":"text/json"});
    var data = {};
    data.location = clicks[clickIndex].location;
    data.index = clickIndex;
    data.topTime = (Date.now() - (clicks[clickIndex].clickTime)) % (fallDuration*2);
    if (data.topTime < LOWEST_LATENCY){
        data.topTime += fallDuration*2;
    }
    data.dropTime = fallDuration;
    let responseContent = JSON.stringify(data);
    console.log("Sent click: "+ responseContent);
    response.end(responseContent);
}

function sendEmptyResponse(response){
    response.writeHead(404);
    response.end();
}

class Click{
    constructor(location){
        this.location = location;
        this.clickTime = Date.now();
    }
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
console.log("Server started.");
clicks.push(new Click(new Point(100,100)));