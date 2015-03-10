from werkzeug.wsgi import peek_path_info
from geventwebsocket import Resource
from chatterbox import config
from chatterbox.app import App
from flask_sockets import Sockets
from chatterbox.app.kilo import Kilo #WebRTC Signalling server
import logging
from gevent import monkey
monkey.patch_all()

def create_app():
    logging.basicConfig(level=config.LOG_LEVEL)
    logging.info("Initializing")
    def app(env, start_response):
        _app = App()
        if peek_path_info(env) == "healthcheck":
            _app.config['SERVER_NAME'] = None
        else:
            _app.config['SERVER_NAME'] = config.SERVER_NAME

        return _app(env, start_response)

    logging.info("Running")
    return app

app = Resource({
    '/': create_app(),
    '/room': Kilo
})
