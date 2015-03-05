'use strict';

var me;
var room;
var room_name = 'foo';
var localVideo = document.getElementById('localVideo');
var videos = document.getElementById('remote_videos');
var url = "ws://chatterbox.entropealabs.mine.nu/room"

var vid_constraints = {
    mandatory: {
        maxHeight: 180,
        maxWidth: 320
    }
}
var constraints = { audio: true, video: vid_constraints };

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
    room = new Room(room_name, url, stream);
    init_room(room);
}

function handleUserMediaError(error){
    console.log('getUserMedia error: ', error);
}

function Client(id, moderator, room){
    this.id = id;
    this.moderator = moderator;
    this.room = room;
    this.pc = this.create_peer_connection();
}

Client.prototype.ping = function(){
    var me = this;
    setInterval(function(){
        me.broadcast({ping:'pong'})
    }, 30000);
}

Client.prototype.sendto = function(client, data){
    var me = this;
    this.room.socket.send(JSON.stringify({
        _from:me.id,
        _to:client,
        _action:'sendto',
        data:data,
    }));
}

Client.prototype.broadcast = function(data){
    var me = this;
    this.room.socket.send(JSON.stringify({
        _from:me.id,
        _action:'broadcast',
        data:data,
    }));
}

Client.prototype.create_peer_connection = function(){
    var pc = new RTCPeerConnection(null);
    pc.onicecandidate = this.onicecandidate;
    pc.onaddstream = this.onaddstream;
    pc.onremovestream = this.onremovestream;
    pc.oniceconnectionstatechange = this.oniceconnectionstatechange;
    pc.addStream(this.room.stream);
    return pc;
}


Client.prototype.onaddstream = function(evt){
    var vid = document.createElement('video');
    vid.autoplay = true;
    vid.src = window.URL.createObjectURL(evt.stream);
    videos.appendChild(vid);
}

Client.prototype.onremovestream = function(evt){
    console.log(evt);
}

Client.prototype.oniceconnectionstatechange = function(evt){
    console.log(evt);
}

Client.prototype.onicecandidate = function(evt){
    if(evt.candidate) {
        me.broadcast({
            type: 'candidate',
            label: evt.candidate.sdpMLineIndex,
            id: evt.candidate.sdpMid,
            candidate: evt.candidate.candidate
        });
    }else{
        console.log('End of candidates.');
    }
}

Client.prototype.call = function(client){
    var me = this;
    this.pc.createOffer(function(offer){
        me.pc.setLocalDescription(new RTCSessionDescription(offer), function(){
            me.sendto(client, offer);
        }, function(){});
    }, function(){});
}

Client.prototype.answer = function(client_id, offer){
    var me = this
    this.pc.setRemoteDescription(new RTCSessionDescription(offer), function() {
        me.pc.createAnswer(function(answer) {
            me.pc.setLocalDescription(new RTCSessionDescription(answer), function() {
                console.log(client_id);
                console.log(offer);
                me.sendto(client_id, answer);
            }, function(){});
        }, function(){});
    }, function(){});
};

function Room(name, url, stream) {
    this.name = name;
    this.clients = {};
    this.socket = null;
    this.url = url;//+"/"+name;
    this.stream = stream;
    this.open();
}

Room.prototype.on = function(name, callback){
    this.socket.addEventListener(name, callback, false);
}

Room.prototype.add_client = function(client){
    this.clients[client.id] = client;
}

Room.prototype.open = function(){
    this.socket = new WebSocket(this.url);
    var room = this;
    this.socket.on('message', function(message) {
        var evt = JSON.parse(message.data);
        var e = new CustomEvent(evt.data.type, {detail:evt});
        room.socket.dispatchEvent(e);
    });
    this.socket.on('error', function(evt) {
        console.log("socket error", evt);
    });
}

function init_room(room){
    room.socket.on('me', function (evt){
        me = new Client(evt.detail.data.id, evt.detail.data.moderator, room);
        console.log(me);
    });

    room.socket.on('joined', function(evt){
        if(me.id != evt.detail.data.id){
            console.log("calling: ", evt)
            me.call(evt.detail.data.id);
        }
    });

    room.socket.on('offer', function(evt){
        console.log("Got Offer", evt);
        me.answer(evt.detail._from, evt.detail.data);
    });

    room.socket.on('answer', function(evt){
        console.log("Got Answer:", evt);
        me.pc.setRemoteDescription(new RTCSessionDescription(evt.detail.data), function() { }, function() { });
    });

    room.socket.on('candidate', function(evt){
        var candidate = new RTCIceCandidate({
            sdpMLineIndex: evt.detail.data.label,
            candidate: evt.detail.data.candidate
        });
        me.pc.addIceCandidate(candidate);
    });
}
