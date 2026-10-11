(() => {
  'use strict';
  const catalog=window.GOLF_TRANSLATIONS;
  let language='en',engineReady=false;
  try{const saved=localStorage.getItem('pitpom-language');if(Object.hasOwn(catalog,saved))language=saved;}catch{}
  function t(key,values={}){
    const value=catalog[language][key]??catalog.en[key]??key;
    return value.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??`{${name}}`));
  }
  function paint(){
    document.documentElement.lang=language;
    for(const element of document.querySelectorAll('[data-i18n]'))element.textContent=t(element.dataset.i18n);
    for(const element of document.querySelectorAll('[data-i18n-placeholder]'))element.placeholder=t(element.dataset.i18nPlaceholder);
    for(const element of document.querySelectorAll('[data-i18n-label]'))element.setAttribute('aria-label',t(element.dataset.i18nLabel));
    document.getElementById('language').value=language;
  }
  function syncEngine(){if(engineReady)Module.ccall('golf_set_language',null,['string'],[language]);}
  function setLanguage(value){
    if(!Object.hasOwn(catalog,value))value='en';
    window.GolfOnline?.cancelAim();language=value;
    try{localStorage.setItem('pitpom-language',language);}catch{}
    paint();syncEngine();window.dispatchEvent(new Event('languagechange'));
  }
  function errorKey(message){return Object.keys(catalog['pt-BR']).find(key=>key.startsWith('error.')&&catalog['pt-BR'][key]===message);}
  window.GolfI18n={t,setLanguage,get language(){return language;},ready(){engineReady=true;syncEngine();},
    error(message){const key=message.code?`error.${message.code}`:errorKey(message.message);return key&&catalog.en[key]?t(key,message.params):t('error.BAD_REQUEST');}};
  document.getElementById('language').onchange=event=>setLanguage(event.target.value);
  paint();
})();
