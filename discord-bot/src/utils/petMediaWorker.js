import {parentPort,workerData} from 'node:worker_threads';
import {renderIllustrated} from './petWorldArt.js';
try{
  const result=await renderIllustrated(workerData.pet,workerData.opts);
  parentPort.postMessage({result});
}catch(error){parentPort.postMessage({error:String(error?.message??error)});}
