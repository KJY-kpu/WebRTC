const socket = io();

const welcome = document.getElementById("welcome");
const nickForm = welcome.querySelector("#nickname");
const roomForm = welcome.querySelector("#roomname");
const room = document.getElementById("room");

room.hidden = true;

let roomName;

function addMessage(message) {
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
}

function handleMessageSubmit(event) {
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value;
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(`You: ${value}`);
    });
    input.value = "";
}

function handleNickNameSubmit(event) {
    event.preventDefault();
    const input = nickForm.querySelector("input");
    const value = input.value;
    socket.emit("nickname", input.value);
}

function showRoom() {
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    const msgForm = room.querySelector("#msg");
    msgForm.addEventListener("submit", handleMessageSubmit);
}

function handleRoomSubmit(event) {
    event.preventDefault();
    const input = roomForm.querySelector("input");
    socket.emit("enter_room", input.value, showRoom);
    roomName = input.value;
    input.value = "";
}

roomForm.addEventListener("submit", handleRoomSubmit);
nickForm.addEventListener("submit", handleNickNameSubmit);

socket.on("welcome", (user, roomCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${roomCount})`;
    addMessage(`${user} arrived!`);
});

socket.on("bye", (user, roomCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${roomCount})`;
    addMessage(`${user} has gone`);
});

socket.on("new_message", addMessage);

socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector("#roomlist");
    roomList.innerHTML = "";
    if (rooms.length === 0) {
        return;
    }

    rooms.forEach(room => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});