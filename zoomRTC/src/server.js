import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import SocketIO from "socket.io";
import e from "express";

let wrtc = require("wrtc");

const app = express();
const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.engine("pug", require("pug").__express);

app.use("/public", express.static(__dirname + "/public"));

app.get("/", (req, res) => res.render("home_teacher"));
app.get("/student", (req, res) => res.render("home_student"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log('Listening on http://localhost:3000');

// async function init() {
//   teacherPc = new wrtc.RTCPeerConnection();

//   studentPc = new Map();
// }
// await init();

let teacherPc;
let teacherStream;
let studentPc = new Map();
let users = {};

const createTeacherPc = (teacherSocket) => {
  const pc = new wrtc.RTCPeerConnection({
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

  pc.onicecandidate = (e) => {
    teacherSocket.emit("ice", e.candidate);
  };

  pc.oniceconnectionstatechange = (e) => {
    //console.log(e);
  };

  pc.ontrack = (e) => {
    console.log("input stream in ts ", e.streams[0]);
    teacherStream = e.streams[0];
  };

  pc.addEventListener("addstream", (data) => {
    console.log("addstream");
    const spcList = studentPc.values();
    for(let spc of spcList) {
      spc.addTrack(data.stream);
    }
  });

  return pc;

}

const createStudentPc = (studentSocket) => {
  const pc = new wrtc.RTCPeerConnection({
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

  pc.onicecandidate = (e) => {
    studentSocket.emit("ice", e.candidate);
  };

  pc.oniceconnectionstatechange = (e) => {
    //console.log(e);
  };
  console.log("stream is " + teacherStream);

  teacherStream.getTracks().forEach(track => pc.addTrack(track, teacherStream));

  return pc;
}

wsServer.on("connection", socket => {
  socket.on("join_room", async (roomName) => {
    socket.emit("welcome");
  });
  socket.on("offerteacher", async (offer) => {
    try {
      teacherPc = createTeacherPc(socket);
    } catch (e) { console.log(e); }
    teacherPc.setRemoteDescription(offer);
    const answer = await teacherPc.createAnswer({
      offerToReceiveAudio: true,
      offerToReceivevideo: true,
    });

    teacherPc.setLocalDescription(answer);
    socket.emit("answer", answer);
    console.log("i got offer and send answer / offer is ", offer, " / answer is ", answer);
  });

  socket.on("offerstudent", async () => {
    try {
      studentPc.set(socket, createStudentPc(socket));
    } catch (e) { console.log(e); }
    const offer = await studentPc.get(socket).createOffer();
    studentPc.get(socket).setLocalDescription(offer);
    socket.emit("offer", offer);
    console.log("send offer to student");
  });

  socket.on("answerstudent", (answer) => {
    studentPc.get(socket).setRemoteDescription(answer);
    console.log("i got answer from studnet");
  })

  socket.on("ice", (ice, role) => {
    if (role === 0) {
      if (ice) teacherPc.addIceCandidate(
        new wrtc.RTCIceCandidate(ice)
      );
      console.log("i got ice");
    }
    else {
      if (ice) studentPc.get(socket).addIceCandidate(
        new wrtc.RTCIceCandidate(ice)
      );
      console.log("i got ice");
    }
  });
})

httpServer.listen(3000, handleListen);
