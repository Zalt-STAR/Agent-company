import { TITLE, TAGLINE } from './config.js';
import { createItems } from './items.js';
import { mountView } from './view.js';

document.title = TITLE;
document.getElementById('title').textContent = TITLE;
document.getElementById('tagline').textContent = TAGLINE;

const items = createItems();
const view = mountView(document.getElementById('root'), items);
items.subscribe(view.render);
view.render();
