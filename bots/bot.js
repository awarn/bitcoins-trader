"use strict";

require('dotenv').config();

if (!process.env.LOCALBITCOIN_KEY) {
	process.exit(1);
}
if (!process.env.LOCALBITCOIN_SECRET) {
	process.exit(1);
}

const console = require("better-console");
const later = require("later");
const LBCClient = require("/Users/antonwarnhag/Code/localbitcoins-api");
const redis = require("redis");
const request = require("request-promise");

const client = redis.createClient(process.env.REDIS_URL);

// Setup Localbitcoin client
const lbc = new LBCClient(process.env.LOCALBITCOIN_KEY, process.env.LOCALBITCOIN_SECRET);

// Timing
let checkupSched = later.parse.text('every 10 seconds');
let checkupTimer;

async function getRedis(key) {
	return new Promise((resolve, reject) => {
		client.get(key, function(err, reply) {
			if (err) {
				reject(err);
			} else {
				resolve(reply);
			}
		});
	});
}

async function setRedis(key, value) {
	return new Promise((resolve, reject) => {
		client.set(key, value, function(err, reply) {
			if (err) {
				reject(err);
			} else {
				resolve(reply);
			}
		});
	});
}

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

async function getCurrencies() {
	let method = 'currencies';
	return apiCall(method);
}

async function getCountryCodes() {
	let method = 'countrycodes';
	return apiCall(method);
}

async function updateAd(adId, params) {
	let method = 'ad';
	return apiCall(method, adId, params);
}

// Get listed buy ads
async function getBuyAds() {
	let method = 'buy-bitcoins-online';
	let params = {
		path: 'SEK'
	};
	return apiCall(method, null, params);
}

