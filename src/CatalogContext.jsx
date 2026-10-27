import {createContext,useContext} from 'react';
import {defaultCatalog,catalogLabel} from './catalog';
export const CatalogContext=createContext(defaultCatalog);
export function useCatalog(){const catalog=useContext(CatalogContext);return {...catalog,label:(kind,name)=>catalogLabel(catalog,kind,name)};}
