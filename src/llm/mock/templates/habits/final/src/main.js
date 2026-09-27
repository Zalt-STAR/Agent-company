import { createStore } from './store.js';
import { mountList } from './habitList.js';
import { mountForm } from './addHabit.js';

const store = createStore([
  { name: 'Drink water', emoji: '💧' },
  { name: 'Read 20 pages', emoji: '📚' },
  { name: 'Walk outside', emoji: '🏃' },
]);

const list = mountList(document.getElementById('list'), store);
mountForm(document.getElementById('add'), store);
store.subscribe(list.render);
list.render();
