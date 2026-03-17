from http.server import SimpleHTTPRequestHandler, HTTPServer
import os

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

if __name__ == "__main__":
    httpd = HTTPServer(('localhost', PORT), CustomHTTPRequestHandler)
    print(f"Serving frontend at http://localhost:{PORT}")
    httpd.serve_forever()