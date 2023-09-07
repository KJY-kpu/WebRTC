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

let teacherPc;
let teacherStream;
let teacherSenders = {};
let studentPc = new Map();
let room;
let reConnection = 0;

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
    console.log("I sent ice");
    teacherSocket.emit("ice", e.candidate);
  };

  pc.oniceconnectionstatechange = (e) => {
    //console.log(e);
  };

  pc.ontrack = (e) => {
    console.log("input stream in ts ", e.streams[0]);
    teacherStream = e.streams[0];
    teacherSenders = pc.getSenders();
    if(reConnection === 1) {
      console.log("try to reconnecting");
      for(let spc of studentPc.values()) {
        teacherStream.getTracks().forEach(track => spc.addTrack(track, teacherStream));
      }
    reConnection = 0;
    }
  };

  pc.onconnectionstatechange = (e) => {
    console.log("tpc has changed", pc.connectionState);
    switch (pc.connectionState) {
      case "disconnected" :
        teacherStream = null;
        for(let spc of studentPc.values()) {
          for(let sender of spc.getSenders()) spc.removeTrack(sender);
        }
        reConnection = 1;
        break;
      case "connected" :
        if(reConnection === 1) {
          for(let spc of studentPc.values()) {
            teacherStream.getTracks().forEach(track => spc.addTrack(track, teacherStream));
          }
          
        }
        else {
          for(let sSocket of studentPc.keys()) {
            sSocket.emit("welcome");
          }
        }
        break;
      
    }
  }

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
    console.log("I sent ice");
    studentSocket.emit("ice", e.candidate);
  };

  pc.oniceconnectionstatechange = (e) => {
    //console.log(e);
  };
  console.log("stream is " + teacherStream);

  if (teacherStream) teacherStream.getTracks().forEach(track => pc.addTrack(track, teacherStream));

  return pc;
}

wsServer.on("connection", socket => {
  socket.on("join_room", async (roomName) => {
    room = roomName;
    socket.join(roomName);
    socket.emit("welcome");
  });
  socket.on('join_roomstudent', async (roomName) => {
    room = roomName;
    socket.join(roomName);
    if(teacherStream) socket.emit("welcome");
  })
  socket.on("offerteacher", async (offer) => {
    console.log("start offerteacher");
    try {
      teacherPc = createTeacherPc(socket);
      console.log("created pc");
    } catch (e) { console.log(e); }
    teacherPc.setRemoteDescription(offer);
    console.log("set remotedDescription");
    const answer = await teacherPc.createAnswer({
      offerToReceiveAudio: true,
      offerToReceivevideo: true,
    });
    console.log("created answer");

    teacherPc.setLocalDescription(answer);
    console.log("set localDescription");
    socket.emit("answer", answer);

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
      if (ice) {
        teacherPc.addIceCandidate(
          new wrtc.RTCIceCandidate(ice)
        );
        console.log("i got ice");
      }
      else {
        console.log("i got null ice", ice);
      }

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
