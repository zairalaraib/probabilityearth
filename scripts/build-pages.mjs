import {rename,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
if(process.env.GITHUB_PAGES!=='true')throw Error('Use GITHUB_PAGES=true for this build');
const api=new URL('../app/api',import.meta.url),staging=new URL('../.pages-api',import.meta.url);
let moved=false;
try {await access(api);await rename(api,staging);moved=true;const result=spawnSync('npm',['run','build'],{stdio:'inherit',env:process.env});process.exitCode=result.status??1}
finally{if(moved)await rename(staging,api)}
