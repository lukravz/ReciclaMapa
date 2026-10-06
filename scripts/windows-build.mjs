import fs from 'node:fs';
import path from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
// OpenNext's traced pnpm links are absolute on Windows. Use directory junctions
// inside the generated bundle so esbuild resolves OpenNext's patched copies.
// This preload only affects the build process; it is not part of the Worker.
const original=fs.symlinkSync;
const root=process.cwd();
fs.symlinkSync=function(target,destination,type){
 let resolved=path.resolve(path.dirname(destination),target);
 if(process.platform==='win32' && fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
  const rel=path.relative(root,resolved);
  const bundle=path.join(root,'.open-next','server-functions','default');
  if(destination.startsWith(bundle+path.sep) && rel.startsWith('node_modules'+path.sep)) resolved=path.join(bundle,rel);
  return original(resolved,destination,'junction');
 }
 return original(target,destination,type);
};
syncBuiltinESMExports();
