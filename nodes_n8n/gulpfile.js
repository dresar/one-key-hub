const { src, dest } = require('gulp');

function copyIcons() {
	return src('src/**/*.svg').pipe(dest('dist'));
}

exports.default = copyIcons;
exports['build:icons'] = copyIcons;
