const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const query = require('querystring');
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

let server = http.createServer( (request, response) => {
    console.log("Received request: ");
    console.log("URL: "+ request.url);

    if (recieveFileRequest(request, response)) {
        // successfully handled file request.
    }else{
        recieveNonFileRequest(request, response);
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
        let location = "../site" + request.url;
        let extension = path.extname(location);
        fs.readFile(location, (error, content) => {
            if (error) {
                console.log(error);
                sendEmptyResponse(response);
            } else {
                response.writeHead(200, {"Content-Type": EXTENSION_MAP[extension]})
                response.end(content, "utf-8");
            }
        });
    }else{
        return false;
    }
    return true;
}

function recieveNonFileRequest(request, response) {
    console.log("Non file request:");
    if (request.url.startsWith("/BallPoll")) {
        //TODO: Long poll for new balls. Will respond after a new ball is dropped, or 5 seconds passed by.
    }else if (request.url == "/OnClick") {
        let body = "";
        request.on("data", chunk =>{
            body += chunk;
        });
        request.on("end", ()=>{
            console.log(body);
            let data = query.parse(body);
            let point = JSON.parse(data.location);
            clicks.push(new Click(point));
            console.table("Click received. Clicks:"+clicks);
            console.log(clicks[0]);
            response.writeHead(200, {"Content-Type":"text/txt"});
            response.end("ok");
        });
    }else{
        sendEmptyResponse(response);
    }
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