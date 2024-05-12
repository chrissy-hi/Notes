import assetPath = require('../services/asset_path');
import path = require("path");
import express = require("express");
import env = require('../services/env');
import serveStatic = require('serve-static');
import utils = require('../services/utils');

const persistentCacheStatic = (root: string, options?: serveStatic.ServeStaticOptions<express.Response<any, Record<string, any>>>) => {
    if (!env.isDev()) {
        options = {
            maxAge: '1y',
            ...options
        };
    }
    return express.static(root, options);
};

function register(app: express.Application) {
    let root: string;
    if (!utils.isElectron()) {
      root = path.join(__dirname, '..', '..', '..');
    } else {
      root = path.join(__dirname, '..', '..', '..', '..', '..');
    }

    console.log("Asset root path is", path.resolve(root));
    const clientRoot = path.join(root, 'client');
    const commonRoot = path.join(root, 'common');    

    app.use(`/${assetPath}/app`, persistentCacheStatic(path.join(clientRoot, 'src')));
    app.use(`/${assetPath}/app-dist`, persistentCacheStatic(path.join(clientRoot, 'src-dist')));
    app.use(`/${assetPath}/fonts`, persistentCacheStatic(path.join(clientRoot, 'assets/fonts')));
    app.use(`/assets/vX/fonts`, express.static(path.join(clientRoot, 'assets/fonts')));
    app.use(`/${assetPath}/images`, persistentCacheStatic(path.join(commonRoot, 'images')));
    app.use(`/assets/vX/images`, express.static(path.join(clientRoot, 'images')));
    app.use(`/${assetPath}/stylesheets`, persistentCacheStatic(path.join(clientRoot, 'assets/stylesheets')));
    app.use(`/assets/vX/stylesheets`, express.static(path.join(clientRoot, 'assets/stylesheets')));
    app.use(`/${assetPath}/libraries`, persistentCacheStatic(path.join(clientRoot, 'libraries')));
    app.use(`/assets/vX/libraries`, express.static(path.join(clientRoot, 'libraries')));

    // excalidraw-view mode in shared notes
    app.use(`/${assetPath}/node_modules/react/umd/react.production.min.js`, persistentCacheStatic(path.join(clientRoot, 'node_modules/react/umd/react.production.min.js')));
    app.use(`/${assetPath}/node_modules/react/umd/react.development.js`, persistentCacheStatic(path.join(clientRoot, 'node_modules/react/umd/react.development.js')));
    app.use(`/${assetPath}/node_modules/react-dom/umd/react-dom.production.min.js`, persistentCacheStatic(path.join(clientRoot, 'node_modules/react-dom/umd/react-dom.production.min.js')));
    app.use(`/${assetPath}/node_modules/react-dom/umd/react-dom.development.js`, persistentCacheStatic(path.join(clientRoot, 'node_modules/react-dom/umd/react-dom.development.js')));
    // expose the whole dist folder since complete assets are needed in edit and share
    app.use(`/node_modules/@excalidraw/excalidraw/dist/`, express.static(path.join(clientRoot, 'node_modules/@excalidraw/excalidraw/dist/')));
    app.use(`/${assetPath}/node_modules/@excalidraw/excalidraw/dist/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/@excalidraw/excalidraw/dist/')));

    // KaTeX
    app.use(
      `/${assetPath}/node_modules/katex/dist/katex.min.js`,
      persistentCacheStatic(path.join(clientRoot, 'node_modules/katex/dist/katex.min.js')));
    app.use(
      `/${assetPath}/node_modules/katex/dist/contrib/mhchem.min.js`,
      persistentCacheStatic(path.join(clientRoot, 'node_modules/katex/dist/contrib/mhchem.min.js')));
    app.use(
      `/${assetPath}/node_modules/katex/dist/contrib/auto-render.min.js`,
      persistentCacheStatic(path.join(clientRoot, 'node_modules/katex/dist/contrib/auto-render.min.js')));
    // expose the whole dist folder
    app.use(`/node_modules/katex/dist/`,
      express.static(path.join(clientRoot, 'node_modules/katex/dist/')));
    app.use(`/${assetPath}/node_modules/katex/dist/`,
      persistentCacheStatic(path.join(clientRoot, 'node_modules/katex/dist/')));

    app.use(`/${assetPath}/node_modules/dayjs/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/dayjs/')));
    app.use(`/${assetPath}/node_modules/force-graph/dist/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/force-graph/dist/')));

    app.use(`/${assetPath}/node_modules/boxicons/css/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/boxicons/css/')));
    app.use(`/${assetPath}/node_modules/boxicons/fonts/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/boxicons/fonts/')));

    app.use(`/${assetPath}/node_modules/mermaid/dist/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/mermaid/dist/')));

    app.use(`/${assetPath}/node_modules/jquery/dist/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/jquery/dist/')));

    app.use(`/${assetPath}/node_modules/jquery-hotkeys/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/jquery-hotkeys/')));

    app.use(`/${assetPath}/node_modules/print-this/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/print-this/')));

    app.use(`/${assetPath}/node_modules/split.js/dist/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/split.js/dist/')));

    app.use(`/${assetPath}/node_modules/panzoom/dist/`, persistentCacheStatic(path.join(clientRoot, 'node_modules/panzoom/dist/')));
}

export = {
    register
};