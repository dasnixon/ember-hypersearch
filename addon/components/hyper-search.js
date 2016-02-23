import Ember from 'ember';
import layout from '../templates/components/hyper-search';

const {
  Component,
  A: emberArray,
  RSVP: { Promise, resolve, reject },
  $: { ajax },
  run: { debounce, bind, cancel },
  get,
  set,
  isBlank,
  isPresent,
  typeOf
} = Ember;

/**
 * Returns the key for the query in the cache. Only works in conjunction with
 * Ember.get.
 *
 * @public
 * @param {String} query
 * @return {String} nested key name
 */
function keyForQuery(query) {
  return `_cache.${query}`;
}

export default Component.extend({
  layout,
  minQueryLength: 3,
  debounceRate: 0,
  endpoint: null,
  resultKey: null,
  placeholder: null,

  init() {
    this._super(...arguments);
    this._cache = {};
    this.results = emberArray();
  },

  didRender() {
    this._super(...arguments);
    if (this.get('clearOnOutsideClick')) {
      Ember.$(document).on('click', this._handleOutsideClick.bind(this));
    }
  },

  willDestroyElement() {
    this._super(...arguments);
    this.removeAllFromCache();
    if (this.get('clearOnOutsideClick')) {
      Ember.$(document).off('click', cancel(this, this._handleOutsideClick.bind(this)));
    }
  },

  cache(query, results) {
    set(this, keyForQuery(query), results);
    this._handleAction('loadingHandler', false);
    return resolve(results);
  },

  removeFromCache(query) {
    delete this._cache[query];
    this.notifyPropertyChange('_cache');
  },

  removeAllFromCache() {
    delete this._cache;
    set(this, '_cache', {});
  },

  clearResults() {
    get(this, 'results').clear();
    this.notifyPropertyChange('results');
  },

  fetch(query) {
    if (isBlank(query) || (query.length < get(this, 'minQueryLength'))) {
      return reject();
    }

    this._handleAction('loadingHandler', true);

    let cachedValue = get(this, keyForQuery(query));

    if (isPresent(cachedValue)) {
      this._handleAction('loadingHandler', false);
      return resolve(cachedValue);
    } else {
      return this.requestAndCache(...arguments);
    }
  },

  /**
   * Override to handle the fetching of data. Must return a `Promise`.
   *
   * @public
   * @method request
   * @param {String} query
   * @return {Promise}
   */
  request(query) {
    return new Promise((resolve, reject) => {
      ajax({
        dataType: 'json',
        method: 'GET',
        url: get(this, 'endpoint'),
        data: { q: query }
      })
      .then(resolve, reject);
    });
  },

  requestAndCache(query) {
    return this.request(query)
      .then((results) => this.cache(query, results))
      .catch((error) => reject(error));
  },

  _search(value = this.$('input').val()) {
    return this.fetch(value)
      .then(bind(this, this._setResults));
  },

  _setResults(results) {
    this._handleAction('handleResults', results);

    return set(this, 'results', results);
  },

  _handleAction(actionName, ...args) {
    if (this.attrs && typeOf(this.attrs[actionName]) === 'function') {
      this.attrs[actionName](...args);
    } else {
      this.sendAction(actionName, ...args);
    }
  },

  _handleOutsideClick(event) {
    let $element = this.$();
    let $target = $(event.target);

    if (isBlank($element.children($target)) && isBlank($target.closest($element))) {
      this.set('showResults', false);
    }
  },

  click() {
    this.set('showResults', true);
  },

  actions: {
    search(_event, query) {
      debounce(this, '_search', query, get(this, 'debounceRate'), true);
    },

    selectResult(result) {
      this._handleAction('selectResult', result);
    }
  }
});
