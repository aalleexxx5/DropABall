const RADIUS = 20;
let balls = [];
let ctx, canvas, width, height;
let START_TIME = Date.now();
let sessionID;

function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function dropABall(startPoint, startTime, dropTime) {
    balls.push(new Ball(startPoint, startTime + (Date.now() - START_TIME), dropTime))
}

function dropThisBall(ball) {
    balls.push(ball);
}

/*function sendConnectRequest(){
    var connectRequest = new XMLHttpRequest();
    connectRequest.onreadystatechange = () => {
        if (this.readyState == 4 && this.status == 200){
            balls = JSON.parse(this.responseText);
        }
    };
    connectRequest.open("GET", "balls", true);
    connectRequest.send();
}*/

function sendSyncRequest(ballNumberToSync, nextBottomHitTime) {
    //TODO MATTIAS! Se sendClick og longPoll.
}

function sendSessionRequest(){
    return fetch("NewSession")
        .then(res => res.json())
        .then(id => {
            console.log("Recieved sessionID: ",id);
            sessionID = id
        });
}

function sendClick(clickLocation) {
    if (!sessionID) {
        sendSessionRequest();
        return;
    }
    var connectRequest = new XMLHttpRequest();
    connectRequest.open("POST", "OnClick", true);
    connectRequest.onreadystatechange = function(){
        if (this.status === 403) {
            sendSessionRequest();
            return;
        }
    };
    let jsonLocation = JSON.stringify(clickLocation);
    console.log(jsonLocation);
    connectRequest.send("location=" + jsonLocation+"&id="+sessionID);
}

function longPollForClicks() {
    fetch("BallPoll?size=" + balls.length + (sessionID? "&id="+sessionID:""))
        .then(res => {
            if (res.status == 200) {
                res.json().then(response => {
                    console.log("Received click: ", response);
                    console.log("index: " + response.index);
                    console.log("Location: " + response.location);
                    console.log("Top time: " + response.topTime);
                    console.log("Drop time: ", response.dropTime);
                    balls[response.index] = new Ball(response.location, response.topTime + (Date.now() - START_TIME), response.dropTime);
                });
            }else if (res.status == 205){
                balls = [];
            }
            setTimeout(longPollForClicks, 0);
        }).catch(rej => console.log("error: ", rej));
}

class Ball {
    constructor(topPoint, createTime, dropTime) {
        this.topPoint = topPoint;
        this.createTime = createTime;
        this.dropTime = dropTime;
    }
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

function pointToBottom(point) {
    return new Point(point.x, height);
}

function setup() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    window.requestAnimationFrame(draw);
    longPollForClicks();
    window.addEventListener('mousedown', mouseIsDown, false);
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0099ff";
    for (const ball of balls) {
        let timeSinceStart = (Date.now() - START_TIME);

        if (ball.createTime > timeSinceStart) continue;

        let t = Math.abs((((timeSinceStart-ball.createTime) % (ball.dropTime * 2)) - ball.dropTime) / ball.dropTime);
        let adjustedT = t*(2-t);
        let location = new Point(ball.topPoint.x, lerp(height, ball.topPoint.y, adjustedT));

        drawCircle(location.x, location.y, RADIUS);
    }
    window.requestAnimationFrame(draw);
}

function drawCircle(x, y, radius) {
    ctx.beginPath();//start a drawing
    ctx.arc(x, y, radius, 0, 2 * Math.PI);//go in a circle
    ctx.fill(); //fill the circle
    ctx.closePath(); //stop the drawing
}

function mouseIsDown(event) {
    let cx = event.pageX;
    let cy = event.pageY;
    // noinspection SpellCheckingInspection
    var clickXandY = new Point(cx, cy);
    sendClick(clickXandY);

    console.log("X: " + cx + ", Y: " + cy);
}




/*
Todo:
Alex: Make each client only have one ball.
Niclas: Make a client actually sendClick on click.
Mattias: Make the client periodically sync with the server.
Documentation.

Make each client have a unique color?
 */