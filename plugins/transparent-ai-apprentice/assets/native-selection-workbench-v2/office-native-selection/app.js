import {initAssistant} from '../shared/assistant-v2.js';

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const cfg=window.__AI_APPRENTICE_OVERLAY_CONFIG__||{};
const state=$('#officeState');
const submit=$('#submitOffice');
const back=$('#rollback');
let current='request',previewReady=false,reviewReady=false,submitted=false;

function setState(kind,message){
  state.dataset.state=kind;
  state.querySelector('span').textContent=message;
}

function refreshFlow(){
  const order=['selection','request','preview','review'];
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
    if(!quiet)setState('error','请先生成与当前意见一致的差异预览');
  }
  if(name==='review'&&!reviewReady)name='preview';
  current=name;
  $$('.step-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.stepPanel===name));
  refreshFlow();
  if(innerWidth<=800)$('#actionSheet').classList.add('open');
}

function invalidatePreview(){
  if(!previewReady)return;
  previewReady=false;
  reviewReady=false;
  submitted=false;
  submit.disabled=true;
  back.disabled=true;
  setState('waiting','修改意见已变化 · 请重新生成预览');
  assistant.setState('listening','意见已变化，等待重新预览');
  showStep('request',{quiet:true});
}

$$('.flow button').forEach(button=>button.onclick=()=>showStep(button.dataset.step));
['#operation','#instruction','#formatConstraint'].forEach(selector=>$(selector).addEventListener('input',invalidatePreview));
$$('.constraint-row input').forEach(input=>input.addEventListener('change',invalidatePreview));

$('#showContext').onclick=()=>{
  const hidden=$('#selectionSurface').classList.toggle('hide-context');
  $('#showContext').textContent=hidden?'显示上下文':'弱化上下文';
};

function closeMenu(){$('#contextMenu').hidden=true}
function openMenu(event){
  event.preventDefault();
  const menu=$('#contextMenu');
  menu.hidden=false;
  const width=menu.offsetWidth||250,height=menu.offsetHeight||170;
  menu.style.left=`${Math.max(8,Math.min(event.clientX,innerWidth-width-8))}px`;
  menu.style.top=`${Math.max(8,Math.min(event.clientY,innerHeight-height-8))}px`;
  assistant.setState('listening','选区操作已就绪');
  $('#openAction').focus();
}

$('#selectionSurface').addEventListener('contextmenu',openMenu);
document.addEventListener('pointerdown',event=>{if(!$('#contextMenu').contains(event.target)&&event.button!==2)closeMenu()});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  closeMenu();
  if(innerWidth<=800)$('#actionSheet').classList.remove('open');
});
$('#openAction').onclick=()=>{closeMenu();showStep('request');$('#instruction').focus()};
$('#closePanel').onclick=()=>$('#actionSheet').classList.remove('open');
$$('#contextMenu button:not(#openAction)').forEach(button=>{
  button.disabled=true;
  button.title='请在 Word 宿主软件中使用此命令';
});

const assistant=initAssistant({status:'waiting',onActivate:()=>showStep('request')});

function drawRelation(){
  const canvas=$('#relationCanvas'),paper=$('#selectionSurface'),ratio=Math.min(devicePixelRatio||1,2);
  canvas.width=paper.clientWidth*ratio;
  canvas.height=paper.clientHeight*ratio;
  const context=canvas.getContext('2d');
  context.setTransform(ratio,0,0,ratio,0,0);
  context.clearRect(0,0,paper.clientWidth,paper.clientHeight);
  context.strokeStyle='#1769a6';
  context.lineWidth=1.5;
  context.setLineDash([5,4]);
  context.beginPath();
  context.moveTo(paper.clientWidth*.23,260);
  context.lineTo(paper.clientWidth*.13,350);
  context.stroke();
  context.strokeStyle='#2d7a50';
  context.strokeRect(48,430,paper.clientWidth-96,170);
}

$('#generatePreview').onclick=()=>{
  const instruction=$('#instruction').value.trim();
  if(!instruction){
    setState('error','请先填写老师修改意见');
    $('#instruction').focus();
    return;
  }
  previewReady=true;
  reviewReady=false;
  submitted=false;
  submit.disabled=true;
  back.disabled=false;
  showStep('preview',{quiet:true});
  setState('success','差异预览已生成 · 原文未写回');
  assistant.setState('reading','差异预览已生成');
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
  setState('success','已提交老师审核 · 未自动写回');
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
  setState('waiting','预览已丢弃 · 可继续修改意见');
  assistant.setState('listening','等待修改意见');
  $('#instruction').focus();
};

globalThis.AIApprenticeOverlay={
  validate(){
    if(!$('#instruction').value.trim())return{valid:false,message:'请先填写老师修改意见'};
    if(!previewReady||!reviewReady)return{valid:false,message:'请重新生成预览并进入老师审核步骤'};
    return{valid:true};
  },
  packet(){return{format:'transparent_ai_apprentice_multimodal_surgical_mask_correction_v1',surfaceKind:'office_native_selection',nativeSelection:{schema:'ai_apprentice_native_selection_v1',host:'word',documentId:cfg.documentId||'project-retro-docx',locator:'paragraph:12',range:{start:18,end:42},sourceText:$('#sourceText').textContent,styleContext:{paragraphStyle:'正文',font:'宋体',sizePt:11}},contextAction:{schema:'ai_apprentice_context_action_v1',action:'replace_native_text',instruction:$('#instruction').value,formatConstraint:$('#formatConstraint').value,replacementText:$('#replacementText').textContent},previewReady,submitted,reviewOnly:true,accepted:false,ruleEnabled:false,packagingGated:true}}
};

addEventListener('resize',drawRelation);
drawRelation();
refreshFlow();
if(innerWidth<=800)$('#actionSheet').classList.remove('open');
