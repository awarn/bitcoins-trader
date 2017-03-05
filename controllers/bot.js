"use strict";

require('dotenv').config();

if (!process.env.LOCALBITCOIN_KEY) {
	process.exit(1);
}
if (!process.env.LOCALBITCOIN_SECRET) {
	process.exit(1);
}

const LBCClient = require('../../localbitcoins-api');
const passport = require('passport');
const redis = require("redis");

const redisClient = redis.createClient();

// Setup Localbitcoin client
const lbc = new LBCClient(process.env.LOCALBITCOIN_KEY, process.env.LOCALBITCOIN_SECRET);

// Get the Localbitcoin user whose key and secret is used.
async function getUser() {
	let method = 'myself';
	return apiCall(method);
}

// Get the Localbitcoin user's ads.
async function getUserAds() {
	let method = 'ads';
	return apiCall(method);
}

async function apiCall(method, ad_id, params) {
	// Display user's info
	return new Promise((resolve, reject) => {
		lbc.api(method, ad_id, params, function(error, response) {
			if(error) {
				reject(error);
			}
			else {
				resolve(response.data);
			}
		});
	});
}

async function redisGet(key) {
	return new Promise((resolve, reject) => {
		redisClient.get(key, function(err, reply) {
			if (err) {
				reject(err);
			} else {
				resolve(reply);
			}
		});
	});
}

async function redisSet(key, value) {
	return new Promise((resolve, reject) => {
		console.log(value);
		if (value) {
			redisClient.set(key, value, function(err, reply) {
				if (err) {
					reject(err);
				} else {
					resolve(reply);
				}
			});
		} else {
			redisClient.del(key, function(err, reply) {
				if (err) {
					reject(err);
				} else {
					resolve(reply);
				}
			});
		}
	});
}

/**
 * GET /bot
 */
exports.index = async (req, res, next) => {

	try {
		let settings = {};
		settings.running = await redisGet("running");
		settings.dontGoUnder = await redisGet("dontGoUnder");
		settings.minimumMaxAmountAvailable = await redisGet("minimumMaxAmountAvailable");
		settings.minTradeCount = await redisGet("minTradeCount");
		settings.paymentMethod = await redisGet("paymentMethod");
		settings.undercutAmount = await redisGet("undercutAmount");

		let lbcUser = await getUser();
		let lbcUserAds = await getUserAds();

		lbcUserAds = lbcUserAds.ad_list.map((ad) => {
			return ad.data;
		});

		res.render('bot', {
			title: 'Bot settings',
			settings: settings,
			lbcUser: lbcUser,
			lbcUserAds: lbcUserAds
		});
	} catch (error) {
		console.log(error);
		next();
	}
	
}

/**
 * POST /bot
 */
exports.postSettings = (req, res, next) => {
	req.assert('dontGoUnder', '"dontGoUnder" cannot be blank').notEmpty();
	req.assert('minimumMaxAmountAvailable', '"minimumMaxAmountAvailable" cannot be blank').notEmpty();
	req.assert('minTradeCount', '"minTradeCount" cannot be blank').notEmpty();
	req.assert('paymentMethod', '"paymentMethod" cannot be blank').notEmpty();
	req.assert('undercutAmount', '"undercutAmount" cannot be blank').notEmpty();

	const errors = req.validationErrors();

	if (errors) {
    req.flash('errors', errors);
    return res.redirect('/bot');
  }

	redisSet("dontGoUnder", req.body.dontGoUnder);
	redisSet("minimumMaxAmountAvailable", req.body.minimumMaxAmountAvailable);
	redisSet("minTradeCount", req.body.minTradeCount);
	redisSet("paymentMethod", req.body.paymentMethod);
	redisSet("undercutAmount", req.body.undercutAmount);

	if (req.body.run) {
		redisSet("running", req.body.run);
	}
	else {
		redisSet("running", null);
	}

	req.flash('success', { msg: 'Bot settings have been updated.' });
	res.redirect('/bot');
  
}
