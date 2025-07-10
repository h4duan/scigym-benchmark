# SciGym Website

This is the repository that contains source code for the [SciGym website](https://h4duan.github.io/scigym.github.io/).

## How to Start the Web Server

This is a static website that can be served using any web server. Here are several options:

### Option 1: Python HTTP Server (Python 3)

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

### Option 2: Python HTTP Server (Python 2)

```bash
python -m SimpleHTTPServer 8000
```

Then open http://localhost:8000 in your browser.

### Option 3: Node.js HTTP Server

First install a simple HTTP server:

```bash
npm install -g http-server
```

Then start the server:

```bash
http-server -p 8000
```

Then open http://localhost:8000 in your browser.
