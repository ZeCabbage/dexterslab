import { SpatialModel } from './observer2/spatial-model.js';
const spatial = new SpatialModel(320, 240);
const evs = spatial.processMotionEvent([{x:160, y:120, w:10, h:10, area:100}]);
console.log(evs);
