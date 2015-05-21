'use strict'; /* global global */

global.require = require;
global.traceur = require('traceur/src/node/System.js');

var Options = require('command-line-args')([
    { name: 'help', alias: 'h', type: Boolean, description: 'Print usage instructions' },
    { name: 'files', type: Array, defaultOption: true, description: 'The input file or folder followed by the output folder' }
]);

var options = Options.parse();
/*if (options.help || !options.files || options.files.length <= 2) {
	console.log(Options.getUsage({
		header: '',
		footer: '',
	}));
	return;
}*/

global.traceur.import('./main.js', global).then(function(module) {

	module.main(global.process.argv[1], options);

}).catch(function(error) {
	console.error(error);
});
