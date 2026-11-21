(async function bootstrapBatalha(){
let THREE;
try {
  THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
} catch (primaryImportError) {
  console.warn("BATALHA-MOZ: CDN principal indisponível; a tentar alternativa.", primaryImportError);
  try {
    THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js");
  } catch (fallbackImportError) {
    const message = "Não foi possível descarregar a biblioteca 3D (Three.js). Confirma a ligação à internet ou tenta outra rede.";
    if (window.__BATALHA_SHOW_ERROR) window.__BATALHA_SHOW_ERROR(message);
    throw fallbackImportError;
  }
}

const sceneHost=document.querySelector("#scene");
const $=id=>document.getElementById(id);
const ui={intro:$("intro-panel"),hud:$("hud"),crosshair:$("crosshair"),hint:$("bottom-hint"),loading:$("loading"),error:$("error-panel"),toast:$("toast")};
let renderer,scene,camera,clock,player,playerGroup,terrain,weather="clear",started=false,locked=false,won=false,plane,parachute,dropElapsed=0,dropPhase="waiting";
let yaw=0,pitch=-0.16,cameraDistance=7.5,verticalVelocity=0,onGround=true,walkTime=0,elapsed=0,toastTimer=0,dayTime=8.5;
const keys=new Set(),crystals=[],colliders=[],lootObjects=[],interactables=[];
let stickVector={x:0,y:0},stickPointer=null,selectedItemId=null,inventoryCategory="all",nearestInteractable=null,inventoryOpen=false;
const inventory=[],equipment={backpack:null,compass:null,boots:null};
const itemDefs={water:{name:"Água potável",category:"supplies",icon:"◉",description:"Garrafa de água para recuperar energia durante a exploração.",stack:5,effect:"energy",value:28},ration:{name:"Ração",category:"supplies",icon:"▣",description:"Alimento embalado que recupera energia.",stack:5,effect:"energy",value:20},firstaid:{name:"Estojo de primeiros socorros",category:"supplies",icon:"✚",description:"Kit de cuidados que recupera vitalidade do explorador.",stack:3,effect:"health",value:35},wood:{name:"Madeira recolhida",category:"materials",icon:"▤",description:"Material natural encontrado perto das estruturas.",stack:8},crystal:{name:"Fragmento de cristal",category:"materials",icon:"◇",description:"Fragmento brilhante usado como recurso de exploração.",stack:8},backpack:{name:"Mochila reforçada",category:"equipment",icon:"▣",description:"Equipamento que aumenta a capacidade da mochila em seis espaços.",stack:1,slot:"backpack"},compass:{name:"Bússola de campo",category:"equipment",icon:"⊕",description:"Acessório de orientação. Mostra um indicador de direção no HUD.",stack:1,slot:"compass"},boots:{name:"Botas de caminhada",category:"equipment",icon:"⌁",description:"Calçado de exploração que melhora ligeiramente a velocidade de movimento.",stack:1,slot:"boots"}};
let playerStats={health:100,energy:100};
const SAFE_ZONE_RADIUS=62;
let outsideSafeZone=false;
const inventoryCapacity=()=>12+(equipment.backpack?6:0);
const WORLD=170,CRYSTAL_TOTAL=5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const terrainHeight=(x,z)=>{const hills=Math.sin(x*.045)*2.8+Math.cos(z*.052)*2.4+Math.sin((x+z)*.025)*3.2;const ridges=Math.max(0,Math.sin(x*.018+z*.013))**3*7;return hills+ridges-2;};
function makeMaterial(color,roughness=1){return new THREE.MeshStandardMaterial({color,roughness});}
function seeded(i){const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v);}
function buildWorld(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x9bc4d0);scene.fog=new THREE.FogExp2(0x9bc4d0,.0065);
 camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,500);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;sceneHost.appendChild(renderer.domElement);
 const hemi=new THREE.HemisphereLight(0xc8e8ed,0x34452c,2.0);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffe0ad,3.1);sun.position.set(-45,70,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-75;sun.shadow.camera.right=75;sun.shadow.camera.top=75;sun.shadow.camera.bottom=-75;scene.add(sun);scene.userData.sun=sun;scene.userData.hemi=hemi;
 const groundGeo=new THREE.PlaneGeometry(WORLD,WORLD,150,150);groundGeo.rotateX(-Math.PI/2);const pos=groundGeo.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,terrainHeight(x,z));}groundGeo.computeVertexNormals();
 const colors=[];for(let i=0;i<pos.count;i++){const h=pos.getY(i),n=(seeded(i+17)-.5)*.055;const c=new THREE.Color(h>5?0x6f766c:h>1?0x637e4d:0x547b48);c.offsetHSL(0,n,n);colors.push(c.r,c.g,c.b);}groundGeo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));const ground=new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,vertexColors:true}));ground.receiveShadow=true;scene.add(ground);terrain=ground;
 const shore=new THREE.Mesh(new THREE.PlaneGeometry(600,600),makeMaterial(0x315e68));shore.rotation.x=-Math.PI/2;shore.position.y=-8;scene.add(shore);
 const safeRing=new THREE.Mesh(new THREE.TorusGeometry(SAFE_ZONE_RADIUS,.22,8,180),new THREE.MeshStandardMaterial({color:0x70e8c5,emissive:0x1b8e70,emissiveIntensity:1.15,transparent:true,opacity:.82}));safeRing.rotation.x=-Math.PI/2;safeRing.position.y=1.05;safeRing.receiveShadow=false;scene.add(safeRing);
 addMountainRing();addForest();addGrassDetails();addPalmGroves();addRocks();addClouds();addBirds();addBuildings();addCrystals();addPlayer();addGuideNPC();addLootObjects();addPlane();buildSky();
}
function addMountainRing(){const mat=makeMaterial(0x596b68);for(let i=0;i<22;i++){const a=i/22*Math.PI*2,r=105+seeded(i)*12,h=18+seeded(i+50)*24;const m=new THREE.Mesh(new THREE.ConeGeometry(12+seeded(i+80)*9,h,7),mat);m.position.set(Math.cos(a)*r,h/2-2,Math.sin(a)*r);m.rotation.y=seeded(i+4)*Math.PI;m.castShadow=true;scene.add(m);}}
function addTree(x,z,s=1){const y=terrainHeight(x,z),g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.38*s,3.2*s,7),makeMaterial(0x59412d));trunk.position.y=1.6*s;trunk.castShadow=true;g.add(trunk);for(let j=0;j<3;j++){const crown=new THREE.Mesh(new THREE.ConeGeometry((2.1-j*.27)*s,3.2*s,8),makeMaterial(j===0?0x315c3d:0x3e7048));crown.position.y=(3+j*1.25)*s;crown.castShadow=true;g.add(crown);}g.userData.swayPhase=seeded(x+z)*6;g.position.set(x,y,z);scene.add(g);colliders.push({x,z,r:1.0*s});}
function addForest(){for(let i=0;i<245;i++){const a=seeded(i+10)*Math.PI*2,r=12+seeded(i+200)*78,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x,z)<11)continue;addTree(x,z,.72+seeded(i+400)*.8);}}
function addGrassDetails(){
 const geo=new THREE.ConeGeometry(.075,.48,3),mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),count=1250,grass=new THREE.InstancedMesh(geo,mat,count),dummy=new THREE.Object3D(),color=new THREE.Color();
 let placed=0;
 for(let i=0;i<count;i++){const a=seeded(i+2100)*Math.PI*2,r=9+seeded(i+2200)*78,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x,z)<13)continue;
 dummy.position.set(x,terrainHeight(x,z)+.22,z);dummy.rotation.set((seeded(i+2300)-.5)*.2,seeded(i+2400)*Math.PI*2,(seeded(i+2500)-.5)*.2);const s=.55+seeded(i+2600)*.85;dummy.scale.set(s,s,s);dummy.updateMatrix();grass.setMatrixAt(placed,dummy.matrix);color.setHSL(.27+seeded(i+2700)*.055,.36,.25+seeded(i+2800)*.12);grass.setColorAt(placed,color);placed++;}
 grass.count=placed;grass.instanceMatrix.needsUpdate=true;if(grass.instanceColor)grass.instanceColor.needsUpdate=true;grass.receiveShadow=true;scene.add(grass);
}
function addPalmGroves(){
 const trunkMat=makeMaterial(0x76583a),leafMats=[makeMaterial(0x2e6847),makeMaterial(0x397b4d),makeMaterial(0x4a8950)];
 for(let i=0;i<22;i++){
  const a=seeded(i+1500)*Math.PI*2,r=58+seeded(i+1600)*19,x=Math.cos(a)*r,z=Math.sin(a)*r,s=.78+seeded(i+1700)*.55,y=terrainHeight(x,z),palm=new THREE.Group();
  let last=new THREE.Vector3(0,0,0);
  for(let j=0;j<5;j++){const next=new THREE.Vector3(Math.sin(j*.12)*.22*s,(j+1)*.82*s,Math.cos(j*.12)*.12*s);const delta=next.clone().sub(last),seg=new THREE.Mesh(new THREE.CylinderGeometry(.16*s-j*.012*s,.22*s-j*.012*s,delta.length(),7),trunkMat);seg.position.copy(last).add(next).multiplyScalar(.5);seg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());seg.castShadow=true;palm.add(seg);last=next;}
  const crownY=4.05*s;
  for(let j=0;j<8;j++){const angle=j/8*Math.PI*2,leaf=new THREE.Mesh(new THREE.ConeGeometry(.24*s,4.2*s,5),leafMats[j%3]);leaf.position.set(Math.cos(angle)*1.55*s,crownY-.42*s,Math.sin(angle)*1.55*s);leaf.rotation.z=Math.cos(angle)*.85;leaf.rotation.x=-Math.sin(angle)*.85;leaf.rotation.y=angle;leaf.castShadow=true;palm.add(leaf);}
  const coconuts=new THREE.Mesh(new THREE.SphereGeometry(.22*s,8,7),makeMaterial(0x76522d));coconuts.position.set(0,crownY-.25*s,0);palm.add(coconuts);
  palm.userData.swayPhase=seeded(i+3800)*6;palm.position.set(x,y,z);scene.add(palm);
 }
}
function addRocks(){for(let i=0;i<48;i++){const a=seeded(i+600)*Math.PI*2,r=9+seeded(i+700)*76,x=Math.cos(a)*r,z=Math.sin(a)*r,s=.6+seeded(i+800)*1.7;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(s,1),makeMaterial(0x777d76));rock.position.set(x,terrainHeight(x,z)+s*.55,z);rock.scale.y=.7;rock.rotation.set(seeded(i)*2,seeded(i+1)*3,seeded(i+2));rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);}}
function addClouds(){const cloudMat=new THREE.MeshStandardMaterial({color:0xf3f5ee,roughness:1,transparent:true,opacity:.83});for(let i=0;i<18;i++){const cloud=new THREE.Group();for(let j=0;j<5;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(2.5+seeded(i*8+j)*2,10,8),cloudMat);puff.position.set(j*2.7,seeded(j+i)*1.4,seeded(j+30)*2);cloud.add(puff);}cloud.position.set((seeded(i+900)-.5)*210,28+seeded(i+1000)*17,(seeded(i+1100)-.5)*180);cloud.userData.speed=.25+seeded(i+1200)*.35;scene.add(cloud);}}
function addBirds(){
 const birdMat=makeMaterial(0x26383a,.85);
 for(let i=0;i<7;i++){
  const bird=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),birdMat);body.scale.set(1.6,.55,.65);bird.add(body);
  const wingGeo=new THREE.BoxGeometry(.62,.045,.22);
  const left=new THREE.Mesh(wingGeo,birdMat),right=new THREE.Mesh(wingGeo,birdMat);
  left.position.set(-.42,.04,0);right.position.set(.42,.04,0);bird.add(left,right);
  bird.userData={bird:true,left,right,phase:seeded(i+3300)*6,speed:2.2+seeded(i+3400)*1.5};
  bird.position.set(-95+seeded(i+3500)*190,24+seeded(i+3600)*18,-75+seeded(i+3700)*150);
  scene.add(bird);
 }
}
function addBuildings(){
 const sites=[[-25,-28,0],[-39,8,.5],[29,-39,-.35],[42,8,.2],[8,65,0]];
 for(let i=0;i<sites.length;i++){const [x,z,rot]=sites[i],y=terrainHeight(x,z),house=new THREE.Group();
 const wall=makeMaterial(i%2?0xb6a17d:0xc2b18c),roofMat=makeMaterial(0x68483b),dark=makeMaterial(0x25343a),glass=new THREE.MeshStandardMaterial({color:0x83cbd0,metalness:.35,roughness:.2,emissive:0x17383b});
 const body=new THREE.Mesh(new THREE.BoxGeometry(10,5.2,8),wall);body.position.y=2.6;body.castShadow=true;body.receiveShadow=true;house.add(body);
 const roof=new THREE.Mesh(new THREE.ConeGeometry(7.2,3.5,4),roofMat);roof.position.y=6.7;roof.rotation.y=Math.PI/4;roof.castShadow=true;house.add(roof);
 const door=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.8,.16),dark);door.position.set(0,1.4,4.08);door.userData.closedRotation=0;house.add(door);
 for(const side of [-1,1]){const win=new THREE.Mesh(new THREE.BoxGeometry(1.65,1.25,.18),glass);win.position.set(side*3,3.1,4.1);house.add(win);}
 const porch=new THREE.Mesh(new THREE.BoxGeometry(4,.25,2.4),makeMaterial(0x81705b));porch.position.set(0,.15,5);house.add(porch);
 house.position.set(x,y,z);house.rotation.y=rot;scene.add(house);colliders.push({x,z,r:6.1});interactables.push({type:"door",name:"Casa de exploração",x:x+Math.sin(rot)*5.2,z:z+Math.cos(rot)*5.2,door,open:false});
 const path=new THREE.Mesh(new THREE.BoxGeometry(3,.08,7),makeMaterial(0xb9a47e));path.position.set(x,y+.06,z+7);scene.add(path);
 }
}
function createLootModel(type){
 const g=new THREE.Group(),mats={water:0x4c9bc1,ration:0xb58a4e,firstaid:0xe6e4d8,wood:0x8d6039,crystal:0x67e8d0,backpack:0x98713c,compass:0xd1ae58,boots:0x303b3d};
 const mat=makeMaterial(mats[type]||0xb4a77d);
 if(type==="water"){const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.28,.32,.9,10),new THREE.MeshStandardMaterial({color:0x4b9ac0,transparent:true,opacity:.86,roughness:.22}));bottle.position.y=.55;g.add(bottle);const cap=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.12,8),makeMaterial(0xd8d7c5));cap.position.y=1.06;g.add(cap);}
 else if(type==="ration"||type==="firstaid"){const box=new THREE.Mesh(new THREE.BoxGeometry(.9,.55,.65),mat);box.position.y=.38;g.add(box);if(type==="firstaid"){const cross=new THREE.Mesh(new THREE.BoxGeometry(.12,.38,.04),makeMaterial(0x9e5144));cross.position.set(0,.4,.34);g.add(cross);const cross2=new THREE.Mesh(new THREE.BoxGeometry(.38,.12,.04),makeMaterial(0x9e5144));cross2.position.set(0,.4,.34);g.add(cross2);}}
 else if(type==="wood"){for(let i=0;i<3;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,1.25,7),mat);log.rotation.z=Math.PI/2;log.position.set((i-1)*.14,.22+i*.12,0);g.add(log);}}
 else if(type==="crystal"){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.48),new THREE.MeshStandardMaterial({color:0x65efd1,emissive:0x158d76,emissiveIntensity:1.1,metalness:.25,roughness:.18}));gem.position.y=.55;g.add(gem);}
 else if(type==="backpack"){const bag=new THREE.Mesh(new THREE.BoxGeometry(.8,.95,.42),mat);bag.position.y=.58;g.add(bag);const flap=new THREE.Mesh(new THREE.BoxGeometry(.65,.25,.08),makeMaterial(0x55452f));flap.position.set(0,.95,-.23);g.add(flap);}
 else if(type==="compass"){const disk=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.13,16),mat);disk.position.y=.28;g.add(disk);const needle=new THREE.Mesh(new THREE.ConeGeometry(.12,.48,4),makeMaterial(0xb94e3c));needle.position.y=.59;g.add(needle);}
 else if(type==="boots"){for(const x of [-.23,.23]){const boot=new THREE.Mesh(new THREE.BoxGeometry(.38,.35,.72),mat);boot.position.set(x,.2,0);g.add(boot);}}
 return g;
}
function addLootObjects(){const placements=[["water",-18,-24],["ration",-33,11],["firstaid",31,-35],["wood",-42,13],["crystal",43,8],["backpack",-24,-30],["compass",11,61],["boots",37,13],["water",8,42],["ration",17,-18],["wood",40,-1]];
 for(const [type,x,z] of placements){const model=createLootModel(type);model.position.set(x,terrainHeight(x,z),z);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});model.userData={loot:true,type,baseY:model.position.y,phase:seeded(x+z)*6};scene.add(model);lootObjects.push(model);}}
