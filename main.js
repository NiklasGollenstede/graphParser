'use strict';
/* global global */
/* global traceur */
/* global process */

import { Execute, Path, FS, NameSpace, Marker, Counter, log, exitWith, fuzzyMatch, promisify, spawn } from './util.js';

const parseGraph = lines => {
	let graph = lines.map(() => []);
	lines.forEach((line, index) => {
		let node = graph[index];
		node.id = index- -1;
		Object.assign(node, (line.match(/\d+/g) || []).map(i => graph[i - 1]));
	});
	return graph;
};

const inDepth = (node, cb, mark = new Marker) => (!mark(node)) && cb(node) === node.forEach(
	node => inDepth(node, cb, mark)
);

const inDepthAsync = (node, cb, mark = new Marker) => new Promise((resolve, reject) => {
	const doIt = node => { try { (!mark(node)) && cb(node) === node.forEach(
		node => process.nextTick(doIt.bind(null, node))
	); } catch (e) { reject(e); } };
	process.nextTick(doIt.bind(null, node));
	setTimeout(resolve);
});

export const main = (dir, { files: { 0: src, } }) => spawn(function*() {

	let mode = Path.basename(dir, '.js');
	dir = Path.dirname(dir);
	src = Path.resolve(dir, src);

	console.log(mode, src);

	!(yield FS.exists(src)) && exitWith('source '+ src +' doesn\'t exist');

	let files = [ src ];
	try {
		files = yield FS.listDir(src);
	} catch (error) {
		if (error.code !== 'ENOTDIR') { throw error; }
	}

	files = files.filter(path => (/EX\d+?\.txt$/).test(path)).sort();
	console.log('found '+ files.length +' file(s)');

	let errors = yield Promise.all(files.map(file => spawn(function*() {
		if (!(yield FS.stat(file)).isFile()) { return; }

		const lines = (yield FS.readFile(file, 'utf8')).split('\r\n');
		if (lines.pop() !== 'end') {
			throw 'File '+ file +'didn\'t end with "end"';
		}

		let graph = parseGraph(lines);
		graph.name = Path.basename(file, '.txt');
		// console.log('graph', graph);

		if (false) { // # of nodes
			let count = Counter(0);
			let mark = new Marker();
			yield Promise.all(graph.map(node => inDepthAsync(node, count, mark)));
			console.log('Graph '+ graph.name +' has '+ count.get() +' nodes');
		}

		if (true) { // max degree
			let deg = graph.reduce((max, node) => Math.max(max, node.length), 0);
			console.log('Max deg. of '+ graph.name +' is '+ deg);
		}

		if (false) { // # and max size of 'Zusammenhangskomponenten', takes ~5 minutes
			let number = 0;
			let size = 0;
			let mark = new Marker();
			for (let node of graph) {
				let count = Counter(0);
				yield inDepthAsync(node, count, mark);
				if (count.get()) { ++number; }
				size = Math.max(size, count.get());
			}
			console.log('Graph '+ graph.name +' has '+ number +' "Zusammenhangskomponenten"');
			console.log('The largest has '+ number +' nodes');
		}

		if (false) { // path length from v to w, doesn't work yet
			let [ v, w, expected ] = {
				EX10: [ 6, 10, 2 ],
				EX100: [ 14, 45, 5 ],
				EX2500: [ 533, 895, 4 ],
				EX24900: [ 4422, 23561, 17 ],
				EX25100: [ 22710, 23942, 18 ],
			}[graph.name];
			v = graph[v - 1];
			w = graph[w - 1];

			let count = Counter(0);
			let done = { };
			try {
				yield inDepthAsync(v, node => {
					if (node == w) {
						throw done;
					} else {
						count();
					}
				});
			} catch (e) { if (e !== done) { throw e; } }
			console.log('Distance between node '+ v.id +' and '+ w.id +' in '+ graph.name +' is '+ count.get() +', '+ ((count.get() == expected) ? 'as expected' : ('but should be '+ expected)));

		}

	})));

}).catch(error => {
	exitWith('uncought exception\n', error, '\n terminating');
});
