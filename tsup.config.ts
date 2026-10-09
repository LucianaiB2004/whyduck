import {defineConfig} from 'tsup';
export default defineConfig({entry:['src/server/index.ts'],format:['esm'],outDir:'dist/server',platform:'node',target:'node24',removeNodeProtocol:false,external:['express','sharp','@modelcontextprotocol/sdk','alipay-sdk']});
