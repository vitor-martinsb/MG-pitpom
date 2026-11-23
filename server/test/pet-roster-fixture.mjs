import assert from 'node:assert/strict';
// Same public flags in native-authority snapshots and browser course frames.
export function assertPetRoster(f){
 const c=f.companions;
 const benedita=c?c.benedita.active:f.beneditaActive;
 const samanta=c?c.smanata.active:f.smanataActive;
 const alfredo=c?c.alfredo?.active:f.alfredoActive;
 const pets=[...(f.catVisible?['pompom']:[]),...(f.dogVisible?['pituca']:[]),...f.wildlife.filter(a=>a.visible).map(a=>`wildlife-${a.kind}`),...(benedita?['benedita']:[]),...(samanta?['samanta']:[]),...(alfredo?['alfredo']:[])];
 assert.equal(pets.length,3,`exactly three animals: ${pets}`);
 assert.notEqual(f.catVisible,f.dogVisible,'choose Pituca or Pompom for the mandatory slot');
 assert.equal(benedita,samanta,'Benedita and Samanta always appear together');
 if(benedita){assert.equal(f.wildlife.filter(a=>a.visible).length,0);assert.equal(Boolean(alfredo),false);assert.notEqual(f.catVisible,f.dogVisible);}
 return pets;
}
