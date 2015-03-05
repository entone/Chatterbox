'use strict';

var isChannelReady;
var isInitiator = false;
var localStream;
var peers = {};
var remoteStream;
var turnReady;
var constraints = {video: true, audio:true};
var socket;
var ident = new Array(25).join().replace(/(.|$)/g, function(){return ((Math.random()*36)|0).toString(36)[Math.random()<.5?"toString":"toUpperCase"]();});

WebSocket.prototype.on = function(name, callback){
    this.addEventListener(name, callback, false);
}

WebSocket.prototype.emit = function(data){
    this.send(JSON.stringify({type:'event', data:data, id:ident}));
}

console.log("IDENT: "+ident);

var pc_config = {
    'iceServers': [
        {'url': 'stun:stun.l.google.com:19302'}
    ]
};

var pc_constraints = {
    'optional': [
        {'DtlsSrtpKeyAgreement': true}
    ]
};

var sdpConstraints = {
    'mandatory': {
        'OfferToReceiveAudio':true,
        'OfferToReceiveVideo':true
    }
};

/////////////////////////////////////////////
console.log('Getting user media with constraints', constraints);
getUserMedia(constraints, handleUserMedia, handleUserMediaError);

function handleUserMedia(stream) {
    console.log('Adding local stream.');
    localVideo.src = window.URL.createObjectURL(stream);
    localStream = stream;
    init_websocket();
}

function handleUserMediaError(error){
    console.log('getUserMedia error: ', error);
}

function init_websocket(){
    socket = new WebSocket("ws://chatterbox.entropealabs.mine.nu/echo");

    socket.on('open', function(evt) {
        console.log("open");
        socket.emit({type:'register'});
        ping();
    });

    socket.on('close', function(evt) {
        console.log("close");
    });

    socket.on('message', function(evt) {
        var data = JSON.parse(evt.data);
        data.data.id = data.id;
        var ev = new CustomEvent(data.type, {detail:data.data});
        evt.currentTarget.dispatchEvent(ev);
    });

    socket.on('error', function(evt) {
        console.log("close");
        console.log(evt);
    });

    socket.on('event', function (message){
        var evt = message.detail;
        console.log('Client received message:', evt);
        switch(evt.type){
            case 'joined':
                isChannelReady = true;
                console.log('A peer has joined room ' + evt.room);
                break;
            case 'created':
                isInitiator = true;
                console.log("First one in the room");
                break;
            case 'register':
                peers[evt.id] = peers[evt.id] ? evt.id in peers : {};
                socket.emit({type:'registered'});
                console.log("PEERS: ");
                console.log(peers);
                break;
            case 'registered':
                peers[evt.id] = peers[evt.id] ? evt.id in peers : {};
                console.log("PEERS: ");
                console.log(peers);
                socket.emit({type:'user_media'});
                break;
            case 'user_media':
      	        maybeStart(evt.id);
                break;
            case 'offer':
                maybeStart(evt.id);
                peers[evt.id].setRemoteDescription(new RTCSessionDescription(evt));
                doAnswer(evt.id);
                break;
            case 'answer':
                peers[evt.id].setRemoteDescription(
                    new RTCSessionDescription(evt)
                );
                break;
            case 'candidate':
                var candidate = new RTCIceCandidate({
                    sdpMLineIndex: evt.label,
                    candidate: evt.candidate
                });
                peers[evt.id].addIceCandidate(candidate);
                break;
            case 'bye':
                handleRemoteHangup();
                break;
            case 'ping':
                console.log("received ping...")
        }
    });
}

var localVideo = document.getElementById('localVideo');
var remote_videos = document.getElementById('remote_videos');

var room = 'foo';

function ping(){
    setInterval(function(){
        socket.emit({type:'ping'});
    }, 10000);
};

window.onbeforeunload = function(e){
	socket.emit({type:'bye'});
}

function maybeStart(id) {
    if(localStream && isChannelReady) {
        createPeerConnection(id);
        peers[id].addStream(localStream);
        console.log('isInitiator', isInitiator);
        if(isInitiator) doCall(id);
    }
}

/////////////////////////////////////////////////////////

function createPeerConnection(id) {
    try {
        peers[id] = new RTCPeerConnection(null);
        peers[id].onicecandidate = handleIceCandidate;
        peers[id].onaddstream = handleRemoteStreamAdded;
        peers[id].onremovestream = handleRemoteStreamRemoved;
        console.log('Created RTCPeerConnnection');
    }catch(e){
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

function handleIceCandidate(event) {
    console.log('handleIceCandidate event: ', event);
    if(event.candidate) {
        socket.emit({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    }else{
        console.log('End of candidates.');
    }
}

function handleRemoteStreamAdded(event) {
    var vid = document.createElement('video');
    vid.autoplay = true;
    vid.src = window.URL.createObjectURL(event.stream);
    remote_videos.appendChild(vid);
    console.log('Remote stream added.');
    console.log(vid);
}

function handleCreateOfferError(event){
    console.log('createOffer() error: ', e);
}

function doCall(id) {
    console.log('Sending offer to peer');
    peers[id].createOffer(function(desc){
        setLocalAndSendDescription(desc, id);
    }, handleCreateOfferError);
}

function doAnswer(id) {
    console.log('Sending answer to peer.');
    peers[id].createAnswer(function(desc){
        setLocalAndSendDescription(desc, id);
    }, null, sdpConstraints);
}

function setLocalAndSendDescription(desc, id){
    peers[id].setLocalDescription(desc);
    console.log('setLocalAndSendMessage sending message' , desc);
    socket.emit(desc);
}

function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}

function hangup() {
    console.log('Hanging up.');
    stop();
    socket.emit({type:'bye'});
}

function handleRemoteHangup() {
    console.log('Someone Left');
}

function stop() {
    //isAudioMuted = false;
    //isVideoMuted = false;
    pc.close();
    pc = null;
}
