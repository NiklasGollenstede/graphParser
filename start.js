'use strict';
/* global global */

global.require = require;
global.traceur = require('traceur/src/node/System.js');

var Options = require('command-line-args')([
    { name: 'help', alias: 'h', type: Boolean, description: 'Print usage instructions' },
    { name: 'count', alias: 'n', type: Boolean, description: 'Count the total number of nodes' },
    { name: 'con_comp', alias: 'c', type: Boolean, description: 'Find number of and largest connectivity component(s)' },
    { name: 'degree', alias: 'd', type: Boolean, description: 'Find the maximal degree' },
    { name: 'distance', alias: 'l', description: 'Find the shortest path between two nodes, provide as "start_node_id,end_node_id,expected_value"' },
    { name: 'files', type: Array, defaultOption: true, description: 'The input file or folder, all files will be filtered to end with /EX\d+?\.txt/' }
]);

var options = Options.parse();
if (options.help || !options.files || options.files.length < 1) {
	console.log(Options.getUsage({
		header: '\t e.g. `node start ./test -c -n -d -l "14,45,5"´',
		footer: '',
	}));
	return;
}

global.traceur.import('./main.js', global).then(function(module) {

	module.main(global.process.argv[1], options);

}).catch(function(error) {
	console.error(error);
});
