import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import SocketIO from "socket.io";
import e from "express";
import { start } from "repl";
import * as mediasoupClient from "mediasoup-client";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const WebSocket = require('ws');

const fs = require('fs');
const path = require('path');
const wrtc = require("wrtc");


const app = express();
const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.engine("pug", require("pug").__express);

app.use("/public", express.static(__dirname + "/public"));

app.get("/", (req, res) => res.render("home_teacher"));
app.get("/student", (req, res) => res.render("home_student"));

const handleListen = () => console.log('Listening on http://localhost:3005');

let writeStream;

let teacherPc;
let teacherStream;
let teacherSenders = {};
let studentPc = new Map();    //소켓, peerConnection 쌍
let reConnection = 0;
let teacherDevice;
let room;

//---선생 RTCPeerConnection 정의

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
    // console.log("I sent ice");
    teacherSocket.emit("ice", e.candidate);
  };

  pc.oniceconnectionstatechange = (e) => {
    //console.log(e);
  };

  pc.ontrack = (e) => {
    console.log("input stream in ts ", e.streams[0]);
    teacherStream = e.streams[0];
    teacherSenders = pc.getSenders();
  };

  pc.onconnectionstatechange = (e) => {
    console.log("tpc has changed", pc.connectionState);
    switch (pc.connectionState) {
      case "disconnected":
        if (teacherPc) teacherPc.close();
        teacherStream = null;
        teacherPc = null;
        reConnection = 1;
        break;
      case "failed":
        if (teacherPc) teacherPc.close();
        teacherStream = null;
        teacherPc = null;
        reConnection = 1;
        break;
      case "connected":

        socket = new WebSocket(`wss://localhost:3000`);

        socketEvent();

        if (reConnection === 1) {
          console.log("reconnecting");

          studentPc.forEach(spc => {
            spc.close();
          });

          for (let sSock of studentPc.keys()) {
            sSock.emit("reconnect");
          }
          reConnection = 0;
        }

        console.log("sent welcome to students");

        for (let sSock of studentPc.keys()) {
          sSock.emit("welcome");
        }

        break;

    }
  }

  return pc;

}

//---학생 RTCPeerConnection 정의

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
    // console.log("I sent ice");
    studentSocket.emit("ice", e.candidate);
  };

  pc.oniceconnectionstatechange = (e) => {
    //console.log(e);
  };

  if (teacherStream) teacherStream.getTracks().forEach(track => pc.addTrack(track, teacherStream));

  return pc;
}

//---소켓 통신

wsServer.on("connection", socket => {

  socket.on("join_room", async (roomName) => {
    room = roomName;
    socket.join(roomName);
    socket.emit("welcome");
  });

  socket.on('join_roomstudent', async (roomName) => {
    room = roomName;
    socket.join(roomName);
    studentPc.set(socket, null);
    if (teacherStream) socket.emit("welcome");
  });

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
  });

  socket.on("ice", (ice, role) => {
    if (role === 0) {
      if (ice) {
        teacherPc.addIceCandidate(
          new wrtc.RTCIceCandidate(ice)
        );
        // console.log("i got ice");
      }
      else {
        // console.log("i got null ice", ice);
      }

    }
    else {
      if (ice) studentPc.get(socket).addIceCandidate(
        new wrtc.RTCIceCandidate(ice)
      );
      // console.log("i got ice");
    }
  });

  socket.on("device", (device) => {
    teacherDevice = new mediasoup.Device(device);
  });
})

httpServer.listen(3005, handleListen);

//----------------------live streaming save

const mediasoup = require('mediasoup-client');

const { GUM } = require('./gum');
const Peer = require('./peer');
const SocketQueue = require('./queue');

const mediasoupConfig = require('./config');

let peer;
const queue = new SocketQueue();

let socket;

const handleSocketOpen = async () => {
  console.log('handleSocketOpen()');
};

const handleSocketMessage = async (message) => {
  try {
    const jsonMessage = JSON.parse(message.data);
    handleJsonMessage(jsonMessage);
  } catch (error) {
    console.error('handleSocketMessage() failed [error:%o]', error);
  }
};

const handleSocketClose = () => {
  console.log('handleSocketClose()');
  // document.getElementById('startRecordButton').disabled = true;
  // document.getElementById('stopRecordButton').disabled = true;
};

const getVideoCodecs = () => {
  const params = new URLSearchParams(location.search.slice(1));
  const videoCodec = params.get('videocodec')
  console.warn('videoCodec');

  const codec = mediasoupConfig.router.mediaCodecs.find(c => {
    if (!videoCodec)
      return undefined;

    return ~c.mimeType.toLowerCase().indexOf(videoCodec.toLowerCase())
  });

  console.warn('codec', codec);
  return codec ? codec : {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000
    }
  };
}

const handleSocketError = error => {
  console.error('handleSocketError() [error:%o]', error);
};

const handleJsonMessage = async (jsonMessage) => {
  const { action } = jsonMessage;

  switch (action) {
    case 'router-rtp-capabilities':
      handleRouterRtpCapabilitiesRequest(jsonMessage);
      break;
    case 'create-transport':
      handleCreateTransportRequest(jsonMessage);
      break;
    case 'connect-transport':
      handleConnectTransportRequest(jsonMessage);
      break;
    case 'produce':
      handleProduceRequest(jsonMessage);
      break;
    default: console.log('handleJsonMessage() unknown action %s', action);
  }
};

