/* 
 * The MIT License
 *
 * Copyright 2016 KryptoNova.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
var Bittrex = require("node.bittrex.api");
var util = require('../core/util.js');
var _ = require('lodash');
var moment = require('moment');
var log = require('../core/log');

var Trader = function(config) {
  _.bindAll(this);
  if(_.isObject(config)) {
    this.key = config.key;
    this.secret = config.secret;
  }
  this.name = 'Bittrex';
  this.balance;
  this.price;
  this.pair = config.currency + '-' + config.asset;
  this.bittrex = Bittrex;
  this.bittrex.options({
    'apikey' : this.key,
    'apisecret' : this.secret, 
    'stream' : true,
    'verbose' : false,
    'cleartext' : false 
  });
}

// if the exchange errors we try the same call again after
// waiting 10 seconds
Trader.prototype.retry = function(method, args) {
  var wait = +moment.duration(10, 'seconds');
  log.debug(this.name, 'returned an error, retrying..');

  var self = this;

  // make sure the callback (and any other fn)
  // is bound to Trader
  _.each(args, function(arg, i) {
    if(_.isFunction(arg))
      args[i] = _.bind(arg, self);
  });

  // run the failed method again with the same
  // arguments after wait
  setTimeout(
    function() { method.apply(self, args) },
    wait
  );
}

Trader.prototype.getPortfolio = function(callback) {
  this.bittrex.getbalances(function (data){
    if (!data.success)
      return log.error('unable to get balances', '(', data.message, ')');

    var portfolio = [];
    for (var i = 0; i < data.result.length; i++) {
      portfolio.push({name: data.result[i].Currency,
                      amount: data.result[i].Available});
    }

    callback(!data.success, portfolio);
  });
}

Trader.prototype.getTicker = function(callback) {
  this.bittrex.getticker({market: this.pair}, function (data){
    if (!data.success)
      return log.error('unable to get ticker', '(', data.message, ')');

    callback(!data.success, {bid: +data.result.Bid, ask: +data.result.Ask});
  });
}

// This assumes that only limit orders are being placed, so fees are the
// "maker fee" of 0.25%.  It does not take into account volume discounts.
Trader.prototype.getFee = function(callback) {
    var makerFee = 0.25;
    callback(false, makerFee / 100);
}

Trader.prototype.submit_order = function(type, amount, price, callback) {
  amount = Math.floor(amount*100000000)/100000000;

  if (type == 'buy') {
    this.bittrex.buylimit ({market: this.pair, quantity: amount, rate: price}, function (data) {
      if (!data.success)
        return log.error('unable to buy', data.message);
      callback(!data.success, data.results.uuid);
    });
  } else {
    this.bittrex.selllimit ({market: this.pair, quantity: amount, rate: price}, function (data) {
      if (!data.success)
        return log.error('unable to buy', data.message);
      callback(!data.success, data.results.uuid);
    });
  }
}

Trader.prototype.buy = function(amount, price, callback) {
  this.submit_order('buy', amount, price, callback);
}

Trader.prototype.sell = function(amount, price, callback) {
  this.submit_order('sell', amount, price, callback);
}

Trader.prototype.checkOrder = function(order_id, callback) {
  this.bittrex.getorder({uuid: order_id}, function (data) {
    var is_live = data.result.QuantityRemaining > 0;
    callback(!data.success, is_live)
  });
}

Trader.prototype.cancelOrder = function(order_id, callback) {
  this.bitrex.cancelorder ({uuid: order_id}, function (data) {
    if (!data.success)
      log.error('unable to cancel order', order_id, '(', data.message, ')');
  });
}

Trader.prototype.getTrades = function(since, callback, descending) {
  var args = _.toArray(arguments);
  var self = this;

  var path = {market: this.pair};

  this.bittrex.getmarkethistory(path, function(err, data) {
    if (!err.success)
      return self.retry(self.getTrades, args);
  
    var i, trades = [], timestamp;
    
    for (i = 0; i < err.result.length; i++) {
      timestamp = (new moment(new Date(err.result[i].TimeStamp))).utc().unix();
      trades.push({
          tid: err.result[i].Id,
          date:  timestamp,
          price: +err.result[i].Price,
          amount: +err.result[i].Quantity
      });
    }

    trades.reverse();
    
    callback(null, trades);
  });
}

module.exports = Trader;

