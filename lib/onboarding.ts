export function onboardingRole(path:'generator'|'collect',acting?:'collector'|'cooperative') {
 return path==='generator'?'generator':path==='collect'&&(acting==='collector'||acting==='cooperative')?acting:null;
}
