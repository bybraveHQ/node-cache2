// Vendored from `clone` 2.1.2 (MIT, © Paul Vorbach, Blake Miner), converted to
// an ES module. Deep clone with circular-reference support — used for useClones.
// See https://github.com/pvorbach/node-clone

function _instanceof(obj, type) {
  return type != null && obj instanceof type;
}

function __objToStr(o) {
  return Object.prototype.toString.call(o);
}
function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
}
function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
}
function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
}
function __getRegExpFlags(re) {
  let flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
}

/**
 * Deep-clone `parent`. Supports circular references by default.
 * @param {*} parent value to clone
 * @param {boolean} [circular=true] handle circular references
 * @param {number} [depth=Infinity] clone only to this depth
 * @param {object} [prototype] prototype to use for cloned objects
 * @param {boolean} [includeNonEnumerable=false] also clone non-enumerable props
 */
export default function clone(parent, circular, depth, prototype, includeNonEnumerable) {
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    includeNonEnumerable = circular.includeNonEnumerable;
    circular = circular.circular;
  }
  const allParents = [];
  const allChildren = [];
  const useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined') circular = true;
  if (typeof depth == 'undefined') depth = Infinity;

  function _clone(parent, depth) {
    if (parent === null) return null;
    if (depth === 0) return parent;

    let child;
    let proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (_instanceof(parent, Map)) {
      child = new Map();
    } else if (_instanceof(parent, Set)) {
      child = new Set();
    } else if (_instanceof(parent, Promise)) {
      child = new Promise((resolve, reject) => {
        parent.then(
          (value) => resolve(_clone(value, depth - 1)),
          (err) => reject(_clone(err, depth - 1))
        );
      });
    } else if (__isArray(parent)) {
      child = [];
    } else if (__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = Buffer.allocUnsafe(parent.length);
      parent.copy(child);
      return child;
    } else if (_instanceof(parent, Error)) {
      child = Object.create(parent);
    } else if (typeof prototype == 'undefined') {
      proto = Object.getPrototypeOf(parent);
      child = Object.create(proto);
    } else {
      child = Object.create(prototype);
      proto = prototype;
    }

    if (circular) {
      const index = allParents.indexOf(parent);
      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    if (_instanceof(parent, Map)) {
      parent.forEach((value, key) => {
        child.set(_clone(key, depth - 1), _clone(value, depth - 1));
      });
    }
    if (_instanceof(parent, Set)) {
      parent.forEach((value) => {
        child.add(_clone(value, depth - 1));
      });
    }

    for (const i in parent) {
      let attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }
      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    const symbols = Object.getOwnPropertySymbols(parent);
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const descriptor = Object.getOwnPropertyDescriptor(parent, symbol);
      if (descriptor && !descriptor.enumerable && !includeNonEnumerable) {
        continue;
      }
      child[symbol] = _clone(parent[symbol], depth - 1);
      if (!descriptor.enumerable) {
        Object.defineProperty(child, symbol, { enumerable: false });
      }
    }

    if (includeNonEnumerable) {
      const allPropertyNames = Object.getOwnPropertyNames(parent);
      for (let i = 0; i < allPropertyNames.length; i++) {
        const propertyName = allPropertyNames[i];
        const descriptor = Object.getOwnPropertyDescriptor(parent, propertyName);
        if (descriptor && descriptor.enumerable) {
          continue;
        }
        child[propertyName] = _clone(parent[propertyName], depth - 1);
        Object.defineProperty(child, propertyName, { enumerable: false });
      }
    }

    return child;
  }

  return _clone(parent, depth);
}
