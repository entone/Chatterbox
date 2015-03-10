from geventwebsocket import WebSocketApplication
from chatterbox import config
from uuid import uuid4
import gevent
import logging
import json

class Kilo(WebSocketApplication):

    def on_open(self):
        self.name = 'foo'
        current = self.ws.handler.active_client
        ev = {'type':'event', '_to':current.address, 'data':{'type':'me', 'room':self.name, 'id':current.address}}
        self.sendto(ev)
        ev['data']['type'] = 'joined'
        self.broadcast(ev)

    def on_message(self, ms):
        try:
            ms = json.loads(ms)
            logging.info("Message: {}".format(ms))
            _action = ms['_action']
            ms['_from'] = tuple(ms.get('_from', {}))
            ms['_to'] = tuple(ms.get('_to', {}))
            actions = {
                'sendto': self.sendto,
                'broadcast':self.broadcast,
                'ping':self.ping
            }
            actions[_action](ms)
        except Exception as e:
            logging.error(e)

    def ping(self, ms): pass

    def on_close(self, reason):
        current = self.ws.handler.active_client
        logging.info("Client Left: {}".format(current.address))
        ev = {'type':'event', 'data':{'type':'bye', 'room':self.name, 'id':current.address}}
        self.broadcast(ev)

    def sendto(self, ms):
        _to = self.ws.handler.server.clients.get(ms['_to'])
        if _to: _to.ws.send(json.dumps(ms))

    def broadcast(self, message):
        for client in self.ws.handler.server.clients.values():
            client.ws.send(json.dumps(message))
