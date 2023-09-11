const socket = io();


const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");


call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let chunks = [];
let mediaRecorder;
let arrBuffer;
let resultBlob;

// setTimeout(() => {
//     mediaRecorder.stop();

// }, 7000)

// setTimeout(() => {
//     const testFace = document.getElementById("testFace");
//     const newBlob = new Blob([arrBuffer]);
//     const url = URL.createObjectURL(resultBlob);
//     testFace.src = url;

// }, 9000)

async function getCamears() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if (currentCamera.label === camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        });
    } catch (e) {
        console.log(e);
    }
}

async function getMedia(deviceId) {
    const initialConstrains = {
        audio: true,
        video: { facingMode: "user" },
    };
    const cameraConstrains = {
        audio: true,
        video: { deviceId: { exact: deviceId } },
    }
    try {
        myStream = await navigator.mediaDevices.getUserMedia(deviceId ? cameraConstrains : initialConstrains);
        myFace.srcObject = myStream;
        if (!deviceId) {
            await getCamears();
        }
    } catch (e) {
        console.log(e);
    }
}

function handleMuteClick() {
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    if (!muted) {
        muteBtn.innerText = "Unmute";
        muted = true;
    } else {
        muteBtn.innerText = "Mute";
        muted = false;
    }
}
function handleCameraClick() {
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    if (cameraOff) {
        cameraBtn.innerText = "Turn Camera off";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "Turn Camera on";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value);
    if (myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection
            .getSenders()
            .find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join room)-------------------------------
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket code

socket.on("welcome", async () => {
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    socket.emit("offerteacher", offer);
    console.log("sent my offer!")
});

socket.on("answer", answer => {
    myPeerConnection.setRemoteDescription(answer);
    console.log("received answer!");
});

socket.on("ice", ice => {
    myPeerConnection.addIceCandidate(ice);
    console.log("i got ice", ice);
});

// RTC code

function makeConnection() {
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
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));

    mediaRecorder = new MediaRecorder(myStream);

    mediaRecorder.start(1000);
    console.log(mediaRecorder.state);
    console.log("recorder started");

    mediaRecorder.onstop = (e) => {
        console.log("data available after MediaRecorder.stop() called.");
        
        resultBlob = new Blob(chunks, { type: "video\/mp4" });
        arrBuffer = resultBlob.arrayBuffer();
        
        console.log("recorder stopped");
    };

    mediaRecorder.ondataavailable = (e) => {
        socket.emit("push", e.data);
        console.log("emit chunk : ", e.data);
        //chunks.push(e.data);
    };

    //각 비디오, 오디오 트랙을 잡아서 RTCPeerConnection에 집어넣음
}

function handleIce(data) {
    socket.emit("ice", data.candidate, 0);
    console.log("sent my candidate");
}