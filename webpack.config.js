const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
var nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: './src/index.ts',
    target: 'node',
    externals: [nodeExternals()], // in order to ignore all modules in node_modules folder
    devtool: 'none',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                // exclude: /node_modules/
                include: __dirname
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'autoinquirer.js',
        library: 'autoinquirer',
        libraryTarget: 'commonjs2',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [new UglifyJsPlugin()]
};
