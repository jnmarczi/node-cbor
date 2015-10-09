(function() {
  var BinaryParseStream, COUNT, Decoder, ERROR, MAJOR, MT, NEG_MAX, NEG_ONE, NOT_FOUND, NUMBYTES, NoFilter, PENDING_KEY, SIMPLE, SYMS, Simple, Tagged, bignumber, parentArray, parentBufferStream, ref, utils,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  BinaryParseStream = require('../vendor/binary-parse-stream');

  Tagged = require('./tagged');

  Simple = require('./simple');

  NoFilter = require('nofilter');

  utils = require('./utils');

  bignumber = require('bignumber.js');

  ref = require('./constants'), MT = ref.MT, NUMBYTES = ref.NUMBYTES, SIMPLE = ref.SIMPLE, SYMS = ref.SYMS;

  NEG_ONE = new bignumber(-1);

  NEG_MAX = NEG_ONE.sub(new bignumber(Number.MAX_SAFE_INTEGER.toString(16), 16));

  COUNT = Symbol('count');

  PENDING_KEY = Symbol('pending_key');

  MAJOR = Symbol('major type');

  ERROR = Symbol('error');

  NOT_FOUND = Symbol('not found');

  parentArray = function(parent, typ, count) {
    var a;
    a = [];
    a[COUNT] = count;
    a[SYMS.PARENT] = parent;
    a[MAJOR] = typ;
    return a;
  };

  parentBufferStream = function(parent, typ) {
    var b;
    b = new NoFilter;
    b[SYMS.PARENT] = parent;
    b[MAJOR] = typ;
    return b;
  };

  module.exports = Decoder = (function(superClass) {
    extend(Decoder, superClass);

    Decoder.NOT_FOUND = NOT_FOUND;

    Decoder.nullcheck = function(val) {
      switch (val) {
        case SYMS.NULL:
          return null;
        case SYMS.UNDEFINED:
          return void 0;
        default:
          return val;
      }
    };

    Decoder.decodeFirst = function(input, options, cb) {
      var c, encod, opts, p, ref1, ref2, required, v;
      if (options == null) {
        options = {
          encoding: 'hex'
        };
      }
      opts = {};
      required = false;
      encod = void 0;
      switch (typeof options) {
        case 'function':
          cb = options;
          encod = utils.guessEncoding(input);
          break;
        case 'string':
          encod = options;
          break;
        case 'object':
          opts = utils.extend({}, options);
          encod = (ref1 = opts.encoding) != null ? ref1 : utils.guessEncoding(input);
          delete opts.encoding;
          required = (ref2 = opts.required) != null ? ref2 : false;
          delete opts.required;
      }
      c = new Decoder(opts);
      p = void 0;
      v = NOT_FOUND;
      c.on('data', function(val) {
        v = Decoder.nullcheck(val);
        return c.close();
      });
      if (typeof cb === 'function') {
        c.once('error', function(er) {
          var u;
          u = v;
          v = ERROR;
          c.close();
          return cb(er, u);
        });
        c.once('end', function() {
          switch (v) {
            case NOT_FOUND:
              if (required) {
                return cb(new Error('No CBOR found'));
              } else {
                return cb(null, v);
              }
            case ERROR:
              return void 0;
            default:
              return cb(null, v);
          }
        });
      } else {
        p = new Promise(function(resolve, reject) {
          c.once('error', function(er) {
            v = ERROR;
            c.close();
            return reject(er);
          });
          return c.once('end', function() {
            switch (v) {
              case NOT_FOUND:
                if (required) {
                  return reject(new Error('No CBOR found'));
                } else {
                  return resolve(v);
                }
              case ERROR:
                return void 0;
              default:
                return resolve(v);
            }
          });
        });
      }
      c.end(input, encod);
      return p;
    };

    Decoder.decodeAll = function(input, options, cb) {
      var c, encod, opts, p, ref1, vals;
      if (options == null) {
        options = {
          encoding: 'hex'
        };
      }
      opts = {};
      encod = void 0;
      switch (typeof options) {
        case 'function':
          cb = options;
          encod = utils.guessEncoding(input);
          break;
        case 'string':
          encod = options;
          break;
        case 'object':
          opts = utils.extend({}, options);
          encod = (ref1 = opts.encoding) != null ? ref1 : utils.guessEncoding(input);
          delete opts.encoding;
      }
      c = new Decoder(opts);
      p = void 0;
      vals = [];
      c.on('data', function(val) {
        return vals.push(Decoder.nullcheck(val));
      });
      if (typeof cb === 'function') {
        c.on('error', function(er) {
          return cb(er);
        });
        c.on('end', function() {
          return cb(null, vals);
        });
      } else {
        p = new Promise(function(resolve, reject) {
          c.on('error', function(er) {
            return reject(er);
          });
          return c.on('end', function() {
            return resolve(vals);
          });
        });
      }
      c.end(input, encod);
      return p;
    };

    function Decoder(options) {
      this.tags = options != null ? options.tags : void 0;
      if (options != null) {
        delete options.tags;
      }
      this.max_depth = (options != null ? options.max_depth : void 0) || -1;
      if (options != null) {
        delete options.max_depth;
      }
      this.running = true;
      Decoder.__super__.constructor.call(this, options);
    }

    Decoder.prototype.close = function() {
      this.running = false;
      return this.__fresh = true;
    };

    Decoder.prototype._parse = function*() {
      var a, again, ai, allstrings, buf, depth, i, mt, numbytes, octet, parent, pm, t, val;
      parent = null;
      depth = 0;
      val = null;
      while (true) {
        if ((this.max_depth >= 0) && (depth > this.max_depth)) {
          throw new Error("Maximum depth " + this.max_depth + " exceeded");
        }
        octet = ((yield 1.))[0];
        if (!this.running) {
          throw new Error("Unexpected data: 0x" + (octet.toString(16)));
        }
        mt = octet >> 5;
        ai = octet & 0x1f;
        switch (ai) {
          case NUMBYTES.ONE:
            this.emit('more-bytes', mt, 1, parent != null ? parent[MAJOR] : void 0, parent != null ? parent.length : void 0);
            val = ((yield 1.))[0];
            break;
          case NUMBYTES.TWO:
          case NUMBYTES.FOUR:
          case NUMBYTES.EIGHT:
            numbytes = 1 << (ai - 24);
            this.emit('more-bytes', mt, numbytes, parent != null ? parent[MAJOR] : void 0, parent != null ? parent.length : void 0);
            buf = (yield numbytes);
            val = mt === MT.SIMPLE_FLOAT ? buf : utils.parseCBORint(ai, buf);
            break;
          case 28:
          case 29:
          case 30:
            this.running = false;
            throw new Error("Additional info not implemented: " + ai);
            break;
          case NUMBYTES.INDEFINITE:
            val = -1;
            break;
          default:
            val = ai;
        }
        switch (mt) {
          case MT.POS_INT:
            void 0;
            break;
          case MT.NEG_INT:
            if (val === Number.MAX_SAFE_INTEGER) {
              val = NEG_MAX;
            } else if (val instanceof bignumber) {
              val = NEG_ONE.sub(val);
            } else {
              val = -1 - val;
            }
            break;
          case MT.BYTE_STRING:
          case MT.UTF8_STRING:
            switch (val) {
              case 0:
                val = mt === MT.BYTE_STRING ? new Buffer(0) : '';
                break;
              case -1:
                this.emit('start', mt, SYMS.STREAM, parent != null ? parent[MAJOR] : void 0, parent != null ? parent.length : void 0);
                parent = parentBufferStream(parent, mt);
                depth++;
                continue;
              default:
                this.emit('start-string', mt, val, parent != null ? parent[MAJOR] : void 0, parent != null ? parent.length : void 0);
                val = (yield val);
                if (mt === MT.UTF8_STRING) {
                  val = val.toString('utf-8');
                }
            }
            break;
          case MT.ARRAY:
          case MT.MAP:
            switch (val) {
              case 0:
                val = mt === MT.MAP ? {} : [];
                val[SYMS.PARENT] = parent;
                break;
              case -1:
                this.emit('start', mt, SYMS.STREAM, parent != null ? parent[MAJOR] : void 0, parent != null ? parent.length : void 0);
                parent = parentArray(parent, mt, -1);
                depth++;
                continue;
              default:
                this.emit('start', mt, val, parent != null ? parent[MAJOR] : void 0, parent != null ? parent.length : void 0);
                parent = parentArray(parent, mt, val * (mt - 3));
                depth++;
                continue;
            }
            break;
          case MT.TAG:
            this.emit('start', mt, val, parent != null ? parent[MAJOR] : void 0, parent != null ? parent.length : void 0);
            parent = parentArray(parent, mt, 1);
            parent.push(val);
            depth++;
            continue;
          case MT.SIMPLE_FLOAT:
            if (typeof val === 'number') {
              val = Simple.decode(val, parent != null);
            } else {
              val = utils.parseCBORfloat(val);
            }
        }
        this.emit('value', val, parent != null ? parent[MAJOR] : void 0, parent != null ? parent.length : void 0, ai);
        again = false;
        while (parent != null) {
          switch (false) {
            case val !== SYMS.BREAK:
              parent[COUNT] = 1;
              break;
            case !Array.isArray(parent):
              parent.push(val);
              break;
            case !(parent instanceof NoFilter):
              pm = parent[MAJOR];
              if ((pm != null) && (pm !== mt)) {
                this.running = false;
                throw new Error('Invalid major type in indefinite encoding');
              }
              parent.write(val);
          }
          if ((--parent[COUNT]) !== 0) {
            again = true;
            break;
          }
          --depth;
          delete parent[COUNT];
          this.emit('stop', parent[MAJOR]);
          val = (function() {
            var j, k, l, ref1, ref2, ref3;
            switch (false) {
              case !Array.isArray(parent):
                switch (parent[MAJOR]) {
                  case MT.ARRAY:
                    return parent;
                  case MT.MAP:
                    allstrings = true;
                    if ((parent.length % 2) !== 0) {
                      throw new Error("Invalid map length: " + parent.length);
                    }
                    for (i = j = 0, ref1 = parent.length; j < ref1; i = j += 2) {
                      if (typeof parent[i] !== 'string') {
                        allstrings = false;
                        break;
                      }
                    }
                    if (allstrings) {
                      a = {};
                      for (i = k = 0, ref2 = parent.length; k < ref2; i = k += 2) {
                        a[parent[i]] = parent[i + 1];
                      }
                      return a;
                    } else {
                      a = new Map;
                      for (i = l = 0, ref3 = parent.length; l < ref3; i = l += 2) {
                        a.set(parent[i], parent[i + 1]);
                      }
                      return a;
                    }
                    break;
                  case MT.TAG:
                    t = new Tagged(parent[0], parent[1]);
                    return t.convert(this.tags);
                }
                break;
              case !(parent instanceof NoFilter):
                switch (parent[MAJOR]) {
                  case MT.BYTE_STRING:
                    return parent.slice();
                  case MT.UTF8_STRING:
                    return parent.toString('utf-8');
                }
            }
          }).call(this);
          parent = parent[SYMS.PARENT];
        }
        if (!again) {
          return val;
        }
      }
    };

    return Decoder;

  })(BinaryParseStream);

}).call(this);

//# sourceMappingURL=decoder.js.map