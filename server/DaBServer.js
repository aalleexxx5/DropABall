const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
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
        fs.readFile("../site/index.html", (error, content)=>{
            if (error) {
                sendEmptyResponse(response);
            }else{
                response.writeHead(200,{"Content-Type":"text/html"});
                response.end(content, "utf-8");
            }
        });
    }else if (/.*\\..*/g.test(response.url)) {
        let location = "../site" + request.url;
        let extension = path.extname(location);
        fs.readFile(location, (error, content) => {
            if (error) {
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
    if (response.url == "/BallPoll") {
        //TODO: Long poll for new balls. Will respond after a new ball is dropped, or 5 seconds passed by.
    }else if (response.url == "/OnClick") {
        //TODO: Drop a ball!
    }else if (request.url == "/Balls") {
        //TODO: Respond with all balls.
    }
    sendEmptyResponse(response);
}

function sendEmptyResponse(response){
    response.writeHead(404);
    response.end();
}

console.log("Server started.")