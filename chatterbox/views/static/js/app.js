'use strict';

var id;
var local_stream;
var recorder;

var vid_constraints = {
    mandatory: {
        maxHeight: 180,
        maxWidth: 320
    }
}

var constraints = { audio: true, video: vid_constraints };

var pc_config = {
    'iceServers': [
        {url: 'stun:stun.l.google.com:19302'},
        {
        	url: 'turn:numb.viagenie.ca',
        	credential: 'abudabu1',
        	username: 'entone@gmail.com'
        }
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

function Client(id, peer, room, stream){
    this.id = id;
    this.room = room;
    if(peer != "me") this.pc = this.create_peer_connection();
    this.stream = stream;
    this.peer = peer;
    this.dom_id = "peer"+Math.ceil(Math.random()*100000000);
    if(this.stream) this.onaddstream({'stream':stream});
}

Client.prototype.set_peer = function(peer){
    this.peer = peer;
}

Client.prototype.send = function(data){
    var me = this;
    this.room.socket.send(JSON.stringify({
        _from:me.id,
        _to:me.peer,
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
    var pc = new RTCPeerConnection(pc_config, pc_constraints);
    var me = this;
    pc.onicecandidate = function(evt){
        me.onicecandidate(evt);
    }
    pc.onaddstream = function(evt){
        me.onaddstream(evt);
    }
    pc.onremovestream = function(evt){
        me.onremovestream(evt);
    }
    pc.oniceconnectionstatechange = function(evt){
        me.oniceconnectionstatechange(evt);
    }
    //pc.addStream(local_stream);
    return pc;
}


Client.prototype.onaddstream = function(evt){
    var me = this;
    this.stream = window.URL.createObjectURL(evt.stream);
    //$("#"+this.dom_id).attr('src', this.stream);
    this.room.onclient(this);
}

Client.prototype.onremovestream = function(evt){
    console.log(evt);
    $("#"+this.dom_id).remove();
}

Client.prototype.oniceconnectionstatechange = function(evt){
    if(evt.currentTarget.iceConnectionState == 'completed'){
        //var peer = this.peer;
        console.log(this.peer+" Connection Complete");
        console.log(this.room.clients);
        /*
        for(var c in this.room.clients){
            var cli = this.room.clients[c];
            if(id == cli.moderator){
                var obj = {
                    type:'joined',
                    room:room_name,
                    id:peer,
                    moderator:id,
                };
                //cli.send(obj);
            }
        }
        */
    }
}

Client.prototype.onicecandidate = function(evt){
    if(evt.candidate) {
        this.send({
            type: 'candidate',
            label: evt.candidate.sdpMLineIndex,
            id: evt.candidate.sdpMid,
            candidate: evt.candidate.candidate
        });
    }else{
        console.log('End of candidates.');
    }
}

Client.prototype.has_peer = function(){
    if(!this.peer) throw "No peer set";
}

Client.prototype.call = function(){
    this.has_peer();
    var me = this;
    this.pc.createOffer(function(offer){
        me.pc.setLocalDescription(new RTCSessionDescription(offer), function(){
            me.send(offer);
        }, function(){});
    }, function(){});
}

Client.prototype.answer = function(offer){
    this.has_peer();
    var me = this;
    this.pc.setRemoteDescription(new RTCSessionDescription(offer), function() {
        me.pc.createAnswer(function(answer) {
            me.pc.setLocalDescription(new RTCSessionDescription(answer), function() {
                me.send(answer);
            }, function(){});
        }, function(){});
    }, function(){});
};

Client.prototype.set_remote_description = function(desc){
    this.pc.setRemoteDescription(new RTCSessionDescription(desc), function() { }, function() { });
}

function Room(name, url) {
    this.name = name;
    this.clients = [];
    this.socket = null;
    this.url = url;//+"/"+name;
    this.open();
    this.init();
}

Room.prototype.on = function(name, callback){
    this.socket.addEventListener(name, callback, false);
}

Room.prototype.add_client = function(client){
    this.clients.push(client);
}

Room.prototype.open = function(){
    this.socket = new WebSocket(this.url);
    var room = this;
    this.socket.on('open', function(evt){
        setInterval(function(){
            room.socket.send(JSON.stringify({_action:'ping'}));
        }, 5000);
    });

    this.socket.on('message', function(message) {
        var evt = JSON.parse(message.data);
        var e = new CustomEvent(evt.data.type, {detail:evt});
        room.socket.dispatchEvent(e);
    });

    this.socket.on('error', function(evt) {
        console.log("socket error", evt);
    });
};

Room.prototype.get_peer = function(id){
    for(var c in this.clients){
        var cli = this.clients[c];
        if(cli.peer && (cli.peer.toString() == id.toString())) return cli;
    }
    throw "Peer "+id+" does not exist";
}

Room.prototype.remove_peer = function(id){
    for(var c in this.clients){
        var cli = this.clients[c];
        if(cli.peer && (cli.peer.toString() == id.toString())){
            $("#"+cli.dom_id).remove();
            delete this.clients[c];
        }
    }
}

Room.prototype.record = function(){
    /*var mediaRecorder = new MediaStreamRecorder(stream);
    mediaRecorder.mimeType = 'video/webm';
    mediaRecorder.width = 320;
    mediaRecorder.height = 180;

    mediaRecorder.ondataavailable = function (blob) {
        // POST/PUT "Blob" using FormData/XHR2
        var blobURL = URL.createObjectURL(blob);
        var vid = document.getElementById("recorded_video");
        vid.src = blobURL;
        vid.play();
    };
    mediaRecorder.start(3000);*/
}

Room.prototype.init = function(){
    var room = this;
    room.socket.on('me', function (evt){
        id = evt.detail.data.id;
        me = new Client(id, "me", room);
        room.onme(me);
    });

    room.socket.on('joined', function(evt){
        if(me.id.toString() == evt.detail.data.id.toString()) return;
        console.log("Joined:", evt);
        var new_peer = true;
        for(c in room.clients){
            var cli = room.clients[c];
            if(cli.peer == evt.detail.data.id){
                new_peer = false;
                break;
            }
            if(!cli.peer){
                cli.set_peer(evt.detail.data.id);
                new_peer = false;
                cli.call();
                break;
            }
        }
        if(new_peer){
            var c = new Client(id, evt.detail.data.id, room);
            room.add_client(c);
            c.call();
        }
    });

    room.socket.on('offer', function(evt){
        console.log("Got Offer", evt);
        var new_peer = true;
        var from = evt.detail._from;
        for(var c in room.clients){
            var cli = room.clients[c];
            if(cli.peer == from || cli.moderator == from){
                cli.set_peer(from);
                cli.answer(evt.detail.data);
                new_peer = false;
                break;
            }
        }
        if(new_peer){
            var c = new Client(id, from, room);
            room.add_client(c);
            c.answer(evt.detail.data);
        }
    });

    room.socket.on('answer', function(evt){
        console.log("Got Answer:", evt);
        var peer = room.get_peer(evt.detail._from);
        peer.set_remote_description(evt.detail.data);
    });

    room.socket.on('candidate', function(evt){
        var candidate = new RTCIceCandidate({
            sdpMLineIndex: evt.detail.data.label,
            candidate: evt.detail.data.candidate
        });
        var peer = room.get_peer(evt.detail._from);
        peer.pc.addIceCandidate(candidate);
    });

    room.socket.on('bye', function(evt){
        room.remove_peer(evt.detail.data.id);
    })
}
