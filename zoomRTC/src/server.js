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

let teacherPc = new wrtc.RTCPeerConnection();

let studentPc = new Map();

wsServer.on("connection", socket => {
  socket.on("join_room", async (roomName) => {
    
    socket.join(roomName);
    socket.emit("welcome");
  });
  socket.on("offer", async (offer, role) => {
    if (role === 0) {
      teacherPc.setRemoteDescription(offer);
      const answer = await teacherPc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceivevideo: true,
      });

      teacherPc.setLocalDescription(answer);
      socket.emit("answer", answer);
      
    }
    else {
      let pc = new wrtc.RTCPeerConnection();
      studentPc.set(socket, pc);
      studentPc.get(socket).setRemoteDescription(offer);
      const answer = await studentPc.get(socket).createAnswer();
      studentPc.get(socket).setLocalDescription(answer);
      socket.emit("answer", answer);
    }
    
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, role) => {
    if (role === 0) {
      console.log("i got ice", ice);
      if(ice) teacherPc.addIceCandidate(ice);
    }
    else {
      studentPc.get(socket).addIceCandidate(ice);
    }
  });
})

httpServer.listen(3000, handleListen);