function itemCount(){return inventory.reduce((n,item)=>n+item.qty,0);}
function addItem(type,qty=1){const def=itemDefs[type];if(!def)return false;let remaining=qty;for(const item of inventory){if(item.type===type&&item.qty<def.stack){const add=Math.min(remaining,def.stack-item.qty);item.qty+=add;remaining-=add;if(!remaining)break;}}while(remaining>0&&itemCount()<inventoryCapacity()){const add=Math.min(remaining,def.stack);inventory.push({id:type+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),type,qty:add});remaining-=add;}renderInventory();return remaining===0;}
function removeItem(id,qty=1){const i=inventory.findIndex(x=>x.id===id);if(i<0)return false;inventory[i].qty-=qty;if(inventory[i].qty<=0){inventory.splice(i,1);if(selectedItemId===id)selectedItemId=inventory[0]?.id||null;}renderInventory();return true;}
function selectedItem(){return inventory.find(x=>x.id===selectedItemId)||null;}
function categoryName(cat){return ({supplies:"SUPRIMENTOS",materials:"MATERIAIS",equipment:"EQUIPAMENTO"})[cat]||"OBJECTOS";}
function renderInventory(){const grid=$("inventory-grid");if(!grid)return;const visible=inventory.filter(x=>inventoryCategory==="all"||itemDefs[x.type].category===inventoryCategory);grid.innerHTML="";visible.forEach(item=>{const d=itemDefs[item.type],button=document.createElement("button");button.className="inventory-slot"+(item.id===selectedItemId?" selected":"");button.innerHTML='<span class="slot-count">×'+item.qty+'</span><span class="slot-icon">'+d.icon+'</span><span class="slot-name"></span>';button.querySelector(".slot-name").textContent=d.name;button.addEventListener("click",()=>{selectedItemId=item.id;renderInventory();});grid.appendChild(button);});$("inventory-empty").classList.toggle("hidden",visible.length>0);$("inventory-count").textContent=itemCount()+"/"+inventoryCapacity();$("inventory-capacity").textContent="CAPACIDADE "+itemCount()+" / "+inventoryCapacity();$("equipped-backpack").textContent=equipment.backpack?"Reforçada":"+6 espaços";$("equipped-compass").textContent=equipment.compass?"Bússola equipada":"Nenhum";$("equipped-boots").textContent=equipment.boots?"Botas de caminhada":"Padrão";updateSelectedDetails();}
function updateSelectedDetails(){const item=selectedItem(),d=item&&itemDefs[item.type];$("selected-art").textContent=d?.icon||"◇";$("selected-category").textContent=d?categoryName(d.category):"SEM SELECÇÃO";$("selected-name").textContent=d?.name||"Escolhe um item";$("selected-description").textContent=d?.description||"Os objetos recolhidos aparecem aqui."; $("selected-quantity").textContent=item?"QUANTIDADE: "+item.qty:"—";$("item-primary").disabled=!item||!d.effect;$("item-primary").textContent=d?.effect==="health"||d?.effect==="energy"?"UTILIZAR":"SEM UTILIZAÇÃO";$("item-equip").disabled=!item||!d.slot;$("item-equip").textContent=d?.slot&&equipment[d.slot]===item.type?"EQUIPADO":"EQUIPAR";$("item-drop").disabled=!item;}
function openInventory(){inventoryOpen=true;$("inventory-panel").classList.remove("hidden");renderInventory();document.exitPointerLock?.();}
function closeInventory(){inventoryOpen=false;$("inventory-panel").classList.add("hidden");if(started&&innerWidth>760)requestLock();}
function useSelectedItem(){const item=selectedItem();if(!item)return;const d=itemDefs[item.type];if(d.effect==="health"){if(playerStats.health>=100){showToast("VITALIDADE JÁ ESTÁ NO MÁXIMO");return;}playerStats.health=Math.min(100,playerStats.health+d.value);}else if(d.effect==="energy"){if(playerStats.energy>=100){showToast("ENERGIA JÁ ESTÁ NO MÁXIMO");return;}playerStats.energy=Math.min(100,playerStats.energy+d.value);}else return;removeItem(item.id);showToast(d.name.toUpperCase()+" UTILIZADO");}
function equipSelectedItem(){const item=selectedItem();if(!item)return;const d=itemDefs[item.type];if(!d.slot)return;if(equipment[d.slot]===item.type){showToast("ESTE EQUIPAMENTO JÁ ESTÁ ACTIVO");return;}if(d.slot==="backpack"&&!equipment.backpack&&itemCount()>12){showToast("ESVAZIA A MOCHILA ANTES DE EQUIPAR");return;}equipment[d.slot]=item.type;removeItem(item.id);applyEquipmentVisuals();renderInventory();showToast(d.name.toUpperCase()+" EQUIPADO");}
function applyEquipmentVisuals(){if(!playerGroup)return;const pack=playerGroup.userData.backpack;if(pack){pack.material=makeMaterial(equipment.backpack?0x465f51:0x9b7138);pack.scale.setScalar(equipment.backpack?1.18:1);}const compass=playerGroup.userData.compass;if(compass)compass.visible=!!equipment.compass;const boots=playerGroup.userData.boots||[];boots.forEach(b=>{b.material=makeMaterial(equipment.boots?0x5b6848:0x161d20);b.scale.set(equipment.boots?1.12:1,1,equipment.boots?1.08:1);});}
function dropSelectedItem(){const item=selectedItem();if(!item)return;const d=itemDefs[item.type];if(d.slot&&equipment[d.slot]===item.type){showToast("RETIRA O EQUIPAMENTO ANTES DE O DESCARTAR");return;}const type=item.type;removeItem(item.id);const model=createLootModel(type);model.position.set(playerGroup.position.x+Math.sin(yaw)*1.8,terrainHeight(playerGroup.position.x+Math.sin(yaw)*1.8,playerGroup.position.z-Math.cos(yaw)*1.8),playerGroup.position.z-Math.cos(yaw)*1.8);model.userData={loot:true,type,baseY:model.position.y,phase:Math.random()*6};scene.add(model);lootObjects.push(model);showToast(d.name.toUpperCase()+" DESCARTADO");}
function updateInteractions(){
 let best=null,bestDist=3.4;
 for(const loot of lootObjects){if(loot.userData.collected)continue;const d=Math.hypot(playerGroup.position.x-loot.position.x,playerGroup.position.z-loot.position.z);if(d<bestDist){best={type:"loot",object:loot,distance:d};bestDist=d;}}
 for(const target of interactables){const d=Math.hypot(playerGroup.position.x-target.x,playerGroup.position.z-target.z);if(d<bestDist){best={type:target.type==="guide"?"guide":"door",object:target,distance:d};bestDist=d;}}
 nearestInteractable=best;$("interaction-prompt").classList.toggle("hidden",!best||inventoryOpen);
 if(best&&!inventoryOpen){const prompt=best.type==="loot"?"PRIMA E PARA RECOLHER: "+itemDefs[best.object.userData.type].name:best.type==="guide"?"PRIMA E PARA FALAR COM O GUIA":"PRIMA E PARA "+(best.object.open?"FECHAR":"ABRIR")+" A PORTA";$("interaction-prompt").textContent=prompt;}
}
function interact(){
 if(inventoryOpen||!nearestInteractable)return;const target=nearestInteractable;
 if(target.type==="loot"){const loot=target.object,type=loot.userData.type;if(addItem(type)){loot.userData.collected=true;scene.remove(loot);lootObjects.splice(lootObjects.indexOf(loot),1);showToast(itemDefs[type].name.toUpperCase()+" RECOLHIDO");nearestInteractable=null;}else showToast("MOCHILA CHEIA • DESCARTA UM ITEM");}
 else if(target.type==="guide"){showToast("GUIA: RECOLHE OS CINCO CRISTAIS, USA A BÚSSOLA E REGRESSA À ZONA SEGURA.");}
 else if(target.type==="door"){target.object.open=!target.object.open;target.object.door.rotation.y=target.object.open?-Math.PI*.48:0;showToast(target.object.open?"PORTA ABERTA":"PORTA FECHADA");}
}
function addCrystals(){const positions=[[-13,-9],[18,-15],[-29,24],[34,30],[4,48]];positions.forEach((p,i)=>{const g=new THREE.Group();const gem=new THREE.Mesh(new THREE.OctahedronGeometry(1.05,0),new THREE.MeshStandardMaterial({color:0x66f2d0,emissive:0x13a98d,emissiveIntensity:1.5,metalness:.25,roughness:.2}));gem.position.y=1.8;gem.castShadow=true;g.add(gem);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.35,.045,8,32),new THREE.MeshBasicMaterial({color:0xc0fff0}));ring.rotation.x=Math.PI/2;ring.position.y=1.3;g.add(ring);g.position.set(p[0],terrainHeight(p[0],p[1]),p[1]);g.userData={gem,ring,index:i};scene.add(g);crystals.push(g);});}
function addPlayer(){
 playerGroup=new THREE.Group();
 const skin=makeMaterial(0x9b6948,.86),skinLight=makeMaterial(0xb77e59,.9),shirt=makeMaterial(0x344b48,.94),shirtDark=makeMaterial(0x223632,.98),pants=makeMaterial(0x343d3b,.98),bootMaterial=makeMaterial(0x171d1b,.9),leather=makeMaterial(0x765238,.9),fabric=makeMaterial(0x46534a,.95),metal=makeMaterial(0x68716c,.55);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.39,.72,7,12),shirt);torso.position.y=1.48;torso.scale.set(1.08,1.08,.82);torso.castShadow=true;playerGroup.add(torso);
 const chest=new THREE.Mesh(new THREE.BoxGeometry(.68,.48,.13),shirtDark);chest.position.set(0,1.62,-.31);chest.castShadow=true;playerGroup.add(chest);
 const collar=new THREE.Mesh(new THREE.CylinderGeometry(.19,.23,.16,12),leather);collar.position.y=1.98;playerGroup.add(collar);
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.22,12),skin);neck.position.y=2.03;playerGroup.add(neck);
 const shoulderPads=[];
 for(const x of [-1,1]){const pad=new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),fabric);pad.position.set(x*.43,1.82,0);pad.scale.set(1,.72,1.05);playerGroup.add(pad);shoulderPads.push(pad);}
 const belt=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.13,16),leather);belt.position.y=1.03;belt.scale.z=.78;playerGroup.add(belt);
 const buckle=new THREE.Mesh(new THREE.BoxGeometry(.16,.13,.045),metal);buckle.position.set(0,1.03,-.28);playerGroup.add(buckle);
 const chestStrap=new THREE.Mesh(new THREE.BoxGeometry(.11,.83,.075),leather);chestStrap.position.set(.2,1.57,-.39);chestStrap.rotation.z=-.24;playerGroup.add(chestStrap);
 const chestStrap2=new THREE.Mesh(new THREE.BoxGeometry(.11,.83,.075),leather);chestStrap2.position.set(-.2,1.57,-.39);chestStrap2.rotation.z=.24;playerGroup.add(chestStrap2);
 for(const x of [-.2,.2]){const pocket=new THREE.Mesh(new THREE.BoxGeometry(.2,.22,.09),fabric);pocket.position.set(x,1.36,-.39);playerGroup.add(pocket);const flap=new THREE.Mesh(new THREE.BoxGeometry(.22,.055,.1),leather);flap.position.set(x,1.49,-.4);playerGroup.add(flap);}
 const sidePouch=new THREE.Mesh(new THREE.BoxGeometry(.2,.28,.18),leather);sidePouch.position.set(.37,1.02,-.04);playerGroup.add(sidePouch);
 const headGroup=new THREE.Group();
 const head=new THREE.Mesh(new THREE.SphereGeometry(.285,20,16),skin);head.scale.set(.92,1.12,.9);head.position.y=2.38;head.castShadow=true;headGroup.add(head);
 const earGeo=new THREE.SphereGeometry(.075,10,8);
 for(const x of [-1,1]){const ear=new THREE.Mesh(earGeo,skinLight);ear.position.set(x*.275,2.39,0);headGroup.add(ear);}
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),skinLight);nose.scale.set(.7,1,.8);nose.position.set(0,2.34,-.265);headGroup.add(nose);
 const eyeWhite=makeMaterial(0xe7dfce),eyeDark=makeMaterial(0x211e1a);
 for(const x of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),eyeWhite);eye.position.set(x*.105,2.43,-.245);headGroup.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),eyeDark);pupil.position.set(x*.105,2.43,-.276);headGroup.add(pupil);}
 const hair=new THREE.Mesh(new THREE.SphereGeometry(.292,16,10,0,Math.PI*2,0,Math.PI*.57),makeMaterial(0x211f1b));hair.position.set(0,2.49,.015);headGroup.add(hair);
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.305,16,10,0,Math.PI*2,0,Math.PI*.34),fabric);cap.position.set(0,2.57,0);cap.scale.set(1,.65,1);headGroup.add(cap);
 const brim=new THREE.Mesh(new THREE.BoxGeometry(.48,.045,.25),fabric);brim.position.set(0,2.51,-.25);headGroup.add(brim);
 playerGroup.add(headGroup);playerGroup.userData.head=headGroup;
 const legs=[],arms=[],bootMeshes=[],lowerArms=[];
 for(const side of [-1,1]){
  const hip=new THREE.Group();hip.position.set(side*.2,1.02,0);playerGroup.add(hip);
  const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.145,.42,6,9),pants);thigh.position.y=-.29;thigh.castShadow=true;hip.add(thigh);
  const knee=new THREE.Mesh(new THREE.SphereGeometry(.145,10,8),shirtDark);knee.position.y=-.55;hip.add(knee);const kneePad=new THREE.Mesh(new THREE.BoxGeometry(.23,.18,.075),fabric);kneePad.position.set(0,-.55,-.12);hip.add(kneePad);
  const shin=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.37,5,8),pants);shin.position.y=-.79;shin.castShadow=true;hip.add(shin);
  const boot=new THREE.Group();boot.position.set(0,-1.02,-.08);hip.add(boot);
  const bootBody=new THREE.Mesh(new THREE.BoxGeometry(.28,.2,.43),bootMaterial);bootBody.position.set(0,.04,-.06);boot.add(bootBody);
  const sole=new THREE.Mesh(new THREE.BoxGeometry(.3,.055,.46),makeMaterial(0x090d0d));sole.position.set(0,-.065,-.06);boot.add(sole);
  legs.push(hip);bootMeshes.push(boot);
  const arm=new THREE.Group();arm.position.set(side*.49,1.82,0);playerGroup.add(arm);
  const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.125,.37,6,9),shirt);upper.position.y=-.25;upper.castShadow=true;arm.add(upper);
  const elbow=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),skin);elbow.position.y=-.49;arm.add(elbow);
  const forearm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.34,5,8),skin);forearm.position.y=-.68;forearm.castShadow=true;arm.add(forearm);
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.112,.112,.09,10),shirtDark);cuff.position.y=-.51;arm.add(cuff);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(.115,10,8),skin);hand.position.y=-.91;arm.add(hand);
  arms.push(arm);lowerArms.push(forearm);
 }
 const pack=new THREE.Group();pack.position.set(0,1.53,.39);playerGroup.add(pack);
 const packBody=new THREE.Mesh(new THREE.BoxGeometry(.58,.66,.25),leather);packBody.castShadow=true;pack.add(packBody);
 const packTop=new THREE.Mesh(new THREE.BoxGeometry(.48,.19,.28),fabric);packTop.position.y=.34;pack.add(packTop);
 for(const x of [-.23,.23]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.075,.72,.08),leather);strap.position.set(x,.02,-.16);pack.add(strap);}
 playerGroup.userData.backpack=pack;
 const compassMesh=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.08,12),makeMaterial(0xd1ae58));compassMesh.position.set(.67,1.8,0);compassMesh.visible=false;playerGroup.add(compassMesh);playerGroup.userData.compass=compassMesh;
 playerGroup.userData.legs=legs;playerGroup.userData.arms=arms;playerGroup.userData.boots=bootMeshes;playerGroup.userData.lowerArms=lowerArms;
 playerGroup.userData.velocity={x:0,z:0};playerGroup.position.set(0,terrainHeight(0,0),0);scene.add(playerGroup);
}
function addGuideNPC(){
 const guide=new THREE.Group(),skin=makeMaterial(0x8f6247),jacket=makeMaterial(0x8a633d),cloth=makeMaterial(0x344d4c),dark=makeMaterial(0x252b28);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.36,.62,6,10),jacket);torso.position.y=1.38;guide.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.25,16,12),skin);head.position.y=2.16;guide.add(head);
 const hat=new THREE.Mesh(new THREE.CylinderGeometry(.31,.3,.13,12),cloth);hat.position.y=2.4;guide.add(hat);
 const crown=new THREE.Mesh(new THREE.CylinderGeometry(.2,.23,.2,12),cloth);crown.position.y=2.53;guide.add(crown);
 for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.48,5,8),dark);leg.position.set(side*.17,.52,0);guide.add(leg);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.1,.48,5,8),jacket);arm.position.set(side*.43,1.38,0);arm.rotation.z=side*.12;guide.add(arm);}
 const satchel=new THREE.Mesh(new THREE.BoxGeometry(.34,.42,.16),cloth);satchel.position.set(.38,1.25,.25);guide.add(satchel);
 const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.18),new THREE.MeshStandardMaterial({color:0xe6bd69,emissive:0x8c5e22,emissiveIntensity:.8}));marker.position.y=2.95;guide.add(marker);
 guide.position.set(5,terrainHeight(5,4),4);guide.rotation.y=Math.PI*.72;guide.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(guide);
 interactables.push({type:"guide",name:"Guia da ilha",x:5,z:6,object:guide});
}
function addPlane(){
 plane=new THREE.Group();
 const fuselage=new THREE.Mesh(new THREE.CylinderGeometry(.72,.92,13,12),makeMaterial(0x65747a));fuselage.rotation.z=Math.PI/2;fuselage.castShadow=true;plane.add(fuselage);
 const wing=new THREE.Mesh(new THREE.BoxGeometry(2,.22,18),makeMaterial(0x89979a));wing.castShadow=true;plane.add(wing);
 const tail=new THREE.Mesh(new THREE.BoxGeometry(1.5,.18,5),makeMaterial(0x89979a));tail.position.set(-5,1,0);plane.add(tail);
 const fin=new THREE.Mesh(new THREE.BoxGeometry(2,.18,.22),makeMaterial(0x53646a));fin.position.set(-5,1.7,0);plane.add(fin);
 const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.8,12,8),new THREE.MeshStandardMaterial({color:0x9bd1d5,metalness:.5,roughness:.18,transparent:true,opacity:.82}));cockpit.scale.set(1.2,.7,.9);cockpit.position.set(3,.55,0);plane.add(cockpit);
 plane.position.set(-105,48,-12);plane.rotation.y=Math.PI/2;scene.add(plane);
 parachute=new THREE.Group();
 const canopy=new THREE.Mesh(new THREE.SphereGeometry(3.4,20,12,0,Math.PI*2,0,Math.PI*.52),new THREE.MeshStandardMaterial({color:0xc5a15b,roughness:.8,side:THREE.DoubleSide}));canopy.position.y=5.2;canopy.scale.set(1,.72,1);parachute.add(canopy);
 const harness=new THREE.Mesh(new THREE.BoxGeometry(.55,.7,.35),makeMaterial(0x394c4d));harness.position.y=2.2;parachute.add(harness);
 for(let i=0;i<8;i++){const angle=i/8*Math.PI*2;const line=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,3.5,5),makeMaterial(0xd9d5c6));line.position.set(Math.cos(angle)*2.25,3.75,Math.sin(angle)*2.25);parachute.add(line);}
 parachute.visible=false;scene.add(parachute);
}
function startDropSequence(){dropElapsed=0;dropPhase="boarding";playerGroup.visible=false;plane.visible=true;parachute.visible=false;$("drop-status").classList.remove("hidden");$("phase-label").textContent="A EMBARCAR";$("phase-detail").textContent="A aeronave aproxima-se da ilha";showToast("A AERONAVE ESTÁ A APROXIMAR-SE");}
function updateDropSequence(dt){
 if(dropPhase==="waiting"||dropPhase==="landed")return;
 dropElapsed+=dt;const t=dropElapsed;
 if(t<3){plane.position.x=-105+t*19;plane.position.y=48+Math.sin(t*1.3)*1.2;playerGroup.position.set(plane.position.x+5,plane.position.y-3,plane.position.z);camera.position.lerp(new THREE.Vector3(plane.position.x-19,plane.position.y+11,plane.position.z+24),.045);camera.lookAt(plane.position);$("phase-label").textContent="A BORDO";$("phase-detail").textContent="Sobrevoando a costa de Moçambique";}
 else if(t<10){if(dropPhase!=="descending"){dropPhase="descending";playerGroup.visible=true;parachute.visible=true;}
 const p=(t-3)/7,x=-48+p*48,z=-12+p*8,y=48-p*(48-terrainHeight(x,z));playerGroup.position.set(x,y,z);parachute.position.set(x,y-1,z);plane.position.x=-48+(t-3)*8;plane.position.y=48;playerGroup.rotation.y=Math.PI/2;$("phase-label").textContent="DESCIDA";$("phase-detail").textContent="A aproximar-se da zona de aterragem";camera.position.lerp(new THREE.Vector3(x+10,y+9,z+13),.035);camera.lookAt(x,y+2,z);}
 else{dropPhase="landed";plane.visible=false;parachute.visible=false;playerGroup.visible=true;playerGroup.position.set(0,terrainHeight(0,0),-4);verticalVelocity=0;onGround=true;$("phase-label").textContent="ATERRAGEM CONCLUÍDA";$("phase-detail").textContent="Explora a ilha e encontra os cinco cristais";setTimeout(()=>$("drop-status").classList.add("hidden"),2600);showToast("BEM-VINDO À ILHA • MISSÃO INICIADA");}
}
function buildSky(){const skyGeo=new THREE.SphereGeometry(260,24,16);const skyMat=new THREE.MeshBasicMaterial({color:0x8bbdce,side:THREE.BackSide});scene.add(new THREE.Mesh(skyGeo,skyMat));}
function showToast(message){ui.toast.textContent=message;ui.toast.classList.remove("hidden");toastTimer=2.3;}
function begin(){started=true;$("inventory-toggle").classList.remove("hidden");ui.intro.classList.add("hidden");ui.hud.classList.remove("hidden");ui.hint.classList.remove("hidden");$("mobile-controls").classList.remove("hidden");startDropSequence();if(innerWidth>760)requestLock();}
function requestLock(){if(renderer?.domElement?.requestPointerLock&&innerWidth>760)renderer.domElement.requestPointerLock();}
function updatePlayer(dt){
 const forward=clamp((keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0)-stickVector.y,-1,1);
 const side=clamp((keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0)+stickVector.x,-1,1);
 const moving=forward!==0||side!==0;
 const sprinting=moving&&keys.has("ShiftLeft")&&playerStats.energy>4;
 const maxSpeed=(sprinting?9.2:5.4)+(equipment.boots?.65:0);
 const input=new THREE.Vector3(side,0,-forward);
 if(input.lengthSq()>1)input.normalize();
 input.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
 const response=1-Math.exp(-13*dt);
 playerGroup.userData.velocity.x+=(input.x*maxSpeed-playerGroup.userData.velocity.x)*response;
 playerGroup.userData.velocity.z+=(input.z*maxSpeed-playerGroup.userData.velocity.z)*response;
 const actualSpeed=Math.hypot(playerGroup.userData.velocity.x,playerGroup.userData.velocity.z);
 playerGroup.position.x+=playerGroup.userData.velocity.x*dt;
 playerGroup.position.z+=playerGroup.userData.velocity.z*dt;
 if(actualSpeed>.18){
  const facing=Math.atan2(-playerGroup.userData.velocity.x,-playerGroup.userData.velocity.z);
  let angleDelta=((facing-playerGroup.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
  playerGroup.rotation.y+=angleDelta*(1-Math.exp(-18*dt));
  walkTime+=dt*(sprinting?12:8)*Math.min(1,actualSpeed/maxSpeed);
  const gait=Math.min(1,actualSpeed/maxSpeed);
  playerGroup.userData.legs[0].rotation.x=Math.sin(walkTime)*.62*gait;
  playerGroup.userData.legs[1].rotation.x=-Math.sin(walkTime)*.62*gait;
  playerGroup.userData.arms[0].rotation.x=-Math.sin(walkTime)*.34*gait;
  playerGroup.userData.arms[1].rotation.x=Math.sin(walkTime)*.34*gait;
  playerGroup.userData.head.rotation.y=Math.sin(walkTime*.45)*.025;
 }else{
  playerGroup.userData.velocity.x=0;playerGroup.userData.velocity.z=0;
  playerGroup.userData.legs.forEach(l=>l.rotation.x*=Math.exp(-12*dt));
  playerGroup.userData.arms.forEach(a=>a.rotation.x*=Math.exp(-12*dt));
  playerGroup.userData.head.rotation.y=Math.sin(elapsed*1.1)*.025;
 }
 if(keys.has("Space")&&onGround){verticalVelocity=8.5;onGround=false;}
 verticalVelocity-=22*dt;playerGroup.position.y+=verticalVelocity*dt;
 const floor=terrainHeight(playerGroup.position.x,playerGroup.position.z);
 if(playerGroup.position.y<=floor){playerGroup.position.y=floor;verticalVelocity=0;onGround=true;}
 for(const obstacle of colliders){
  const dx=playerGroup.position.x-obstacle.x,dz=playerGroup.position.z-obstacle.z,d=Math.hypot(dx,dz),min=obstacle.r+.55;
  if(d<min&&d>.001){playerGroup.position.x=obstacle.x+dx/d*min;playerGroup.position.z=obstacle.z+dz/d*min;playerGroup.userData.velocity.x=0;playerGroup.userData.velocity.z=0;}
 }
 playerGroup.position.x=clamp(playerGroup.position.x,-WORLD/2+5,WORLD/2-5);
 playerGroup.position.z=clamp(playerGroup.position.z,-WORLD/2+5,WORLD/2-5);
 const target=new THREE.Vector3(playerGroup.position.x,playerGroup.position.y+2.25,playerGroup.position.z);
 const offset=new THREE.Vector3(Math.sin(yaw)*cameraDistance,2.6+pitch*5,Math.cos(yaw)*cameraDistance);
 camera.position.lerp(target.clone().add(offset),1-Math.pow(.001,dt));camera.lookAt(target);
 updateSurvival(dt,actualSpeed>.25);checkCrystals();updateInteractions();
}
function updateSurvival(dt,moving){
 const outside=Math.hypot(playerGroup.position.x,playerGroup.position.z)>SAFE_ZONE_RADIUS;
 if(outside!==outsideSafeZone){outsideSafeZone=outside;showToast(outside?"ATENÇÃO • ESTÁS FORA DA ZONA SEGURA":"REGRESSASTE À ZONA SEGURA");}
 const sprinting=moving&&keys.has("ShiftLeft")&&playerStats.energy>4;
 if(outside)playerStats.energy=Math.max(0,playerStats.energy-5*dt);
 else if(sprinting)playerStats.energy=Math.max(0,playerStats.energy-1.15*dt);
 else playerStats.energy=Math.min(100,playerStats.energy+1.8*dt);
 const healthFill=$("health-fill"),energyFill=$("energy-fill");
 if(healthFill)healthFill.style.width=playerStats.health+"%";
 if(energyFill)energyFill.style.width=playerStats.energy+"%";
 $("health-value").textContent=Math.round(playerStats.health)+"%";
 $("energy-value").textContent=Math.round(playerStats.energy)+"%";
 const card=document.querySelector(".survival-card");if(card)card.classList.toggle("outside-zone",outside);
 $("zone-status").textContent=outside?"FORA DA ZONA • ENERGIA A DIMINUIR":"ZONA SEGURA • EXPLORA À VONTADE";
}
function checkCrystals(){for(const c of crystals){if(c.userData.collected)continue;const dx=playerGroup.position.x-c.position.x,dz=playerGroup.position.z-c.position.z;if(dx*dx+dz*dz<7){c.userData.collected=true;scene.remove(c);const count=crystals.filter(x=>x.userData.collected).length;$("crystal-count").textContent=count;$("progress-fill").style.width=(count/CRYSTAL_TOTAL*100)+"%";showToast("CRISTAL RECOLHIDO • "+count+"/"+CRYSTAL_TOTAL);if(count===CRYSTAL_TOTAL){won=true;$("win-message").classList.remove("hidden");document.exitPointerLock?.();}}}}
function setupTouchControls(){const zone=$("stick-zone"),knob=$("stick-knob");if(!zone)return;const move=e=>{const r=zone.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),max=39,len=Math.hypot(dx,dy),scale=len>max?max/len:1;stickVector={x:dx*scale/max,y:dy*scale/max};knob.style.transform="translate("+stickVector.x*39+"px,"+stickVector.y*39+"px)";};zone.addEventListener("pointerdown",e=>{stickPointer=e.pointerId;zone.setPointerCapture(e.pointerId);move(e);});zone.addEventListener("pointermove",e=>{if(e.pointerId===stickPointer)move(e);});const reset=()=>{stickPointer=null;stickVector={x:0,y:0};knob.style.transform="translate(0,0)";};zone.addEventListener("pointerup",reset);zone.addEventListener("pointercancel",reset);$("jump-touch").addEventListener("pointerdown",e=>{e.preventDefault();if(onGround)keys.add("Space");});$("jump-touch").addEventListener("pointerup",()=>keys.delete("Space"));$("jump-touch").addEventListener("pointercancel",()=>keys.delete("Space"));}
function updateEnvironment(dt){
 elapsed+=dt;dayTime=(8.5+elapsed*.018)%24;
 const h=dayTime,night=h<6||h>19,daylight=night ? 0.24 : clamp(1-Math.abs(h-13)/12,.35,1);
 const skyColor=new THREE.Color().setHSL(.54,.28,night ? 0.13 : 0.58*daylight);
 scene.background.copy(skyColor);scene.fog.color.copy(skyColor);
 scene.userData.sun.intensity=.45+2.7*daylight;scene.userData.hemi.intensity=.55+1.45*daylight;
 $("clock-label").textContent=String(Math.floor(h)).padStart(2,"0")+":"+String(Math.floor((h%1)*60)).padStart(2,"0");
 for(const obj of scene.children){
  if(obj.userData.speed){obj.position.x+=obj.userData.speed*dt;if(obj.position.x>125)obj.position.x=-125;}
  if(obj.userData.bird){
   obj.position.x+=obj.userData.speed*dt;obj.position.z+=Math.sin(elapsed*.35+obj.userData.phase)*dt*.55;
   const flap=Math.sin(elapsed*7+obj.userData.phase)*.48;
   obj.userData.left.rotation.z=flap;obj.userData.right.rotation.z=-flap;
   if(obj.position.x>120)obj.position.x=-120;
  }
  if(obj.userData.swayPhase!==undefined)obj.rotation.z=Math.sin(elapsed*.7+obj.userData.swayPhase)*.012;
  if(obj.userData.gem){obj.userData.gem.rotation.y+=dt*.8;obj.userData.gem.position.y=1.8+Math.sin(elapsed*2+obj.userData.index)*.18;obj.userData.ring.rotation.z+=dt*.4;}
  if(obj.userData.loot){obj.rotation.y+=dt*.45;obj.position.y=obj.userData.baseY+.12+Math.sin(elapsed*2+obj.userData.phase)*.1;}
 }
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(started&&!won){if(dropPhase!=="landed")updateDropSequence(dt);else if(!inventoryOpen)updatePlayer(dt);}updateEnvironment(dt);if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.add("hidden");}renderer.render(scene,camera);}
function init(){try{buildWorld();camera.position.set(0,5,10);camera.lookAt(0,1,0);clock=new THREE.Clock();$("start-btn").addEventListener("click",begin);$("inventory-toggle").addEventListener("click",()=>inventoryOpen?closeInventory():openInventory());$("inventory-close").addEventListener("click",closeInventory);$("item-primary").addEventListener("click",useSelectedItem);$("item-equip").addEventListener("click",equipSelectedItem);$("item-drop").addEventListener("click",dropSelectedItem);$("inventory-tabs").addEventListener("click",e=>{const btn=e.target.closest("button[data-category]");if(!btn)return;inventoryCategory=btn.dataset.category;$("inventory-tabs").querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===btn));renderInventory();});$("continue-btn").addEventListener("click",()=>{$("win-message").classList.add("hidden");won=false;requestLock();});$("sound-btn").addEventListener("click",()=>showToast("SOM AMBIENTE EM PREPARAÇÃO"));$("reload-btn").addEventListener("click",()=>location.reload());setupTouchControls();document.addEventListener("keydown",e=>{if(e.code==="KeyI"&&started){e.preventDefault();inventoryOpen?closeInventory():openInventory();return;}if(e.code==="Escape"&&inventoryOpen){closeInventory();return;}if(e.code==="KeyE"&&started&&!inventoryOpen){interact();return;}keys.add(e.code);if(e.code==="Space")e.preventDefault();});document.addEventListener("keyup",e=>keys.delete(e.code));document.addEventListener("mousemove",e=>{if(!locked)return;yaw-=e.movementX*.0022;pitch=clamp(pitch-e.movementY*.0015,-.55,.35);});renderer.domElement.addEventListener("wheel",e=>{if(!started)return;cameraDistance=clamp(cameraDistance+Math.sign(e.deltaY)*.65,4.5,12);},{passive:true});document.addEventListener("pointerlockchange",()=>{locked=document.pointerLockElement===renderer.domElement;});let lookTouch=null,lastLookX=0,lastLookY=0;renderer.domElement.addEventListener("pointerdown",e=>{if(started&&innerWidth<=760&&e.clientX>innerWidth*.42){lookTouch=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);}});renderer.domElement.addEventListener("pointermove",e=>{if(lookTouch===e.pointerId){yaw-=(e.clientX-lastLookX)*.006;pitch=clamp(pitch-(e.clientY-lastLookY)*.004,-.55,.35);lastLookX=e.clientX;lastLookY=e.clientY;}});renderer.domElement.addEventListener("pointerup",e=>{if(lookTouch===e.pointerId)lookTouch=null;});renderer.domElement.addEventListener("pointercancel",()=>lookTouch=null);renderer.domElement.addEventListener("click",()=>{if(started&&!locked&&!won&&innerWidth>760)requestLock();});addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));});renderInventory();ui.loading.classList.add("hidden");animate();window.__BATALHA_READY=true;}catch(err){console.error("BATALHA-MOZ init:",err);ui.loading.classList.add("hidden");const detail=$("error-detail");if(detail)detail.textContent="Erro ao iniciar a cena 3D: "+(err&&err.message?err.message:"falha desconhecida")+". Recarrega a página; se continuar, envia esta mensagem ao suporte.";ui.error.classList.remove("hidden");}}
init();
})().catch((err) => { console.error("BATALHA-MOZ bootstrap:", err); if (window.__BATALHA_SHOW_ERROR) window.__BATALHA_SHOW_ERROR("Falha ao iniciar o motor 3D: " + (err && err.message ? err.message : "erro desconhecido") + ". Recarrega a página."); });
