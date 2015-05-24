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

const floydWarshall = (a, end) => {
	let N = a.length;
	end = Math.min(N, end || N);

	for (let d = 0; d < end; ++d) {
		for (let y = 0; y < N; ++y) {
			for (let x = 0; x < N; ++x) {
				if (a[x][d] !== 0 && a[d][y] !== 0) {
					a[x][y] = Math.min(a[x][y] || Infinity, a[x][d]- -a[d][y]);
				}
			}
		}
	}
	return a;
};

const inWidth = (node, cb, mark = new Marker) =>  {
	let queue = [ node ];
	let i = 0; do {
		!mark(queue[i], true) && queue.push(...queue[i].filter(node => !mark(node)));
	} while (++i < queue.length);
	queue.forEach(cb);
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

export const main = (dir, { files: { 0: src, }, count: count_nodes, con_comp, degree, distance: find_distance, color: color_greedy }) => spawn(function*() {
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
		//let weights = lines.map(line => line.match(/\d+/g));

		const graph = parseGraph(lines);
		graph.name = Path.basename(file, '.txt');

		if (count_nodes) { // # of nodes
			const count = new Counter;
			const mark = new Marker;
			yield Promise.all(graph.map(node => inDepthAsync(node, count, mark)));
			console.log('Graph '+ graph.name +' has '+ count.get() +' nodes');
		}

		if (degree) { // max degree
			const deg = graph.reduce((max, node) => Math.max(max, node.length), 0);
			console.log('Max deg. of '+ graph.name +' is '+ deg);
		}

		if (con_comp) { // # and max size of connected compoenents
			let number = 0;
			let size = 0;
			const mark = new Marker;
			for (let node of graph) {
				let count = Counter(0);
				yield inDepthAsync(node, count, mark);
				if (count.get()) { ++number; }
				size = Math.max(size, count.get());
			}
			console.log('Graph '+ graph.name +' has '+ number +' connected compoenents');
			console.log('The largest has '+ size +' nodes');
		}

		if (find_distance !== undefined) { // path length from v to w (and all others)
			let v, w, expected;
			if (typeof find_distance === 'string') {
				[ v, w, expected ] = find_distance.match(/\d+/g);
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

			const distance = new Marker;
			distance(v, 0);
			const done = new Marker;
			const inf = { inf: Infinity, };
			distance(inf, Infinity);

			while (true) {
				const node = graph.reduce((o, n) => (!done(n) && (distance(n) < distance(o))) ? n : o, inf); // find node with smalest distance() thats not done() yet
				if (node == inf) { break; } // no such node
				const mayBe = distance(node) + 1;

				for (let mate of node) {

					if ((distance(mate) || Infinity) > mayBe) {
						distance(mate, mayBe);
					}
				}
				done(node, true);
			}

			//console.log(graph.map(node => [ node.id, ':', distance(node) ]).sort((a, b) => (a[2] || Infinity) - (b[2] || Infinity)).map(a => a.join(' ')).join('\n'));

			console.log('Distance between node '+ v.id +' and '+ w.id +' in '+ graph.name +' is '+ distance(w) +', '+ ((distance(w) == expected) ? 'as expected' : ('but should be '+ expected)));
		}

		if (color_greedy) {
			const node = graph.reduce((o, n) => (n.length >= o.length) ? n : o, [ ]); // find node with the most outgoing edges
			const color = new Marker;
			color(node, 1);
			let maxColor = 0;
			inWidth(node, node => {
				const colors = node.map(node => color(node)).filter(color => color).sort((a, b) => a - b);
				let i = 1; while(i == colors[i - 1]) { ++i; }
				// console.log('node-'+ node.id +'\'s neighbours have colors '+ colors +' so node got', i);
				color(node, i);
				i > maxColor && (maxColor = i);
			});
			console.log('Greedy coloring of '+ graph.name +' resulted in a '+ maxColor +'-coloring');
		}

	})));


	return total;
}).catch(error => {
	exitWith('uncought exception\n', error, '\n terminating');
}).then(total => console.log('execution took', total() / 1e9, 'seconsd'));