// Get listed sell ads
async function getSellAds() {
	let method = 'sell-bitcoins-online';
	let params = {
		path: 'SEK'
	};
	return apiCall(method, null, params);
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

function prepareAdjustAdParams(userAdData) {
	let params = {
		bank_name: userAdData.bank_name,
		min_amount: userAdData.min_amount,
		require_trusted_by_advertiser: userAdData.require_trusted_by_advertiser,
		track_max_amount: userAdData.track_max_amount,
		lat: userAdData.lat,
		price_equation: userAdData.price_equation,
		city: userAdData.city,
		location_string: userAdData.location_string,
		countrycode: userAdData.countrycode,
		currency: userAdData.currency,
		max_amount: userAdData.max_amount,
		lon: userAdData.lon,
		sms_verification_required: userAdData.sms_verification_required,
		opening_hours: userAdData.opening_hours,
		msg: userAdData.msg,
		require_identification: userAdData.require_identification,
		'details-phone_number': userAdData.account_details.phone_number
	}
	return params;
}

async function checkup() {

	console.log("Checkup...");

	try {
		let running = await getRedis("running");
		if (!running) {
			console.log("Not running");
			return "Not running.";
		}
	} catch (error) {
		throw error;
	}

	let dontGoUnder, 
	undercutAmount, 
	paymentMethod, 
	minimumMaxAmountAvailable, 
	minTradeCount;

	try {
		dontGoUnder = await getRedis("dontGoUnder");
		undercutAmount = await getRedis("undercutAmount");
		paymentMethod = await getRedis("paymentMethod");
		minimumMaxAmountAvailable = await getRedis("minimumMaxAmountAvailable");
		minTradeCount = await getRedis("minTradeCount");;
	} catch (error) {
		throw(error);
	}

	if (!dontGoUnder) {
		dontGoUnder = 10000;
	}

	if (!undercutAmount) {
		undercutAmount = 10;
	}
	
	if (!paymentMethod) {
		paymentMethod = `SWISH`;
	}

	if (!minimumMaxAmountAvailable) {
		minimumMaxAmountAvailable = 10000;
	}
	
	if (!minTradeCount) {
		minTradeCount = 100;
	}

	try {
		let user = await getUser();

		// Get our own ad(s) id(s).
		let userAds = await getUserAds();
		let userAdList = userAds.ad_list;
		if (!(userAdList && userAdList.length)) {
			throw `User has no ads running.`;
		}

		for (var i = userAdList.length - 1; i >= 0; i--) {
			let data = userAdList[i].data
			console.log("Our price:", data.temp_price);

			if (data.temp_price < dontGoUnder) {
				console.log(`Current ad value (${data.temp_price}) is below 'dontGoUnder' value. Adjusting...`);

				let params = prepareAdjustAdParams(data);
				params.price_equation = dontGoUnder;

				let result = await updateAd(data.ad_id, params);
				console.log(`Adjusted ad price: ${data.temp_price} => ${dontGoUnder}`);
			}
		}

		// Get an array of our ads ids for filtering ads further down.
		let userAdIds = userAdList.map((ad) => {
			return ad.data.ad_id;
		});

		// Get the current SEK ads.
		let allAds = await getSellAds();
		let adList = allAds.ad_list;
		if (!(userAdList && userAdList.length)) {
			throw `Could not find any ads listed on Localbitcoin website. There is likely an error with the bots connection to it.`
		}

		// Filter out our own ad.
		adList = adList.filter((ad) => {
			return userAdIds.includes(ad.data.ad_id) == false;
		});
		// Filter out those not using our preferred payment method.
		adList = adList.filter((ad) => {
			return ad.data.online_provider == paymentMethod;
		});
		// Filter out ads not competing in trade bulk.
		adList = adList.filter((ad) => {
			return ad.data.max_amount_available > minimumMaxAmountAvailable;
		});
		// Filter out ads below or lowest threshold.
		adList = adList.filter((ad) => {
			return ad.data.temp_price - undercutAmount > dontGoUnder;
		});

		// Check that we have any ads left.
		if (!(adList && adList.length)) {
			console.log(`No competing ads passed filters.`);
			return `No competing ads passed filters.`;
		}

		// If we are in the top three, only compete with those
		// with a significant number of trades.
		let inTopThree = false;
		for (let i = 0; i < adList.length; i++) {
			if (i < 3) {
				if (userAdIds.includes(adList[i].data.ad_id)) {
					inTopThree = true;
				}
			}
		}
		if (inTopThree) {
			adList = adList.filter((ad) => {
				let trade_count = ad.data.profile.trade_count.replace(/\+$/, '');
				return trade_count > minTradeCount;
			});
		}

		if (adList.length > 0) {

			// Sort the remaining ads by temp_price.
			adList.sort((a, b) => {
				if (a.data.temp_price < b.data.temp_price) {
					return -1;
				}
				else if (a.data.temp_price > b.data.temp_price) {
					return 1;
				}
				else {
					return 0;
				}
			});

			for (var i = adList.length - 1; i >= 0; i--) {
				let data = adList[i].data
				console.log(data.ad_id, data.profile.username, data.temp_price);
			}

			// Get the lowest price of the remaining.
			let targetPrice = adList[0].data.temp_price;
			console.log("Target price:", targetPrice);

			// Undercut them
			for (var i = userAdList.length - 1; i >= 0; i--) {
				let data = userAdList[i].data;

				console.log("Our price:", data.temp_price);

				let params = prepareAdjustAdParams(data);

				// Set our new price
				let newPriceEquation = targetPrice - undercutAmount;

				if (newPriceEquation == data.price_equation) {
					console.log(`Same value as earlier.`);
				}
				else {
					if (dontGoUnder > newPriceEquation) {
						console.log(`Reached "don't go under" value.`);
						params.price_equation = dontGoUnder;
					}
					else {
						console.log(`Adjusting ad price: ${data.temp_price} => ${targetPrice - undercutAmount} ...`);
						params.price_equation = newPriceEquation;
					}
					let result = await updateAd(data.ad_id, params);
					console.log(result);
				}
			}
		}

	} catch(error) {
		throw error;
	}

	console.log(`Checkup done.`);

}

function start() {
	console.log("Bot started...");
	checkupTimer = later.setInterval(async () => {
		try {
			await checkup();
		} catch (error) {
			console.log(error);
		}
	}, checkupSched);
}

function stop() {
	console.log("Bot stopped.");
	if (checkupTimer) {
		checkupTimer.clear();	
	}
}

exports.start = start;
exports.stop = stop;

