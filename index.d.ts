import { PluginImpl } from "rollup";
interface InputPluginOptions {
    injectImports?: boolean;
    chunkFileNames?: string;
    entryFileNames?: string;
    publicPath?: string;
    sourcemap?: boolean;
    emitFiles?: boolean;
}
declare const cssChunks: PluginImpl<InputPluginOptions>;
export default cssChunks;
