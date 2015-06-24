'use strict';

var fs = require('fs');
var utils = require('./utils');
var unique = utils.unique('vpaidIframe');
var VPAIDAdUnit = require('./VPAIDAdUnit');
var defaultTemplate = fs.readFileSync(__dirname + '/iframe.template.html', 'utf8');

/**
 * This callback is displayed as global member. The callback use nodejs error-first callback style
 * @callback NodeStyleCallback
 * @param {string|null}
 * @param {undefined|object}
 */

/**
 * VPAIDHTML5Client
 * @class
 *
 * @param {HTMLElement} el that will contain the iframe to load adUnit and a el to add to adUnit slot
 * @param {HTMLVideoElement} video default video element to be used by adUnit
 * @param {object} [templateConfig] template: html template to be used instead of the default, extraOptions: to be used when rendering the template
 * @param {object} [vpaidOptions] timeout: when loading adUnit
 */
function VPAIDHTML5Client(el, video, templateConfig, vpaidOptions) {
    templateConfig = templateConfig || {};

    this._id = unique();
    this._destroyed = false;

    this._el = utils.createElementInEl(el, 'div', this._id);
    this._frameContainer = utils.createElementInEl(this._el, 'div');
    this._adElContainer = utils.createElementInEl(this._el, 'div');
    this._adElContainer.className = 'adEl';
    this._videoEl = video;
    this._vpaidOptions = vpaidOptions || {timeout: 1000};

    this._templateConfig = {
        template: templateConfig.template || defaultTemplate,
        extraOptions: templateConfig.extraOptions || {}
    };

}

/**
 * destroy
 *
 */
VPAIDHTML5Client.prototype.destroy = function destroy() {
    this._destroyed = true;
    this.unloadAdUnit();
}

/**
 * isDestroyed
 *
 * @return {boolean}
 */
VPAIDHTML5Client.prototype.isDestroyed = function isDestroyed() {
    return this._destroyed;
}

/**
 * loadAdUnit
 *
 * @param {string} adURL url of the js of the adUnit
 * @param {nodeStyleCallback} callback
 */
VPAIDHTML5Client.prototype.loadAdUnit = function loadAdUnit(adURL, callback) {
    $throwIfDestroyed.call(this);

    this._frame = utils.createIframeWithContent(
        this._frameContainer,
        this._templateConfig.template,
        utils.extend({
            iframeURL_JS: adURL,
            iframeID: this.getID()
        }, this._templateConfig.extraOptions)
    );

    //TODO maybe rethink the timeout if is too hidden logic
    this._onLoad = utils.callbackTimeout(
        this._vpaidOptions.timeout,
        onLoad.bind(this),
        onTimeout.bind(this)
    );

    window.addEventListener('message', this._onLoad);

    function onLoad (e) {
        //don't clear timeout
        if (e.origin !== window.location.origin) return;

        var result = JSON.parse(e.data);

        //don't clear timeout
        if (result.id !== this.getID()) return;

        var adUnit, error;
        if (!this._frame.contentWindow) {

            error = 'the iframe is not anymore in the DOM tree';

        } else {
            var createAd = this._frame.contentWindow.getVPAIDAd;
            error = utils.validate(typeof createAd === 'function', 'the ad didn\'t return a function to create an ad');
        }

        if (!error) {
            adUnit = new VPAIDAdUnit(createAd(), this._adElContainer, this._videoEl);
            error = utils.validate(adUnit.isValidVPAIDAd(), 'the add is not fully complaint with VPAID specification');
        }

        this._adUnit = adUnit;
        $destroyLoadListener.call(this);
        callback(error, error ? null : adUnit);

        //clear timeout
        return true;
    }

    function onTimeout() {
        callback('timeout', null);
    }
}

/**
 * unloadAdUnit
 *
 */
VPAIDHTML5Client.prototype.unloadAdUnit = function unloadAdUnit() {
    $destroyLoadListener.call(this);

    $removeEl.call(this, '_frame');
    $removeEl.call(this, '_adEl');

    if (this._adUnit) {
        this._adUnit.stopAd();
        delete this._adUnit;
    }

}

/**
 * getID will return the unique id
 *
 * @return {string}
 */
VPAIDHTML5Client.prototype.getID = function () {
    return this._id;
}

/**
 * $removeEl
 *
 * @param {string} key
 * @param {HTMLElement} parent
 */
function $removeEl(key, parent) {
    if (this[key]) {
        this[key].parentElement.remove(this[key]);
        delete this[key];
    }
}

/**
 * $destroyLoadListener
 *
 */
function $destroyLoadListener() {
    if (this._onLoad) {
        window.removeEventListener('message', this._onLoad);
        utils.clearCallbackTimeout(this._onLoad);
        delete this._onLoad;
    }
}

/**
 * $throwIfDestroyed
 *
 */
function $throwIfDestroyed() {
    if (this._destroyed) {
        throw new Error ('VPAIDHTML5Client already destroyed!');
    }
}

module.exports = VPAIDHTML5Client;
window.VPAIDHTML5Client = VPAIDHTML5Client;

