from flask import Blueprint, Response, render_template
from flask.views import MethodView
from chatterbox import config
import logging
import json
from uuid import uuid4
from bunch import Bunch

class Client(object):

    def __init__(self, ws):
        self.id = str(uuid4())
        self.ws = ws

    def send(self, data):
        self.ws.send(json.dumps(data))

class Room(object):

    def __init__(self, name):
        self.name = name
        self.clients = {}

    def on_connect(self, ws):
        current = ws.handler.active_client
        clients = ws.handler.server.clients.values()
        cl = self.add_client(current.ws)
        ev = {'type':'event', 'data':{'type':'me', 'room':self.name, 'id':cl.id}}
        cl.send(ev)
        ev['data']['type'] = 'joined'
        self.broadcast(cl.id, ev)

    def run(self, ws):
        while True:
            try:
                frame = ws.receive()
                try:
                    ms = json.loads(frame)
                    self.handle_message(ms)
                except:pass
            except Exception as e:
                logging.exception(e)
                ws.close()
                break

    def handle_message(self, ms):
        logging.info("Message: {}".format(ms))
        _from = self.clients[ms['_from']]
        _action = ms['_action']
        actions = {
            'sendto': self.sendto,
            'broadcast':self.broadcast,
        }
        actions[_action](_from, ms)

    def sendto(self, _from, ms):
        _to = self.clients[ms['_to']]
        _to.send(ms)

    def broadcast(self, _from, ms):
        for client in self.clients:
            if _from != client:
                self.clients[client].send(ms)

    def add_client(self, ws):
        cl = Client(ws=ws)
        self.clients[cl.id] = cl
        return cl

rooms = {}
def room(ws, room='foo'):
    logging.info('ROOM:{}'.format(room))
    room = rooms.setdefault(room, Room(name=room))
    room.on_connect(ws)
    room.run(ws)
