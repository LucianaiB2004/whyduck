import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({define:{'import.meta.env.VITE_EDGEONE_AGENTS':JSON.stringify(mode==='edgeone'?'true':'false')},plugins:[react()],server:{host:'127.0.0.1',port:5173,strictPort:true,watch:{ignored:['**/artifacts/**','**/data/**','**/design/screenshots/**']},proxy:{'/api':'http://127.0.0.1:3001','/mcp':'http://127.0.0.1:3001'}},build:{outDir:'dist/client',emptyOutDir:true}}));
