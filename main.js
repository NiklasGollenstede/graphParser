'use strict';
/* global global */
/* global traceur */
/* global process */
/* global setImmediate */

import { Execute, Path, FS, NameSpace, Marker, Counter, Timer, log, exitWith, fuzzyMatch, promisify, spawn } from './util.js';

const parseGraph = lines => {
	let graph = lines.map(() => []);
	lines.forEach((line, index) => {
		let node = graph[index];
		node.id = index- -1;
		Object.assign(node, (line.match(/\d+/g) || []).map(i => graph[i - 1]));
	});
	return graph;
};

const inDepth = (node, cb, mark = new Marker) => (!mark(node, true)) && cb(node) === node.forEach(
	node => inDepth(node, cb, mark)
);

const inDepthAsync = (node, cb, mark = new Marker) => new Promise((resolve, reject) => {
	const doIt = node => { try { (!mark(node, true)) && cb(node) === node.forEach(
		node => process.nextTick(doIt.bind(null, node))
	); } catch (e) { reject(e); } };
	process.nextTick(doIt.bind(null, node));
	setImmediate(resolve);
});

export const main = (dir, { files: { 0: src, }, count: count_nodes, con_comp, degree, distance, }) => spawn(function*() {
	let total = new Timer;
	let mode = Path.basename(dir, '.js');
	dir = Path.dirname(dir);
	src = Path.resolve(dir, src);

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

		if (count_nodes) { // # of nodes
			let count = new Counter;
			let mark = new Marker;
			yield Promise.all(graph.map(node => inDepthAsync(node, count, mark)));
			console.log('Graph '+ graph.name +' has '+ count.get() +' nodes');
		}

		if (degree) { // max degree
			let deg = graph.reduce((max, node) => Math.max(max, node.length), 0);
			console.log('Max deg. of '+ graph.name +' is '+ deg);
		}

		if (con_comp) { // # and max size of connected compoenents
			let number = 0;
			let size = 0;
			let mark = new Marker;
			for (let node of graph) {
				let count = Counter(0);
				yield inDepthAsync(node, count, mark);
				if (count.get()) { ++number; }
				size = Math.max(size, count.get());
			}
			console.log('Graph '+ graph.name +' has '+ number +' connected compoenents');
			console.log('The largest has '+ size +' nodes');
		}

		if (distance !== undefined) { // path length from v to w (and all others)
			let v, w, expected;
			if (typeof distance === 'string') {
				[ v, w, expected ] = distance.match(/\d+/g);
			} else {
				[ v, w, expected ] = {
					EX10: [ 6, 10, 2 ],
					EX100: [ 14, 45, 5 ],
					EX2500: [ 533, 895, 4 ],
					EX24900: [ 4422, 23561, 17 ],
					EX25100: [ 22710, 23942, 18 ],
				}[graph.name.toUpperCase()];
			}
			v = graph[v - 1];
			w = graph[w - 1];

			let length = new Marker;
			length(v, 0);
			let done = new Marker;
			let inf = { inf: Infinity, };
			length(inf, Infinity);

			while (true) {
				let node = graph.reduce((o, n) => (!done(n) && (length(n) < length(o))) ? n : o, inf);
				// console.log('processing', node);
				if (node == inf) {
					break;
				}
				let mayBe = length(node);
				++mayBe;
				// console.log('mayBe', mayBe);
				for (let mate of node) {
					// console.log('mate', mate);
					if ((length(mate) || Infinity) > mayBe) {
						length(mate, mayBe);
					}
				}
				done(node, true);
			}

			//console.log(graph.map(node => [ node.id, ':', length(node) ]).sort((a, b) => (a[2] || Infinity) - (b[2] || Infinity)).map(a => a.join(' ')).join('\n'));

			console.log('Distance between node '+ v.id +' and '+ w.id +' in '+ graph.name +' is '+ length(w) +', '+ ((length(w) == expected) ? 'as expected' : ('but should be '+ expected)));
		}

	})));


	return total;
}).catch(error => {
	exitWith('uncought exception\n', error, '\n terminating');
}).then(total => console.log('execution took', total() / 1e9, 'seconsd'));
