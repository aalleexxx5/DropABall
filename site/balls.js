const RADIUS = 20;
const SYNC_FREQUENCY = 5000;
let balls = [];
let ctx, canvas, width, height;
let START_TIME = Date.now();
let sessionID;
let approxLatency = 0;


/* ===================================================================================
                                   APPLICATION FUNCTIONS
   ===================================================================================
*/

function setup() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    window.requestAnimationFrame(draw);
    longPollForClicks();
    window.addEventListener('mousedown', mouseIsDown, false);
    sendSyncRequest(0);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const ball of balls) {
        let timeSinceStart = (Date.now() - START_TIME);
        ctx.fillStyle = ball.color;

        if (ball.createTime > timeSinceStart) continue;

        let t = Math.abs((((timeSinceStart - ball.createTime) % (ball.dropTime * 2)) - ball.dropTime) / ball.dropTime);
        let adjustedT = t * (2 - t);
        let location = new Point(ball.topPoint.x, lerp(height, ball.topPoint.y, adjustedT));

        drawCircle(location.x, location.y, RADIUS);
    }
    window.requestAnimationFrame(draw);
}

function mouseIsDown(event) {
    let cx = event.pageX;
    let cy = event.pageY;
    // noinspection SpellCheckingInspection
    var clickXandY = new Point(cx, cy);
    sendClick(clickXandY);

    console.log("X: " + cx + ", Y: " + cy);
}

/* ===================================================================================
                                      NETWORKING
   ===================================================================================
*/

function longPollForClicks() {
    fetch("BallPoll?size=" + balls.length + (sessionID ? "&id=" + sessionID : ""))
        .then(res => {
            if (res.status == 200) {
                res.json().then(response => {
                    console.log("Received click: ", response);
                    console.log("index: " + response.index);
                    console.log("Location: " + response.location);
                    console.log("Top time: " + response.topTime);
                    console.log("Drop time: ", response.dropTime);
                    balls[response.index] = new Ball(response.location, (response.topTime - approxLatency) + (Date.now() - START_TIME), response.dropTime, response.color);
                });
            } else if (res.status == 205) {
                balls = [];
            }
            setTimeout(longPollForClicks, 0);
        }).catch(rej => console.log("error: ", rej));
}

function sendClick(clickLocation) {
    if (!sessionID) {
        sendSessionRequest();
        return;
    }
    var connectRequest = new XMLHttpRequest();
    connectRequest.open("POST", "OnClick", true);
    connectRequest.onreadystatechange = function () {
        if (this.status === 403) {
            sendSessionRequest();
            return;
        }
    };
    let jsonLocation = JSON.stringify(clickLocation);
    console.log(jsonLocation);
    connectRequest.send("location=" + jsonLocation + "&id=" + sessionID + "&latency=" + approxLatency);
}

function sendSessionRequest() {
    return fetch("NewSession")
        .then(res => res.json())
        .then(id => {
            console.log("Recieved sessionID: ", id);
            sessionID = id
        });
}

function sendSyncRequest(ballNumberToSync) {
    if (balls.length < 1) {
        setTimeout(() => sendSyncRequest(0), SYNC_FREQUENCY);
        return;
    }
    if (ballNumberToSync > balls.length - 1) {
        setTimeout(() => sendSyncRequest(0));
        return;
    }
    const sendTime = Date.now();
    fetch("Sync?ball=" + ballNumberToSync)
        .then(res => {
            if (res.status == 200) {
                approxLatency = (Date.now() - sendTime) / 2;
                console.log("Latency updated to: ", approxLatency);
                return res;
            } else if (res.status == 404 || res.status == 400) {
                approxLatency = (Date.now() - sendTime) / 2;
                console.log("Latency updated to: ", approxLatency);
                throw new Error("No ball");
            } else {
                throw new Error("Server did not respond");
            }
        })
        .then(res => res.json())
        .then(ball => {
            console.log("Synced ball: ", ball);
            balls[ballNumberToSync].createTime = (ball.topTime - approxLatency) + (Date.now() - START_TIME);
        })
        .finally(() => setTimeout(() => sendSyncRequest(ballNumberToSync + 1), SYNC_FREQUENCY));
}

/* ===================================================================================
                                    CLASSES
   ===================================================================================
*/

class Ball {
    constructor(topPoint, createTime, dropTime, color = "#09f") {
        this.topPoint = topPoint;
        this.createTime = createTime;
        this.dropTime = dropTime;
        this.color = color;
    }
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

/* ===================================================================================
                                     UTILITY FUNCTIONS
   ===================================================================================
*/

function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function drawCircle(x, y, radius) {
    ctx.beginPath();//start a drawing
    ctx.arc(x, y, radius, 0, 2 * Math.PI);//go in a circle
    ctx.fill(); //fill the circle
    ctx.closePath(); //stop the drawing
}

/* ===================================================================================
                                      DEBUG FUNCTIONS
   ===================================================================================
*/

// DEBUG functions.
function dropABall(startPoint, startTime, dropTime) {
    balls.push(new Ball(startPoint, startTime + (Date.now() - START_TIME), dropTime))
}

function dropThisBall(ball) {
    balls.push(ball);
}