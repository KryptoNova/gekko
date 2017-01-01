var _ = require('lodash');
var util = require('../../core/util.js');
var config = util.getConfig();
var dirs = util.dirs();

var log = require(dirs.core + 'log');
var Manager = require('./portfolioManager');
//var exchangeChecker = require(util.dirs().core + 'exchangeChecker');

var KryptoTrader = function(next) {
  _.bindAll(this);

  this.manager = new Manager(_.extend(config.trader, config.watch));
  this.manager.init(next);

  var TradeB = require(dirs.budfox +'tradeBatcher');
  _.each(this, function(fn, name) {
    TradeB.prototype[name] = fn;
  });
  
  this.tradeB = new TradeB (require(util.dirs().core + 'exchangeChecker')
                            .settings(config.watch).tid);
  //This works to register the all_done in a plugin!!
  var hitIt = function () {
    log.debug("Hit It!!!");
  }
  this.tradeB
    .once('all_loaded', hitIt);
}

util.makeEventEmitter(KryptoTrader);

KryptoTrader.prototype.processAdvice = function(advice) {
  if(advice.recommendation == 'long') {
    log.info(
      'Trader',
      'Received advice to go long.',
      'Buying ', config.trader.asset
    );
    //this.manager.trade('BUY');
  } else if(advice.recommendation == 'short') {
    log.info(
      'Trader',
      'Received advice to go short.',
      'Selling ', config.trader.asset
    );
    //this.manager.trade('SELL');
  }
}

module.exports = KryptoTrader;
