const page=await figma.getNodeByIdAsync('7:51');await figma.setCurrentPageAsync(page);
await Promise.all(['Regular','Medium','SemiBold','Bold'].map(style=>figma.loadFontAsync({family:'Geist',style})));
await figma.loadFontAsync({family:'Tinos',style:'Regular'});
const components=await Promise.all(['19:2','19:4','19:6','19:8','19:17'].map(id=>figma.getNodeByIdAsync(id)));
const local=await figma.variables.getLocalVariablesAsync();const semantic=local.filter(v=>v.variableCollectionId==='VariableCollectionId:7:3');const primitives=local.filter(v=>v.variableCollectionId==='VariableCollectionId:7:2');
const templates={};for(const [key,id] of [['header1440','46:1063'],['footer1440','46:1160'],['header390','56:1262'],['footer390','56:1501']])templates[key]=await figma.getNodeByIdAsync(id);
const refImage=await figma.getNodeByIdAsync('70:507');const imageHash=refImage.fills.find(f=>f.type==='IMAGE')?.imageHash;
const created=[];const screens=[];
function paint(value){let m=String(value).match(/rgba?\(([^)]+)\)/);let srgb=false;if(!m){m=String(value).match(/color\(srgb ([^)]+)\)/);srgb=true;}if(!m)return null;const a=m[1].split(/[, /]+/).map(Number);if(srgb)for(let i=0;i<3;i++)a[i]*=255;if(a[3]===0)return null;let p={type:'SOLID',color:{r:a[0]/255,g:a[1]/255,b:a[2]/255},opacity:a[3]??1};const pv=primitives.find(v=>{const c=Object.values(v.valuesByMode)[0];return Math.abs(c.r-p.color.r)<.001&&Math.abs(c.g-p.color.g)<.001&&Math.abs(c.b-p.color.b)<.001;});const sv=pv&&semantic.find(v=>v.name===pv.name);if(sv)p=figma.variables.setBoundVariableForPaint(p,'color',sv);return p;}
function styleText(t,s,heading=false){t.fontName={family:heading||/Georgia|Times/.test(s.font)?'Tinos':'Geist',style:heading||/Georgia|Times/.test(s.font)?'Regular':Number(s.weight)>=700?'Bold':Number(s.weight)>=600?'SemiBold':Number(s.weight)>=500?'Medium':'Regular'};t.fontSize=parseFloat(s.size)||14;if(t.fontName.family==='Tinos')t.letterSpacing={unit:'PIXELS',value:-.035*t.fontSize};if(t.fontName.family==='Geist'&&Number(s.weight)>=700&&t.fontSize<12)t.letterSpacing={unit:'PIXELS',value:.17*t.fontSize};t.lineHeight={unit:'PIXELS',value:parseFloat(s.lineHeight)||t.fontSize*1.4};const p=paint(s.color);t.fills=p?[p]:[];}
function box(n,s){const bg=paint(s.background),border=paint(s.border);n.fills=bg?[bg]:[];if(border&&parseFloat(s.borderWidth)>0){n.strokes=[border];n.strokeWeight=parseFloat(s.borderWidth);}else n.strokes=[];n.cornerRadius=parseFloat(s.radius)||0;}
function leafText(d){const t=figma.createText();styleText(t,d.style,/^H[1-6]$/.test(d.tag));t.characters=d.text||'';t.name=t.characters.slice(0,70)||d.tag;t.textAutoResize='HEIGHT';t.resize(Math.max(1,d.w)+(d.h<=(parseFloat(d.style.lineHeight)||24)*1.3?5:0),Math.max(1,d.h));return t;}
function make(d){
 if((d.tag==='HEADER'||d.tag==='FOOTER')&&d.children.some(c=>c.tag==='DIV'&&c.children.some(v=>v.tag==='NAV'))){const n=templates[(d.tag==='HEADER'?'header':'footer')+(d.w>768?1440:390)].clone();n.resize(d.w,d.h);return n;}
 if(d.text&&d.children.length){const n=figma.createAutoLayout('VERTICAL');n.name=d.tag;n.resize(d.w,d.h);box(n,d.style);const parts=d.style.padding.split(' ').map(parseFloat);n.paddingLeft=parts[1]??parts[0]??0;n.paddingRight=parts[1]??parts[0]??0;n.paddingTop=parts[0]||0;const t=leafText({...d,w:d.w-n.paddingLeft-n.paddingRight,text:d.tag==='P'?d.text+' '+d.children.map(c=>c.text||'').join(' '):d.children.map(c=>c.text||'').join(' ')+' '+d.text});n.appendChild(t);return n;}
 if(d.svg){const svg=d.svg.replace(/currentColor/g,d.style.color).replace(/<svg /,`<svg width="${d.w}" height="${d.h}" `);const n=figma.createNodeFromSvg(svg);n.name='Icône';n.resize(Math.max(1,d.w),Math.max(1,d.h));return n;}
 if(d.tag==='IMG'){const n=figma.createFrame();n.name='Photo de démonstration';n.resize(d.w,d.h);n.fills=imageHash?[{type:'IMAGE',imageHash,scaleMode:'FILL'}]:[];return n;}
 if(d.tag==='BUTTON'){
  const primary=d.style.background.includes('180, 81, 55');const c=components[primary?(d.disabled?1:0):(d.disabled?3:2)];const n=c.createInstance();n.name=d.testId||d.text||'Button';n.setProperties({'Label#19:6':d.text||d.children.map(c=>c.text||'').join(' ')});n.resize(d.w,d.h);box(n,d.style);if(d.disabled)n.opacity=.45;return n;
 }
 if(d.tag==='INPUT'||d.tag==='SELECT'||d.tag==='TEXTAREA'){
  if(d.w<=24&&d.h<=24){const n=figma.createFrame();n.name=d.testId||'Case à cocher';n.resize(d.w,d.h);n.cornerRadius=2;n.strokes=[{type:'SOLID',color:{r:.5,g:.5,b:.5}}];n.strokeWeight=1;n.fills=[{type:'SOLID',color:d.checked?{r:.137,g:.306,b:.231}:{r:1,g:1,b:1}}];if(d.checked){const t=leafText({...d,text:'✓',style:{...d.style,color:'rgb(255, 255, 255)'}});n.appendChild(t);t.x=2;t.y=0;}return n;}
  const n=components[4].createInstance();n.name=d.id||d.tag;n.setProperties({'Value#19:10':d.value||d.placeholder||(d.tag==='SELECT'?'FR':'')});n.resize(d.w,d.h);box(n,d.style);n.primaryAxisAlignItems='MIN';n.counterAxisAlignItems='CENTER';const t=n.findAllWithCriteria({types:['TEXT']})[0];styleText(t,d.style);t.textAutoResize='TRUNCATE';t.textTruncation='ENDING';t.maxLines=1;t.resize(Math.max(1,d.w-28),24);t.textAlignHorizontal='LEFT';t.layoutSizingHorizontal='FILL';if(!d.value&&d.placeholder)t.fills=[{type:'SOLID',color:{r:.6,g:.6,b:.6}}];return n;
 }
 if(d.children.length===0&&d.text)return leafText(d);
 const children=d.children.filter(c=>!(c.w<=1&&c.h<=1));
 const n=figma.createAutoLayout('VERTICAL');n.name=d.testId||d.id||d.tag;n.resize(Math.max(1,d.w),Math.max(1,d.h));n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';n.primaryAxisAlignItems='MIN';n.counterAxisAlignItems='MIN';box(n,d.style);n.clipsContent=false;
 // Preserve relationships for ordinary flow and flex containers. Grid and overlapping source boxes retain their explicit positions.
 const vertical=children.length>0&&!d.text&&children.every((c,i)=>!i||c.y>=children[i-1].y+children[i-1].h-1);
 const horizontal=children.length>1&&!d.text&&children.every((c,i)=>!i||c.x>=children[i-1].x+children[i-1].w-1)&&Math.max(...children.map(c=>c.y))-Math.min(...children.map(c=>c.y))<Math.max(...children.map(c=>c.h));
 if(vertical){n.paddingTop=Math.max(0,children[0].y-d.y);n.paddingLeft=0;n.paddingRight=0;n.itemSpacing=0;
  for(let i=0;i<children.length;i++){const c=children[i],child=make(c),gap=i+1<children.length?Math.max(0,children[i+1].y-c.y-c.h):0;const wrap=figma.createAutoLayout('HORIZONTAL');wrap.name='Disposition';wrap.fills=[];wrap.resize(d.w,c.h+gap);wrap.paddingLeft=Math.max(0,c.x-d.x);wrap.paddingBottom=gap;wrap.primaryAxisSizingMode='FIXED';wrap.counterAxisSizingMode='FIXED';wrap.primaryAxisAlignItems='MIN';wrap.counterAxisAlignItems='MIN';n.appendChild(wrap);wrap.appendChild(child);child.layoutSizingHorizontal='FIXED';child.layoutSizingVertical='FIXED';}
 }else if(horizontal){n.layoutMode='HORIZONTAL';n.paddingLeft=Math.max(0,children[0].x-d.x);n.paddingTop=Math.max(0,Math.min(...children.map(c=>c.y))-d.y);n.itemSpacing=children.length>1?Math.max(0,children[1].x-children[0].x-children[0].w):0;n.counterAxisAlignItems='MIN';for(const c of children){const child=make(c);n.appendChild(child);child.layoutSizingHorizontal='FIXED';child.layoutSizingVertical='FIXED';}}
 else {for(const c of children){const child=make(c);n.appendChild(child);child.layoutPositioning='ABSOLUTE';child.x=c.x-d.x;child.y=c.y-d.y;}if(d.text){const t=leafText(d);n.appendChild(t);t.layoutPositioning='ABSOLUTE';t.x=0;t.y=0;}}
 return n;
}
let maxY=Math.max(0,...page.children.map(n=>n.y+n.height))+400;
for(let i=0;i<INPUT_STATES.length;i++){
 const s=INPUT_STATES[i];const name=s.name+'-'+(s.width===390?'mobile':'bureau');if(page.children.some(n=>n.name===name)){screens.push({name,skipped:true});continue;}
 const n=make(s.tree);page.appendChild(n);n.name=name;n.resize(s.width,s.height);n.fills=[paint('rgb(250, 249, 246)')];n.clipsContent=true;n.x=5000+(i%2)*(s.width+200);n.y=maxY+Math.floor(i/2)*2400;
 const all=[n,...n.findAll(()=>true)];created.push(...all.map(c=>c.id));const counts={};for(const c of all)counts[c.type]=(counts[c.type]||0)+1;screens.push({id:n.id,name,width:n.width,height:n.height,counts,images:all.filter(c=>'fills'in c&&Array.isArray(c.fills)&&c.fills.some(p=>p.type==='IMAGE')).map(c=>({id:c.id,name:c.name,width:c.width,height:c.height}))});
}
return {createdNodeIds:created,screens};
