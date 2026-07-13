import {initAssistant} from '../shared/assistant-v2.js';

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const cfg=window.__AI_APPRENTICE_OVERLAY_CONFIG__||{};
const state=$('#engineeringState');
const submit=$('#submitEngineering');
const back=$('#rollback');
let current='request',previewReady=false,reviewReady=false,submitted=false,activeTool='select';

function setState(kind,message){
  state.dataset.state=kind;
  state.querySelector('span').textContent=message;
}

function refreshFlow(){
  const order=['object','request','preview','review'];
  const activeIndex=order.indexOf(current);
  $$('.flow button').forEach(button=>{
    const index=order.indexOf(button.dataset.step);
    button.classList.toggle('active',index===activeIndex);
    button.classList.toggle('done',index<activeIndex||(button.dataset.step==='preview'&&previewReady));
    button.setAttribute('aria-current',index===activeIndex?'step':'false');
    button.setAttribute('aria-disabled',(index>=2&&!previewReady)?'true':'false');
  });
}

function showStep(name,{quiet=false}={}){
  if((name==='preview'||name==='review')&&!previewReady){
    name='request';
    if(!quiet)setState('error','请先计算与当前参数一致的执行预览');
  }
  if(name==='review'&&!reviewReady)name='preview';
  current=name;
  $$('.step-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.stepPanel===name));
  refreshFlow();
  if(innerWidth<=840)$('#propertySheet').classList.add('open');
}

function invalidatePreview(){
  if(!previewReady)return;
  previewReady=false;
  reviewReady=false;
  submitted=false;
  submit.disabled=true;
  back.disabled=true;
  setState('waiting','工程参数已变化 · 请重新计算预览');
  assistant.setState('listening','参数已变化，等待重新预览');
  showStep('request',{quiet:true});
}

$$('.flow button').forEach(button=>button.onclick=()=>showStep(button.dataset.step));
['#action','#targetValue','#unit','#instruction'].forEach(selector=>$(selector).addEventListener('input',invalidatePreview));
$$('.step-panel fieldset input').forEach(input=>input.addEventListener('change',invalidatePreview));
$$('[data-tool]').forEach(button=>button.onclick=()=>{
  activeTool=button.dataset.tool;
  $$('[data-tool]').forEach(item=>{
    item.classList.toggle('active',item===button);
    item.setAttribute('aria-pressed',String(item===button));
  });
});

function draw(){
  const model=$('#modelCanvas'),zone=$('#zoneCanvas'),host=$('#selectionSurface');
  const ratio=Math.min(devicePixelRatio||1,2),width=host.clientWidth,height=host.clientHeight;
  [model,zone].forEach(canvas=>{
    canvas.width=width*ratio;
    canvas.height=height*ratio;
    canvas.getContext('2d').setTransform(ratio,0,0,ratio,0,0);
  });
  const context=model.getContext('2d');
  context.clearRect(0,0,width,height);
  context.save();
  context.translate(width*.49,height*.51);
  const scale=Math.min(width/950,height/560);
  context.scale(scale,scale);
  context.strokeStyle='#324a56';
  context.lineWidth=1.5;
  context.fillStyle='#f5f7f8';
  context.beginPath();
  context.moveTo(-290,-80);context.lineTo(-60,-180);context.lineTo(300,-45);context.lineTo(70,70);context.closePath();context.fill();context.stroke();
  context.beginPath();context.moveTo(-290,-80);context.lineTo(-290,100);context.lineTo(70,210);context.lineTo(70,70);context.stroke();
  context.beginPath();context.moveTo(70,70);context.lineTo(300,-45);context.lineTo(300,115);context.lineTo(70,210);context.stroke();
  context.setLineDash([7,5]);context.strokeStyle='#7b8e98';
  for(let x=-220;x<250;x+=70){context.beginPath();context.moveTo(x,-100);context.lineTo(x+110,130);context.stroke()}
  context.setLineDash([]);context.strokeStyle='#1769a6';context.lineWidth=2;
  context.beginPath();context.moveTo(-260,155);context.lineTo(45,245);context.stroke();
  context.beginPath();context.moveTo(-260,142);context.lineTo(-260,168);context.moveTo(45,232);context.lineTo(45,257);context.stroke();
  context.fillStyle='#104f78';context.font='700 13px Cascadia Mono';context.fillText('D04   420.00 mm',-150,218);context.restore();

  const overlay=zone.getContext('2d');
  overlay.clearRect(0,0,width,height);overlay.lineWidth=2;overlay.setLineDash([6,4]);
  overlay.strokeStyle='#d4473b';overlay.fillStyle='#d4473b16';overlay.strokeRect(width*.22,height*.68,width*.35,height*.12);overlay.fillRect(width*.22,height*.68,width*.35,height*.12);
  overlay.strokeStyle='#2d7a50';overlay.fillStyle='#2d7a5014';overlay.strokeRect(width*.6,height*.28,width*.22,height*.35);overlay.fillRect(width*.6,height*.28,width*.22,height*.35);
  overlay.strokeStyle='#1769a6';overlay.beginPath();overlay.moveTo(width*.57,height*.72);overlay.lineTo(width*.68,height*.45);overlay.stroke();
}

function closeMenu(){$('#contextMenu').hidden=true}
function openMenu(event){
  event.preventDefault();
  const menu=$('#contextMenu');
  menu.hidden=false;
  const width=menu.offsetWidth||252,height=menu.offsetHeight||210;
  menu.style.left=`${Math.max(8,Math.min(event.clientX,innerWidth-width-8))}px`;
  menu.style.top=`${Math.max(8,Math.min(event.clientY,innerHeight-height-8))}px`;
  assistant.setState('listening','对象操作已就绪');
  $('#openAction').focus();
}

$('#selectionSurface').addEventListener('contextmenu',openMenu);
document.addEventListener('pointerdown',event=>{if(!$('#contextMenu').contains(event.target)&&event.button!==2)closeMenu()});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  closeMenu();
  if(innerWidth<=840)$('#propertySheet').classList.remove('open');
});
$('#openAction').onclick=()=>{closeMenu();showStep('request');$('#targetValue').focus()};
$('#closePanel').onclick=()=>$('#propertySheet').classList.remove('open');
$$('#contextMenu button:not(#openAction)').forEach(button=>{
  button.disabled=true;
  button.title='请在工程宿主软件中使用此命令';
});

