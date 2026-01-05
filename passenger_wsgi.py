# This file is sometimes required by Passenger on shared hosting
# For Node.js apps, this is usually not needed, but some hosts require it
# Leave it empty or with minimal content

import sys
import os

# This is a placeholder for Python WSGI apps
# Your Node.js app runs via index.js, not this file
def application(environ, start_response):
    start_response('200 OK', [('Content-Type', 'text/plain')])
    return [b'This is a Node.js application. See index.js']

