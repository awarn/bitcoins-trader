"use strict";

require('dotenv').config();

if (!process.env.LOCALBITCOIN_KEY) {
	process.exit(1);
}
if (!process.env.LOCALBITCOIN_SECRET) {
	process.exit(1);
}

const console = require("better-console");
const later = require('later');
const LBCClient = require('localbitcoins-api');
const request = require('request-promise');

// Setup Localbitcoin client
const lbc = new LBCClient(process.env.LOCALBITCOIN_KEY, process.env.LOCALBITCOIN_SECRET);

// Timing
let checkupSched = later.parse.text('every 10 seconds');

let dontGoUnder = 9000;
let undercutAmount = 10;
let paymentMethod = `SWISH`;
let minimumMaxAmountAvailable = 10000;
let minTradeCount = 100;

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

function checkup() {
	(async () => {

		try {
			let user = await getUser();

			// Get our own ad(s) id(s).
			let userAds = await getUserAds();
			let userAdList = userAds.ad_list;
			let userAdIds = userAdList.map((ad) => {
				return ad.data.ad_id;
			});

			// Get the current SEK ads.
			let allAds = await getSellAds();
			let adList = allAds.ad_list;

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

			// Check that we have any ads left.
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
				console.log("target price:", targetPrice);

				// Undercut them
				for (var i = userAdList.length - 1; i >= 0; i--) {
					let data = userAdList[i].data

					console.log("our price:", data.temp_price);

					if (targetPrice < data.temp_price) {
						let params = {
							bank_name: data.bank_name,
							min_amount: data.min_amount,
							require_trusted_by_advertiser: data.require_trusted_by_advertiser,
							track_max_amount: data.track_max_amount,
							lat: data.lat,
							price_equation: data.price_equation, // Changed below
							city: data.city,
							location_string: data.location_string,
							countrycode: data.countrycode,
							currency: data.currency,
							max_amount: data.max_amount,
							lon: data.lon,
							sms_verification_required: data.sms_verification_required,
							opening_hours: data.opening_hours,
							msg: data.msg,
							require_identification: data.require_identification,
							'details-phone_number': data.account_details.phone_number
						}

						// Set our new price
						params.price_equation = targetPrice - undercutAmount;

						let result = await updateAd(data.ad_id, params);
						console.log(`Adjusted ad price: ${data.temp_price} => ${targetPrice - undercutAmount}`);
					} else {
						console.log(`Currently below or at target price.`);
					}
				}
			}

		} catch(e) {
			console.log(e);
		}

	})();
}

// Run it all
let checkupTimer = later.setInterval(checkup, checkupSched);

