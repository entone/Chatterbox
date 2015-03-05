WebSocket.prototype.on = function(name, callback){
    this.addEventListener(name, callback, false);
}

WebSocket.prototype.emit = function(data){
    this.send(JSON.stringify({type:'event', data:data}));
}
