import {initAssistant} from '../shared/assistant-v2.js';

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const cfg=window.__AI_APPRENTICE_OVERLAY_CONFIG__||{};
const canvas=$('#maskCanvas'),reference=$('#referenceCanvas'),stage=$('#stage');
const context=canvas.getContext('2d'),referenceContext=reference.getContext('2d');
const history=[];
let redo=[],drawing=false,start=null,tool='brush',zoom=1,strokes=0,visible=true,resizing=false;
let pointerFrame=0,pendingPosition=null,shapeBase=null;

function setState(kind,message){
  const box=$('#saveState');
  box.dataset.state=kind;
  box.querySelector('span').textContent=message;
}

function currentSnapshot(){return{url:canvas.toDataURL(),strokes}}
function pushSnapshot(){
  history.push(currentSnapshot());
  if(history.length>30)history.shift();
  redo=[];
  updateHistoryButtons();
}

function restoreSnapshot(snapshot,{syncCount=true}={}){
  if(!snapshot)return Promise.resolve();
  return new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{
      context.clearRect(0,0,stage.clientWidth,stage.clientHeight);
      context.drawImage(image,0,0,stage.clientWidth,stage.clientHeight);
      if(syncCount)strokes=snapshot.strokes;
      updateMaskState();
      resolve();
    };
    image.src=snapshot.url;
  });
}

function drawReference(){
  const width=stage.clientWidth,height=stage.clientHeight;
  referenceContext.clearRect(0,0,width,height);
  referenceContext.lineWidth=1.5;
  referenceContext.setLineDash([5,4]);
  referenceContext.strokeStyle='#1769a6';
  referenceContext.fillStyle='#1769a618';
  referenceContext.strokeRect(width*.21,height*.19,width*.2,height*.58);
  referenceContext.fillRect(width*.21,height*.19,width*.2,height*.58);
  referenceContext.strokeStyle='#2d7a50';
  referenceContext.fillStyle='#2d7a5014';
  referenceContext.strokeRect(width*.51,height*.26,width*.25,height*.45);
  referenceContext.fillRect(width*.51,height*.26,width*.25,height*.45);
}

async function resize(){
  if(resizing)return;
  resizing=true;
  const saved=strokes?currentSnapshot():null;
  const ratio=Math.min(devicePixelRatio||1,2),width=stage.clientWidth,height=stage.clientHeight;
  [canvas,reference].forEach(item=>{
    item.width=width*ratio;
    item.height=height*ratio;
    item.getContext('2d').setTransform(ratio,0,0,ratio,0,0);
  });
  drawReference();
  if(saved)await restoreSnapshot(saved);
  resizing=false;
}

function point(event){
  const bounds=canvas.getBoundingClientRect();
  return{x:(event.clientX-bounds.left)*(stage.clientWidth/bounds.width),y:(event.clientY-bounds.top)*(stage.clientHeight/bounds.height)};
}

function updateHistoryButtons(){
  $('[data-command="undo"]').disabled=history.length===0;
  $('[data-command="redo"]').disabled=redo.length===0;
}

function updateMaskState(){
  $('#maskState').textContent=strokes?`已绘制 ${strokes} 笔`:'尚未绘制修改区';
  const valid=strokes>0&&$('#teacherNote').value.trim().length>0;
  $('#submitReview').disabled=!valid;
  $('#dirtyBadge').hidden=!strokes&&!$('#teacherNote').value.trim();
  $('#dirtyBadge').textContent=valid?'有未保存修改':strokes?'请补充修改意见':'等待绘制修改区';
  return valid;
}

function finishStroke(){
  strokes+=1;
  drawing=false;
  updateMaskState();
  updateHistoryButtons();
  setState('waiting','蒙版已更新 · 等待提交');
  assistant.setState('reading','已读取标注');
}

canvas.addEventListener('pointerdown',event=>{
  start=point(event);
  if(tool==='text'){
    const text=prompt('输入标注文字');
    if(!text?.trim())return;
    pushSnapshot();
    context.fillStyle=$('#color').value;
    context.font=`600 ${Math.max(12,Number($('#size').value)+3)}px "Microsoft YaHei UI"`;
    context.fillText(text.trim(),start.x,start.y);
    finishStroke();
    return;
  }
  drawing=true;
  canvas.setPointerCapture(event.pointerId);
  pushSnapshot();
  shapeBase=context.getImageData(0,0,canvas.width,canvas.height);
  context.beginPath();
  context.moveTo(start.x,start.y);
});

function renderPointer(position){
  pointerFrame=0;
  pendingPosition=null;
  $('#pointer').textContent=`X ${Math.round(position.x)} · Y ${Math.round(position.y)}`;
  if(!drawing)return;
  context.strokeStyle=$('#color').value;
  context.fillStyle=$('#color').value+'33';
  context.lineWidth=Number($('#size').value);
  context.lineCap='round';
  context.lineJoin='round';
  if(tool==='brush'){
    context.lineTo(position.x,position.y);
    context.stroke();
    return;
  }
  if(shapeBase){
    context.save();
    context.setTransform(1,0,0,1,0,0);
    context.putImageData(shapeBase,0,0);
    context.restore();
  }
  context.beginPath();
  if(tool==='rect'){
    context.rect(start.x,start.y,position.x-start.x,position.y-start.y);context.fill();context.stroke();
  }else if(tool==='ellipse'){
    context.ellipse((start.x+position.x)/2,(start.y+position.y)/2,Math.abs(position.x-start.x)/2,Math.abs(position.y-start.y)/2,0,0,Math.PI*2);context.fill();context.stroke();
  }else if(tool==='arrow'){
    context.moveTo(start.x,start.y);context.lineTo(position.x,position.y);context.stroke();
    const angle=Math.atan2(position.y-start.y,position.x-start.x);
    context.beginPath();context.moveTo(position.x,position.y);
    context.lineTo(position.x-13*Math.cos(angle-.45),position.y-13*Math.sin(angle-.45));
    context.moveTo(position.x,position.y);
    context.lineTo(position.x-13*Math.cos(angle+.45),position.y-13*Math.sin(angle+.45));context.stroke();
  }
}

