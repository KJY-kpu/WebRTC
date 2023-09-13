const io = require('socket.io-client');
const socket = io('http://localhost:3000'); // 로컬 서버의 주소와 포트를 지정합니다.

socket.on('test', () => {
    console.log('소켓 연결 성공!');
});



// 필요한 이벤트 핸들러를 추가할 수 있습니다.

setInterval(() => {
    if(socket.connected) {
        socket.emit('test', () => {
            console.log('sent test');
        });
    }
}, 3000);