const handleRouterRtpCapabilitiesRequest = async (jsonMessage) => {
  const { routerRtpCapabilities, sessionId } = jsonMessage;
  console.log('handleRouterRtpCapabilities() [rtpCapabilities:%o]', routerRtpCapabilities);

  try {
    const device = teacherDevice;
    console.log("디바이스 : ", device);
    var caps = { rtpCapabilities: [routerRtpCapabilities]};
    await device.load({ caps });

    peer = new Peer(sessionId, device, teacherStream);
    createTransport();
  } catch (error) {
    console.error('handleRouterRtpCapabilities() failed to init device [error:%o]', error);
    socket.close();
  }
};

const createTransport = () => {
  console.log('createTransport()');

  if (!peer || !peer.device.loaded) {
    throw new Error('Peer or device is not initialized');
  }

  // First we must create the mediasoup transport on the server side
  socket.send(JSON.stringify({
    action: 'create-transport',
    sessionId: peer.sessionId
  }));
};

// Mediasoup Transport on the server side has been created
const handleCreateTransportRequest = async (jsonMessage) => {
  console.log('handleCreateTransportRequest() [data:%o]', jsonMessage);

  try {
    // Create the local mediasoup send transport
    peer.sendTransport = await peer.device.createSendTransport(jsonMessage);
    console.log('handleCreateTransportRequest() send transport created [id:%s]', peer.sendTransport.id);

    // Set the transport listeners and get the users media stream
    handleSendTransportListeners();
    getMediaStream();
  } catch (error) {
    console.error('handleCreateTransportRequest() failed to create transport [error:%o]', error);
    socket.close();
  }
};

const handleSendTransportListeners = () => {
  peer.sendTransport.on('connect', handleTransportConnectEvent);
  peer.sendTransport.on('produce', handleTransportProduceEvent);
  peer.sendTransport.on('connectionstatechange', connectionState => {
    console.log('send transport connection state change [state:%s]', connectionState);
    if(connectionState === 'connected') {
      
      setTimeout(() => {
        console.log("스타트레코드");
        socket.send(JSON.stringify({
          action: 'start-record',
          sessionId: peer.sessionId,
        }));
      
      },5000);
    }
  });
};

const getMediaStream = async () => {
  const mediaStream = teacherStream;

  // Get the video and audio tracks from the media stream
  const videoTrack = mediaStream.getVideoTracks()[0];
  console.log("비디오트랙 : ", videoTrack);
  const audioTrack = mediaStream.getAudioTracks()[0];
  console.log("오디오트랙 : ", audioTrack);

  // If there is a video track start sending it to the server
  if (videoTrack) {
    const videoProducer = await peer.sendTransport.produce({ track: videoTrack });
    peer.producers.push(videoProducer);
  }

  // if there is a audio track start sending it to the server
  if (audioTrack) {
    const audioProducer = await peer.sendTransport.produce({ track: audioTrack });
    peer.producers.push(audioProducer);
  }

  // Enable the start record button
  // document.getElementById('startRecordButton').disabled = false;
};

const handleConnectTransportRequest = async (jsonMessage) => {
  console.log('handleTransportConnectRequest()');
  try {
    const action = queue.get('connect-transport');

    if (!action) {
      throw new Error('transport-connect action was not found');
    }

    await action(jsonMessage);
  } catch (error) {
    console.error('handleTransportConnectRequest() failed [error:%o]', error);
  }
};

const handleProduceRequest = async (jsonMessage) => {
  console.log('handleProduceRequest()');
  try {
    const action = queue.get('produce');

    if (!action) {
      throw new Error('produce action was not found');
    }

    await action(jsonMessage);
  } catch (error) {
    console.error('handleProduceRequest() failed [error:%o]', error);
  }
};

const handleTransportConnectEvent = ({ dtlsParameters }, callback, errback) => {
  console.log('handleTransportConnectEvent()');
  try {
    const action = (jsonMessage) => {
      console.log('connect-transport action');
      callback();
      queue.remove('connect-transport');
    };

    queue.push('connect-transport', action);

    socket.send(JSON.stringify({
      action: 'connect-transport',
      sessionId: peer.sessionId,
      transportId: peer.sendTransport.id,
      dtlsParameters
    }));
  } catch (error) {
    console.error('handleTransportConnectEvent() failed [error:%o]', error);
    errback(error);
  }
};

const handleTransportProduceEvent = ({ kind, rtpParameters }, callback, errback) => {
  console.log('handleTransportProduceEvent()');
  try {
    const action = jsonMessage => {
      console.log('handleTransportProduceEvent callback [data:%o]', jsonMessage);
      callback({ id: jsonMessage.id });
      queue.remove('produce');
    };

    queue.push('produce', action);

    socket.send(JSON.stringify({
      action: 'produce',
      sessionId: peer.sessionId,
      transportId: peer.sendTransport.id,
      kind,
      rtpParameters
    }));
  } catch (error) {
    console.error('handleTransportProduceEvent() failed [error:%o]', error);
    errback(error);
  }
};

function socketEvent() {
  socket.addEventListener('open', handleSocketOpen);
  socket.addEventListener('message', handleSocketMessage);
  socket.addEventListener('error', handleSocketError);
  socket.addEventListener('close', handleSocketClose);
}

