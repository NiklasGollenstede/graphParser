'use strict';
/* global process */
/* global setTimeout */

const child_process = require('child_process');
const fs = require('fs');

export const Path = require('path');

export const Execute = (...args) => new Promise((resolve, reject) => {
	child_process[
		(args[1] instanceof Array) ? 'execFile' : 'exec'
	](
		...args,
		(error, stdout, stderr) => error ? reject(Object.assign(error, { stderr, stdout })) : resolve(stdout)
	);
});

export const spawn = generator => {
	const iterator = generator();
	const onFulfilled = iterate.bind(null, 'next');
	const onRejected = iterate.bind(null, 'throw');

	function iterate(verb, arg) {
		var result;
		try {
			result = iterator[verb](arg);
		} catch (err) {
			return Promise.reject(err);
		}
		if (result.done) {
			return result.value;
		} else {
			return Promise.resolve(result.value).then(onFulfilled, onRejected);
		}
	}
	return iterate('next');
};

export const promisify = function(async, thisArg) {
	return function() {
		var args = Array.prototype.slice.call(arguments);
		return new Promise(function(resolve, reject) {
			args.push(function(err, res) { err ? reject(err) : resolve(res); });
			async.apply(thisArg, args);
		});
	};
};

var walk = function(dir, done) {
	var results = [];
	fs.readdir(dir, function(err, list) {
		if (err) { return done(err); }
		var pending = list.length;
		if (!pending) { return done(null, results); }
		list.forEach(function(file) {
			file = Path.resolve(dir, file);
			fs.stat(file, function(err, stat) {
				if (stat && stat.isDirectory()) {
					walk(file, function(err, res) {
						results = results.concat(res);
						if (!--pending) { done(null, results); }
					});
				} else {
					results.push(file);
					if (!--pending) { done(null, results); }
				}
			});
		});
	});
};

export const FS = (() => {
	const FS = Object.assign({ }, fs);
	FS.makeDir = promisify(require('mkdirp'));
	FS.listDir = promisify(walk);
	let exists = FS.exists;
	Object.keys(FS).forEach(key => {
		if (!(/Sync$/.test(key))) { return; }
		key = key.slice(0, -4);
		FS[key] = promisify(FS[key]);
	});
	FS.exists = path => new Promise(done => exists(path, done));
	return Object.freeze(FS);
})();

export const log = (...args) => (console.log(...args), args[args.length - 1]);

export const sleep = ms => new Promise(done => setTimeout(done, ms));

export const exitWith = (...args) => (console.log('FATAL:', ...args), process.exit(-1));

export const Counter = function(c = 0) { return Object.assign(() => ++c, { get: () => c, }); };

export const Timer = function([s1, ns1] = process.hrtime()) {
	 return ([s2, ns2] = process.hrtime()) => (s2 - s1) * 1e9 + (ns2 - ns1);
};
	// Timer = (s1 = performance.now()) => (s2 = performance.now()) => (s2 - s1);

export const NameSpace = function() {
	let map = new WeakMap();
	return key => {
		let value = map.get(key);
		if (value === undefined) {
			value = { };
			map.set(key, value);
		}
		return value;
	};
};

export const Marker = function() {
	let map = new WeakMap();
	return (key, ...now) => {
		let old = map.get(key);
		now.length && map.set(key, now[0]);
		return old;
	};
};

export function equalLength(a, b) {
	[a, b] = [a, b].map(s => s.toLowerCase());
	let l = 0;
	while (a[l] && a[l] === b[l]) { ++l; }
	return l;
}
export function fuzzyMatch(s1, s2, n) {
	// algorythm: http://www.catalysoft.com/articles/StrikeAMatch.html
	n = (n>2) ? n : 2;
	var l1 = s1.length - n + 1;
	var l2 = s2.length - n + 1;
	var used = new Array(l2);
	var total = 0;
	for (var i = 0; i < l1; ++i) {
		var j = -1;
		while ( // find s1.substr in s2 that wasn't used yet
			((j = s2.indexOf(s1.substring(i, i+n), j+1)) !== -1)
			&& used[j]
		) { }
		if (j != -1) {
			total++;
			used[j] = true;
		}
	}
	return 2 * total / (l1 + l2);
}
