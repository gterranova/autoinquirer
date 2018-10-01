const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: {
    autoinquirer: './src/autoinquirer.ts',
    datasource: './src/datasource/index.ts',
    bundle: './src/index.ts'
  },
  target: 'node',
  externals: [nodeExternals({
    whitelist: ['ajv', 'object-path', 'json-schema-ref-parser']
  })], // in order to ignore all modules in node_modules folder
  devtool: 'source-map',
  module: {
    rules: [{
      test: /\.tsx?$/,
      use: 'ts-loader',
      // exclude: /node_modules/
      include: __dirname
    }]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: '[name].js',
    library: 'autoinquirer',
    libraryTarget: 'commonjs2',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [new DtsBundlePlugin(), new UglifyJsPlugin({
    sourceMap: true
  })]
};

function DtsBundlePlugin(){}
DtsBundlePlugin.prototype.apply = function (compiler) {
  compiler.plugin('done', function(){
    var dts = require('dts-bundle');

    var libs = {
        autoinquirer: './src/autoinquirer.ts',
        datasource: './src/datasource/index.ts',
        bundle: './src/index.ts'
    };

    Object.keys(libs).map( libName => {
        dts.bundle({
            name: libName,
            main: path.resolve(__dirname, 'build', `${libs[libName].replace(/\.ts$/, '.d.ts')}`),
            out: path.resolve(__dirname, 'dist', `${libName}.d.ts`),
            //removeSource: true,
            outputAsModuleFolder: true // to use npm in-package typings
          });      
    });
  });
};