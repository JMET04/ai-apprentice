export function initAssistant({onActivate,status='已读取当前上下文'}={}){
  let button=document.querySelector('#aiBeacon');
  if(!button){
    button=document.createElement('button');
    button.id='aiBeacon'; button.className='ai-beacon'; button.type='button';
    button.dataset.state='waiting'; button.dataset.expanded='false';
    button.innerHTML='<span class="beacon-core">AI</span><span class="beacon-light"></span><span class="beacon-arm"></span><span class="beacon-joint"></span><span class="beacon-stand"></span><span class="beacon-foot"></span><span class="beacon-label"></span>';
    document.body.append(button);
  }
  const label=button.querySelector('.beacon-label');
  let announcer=document.querySelector('#aiApprenticeStatusAnnouncer');
  if(!announcer){
    announcer=document.createElement('div');
    announcer.id='aiApprenticeStatusAnnouncer';
    announcer.className='sr-only';
    announcer.setAttribute('role','status');
    announcer.setAttribute('aria-live','polite');
    announcer.setAttribute('aria-atomic','true');
    document.body.append(announcer);
  }
  const setState=(state,text)=>{
    const message=text||state;
    button.dataset.state=state;
    button.setAttribute('aria-label',`AI 学徒入口：${message}`);
    button.title=message;
    if(label)label.textContent=message;
    if(announcer.textContent!==message)announcer.textContent=message;
  };
  button.addEventListener('click',()=>{button.dataset.expanded=String(button.dataset.expanded!=='true');onActivate?.()});
  setState(button.dataset.state||'waiting',status);
  return {setState,element:button};
}
