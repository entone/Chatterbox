from flask import Blueprint, Response, render_template
from flask.views import MethodView
from chatterbox import config
import logging
import json
from bunch import Bunch

def broadcast(ws, ev):
    for client in ws.handler.server.clients.values():
        client.ws.send(json.dumps(ev))

def new_connection(ws):
    current = ws.handler.active_client
    clients = ws.handler.server.clients.values()
    if len(clients) == 1:
        ev = Bunch(type='created', data='foo')
        current.ws.send(json.dumps(ev))
    else:
        logging.info("Adding Client!")
        ev = Bunch(type='joined', data='foo')
        broadcast(ws, ev)

def echo(ws):
    new_connection(ws)
    while True:
        try:
            ms = json.loads(ws.receive())
        except Exception:
            ws.close()
            break

        logging.info("Got Message: {}".format(ms))
        broadcast(ws, ms)
