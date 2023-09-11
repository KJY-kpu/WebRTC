const socket = io();

const call = document.getElementById("call");

call.hidden = true;

let roomName;
let myPeerConnection;
let joined = 0;
let muted = true;
let audioTracks;
let chunks = [];
let playBackTime = Number(0);
let blobQueue = [];
let played = false;

// Welcome Form (join room)-------------------------------
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");
const peersFace = document.getElementById("peersFace");
const testFace = document.getElementById("testFace");
const playBackForm = document.getElementById("playBack");

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    makeConnection();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_roomstudent", input.value);
    roomName = input.value;
    input.value = "";
}

function handleMuteClick() {
    audioTracks.forEach((track) => (track.enabled = !track.enabled));
    if (!muted) {
        muteBtn.innerText = "Unmute";
        muted = true;
    } else {
        muteBtn.innerText = "Mute";
        muted = false;
    }
}

async function handlePlayBack(event) {
    event.preventDefault();
    const input = playBack.querySelector("input");
    playBackTime = input.value;
    await socket.emit("pull", playBackTime);
    playBackTime = Number(playBackTime) + Number(5);
    // displayBlob(blobQueue.shift());

}

function displayBlob(blob) {
    console.log("display function : ", blob);
    const url = URL.createObjectURL(blob);
    testFace.src = url;
}


welcomeForm.addEventListener("submit", handleWelcomeSubmit);
playBackForm.addEventListener("submit", handlePlayBack);
testFace.addEventListener("ended", async () => {
    console.log("ended event on!");
    // if (blobQueue.length < 3) {
    //     console.log("pulling");
    //     await socket.emit("pull", playBackTime);
    //     playBackTime = playBackTime + 5;
    // }
    displayBlob(blobQueue.shift());

});

setInterval( () => {
    if(blobQueue.length < 3 && played) {
        socket.emit("pull", playBackTime);
        playBackTime = Number(playBackTime) + Number(5);
    }
}, 3000);

// Socket code

socket.on("welcome", () => {
    console.log("i got welcome");
    if (joined === 0) {
        joined = 1;
        socket.emit("offerstudent");
    }
});

socket.on("offer", async (offer) => {
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answerstudent", answer);
    console.log("sent my answer");
});

socket.on("ice", ice => {
    myPeerConnection.addIceCandidate(ice);
    console.log("i got ice");
});

socket.on("reconnect", () => {
    myPeerConnection.close();
    join = 0;
    makeConnection();
    socket.emit("offerstudent");

});

socket.on("blob", (data) => {
    const blob = new Blob([data], { type: "video\/mp4" });
    blobQueue.push(blob);
    console.log("i got blob : ", blob);
    if(played === false) {
        displayBlob(blob);
        played = true;
    }
    // const blob = new Blob([data], { type: "video\/mp4" });
    // console.log(blob);
    // const url = URL.createObjectURL(blob);
    // testFace.src = url;
    // console.log("url : ", url);

});

// RTC code

function makeConnection() {
    try {
        myPeerConnection = new RTCPeerConnection({
            iceServers: [
                {
                    urls: [
                        "stun:stun.l.google.com:19302",
                        "stun:stun1.l.google.com:19302",
                        "stun:stun2.l.google.com:19302",
                        "stun:stun3.l.google.com:19302",
                        "stun:stun4.l.google.com:19302",
                    ]
                }
            ]
        });
        myPeerConnection.addEventListener("icecandidate", handleIce);
        myPeerConnection.addEventListener("track", handleAddTrack);

    } catch (e) { console.log(e); }

}

function handleIce(data) {
    console.log("why??");
    socket.emit("ice", data.candidate, 1);
    console.log("sent my candidate");
}

function handleAddTrack(data) {


    console.log(data.streams[0]);

    peersFace.srcObject = data.streams[0];
    peersFace.muted = true;
}