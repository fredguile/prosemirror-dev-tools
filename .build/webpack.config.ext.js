const path = require("path");
const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const WriteFilePlugin = require("write-file-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

var fileExtensions = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "eot",
  "otf",
  "svg",
  "ttf",
  "woff",
  "woff2"
];

const ouputDir =
  process.env.OUTDIR || path.resolve(__dirname, "../dist/extension");

module.exports = {
  devtool:
    process.env.NODE_ENV === "development" ? "inline-source-map" : undefined,
  entry: {
    inject: path.resolve(__dirname, "../src/extension/inject.js"),
    proseMirrorDevToolsHook: path.resolve(
      __dirname,
      "../src/extension/proseMirrorDevToolsHook.js"
    ),
    backgroundScript: path.resolve(
      __dirname,
      "../src/extension/backgroundScript.js"
    ),
    devtools: path.resolve(__dirname, "../src/extension/pages/devtools.js"),
    panels: path.resolve(__dirname, "../src/extension/panels/index.js")
  },
  output: {
    filename: "[name].js",
    path: ouputDir,
    libraryExport: "default"
  },
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.EnvironmentPlugin(["NODE_ENV"]),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "../src/extension/pages/devtools.html"),
      filename: "devtools.html",
      chunks: ["devtools"]
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "../src/extension/panels/index.html"),
      filename: "panels.html",
      chunks: ["panels"]
    }),
    new CopyWebpackPlugin(
      [
        {
          from: "src/extension/manifest.json",
          transform: function(content, path) {
            // generates the manifest file using the package.json informations
            return Buffer.from(
              JSON.stringify({
                description: process.env.npm_package_description,
                version: process.env.npm_package_version,
                ...JSON.parse(content.toString())
              })
            );
          }
        }
      ],
      {
        copyUnmodified: true
      }
    ),
    new WriteFilePlugin()
    // new BundleAnalyzerPlugin({
    //   analyzerMode: "static",
    //   defaultSizes: "gzip",
    //   generateStatsFile: true
    // })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader"
      },
      {
        test: new RegExp(".(" + fileExtensions.join("|") + ")$"),
        loader: "file-loader?name=[name].[ext]",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    alias: {
      "./get-editor-state": "./get-editor-state.umd",
      react: "preact-compat",
      "react-dom": "preact-compat"
    }
  },
  optimization: {
    concatenateModules: false
  }
};