const assistant=initAssistant({status:'waiting',onActivate:()=>showStep('request')});

$('#generatePreview').onclick=()=>{
  const targetValue=Number($('#targetValue').value);
  if(!Number.isFinite(targetValue)||targetValue<=0){
    setState('error','请输入大于 0 的有效目标值');
    $('#targetValue').focus();
    return;
  }
  if(!$('#instruction').value.trim()){
    setState('error','请先填写老师修改意见');
    $('#instruction').focus();
    return;
  }
  previewReady=true;
  reviewReady=false;
  submitted=false;
  submit.disabled=true;
  back.disabled=false;
  $('#previewValue').replaceChildren(document.createTextNode(targetValue.toFixed(2)+' '));
  const unit=document.createElement('small');unit.textContent=$('#unit').value;$('#previewValue').append(unit);
  showStep('preview',{quiet:true});
  setState('success','执行预览已计算 · 工程文件未变');
  assistant.setState('reading','执行预览已生成');
};

$('#toReview').onclick=()=>{
  if(!previewReady)return showStep('request');
  reviewReady=true;
  submit.disabled=false;
  showStep('review',{quiet:true});
  setState('waiting','预览已锁定 · 等待老师提交审核');
  assistant.setState('waiting','等待老师审核');
};

submit.onclick=()=>setState('offline','请从宿主 Agent 生成的任务页面提交');
submit.addEventListener('ai-apprentice:submission-success',()=>{
  submitted=true;
  setState('success','已提交老师审核 · 未自动执行');
  assistant.setState('waiting','等待宿主执行确认');
});

const backLabel=[...back.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);
if(backLabel)backLabel.textContent='返回修改';
back.onclick=()=>{
  previewReady=false;
  reviewReady=false;
  submitted=false;
  submit.disabled=true;
  back.disabled=true;
  showStep('request',{quiet:true});
  setState('waiting','预览已丢弃 · 可继续修改参数');
  assistant.setState('listening','等待修改参数');
  $('#targetValue').focus();
};

globalThis.AIApprenticeOverlay={
  validate(){
    const targetValue=Number($('#targetValue').value);
    if(!Number.isFinite(targetValue)||targetValue<=0)return{valid:false,message:'请输入大于 0 的有效目标值'};
    if(!$('#instruction').value.trim())return{valid:false,message:'请先填写老师修改意见'};
    if(!previewReady||!reviewReady)return{valid:false,message:'请重新计算预览并进入老师审核步骤'};
    return{valid:true};
  },
  packet(){return{format:'transparent_ai_apprentice_multimodal_surgical_mask_correction_v1',surfaceKind:'engineering_native_selection',nativeSelection:{schema:'ai_apprentice_native_selection_v1',host:'engineering_software',documentId:cfg.documentId||'pack-12-structure-rev07',object:{id:'D04',type:'linear_dimension',value:420,unit:'mm',feature:'Body01/Sketch03',topologyRefs:['E06','E14'],protectedObjects:['D08','D10','other_entities','constraints']}},contextAction:{schema:'ai_apprentice_context_action_v1',action:$('#action').value,targetValue:Number($('#targetValue').value),unit:$('#unit').value,instruction:$('#instruction').value,preserveTopology:true,preserveConstraints:true},previewReady,submitted,activeTool,reviewOnly:true,accepted:false,ruleEnabled:false,packagingGated:true}}
};

addEventListener('resize',draw);
draw();
refreshFlow();
if(innerWidth<=840)$('#propertySheet').classList.remove('open');
