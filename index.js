"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const rollup_pluginutils_1 = require("rollup-pluginutils");
const sourcemap_codec_1 = require("sourcemap-codec");
const fs_1 = require("fs");
const url_join_1 = __importDefault(require("url-join"));
function hash(content) {
    return crypto_1.default.createHmac("sha256", content).digest("hex").substr(0, 8);
}
function makeFileName(name, hashed, pattern) {
    return pattern.replace("[name]", name).replace("[hash]", hashed);
}
const defaultPluginOptions = {
    injectImports: false,
    chunkFileNames: "[name]-[hash].css",
    entryFileNames: "[name].css",
    publicPath: "",
    sourcemap: false,
    emitFiles: true,
};
const cssChunks = function (options = {}) {
    const filter = (0, rollup_pluginutils_1.createFilter)(/\.css$/i, []);
    Object.keys(options).forEach((key) => {
        if (!(key in defaultPluginOptions))
            throw new Error(`unknown option ${key}`);
    });
    const pluginOptions = Object.assign({}, defaultPluginOptions, options);
    const css_data = {};
    return {
        name: "css",
        load(id) {
            if (!filter(id))
                return null;
            let code = (0, fs_1.readFileSync)(id, "utf8");
            let map = null;
            let m = code.match(/\/\*#\W*sourceMappingURL=data:application\/json;charset=utf-8;base64,([a-zA-Z0-9+/]+)\W*\*\//);
            if (m !== null) {
                code = code.replace(m[0], "").trim();
                try {
                    map = JSON.parse(Buffer.from(m[1], "base64").toString("utf-8").trim());
                }
                catch (err) {
                    console.warn(`Could not load css map file of ${id}.\n  ${err}`);
                }
            }
            m = code.match(/\/\*#\W*sourceMappingURL=([^\\/]+)\W*\*\//);
            if (m !== null) {
                code = code.replace(m[0], "").trim();
                try {
                    map = (0, fs_1.readFileSync)(path_1.default.resolve(id, "..", m[1].trim()), "utf8");
                }
                catch (err) {
                    console.warn(`Could not load css map file of ${id}.\n  ${err}`);
                }
            }
            return { code, map };
        },
        transform(code, id) {
            if (!filter(id))
                return null;
            css_data[id] = { code, map: this.getCombinedSourcemap() };
            return {
                code: `export default import.meta.CSS_URL;`,
                map: null,
                meta: { transformedByCSSChunks: true },
            };
        },
        resolveImportMeta(property, options) {
            if (property == "CSS_URL") {
                return `"CSS_FILE_${options.chunkId}"`;
            }
            return null;
        },
        generateBundle(generateBundleOpts, bundle) {
            var _a, _b;
            let emitFiles = pluginOptions.emitFiles;
            if (!generateBundleOpts.dir) {
                this.warn("No directory provided. Skipping CSS generation");
                emitFiles = false;
            }
            for (const chunk of Object.values(bundle).reverse()) {
                if (chunk.type === "asset")
                    continue;
                let code = "";
                if (pluginOptions.injectImports) {
                    for (const c of chunk.imports) {
                        if (bundle[c]) {
                            code += bundle[c].imports
                                .filter(filter)
                                .map((f) => `@import '${f}';`)
                                .join("");
                        }
                    }
                    if (code != "")
                        code += "\n";
                }
                const css_modules = [];
                for (const f of Object.keys(chunk.modules)) {
                    (_b = (_a = this.getModuleInfo(f)) === null || _a === void 0 ? void 0 : _a.importedIds) === null || _b === void 0 ? void 0 : _b.filter((v) => { var _a; return ((_a = this.getModuleInfo(v)) === null || _a === void 0 ? void 0 : _a.meta.transformedByCSSChunks) == true; }).forEach((v) => css_modules.push(v));
                }
                const sources = [];
                const sourcesContent = [];
                const mappings = [];
                for (const f of css_modules) {
                    if (pluginOptions.sourcemap && emitFiles) {
                        const i = sources.length;
                        sources.push(...css_data[f].map.sources.map((source) => path_1.default.relative(generateBundleOpts.dir ? generateBundleOpts.dir : "", source)));
                        if (css_data[f].map.sourcesContent) {
                            sourcesContent.push(...css_data[f].map.sourcesContent);
                        }
                        const decoded = (0, sourcemap_codec_1.decode)(css_data[f].map.mappings);
                        if (i === 0) {
                            decoded[0].forEach((segment) => {
                                segment[0] += code.length;
                            });
                        }
                        if (i > 0) {
                            decoded.forEach((line) => {
                                line.forEach((segment) => {
                                    segment[1] = i;
                                });
                            });
                        }
                        mappings.push(...decoded);
                    }
                    code += css_data[f].code + "\n";
                }
                if (code === "")
                    continue;
                const css_file_name = makeFileName(chunk.name, hash(code), chunk.isEntry
                    ? pluginOptions.entryFileNames
                    : pluginOptions.chunkFileNames);
                const css_file_url = (0, url_join_1.default)(pluginOptions.publicPath, css_file_name);
                chunk.code = chunk.code.replace(new RegExp(`CSS_FILE_${chunk.fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), css_file_url);
                if (emitFiles) {
                    if (emitFiles && pluginOptions.sourcemap) {
                        let map = null;
                        const map_file_name = css_file_name + ".map";
                        map = {
                            version: 3,
                            file: css_file_name,
                            sources: sources,
                            sourcesContent: sourcesContent,
                            names: [],
                            mappings: (0, sourcemap_codec_1.encode)(mappings),
                        };
                        code += `/*# sourceMappingURL=${encodeURIComponent(map_file_name)} */`;
                        this.emitFile({
                            type: "asset",
                            fileName: map_file_name,
                            source: JSON.stringify(map, null),
                        });
                    }
                    this.emitFile({
                        type: "asset",
                        fileName: css_file_name,
                        source: code,
                    });
                    chunk.imports.push(css_file_name);
                }
            }
        },
    };
};
exports.default = cssChunks;
