export function locationLabel(name:string|null|undefined):string{
  if(!name||name.toLowerCase()==="statewide")return "Statewide";
  return /\bLGA$/i.test(name)?name:`${name} LGA`;
}
