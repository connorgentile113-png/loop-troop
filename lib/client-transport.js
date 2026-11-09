/* Injected into mc/eaglercraft.html by scripts/build-client.mjs, before the game runs.
 *
 * The game only speaks WebSocket. Some school proxies allow the site but refuse the WebSocket
 * upgrade, or accept it and then drop every packet, which shows up as "handshake timed out".
 * This wrapper keeps the WebSocket fast path and, when that path does not carry traffic, moves the
 * same frames onto /game/http/* — plain HTTPS requests to this same origin, which the relay in
 * lib/game-relay.js forwards to the camp world unchanged. No other host is contacted.
 *
 * The choice is remembered in localStorage ("http" or "ws") so a camper on a blocked network does
 * not pay the discovery delay twice.
 */
(function () {
  if (window.__loopTroopTransport) return;
  window.__loopTroopTransport = true;

  var Native = window.WebSocket;
  if (!Native) return;

  var STORE_KEY = "lt-ws-transport";
  var OPEN_BUDGET = 2500;
  var HANDSHAKE_BUDGET = 2500;

  function remembered() {
    try {
      return window.localStorage.getItem(STORE_KEY);
    } catch (e) {
      return null;
    }
  }

  function remember(value) {
    try {
      window.localStorage.setItem(STORE_KEY, value);
    } catch (e) {
      /* private mode: we just pay the discovery delay each time */
    }
  }

  // Only our own /game relay is wrapped. The Zentic world is joined by its own address, with no
  // relay of ours in the path, so it keeps the browser's real WebSocket.
  function isGame(url) {
    try { return /^\/game\/?$/.test(new URL(String(url), window.location.href).pathname); } catch (e) { return false; }
  }

  function emit(socket, type, extra) {
    var event = { type: type, target: socket, currentTarget: socket, bubbles: false, cancelable: false };
    if (extra) for (var key in extra) event[key] = extra[key];
    var listeners = socket._listeners[type] || [];
    for (var i = 0; i < listeners.length; i++) {
      try {
        if (typeof listeners[i] === "function") listeners[i].call(socket, event);
        else if (listeners[i] && typeof listeners[i].handleEvent === "function") {
          listeners[i].handleEvent(event);
        }
      } catch (error) {
        setTimeout(function () {
          throw error;
        }, 0);
      }
    }
    var handler = socket["on" + type];
    if (typeof handler === "function") {
      try {
        handler.call(socket, event);
      } catch (error) {
        setTimeout(function () {
          throw error;
        }, 0);
      }
    }
  }

  function toBytes(data) {
    if (typeof data === "string") return new TextEncoder().encode(data);
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Uint8Array(0);
  }

  function pack(frames) {
    var total = 0, i;
    for (i = 0; i < frames.length; i++) total += 4 + frames[i].bytes.length;
    var body = new Uint8Array(total);
    var view = new DataView(body.buffer);
    var at = 0;
    for (i = 0; i < frames.length; i++) {
      view.setUint32(at, frames[i].bytes.length | (frames[i].text ? 0x80000000 : 0));
      at += 4;
      body.set(frames[i].bytes, at);
      at += frames[i].bytes.length;
    }
    return body;
  }

  function closeLocal(socket, code) {
    if (socket.readyState === 3) return;
    socket.readyState = 3;
    socket._requests.forEach(function (controller) { controller.abort(); });
    clearTimeout(socket._openTimer);
    clearTimeout(socket._handshakeTimer);
    clearTimeout(socket._flushTimer);
    emit(socket, "close", { code: code || 1000, reason: "", wasClean: code === 1000 });
  }

  function fail(socket, error) {
    if (socket.readyState === 3) return;
    emit(socket, "error", { message: String((error && error.message) || error), error: error });
    closeLocal(socket, 1006);
  }

  function flushNative(socket) {
    if (!socket._native || !socket._queue.length) return;
    var frames = socket._queue;
    socket._queue = [];
    for (var i = 0; i < frames.length; i++) {
      var bytes = toBytes(frames[i]);
      try {
        socket._native.send(typeof frames[i] === "string" ? frames[i] : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      } catch (error) {
        socket._queue = frames.slice(i).concat(socket._queue);
        fail(socket, error);
        return;
      }
      // Keep what we have sent until the world answers once, so a transport switch can replay it.
      if (!socket._answered) socket._sent.push(frames[i]);
    }
  }

  // A filtered request can otherwise stay pending beyond the game handshake deadline.
  function request(socket, url, options, budget) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, budget);
    socket._requests.push(controller);
    options.signal = controller.signal;
    options.cache = "no-store";
    return fetch(url, options).finally(function () {
      clearTimeout(timer);
      var at = socket._requests.indexOf(controller);
      if (at >= 0) socket._requests.splice(at, 1);
    });
  }

  function flushHttp(socket) {
    if (!socket._id || !socket._queue.length || socket.readyState !== 1 || socket._sending) return;
    var frames = socket._queue;
    socket._queue = [];
    var body = pack(frames.map(function (frame) {
      return { bytes: toBytes(frame), text: typeof frame === "string" };
    }));
    // Await each POST before sending the next batch: parallel requests can arrive out of order.
    socket._sending = true;
    request(socket, socket._base + "/" + socket._id + "/send", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/octet-stream" },
      body: body,
    }, 12000).then(function (res) {
      if (!res.ok) throw new Error("relay answered " + res.status);
      socket._sending = false;
      flushHttp(socket);
    }).catch(function (error) {
      socket._sending = false;
      fail(socket, error);
    });
  }

  function poll(socket) {
    if (socket.readyState !== 1 || !socket._id) return;
    request(socket, socket._base + "/" + socket._id + "/recv", { credentials: "same-origin" }, 25000)
      .then(function (res) {
        if (res.status === 204) {
          poll(socket);
          return null;
        }
        if (res.status === 410) {
          closeLocal(socket, 1000);
          return null;
        }
        if (!res.ok) throw new Error("relay answered " + res.status);
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        if (!buffer || socket.readyState !== 1) return;
        var view = new DataView(buffer);
        var at = 0;
        while (at + 4 <= buffer.byteLength) {
          var header = view.getUint32(at);
          var text = !!(header & 0x80000000);
          var length = header & 0x7fffffff;
          at += 4;
          if (at + length > buffer.byteLength) break;
          socket._answered = true;
          socket._sent = [];
          var data = buffer.slice(at, at + length);
          emit(socket, "message", { data: text ? new TextDecoder().decode(data) : data });
          at += length;
        }
        poll(socket);
      })
      .catch(function (error) {
        fail(socket, error);
      });
  }

  function startHttp(socket, announce) {
    if (socket._httpStarted || socket.readyState === 3) return;
    socket._httpStarted = true;
    request(socket, socket._base + "/open", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }, 18000)
      .then(function (res) {
        if (!res.ok) throw new Error("relay answered " + res.status);
        return res.json();
      })
      .then(function (info) {
        if (socket.readyState === 3) {
          fetch(socket._base + "/" + info.id + "/close", { method: "POST", credentials: "same-origin" }).catch(function () {});
          return;
        }
        socket._id = info.id;
        remember("http");
        socket.readyState = 1;
        if (announce) emit(socket, "open", {});
        var replay = socket._sent.slice();
        socket._sent = [];
        socket._queue = replay.concat(socket._queue);
        flushHttp(socket);
        poll(socket);
      })
      .catch(function (error) {
        fail(socket, error);
      });
  }

  function switchToHttp(socket) {
    if (socket._native) {
      socket._native.onopen = socket._native.onmessage = socket._native.onclose = socket._native.onerror = null;
      try {
        socket._native.close();
      } catch (error) {
        /* already closed */
      }
      socket._native = null;
    }
    startHttp(socket, false);
  }

  function startNative(socket) {
    var native;
    try {
      native = new Native(socket.url);
    } catch (error) {
      startHttp(socket, true);
      return;
    }
    socket._native = native;
    native.binaryType = "arraybuffer";
    var settled = false;

    socket._openTimer = setTimeout(function () {
      if (settled || socket.readyState === 3) return;
      settled = true;
      try {
        native.close();
      } catch (error) {
        /* already closed */
      }
      socket._native = null;
      startHttp(socket, true);
    }, OPEN_BUDGET);

    native.onopen = function () {
      if (settled || socket.readyState === 3) {
        try {
          native.close();
        } catch (error) {
          /* already closed */
        }
        return;
      }
      settled = true;
      clearTimeout(socket._openTimer);
      socket._native = native;
      socket.readyState = 1;
      native.onmessage = function (event) {
        if (socket._httpStarted || socket.readyState === 3) return;
        remember("ws");
        socket._answered = true;
        socket._sent = [];
        emit(socket, "message", { data: event.data });
      };
      native.onclose = function (event) {
        if (socket.readyState === 3 || socket._httpStarted) return;
        if (!socket._answered) { switchToHttp(socket); return; }
        closeLocal(socket, (event && event.code) || 1006);
      };
      emit(socket, "open", {});
      flushNative(socket);

      // A proxy can accept the upgrade and then drop every packet: the world never answers and the
      // client sits on "handshake timed out". If nothing arrives while we have already sent the
      // handshake, move the same frames onto HTTPS.
      socket._handshakeTimer = setTimeout(function () {
        if (socket._answered || socket.readyState !== 1 || !socket._native || !socket._sent.length) return;
        switchToHttp(socket);
      }, HANDSHAKE_BUDGET);
    };

    native.onerror = function () {
      if (settled || socket.readyState === 3) return;
      settled = true;
      clearTimeout(socket._openTimer);
      try {
        native.close();
      } catch (error) {
        /* already closed */
      }
      socket._native = null;
      startHttp(socket, true);
    };
  }

  function Socket(url) {
    this.url = String(url);
    this.readyState = 0;
    this.binaryType = "arraybuffer";
    this.bufferedAmount = 0;
    this.protocol = "";
    this.extensions = "";
    this._listeners = { open: [], message: [], close: [], error: [] };
    this._native = null;
    this._id = null;
    this._queue = [];
    this._sent = [];
    this._answered = false;
    this._httpStarted = false;
    this._sending = false;
    this._requests = [];
    this._openTimer = null;
    this._handshakeTimer = null;
    this._flushTimer = null;
    this._base = "";
    try {
      var target = new URL(this.url);
      var here = new URL(window.location.href);
      // Same host as the page: reuse the page's own protocol, so a wss:// address reached over
      // http:// (local dev, or a proxy terminating TLS) still finds the relay instead of failing
      // on the scheme. Only a cross-host address is converted from ws(s) to http(s).
      var origin =
        target.host === here.host
          ? here.origin
          : (target.protocol === "wss:" ? "https:" : "http:") + "//" + target.host;
      this._base = origin + target.pathname.replace(/\/$/, "") + "/http";
    } catch (error) {
      this._base = "";
    }

    if (!this._base) {
      fail(this, new Error("bad game address"));
      return;
    }
    // Skip straight to HTTPS on a network that already needed it.
    if (remembered() === "http" || !Native) {
      startHttp(this, true);
      return;
    }
    startNative(this);
  }

  Socket.prototype.addEventListener = function (type, listener) {
    if (!listener) return;
    if (!this._listeners[type]) this._listeners[type] = [];
    if (this._listeners[type].indexOf(listener) < 0) this._listeners[type].push(listener);
  };

  Socket.prototype.removeEventListener = function (type, listener) {
    var list = this._listeners[type] || [];
    var at = list.indexOf(listener);
    if (at >= 0) list.splice(at, 1);
  };

  Socket.prototype.send = function (data) {
    if (this.readyState !== 1) return;
    this._queue.push(data);
    if (this._native) {
      flushNative(this);
      return;
    }
    var self = this;
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(function () {
      self._flushTimer = null;
      flushHttp(self);
    }, 5);
  };

  Socket.prototype.close = function () {
    if (this._id) {
      try {
        fetch(this._base + "/" + this._id + "/close", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        }).catch(function () {});
      } catch (error) {
        /* nothing else to do */
      }
    }
    if (this._native) {
      try {
        this._native.close();
      } catch (error) {
        /* already closed */
      }
    }
    clearTimeout(this._handshakeTimer);
    closeLocal(this, 1000);
  };

  Socket.CONNECTING = 0;
  Socket.OPEN = 1;
  Socket.CLOSING = 2;
  Socket.CLOSED = 3;
  Socket.prototype.CONNECTING = 0;
  Socket.prototype.OPEN = 1;
  Socket.prototype.CLOSING = 2;
  Socket.prototype.CLOSED = 3;
  Socket.prototype.binaryType = "arraybuffer";

  var Shim = function (url, protocols) {
    if (!isGame(url)) return protocols === undefined ? new Native(url) : new Native(url, protocols);
    return new Socket(url);
  };
  Shim.prototype = Native.prototype;
  Shim.CONNECTING = 0;
  Shim.OPEN = 1;
  Shim.CLOSING = 2;
  Shim.CLOSED = 3;

  window.WebSocket = Shim;
})();