function flushPointerFrame(){
  if(pointerFrame){cancelAnimationFrame(pointerFrame);pointerFrame=0}
  if(pendingPosition)renderPointer(pendingPosition);
}

canvas.addEventListener('pointermove',event=>{
  pendingPosition=point(event);
  if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>renderPointer(pendingPosition));
});
canvas.addEventListener('pointerup',()=>{if(drawing){flushPointerFrame();finishStroke();shapeBase=null}});
canvas.addEventListener('pointercancel',()=>{drawing=false;pendingPosition=null;shapeBase=null;if(pointerFrame)cancelAnimationFrame(pointerFrame);pointerFrame=0});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)return;
  drawing=false;
  pendingPosition=null;
  shapeBase=null;
  if(pointerFrame)cancelAnimationFrame(pointerFrame);
  pointerFrame=0;
});

function selectTool(next){
  tool=next;
  $$('[data-tool]').forEach(button=>{
    const selected=button.dataset.tool===next;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
$$('[data-tool]').forEach(button=>button.onclick=()=>selectTool(button.dataset.tool));

function selectPanel(name){
  if(name==='submit'&&!updateMaskState()){
    name=strokes?'comment':'locate';
    setState('error',strokes?'请先填写老师修改意见':'请先在图纸上绘制修改范围');
  }
  $$('.stepper button').forEach(button=>{
    const selected=button.dataset.panel===name;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-current',selected?'step':'false');
  });
  $$('.panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panelName===name));
}
$$('.stepper button').forEach(button=>button.onclick=()=>selectPanel(button.dataset.panel));

function setZoom(next){
  zoom=Math.max(.6,Math.min(1.6,next));
  stage.style.transform=zoom===1?'':`scale(${zoom})`;
  $('#zoomValue').value=`${Math.round(zoom*100)}%`;
}

$$('[data-command]').forEach(button=>button.onclick=async()=>{
  const command=button.dataset.command;
  if(command==='zoom-in')setZoom(zoom+.1);
  if(command==='zoom-out')setZoom(zoom-.1);
  if(command==='fit')setZoom(1);
  if(command==='undo'&&history.length){
    redo.push(currentSnapshot());
    await restoreSnapshot(history.pop());
    setState('waiting','已撤销一步 · 等待提交');
  }
  if(command==='redo'&&redo.length){
    history.push(currentSnapshot());
    await restoreSnapshot(redo.pop());
    setState('waiting','已重做一步 · 等待提交');
  }
  if(command==='clear'&&strokes&&confirm('清空当前蒙版？此操作可以用撤销恢复。')){
    pushSnapshot();
    context.clearRect(0,0,stage.clientWidth,stage.clientHeight);
    strokes=0;
    updateMaskState();
    setState('waiting','蒙版已清空 · 可撤销恢复');
  }
  updateHistoryButtons();
});

$('#size').oninput=event=>$('#sizeValue').value=event.target.value;
$('#teacherNote').addEventListener('input',()=>{
  updateMaskState();
  setState('waiting','修改意见已更新 · 等待提交');
});
$('#visibility').onclick=()=>{
  visible=!visible;
  canvas.hidden=!visible;
  $('#visibility').setAttribute('aria-pressed',String(visible));
  $('#visibility').setAttribute('aria-label',visible?'隐藏蒙版':'显示蒙版');
};

document.addEventListener('keydown',event=>{
  if(event.target.matches('input,textarea,select'))return;
  const key=event.key.toLowerCase();
  if((event.ctrlKey||event.metaKey)&&key==='z'){
    event.preventDefault();
    const button=$(`[data-command="${event.shiftKey?'redo':'undo'}"]`);
    if(!button.disabled)button.click();
    return;
  }
  const shortcuts={b:'brush',o:'ellipse',r:'rect',a:'arrow',t:'text'};
  if(shortcuts[key])selectTool(shortcuts[key]);
});

const assistant=initAssistant({status:'waiting',onActivate:()=>{selectPanel('comment');$('#teacherNote').focus()}});
$('.stage-hint').textContent='拖动画布标注 · 快捷键 B / R / O / A / T';

$('#submitReview').onclick=()=>setState('offline','请从宿主 Agent 生成的任务页面提交');
$('#submitReview').addEventListener('ai-apprentice:submission-success',()=>{
  $('#dirtyBadge').hidden=true;
  setState('success','已提交老师审校 · 未自动执行');
  assistant.setState('waiting','等待老师审核');
});

globalThis.AIApprenticeOverlay={
  validate(){
    if(!strokes)return{valid:false,message:'请先在图纸上绘制修改范围'};
    if(!$('#teacherNote').value.trim())return{valid:false,message:'请先填写老师修改意见'};
    return{valid:true};
  },
  packet(){return{format:'transparent_ai_apprentice_multimodal_surgical_mask_correction_v1',surfaceKind:'packaging_image_mask',brand:'AI 学徒',reviewOnly:true,accepted:false,ruleEnabled:false,packagingGated:true,tool,maskDataUrl:canvas.toDataURL(),annotations:{modify:strokes?1:0,protect:1,reference:1},issueType:$('#issueType').value,workflowStep:$('#workflowStep').value,teacherNote:$('#teacherNote').value,config:cfg}}
};

addEventListener('resize',resize);
$('#baseImage').addEventListener('load',resize);
updateHistoryButtons();
updateMaskState();
resize();
